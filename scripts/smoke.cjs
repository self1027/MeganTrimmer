// Real Electron/Chromium smoke tests. Artifacts and settings stay in .cache/.
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const artifacts = path.join(root, '.cache', 'ui-smoke');
fs.mkdirSync(artifacts, { recursive: true });
app.setPath('userData', path.join(artifacts, 'user-data'));
app.setPath('sessionData', path.join(artifacts, 'session-data'));
fs.mkdirSync(app.getPath('userData'), { recursive: true });
fs.writeFileSync(path.join(app.getPath('userData'), 'settings.json'), JSON.stringify({ outputFolder: artifacts }));
const first = path.join(artifacts, 'primeiro.mp4');
const second = path.join(artifacts, 'segundo.mp4');
const ffmpeg = require('ffmpeg-static');
for (const [file, color] of [[first, '0x285e43'], [second, '0x396184']]) {
  const generated = spawnSync(ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=${color}:size=1280x720:rate=30`,
    '-f', 'lavfi', '-i', 'sine=frequency=440', '-t', '2', '-c:v', 'libx264', '-c:a', 'aac', file]);
  assert.equal(generated.status, 0, generated.stderr.toString());
}
const failures = [];
setTimeout(() => { console.error('Smoke test exceeded two minutes.'); app.exit(1); }, 120000).unref();
let window;
const evaluate = code => window.webContents.executeJavaScript(code);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(code) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) { if (await evaluate(code)) return; await pause(40); }
  throw new Error(`Timeout: ${code}`);
}
async function check(name, action) { await action(); console.log(`PASS ${name}`); }
const load = file => evaluate(`import('./modules/video.js').then(m => m.loadVideoFromPath(${JSON.stringify(file)}))`);
const currentPath = () => evaluate(`import('./modules/state.js').then(m => m.state.selectedPath)`);
const changeFps = () => evaluate(`document.querySelector('#frameRateSelect').value='24';document.querySelector('#frameRateSelect').dispatchEvent(new Event('change',{bubbles:true}));`);

app.whenReady().then(async () => {
  const { registerIpcHandlers } = await import(pathToFileURL(path.join(root, 'dist/main/ipc/index.js')));
  const { registerExportIpc } = await import(pathToFileURL(path.join(root, 'dist/main/ipc/export.js')));
  registerIpcHandlers();
  let revealFails = false;
  let revealCalls = 0;
  ipcMain.removeHandler('show-in-folder');
  ipcMain.handle('show-in-folder', () => { revealCalls++; if (revealFails) throw new Error('Explorer indisponível'); });
  window = new BrowserWindow({ width: 900, height: 700, show: false, webPreferences: {
    preload: path.join(root, 'dist/preload.js'), contextIsolation: true, nodeIntegration: false,
    backgroundThrottling: false,
  } });
  window.webContents.on('console-message', (_event, level, message) => { if (level === 3) failures.push(message); });
  window.webContents.on('preload-error', (_event, _file, error) => failures.push(String(error)));
  await window.loadFile(path.join(root, 'dist/renderer/index.html'));
  await until(`document.querySelector('#formatSelect').options.length === 6`);
  await check('empty state and controls', async () => {
    assert.equal(await evaluate(`document.querySelector('#btn').disabled`), true);
    fs.writeFileSync(path.join(artifacts, 'empty-900x700.png'), (await window.webContents.capturePage()).toPNG());
  });
  await check('expanded destination fits the minimum window without an empty feedback gap', async () => {
    await evaluate(`document.querySelector('#settingsToggle').click()`);
    await pause(250);
    const layout = await evaluate(`(() => {
      const sidebar = document.querySelector('.right-sidebar');
      const panel = document.querySelector('#settingsPanel');
      const feedback = document.querySelector('.export-feedback');
      return { overflow: sidebar.scrollHeight - sidebar.clientHeight, feedbackHeight: feedback.getBoundingClientRect().height, expanded: document.querySelector('#settingsToggle').getAttribute('aria-expanded') };
    })()`);
    console.log('Destination layout:', layout);
    assert.equal(layout.expanded, 'true');
    assert.equal(layout.feedbackHeight, 0, 'No empty status space before exporting');
    assert.ok(layout.overflow <= 1, `Sidebar overflows by ${layout.overflow}px`);
    await window.webContents.capturePage();
    await pause(150);
    fs.writeFileSync(path.join(artifacts, 'destination-expanded-900x700.png'), (await window.webContents.capturePage()).toPNG());
    await evaluate(`document.querySelector('#settingsToggle').click()`);
  });
  await check('native video load and clean baseline', async () => {
    await load(first);
    assert.equal(await currentPath(), first);
    assert.equal(await evaluate(`import('./modules/session.js').then(m=>m.hasUnsavedChanges())`), false);
    assert.equal(await evaluate(`document.querySelector('#btn').disabled`), false);
    await until(`document.querySelectorAll('.frame-thumb').length > 0`);
    fs.writeFileSync(path.join(artifacts, 'loaded-900x700.png'), (await window.webContents.capturePage()).toPNG());
  });
  await check('native drop and cancel keep the current cut', async () => {
    await changeFps();
    window.webContents.debugger.attach('1.3');
    for (const type of ['dragEnter', 'dragOver', 'drop']) {
      await window.webContents.debugger.sendCommand('Input.dispatchDragEvent', {
        type, x: 200, y: 200, data: { items: [], files: [second], dragOperationsMask: 1 },
      });
    }
    window.webContents.debugger.detach();
    await until(`document.querySelector('#replaceDialog').open`);
    await evaluate(`document.querySelector('button[value="cancel"]').click()`);
    await until(`import('./modules/state.js').then(m=>!m.state.loading)`);
    assert.equal(await currentPath(), first);
    assert.equal(await evaluate(`document.querySelector('#frameRateSelect').value`), '24');
  });
  await check('discard opens the next video and resets edits', async () => {
    await evaluate(`void import('./modules/video.js').then(m=>m.loadVideoFromPath(${JSON.stringify(second)}))`);
    await until(`document.querySelector('#replaceDialog').open`);
    await evaluate(`document.querySelector('button[value="discard"]').click()`);
    await until(`import('./modules/state.js').then(m=>m.state.selectedPath===${JSON.stringify(second)} && !m.state.loading)`);
    assert.equal(await evaluate(`document.querySelector('#frameRateSelect').value`), 'original');
  });
  await check('invalid video preserves the current source', async () => {
    await load(path.join(artifacts, 'missing.mp4'));
    assert.equal(await currentPath(), second);
    assert.equal(await evaluate(`document.querySelector('#exportStatus').dataset.kind`), 'error');
  });
  await check('failed export preserves dirty state and blocks switching', async () => {
    await changeFps();
    let finish;
    ipcMain.removeHandler('trim-video');
    ipcMain.handle('trim-video', () => new Promise(resolve => { finish = resolve; }));
    await evaluate(`void import('./modules/export.js').then(m=>m.exportCurrentCut())`);
    await until(`document.querySelector('#btn').disabled`);
    await load(first);
    assert.equal(await currentPath(), second);
    finish({ ok: false, error: { message: 'Falha simulada', details: 'Diagnóstico simulado' } });
    await until(`!document.querySelector('#btn').disabled`);
    assert.equal(await evaluate(`import('./modules/session.js').then(m=>m.hasUnsavedChanges())`), true);
    ipcMain.removeHandler('trim-video');
    ipcMain.handle('trim-video', () => ({ ok: false, error: { message: 'Falha antes de trocar', details: '' } }));
    await evaluate(`void import('./modules/video.js').then(m=>m.loadVideoFromPath(${JSON.stringify(first)}))`);
    await until(`document.querySelector('#replaceDialog').open`);
    await evaluate(`document.querySelector('button[value="export"]').click()`);
    await until(`import('./modules/state.js').then(m=>!m.state.loading && !m.state.exporting && document.querySelector('#statusMessage').textContent==='Falha antes de trocar')`);
    assert.equal(await currentPath(), second);
    ipcMain.removeHandler('trim-video'); registerExportIpc();
  });
  await check('consecutive loads ignore a late validation response', async () => {
    await evaluate(`document.querySelector('#frameRateSelect').value='original';document.querySelector('#frameRateSelect').dispatchEvent(new Event('change',{bubbles:true}));`);
    const { validateVideoPath } = await import(pathToFileURL(path.join(root, 'dist/main/services/validation.js')));
    ipcMain.removeHandler('validate-video');
    ipcMain.handle('validate-video', async (_event, file) => {
      if (file === first) await pause(500);
      const info = await validateVideoPath(file);
      return { ok: true, info, url: pathToFileURL(file).href, name: path.basename(file) };
    });
    await evaluate(`void import('./modules/video.js').then(m=>m.loadVideoFromPath(${JSON.stringify(first)}))`);
    await load(second);
    await pause(600);
    assert.equal(await currentPath(), second);
    assert.equal(await evaluate(`document.querySelector('#fileName').textContent`), 'segundo.mp4');
    assert.equal(await evaluate(`document.querySelector('#btn').disabled`), false);
  });
  await check('keyboard navigation and time selection', async () => {
    await evaluate(`document.querySelector('#startRange').focus()`);
    window.webContents.debugger.attach('1.3');
    await window.webContents.debugger.sendCommand('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    await window.webContents.debugger.sendCommand('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    window.webContents.debugger.detach();
    await until(`Number(document.querySelector('#startRange').value)>0`);
    assert.equal(await evaluate(`import('./modules/session.js').then(m=>m.hasUnsavedChanges())`), true);
    await evaluate(`document.querySelector('#startRange').value='0';document.querySelector('#startRange').dispatchEvent(new Event('input',{bubbles:true}));`);
  });
  await check('export succeeds inline and reveals the file only on request', async () => {
    await changeFps();
    revealFails = true;
    await evaluate(`window.progressEvents=[];window.stopProgress=window.api.onExportProgress(p=>{window.progressEvents.push(p)});void 0;`);
    await evaluate(`void import('./modules/video.js').then(m=>m.loadVideoFromPath(${JSON.stringify(first)}))`);
    await until(`document.querySelector('#replaceDialog').open`);
    await evaluate(`document.querySelector('button[value="export"]').click()`);
    await until(`import('./modules/state.js').then(m=>m.state.selectedPath===${JSON.stringify(first)} && !m.state.loading && !m.state.exporting)`);
    assert.ok((await evaluate('window.progressEvents.length')) > 0);
    await evaluate('window.stopProgress()');
    await changeFps();
    assert.equal(await evaluate(`import('./modules/export.js').then(m=>m.exportCurrentCut())`), true);
    assert.equal(revealCalls, 0, 'Export must not open Explorer automatically');
    assert.equal(await evaluate(`document.querySelector('#statusMessage').textContent`), '✓ Clipe salvo');
    assert.equal(await evaluate(`document.querySelector('#exportStatus').dataset.kind`), 'success');
    assert.equal(await evaluate(`document.querySelector('#statusDetails').hidden`), true);
    assert.equal(await evaluate(`document.querySelector('#openExportFolder').hidden`), false);
    await window.webContents.capturePage();
    await pause(150);
    fs.writeFileSync(path.join(artifacts, 'exported-900x700.png'), (await window.webContents.capturePage()).toPNG());
    await evaluate(`document.querySelector('#openExportFolder').click()`);
    await until(`document.querySelector('#statusMessage').textContent.includes('Não foi possível abrir a pasta')`);
    assert.equal(revealCalls, 1);
    assert.equal(await evaluate(`document.querySelector('#exportStatus').dataset.kind`), 'success');
    revealFails = false;
    await evaluate(`document.querySelector('#openExportFolder').click()`);
    await until(`!document.querySelector('#openExportFolder').disabled`);
    assert.equal(revealCalls, 2);
    await load(second);
    assert.equal(await evaluate(`document.querySelector('#exportStatus').hidden`), true);
  });
  await check('desktop layout and reduced motion', async () => {
    window.setSize(1600, 900);
    await pause(350);
    fs.writeFileSync(path.join(artifacts, 'loaded-1600x900.png'), (await window.webContents.capturePage()).toPNG());
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true);
    window.webContents.debugger.attach('1.3');
    await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('#replaceDialog')).transitionDuration`), '0s');
    window.webContents.debugger.detach();
  });
  assert.deepEqual(failures, [], 'Renderer errors');
  console.log(`Artifacts: ${artifacts}`);
  window.destroy(); app.exit(0);
}).catch(error => { console.error(error); window?.destroy(); app.exit(1); });
