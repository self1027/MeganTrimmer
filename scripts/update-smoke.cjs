// Real renderer/preload/main integration with an updater that never uses the network or installs files.
const { app, BrowserWindow, dialog } = require('electron');
const { EventEmitter } = require('node:events');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const artifacts = path.join(root, '.cache/update-smoke');
fs.mkdirSync(artifacts, { recursive: true });
app.setPath('userData', path.join(artifacts, 'user-data'));
fs.mkdirSync(app.getPath('userData'), { recursive: true });
fs.writeFileSync(path.join(app.getPath('userData'), 'settings.json'), JSON.stringify({ outputFolder: '', silentUpdates: false }));
let window;
const evaluate = code => window.webContents.executeJavaScript(code);
async function until(code) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await evaluate(code)) return;
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  throw new Error(`Timeout: ${code}`);
}
setTimeout(() => { console.error('Update smoke timed out'); app.exit(1); }, 30000).unref();

app.whenReady().then(async () => {
  const fromBuild = file => import(pathToFileURL(path.join(root, 'dist', file)).href);
  const { UpdateService } = await fromBuild('main/services/updater.js');
  const { setupUpdates } = await fromBuild('main/updates.js');
  const { registerIpcHandlers } = await fromBuild('main/ipc/index.js');
  const updater = new EventEmitter();
  let downloads = 0;
  let prompts = 0;
  const installs = [];
  updater.checkForUpdates = async () => { updater.emit('update-available', { version: '1.3.1' }); return null; };
  updater.downloadUpdate = async () => { downloads++; updater.emit('download-progress', { percent: 25 }); return []; };
  updater.quitAndInstall = (...args) => { installs.push(args); };
  dialog.showMessageBox = async () => { prompts++; return { response: 0 }; };
  const service = new UpdateService(updater, '1.3.0');
  registerIpcHandlers(settings => service.setSilent(settings.silentUpdates));
  window = new BrowserWindow({ show: false, width: 900, height: 700, webPreferences: {
    preload: path.join(root, 'dist/preload.js'), contextIsolation: true, nodeIntegration: false,
  } });
  setupUpdates(window, service);
  const errors = [];
  window.webContents.on('preload-error', (_event, _file, error) => errors.push(String(error)));
  window.webContents.on('console-message', (_event, level, message) => { if (level === 3) errors.push(message); });
  await window.loadFile(path.join(root, 'dist/renderer/index.html'));
  await until(`!document.querySelector('#updateNotice').hidden`);
  assert.equal(downloads, 0);
  assert.equal(await evaluate(`document.querySelector('#appVersion').textContent`), 'v1.3.0');
  await evaluate(`document.querySelector('#updateNotice').click()`);
  assert.equal(await evaluate(`document.querySelector('#updateSettings').open`), true);
  assert.equal(await evaluate(`document.querySelector('#downloadUpdate').hidden`), false);
  console.log('PASS announce update without auto-download');

  await evaluate(`document.querySelector('#downloadUpdate').click()`);
  await until(`document.querySelector('#updateProgress').value === 25`);
  assert.equal(downloads, 1);
  updater.emit('error', new Error('checksum mismatch'));
  await until(`document.querySelector('#updateStatus').textContent.includes('Não foi possível')`);
  assert.deepEqual(installs, []);
  await evaluate(`document.querySelector('#downloadUpdate').click()`);
  await until(`document.querySelector('#updateProgress').value === 25`);
  updater.emit('update-downloaded', { version: '1.3.1' });
  await until(`!document.querySelector('#installUpdate').hidden`);
  assert.equal(downloads, 2);
  console.log('PASS progress, failure recovery and ready notification');

  await evaluate(`window.api.reportEditorDirty(true)`);
  assert.equal(await evaluate(`window.api.installUpdate()`), false);
  assert.equal(prompts, 1);
  assert.equal(window.isDestroyed(), false);
  window.close();
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(prompts, 2);
  assert.equal(window.isDestroyed(), false);
  assert.deepEqual(installs, []);
  console.log('PASS cancelling restart or close preserves the window');

  await evaluate(`document.querySelector('#silentUpdates').click()`);
  await until(`!document.querySelector('#silentUpdates').disabled`);
  let settings = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'settings.json')));
  assert.equal(settings.silentUpdates, true);
  await evaluate(`window.api.setSettings({ outputFolder: 'C:\\clips' })`);
  settings = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'settings.json')));
  assert.equal(settings.silentUpdates, true);
  await evaluate(`window.api.reportEditorDirty(false)`);
  await new Promise(resolve => setTimeout(resolve, 50));
  window.close();
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.deepEqual(installs, [[true, false]]);
  updater.emit('error', new Error('installer could not start'));
  await evaluate(`window.api.reportEditorDirty(true)`);
  await new Promise(resolve => setTimeout(resolve, 50));
  window.close();
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(prompts, 3, 'Installer error must restore the dirty-edit close guard');
  assert.equal(window.isDestroyed(), false);
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(artifacts, 'updates.png'), (await window.webContents.capturePage()).toPNG());
  console.log('PASS silent enabled after download installs on close without relaunch');
  console.log('PASS failed installer restores the close guard');
  window.destroy(); app.exit(0);
}).catch(error => { console.error(error); window?.destroy(); app.exit(1); });
