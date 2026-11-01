// Real renderer/preload/main IPC; the update choice blocks editing and never installs real files.
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
fs.writeFileSync(path.join(app.getPath('userData'), 'settings.json'), JSON.stringify({ outputFolder: '', silentUpdates: true }));
let window;
const evaluate = code => window.webContents.executeJavaScript(code);
async function until(code) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await evaluate(code)) return;
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  throw new Error('Timeout: ' + code);
}
setTimeout(() => { console.error('Update smoke timed out'); app.exit(1); }, 30000).unref();

app.whenReady().then(async () => {
  const fromBuild = file => import(pathToFileURL(path.join(root, 'dist', file)).href);
  const { UpdateService } = await fromBuild('main/services/updater.js');
  const { setupUpdates } = await fromBuild('main/updates.js');
  const { registerIpcHandlers } = await fromBuild('main/ipc/index.js');
  const updater = new EventEmitter();
  let downloads = 0, prompts = 0, normalCloses = 0;
  const installs = [];
  updater.checkForUpdates = async () => { updater.emit('update-available', { version: '1.3.1' }); return null; };
  updater.downloadUpdate = async () => { downloads++; updater.emit('download-progress', { percent: 25 }); return []; };
  updater.quitAndInstall = (...args) => { installs.push(args); };
  dialog.showMessageBox = async () => { prompts++; return { response: 0 }; };
  app.quit = () => { normalCloses++; };
  const service = new UpdateService(updater, '1.3.0');
  registerIpcHandlers();
  window = new BrowserWindow({ show: false, width: 900, height: 700, webPreferences: {
    preload: path.join(root, 'dist/preload.js'), contextIsolation: true, nodeIntegration: false,
  } });
  setupUpdates(window, service);
  const errors = [];
  window.webContents.on('preload-error', (_event, _file, error) => errors.push(String(error)));
  window.webContents.on('console-message', (_event, level, message) => { if (level === 3) errors.push(message); });
  await window.loadFile(path.join(root, 'dist/renderer/index.html'));
  await until("document.querySelector('#updateDialog')?.open");
  assert.equal(await evaluate("document.querySelectorAll('#updateDialog button').length"), 2);
  assert.equal(await evaluate("document.querySelector('#updateDialog').matches(':modal')"), true);
  assert.equal(await evaluate("document.querySelector('#silentUpdates')"), null);
  assert.equal(await evaluate("document.querySelector('#updateDialog a').href"), 'https://github.com/self1027/megan-trimmer/releases/latest');
  await evaluate("document.querySelector('#updateDialog').dispatchEvent(new Event('cancel',{cancelable:true}))");
  assert.equal(await evaluate("document.querySelector('#updateDialog').open"), true);
  assert.equal(downloads, 0);
  await new Promise(resolve => setTimeout(resolve, 250));
  fs.writeFileSync(path.join(artifacts, 'update-choice.png'), (await window.webContents.capturePage()).toPNG());
  await evaluate("document.querySelector('#skipUpdate').click()");
  assert.equal(await evaluate("document.querySelector('#updateDialog').open"), false);
  await service.check();
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(await evaluate("document.querySelector('#updateDialog').open"), false, 'Do not nag for the declined version');
  assert.deepEqual(installs, []);
  console.log('PASS two buttons and GitHub link require a choice; declining keeps the editor usable');

  await evaluate("document.querySelector('#checkUpdates').click()");
  await until("document.querySelector('#updateDialog').open");
  await evaluate("document.querySelector('#updateNow').click()");
  await until("document.querySelector('#updateProgress').value === 25");
  assert.equal(downloads, 1);
  await evaluate("document.querySelector('#skipUpdate').click()");
  updater.emit('update-downloaded', { version: '1.3.1' });
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(await evaluate("document.querySelector('#updateDialog').open"), false);
  assert.deepEqual(installs, [], 'Continuing during download must cancel any planned restart');
  updater.emit('error', new Error('cached installer missing'));
  await evaluate("document.querySelector('#checkUpdates').click()");
  await until("document.querySelector('#updateDialog').open");
  await evaluate("document.querySelector('#updateNow').click()");
  await until("document.querySelector('#updateProgress').value === 25");
  assert.equal(downloads, 2);
  updater.emit('error', new Error('checksum mismatch'));
  await until("document.querySelector('#updateStatus').textContent.includes('Não foi possível')");
  assert.deepEqual(installs, []);
  await evaluate("document.querySelector('#updateNow').click()");
  await until("document.querySelector('#updateProgress').value === 25");
  await evaluate("window.api.reportEditorDirty(true)");
  updater.emit('update-downloaded', { version: '1.3.1' });
  await until("document.querySelector('#updateStatus').textContent.includes('continuar editando')");
  assert.equal(downloads, 3);
  assert.equal(prompts, 1);
  assert.deepEqual(installs, []);
  await evaluate("document.querySelector('#skipUpdate').click()");
  console.log('PASS failed download and cancelled discard allow continuing without installation');

  await evaluate("window.api.reportEditorDirty(false); document.querySelector('#checkUpdates').click()");
  await until("document.querySelector('#updateDialog').open");
  await evaluate("document.querySelector('#updateNow').click()");
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.deepEqual(installs, [[true, true]]);
  updater.emit('error', new Error('installer could not start'));
  await until("document.querySelector('#updateStatus').textContent.includes('Não foi possível')");
  await evaluate("window.api.reportEditorDirty(true)");
  await new Promise(resolve => setTimeout(resolve, 50));
  window.close();
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(prompts, 2);
  assert.equal(window.isDestroyed(), false);
  await evaluate("document.querySelector('#skipUpdate').click(); window.api.reportEditorDirty(false)");
  await new Promise(resolve => setTimeout(resolve, 50));
  window.close();
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(normalCloses, 1);
  assert.deepEqual(installs, [[true, true]], 'Normal close must never install an update');
  assert.deepEqual(errors, []);
  console.log('PASS explicit restart only; normal close never installs');
  window.destroy(); app.exit(0);
}).catch(error => { console.error(error); window?.destroy(); app.exit(1); });
