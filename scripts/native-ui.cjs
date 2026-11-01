// Controls only the packaged test app on a disposable GitHub-hosted Windows runner.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
if (process.env.GITHUB_ACTIONS !== 'true' || process.env.RUNNER_ENVIRONMENT !== 'github-hosted') {
  throw new Error('Native installer tests may only run on disposable GitHub-hosted runners.');
}
const [mode, expectedVersion, source] = process.argv.slice(2);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function connection(port) {
  for (let attempt = 0; attempt < 150; attempt++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const target = targets.find(item => port === 9334 || item.type === 'page');
      if (!target) throw new Error('No target yet');
      const socket = new WebSocket(target.webSocketDebuggerUrl);
      await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
      let id = 0;
      const pending = new Map();
      socket.onmessage = event => {
        const message = JSON.parse(String(event.data));
        if (message.id && pending.has(message.id)) {
          const callback = pending.get(message.id); pending.delete(message.id);
          if (message.error) callback.reject(new Error(message.error.message));
          else callback.resolve(message.result);
        }
      };
      const call = (method, params = {}) => new Promise((resolve, reject) => {
        pending.set(++id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
      return {
        close: () => socket.close(),
        async evaluate(expression) {
          const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
          if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
          return result.result.value;
        },
      };
    } catch { await pause(200); }
  }
  throw new Error(`The packaged app did not expose its test debugging endpoint on ${port}`);
}

setTimeout(() => { console.error('Native UI test timed out'); process.exit(1); }, 90000).unref();
(async () => {
  const renderer = await connection(9333);
  const main = await connection(9334);
  try {
    for (let i = 0; i < 100 && !await renderer.evaluate('!!window.api'); i++) await pause(100);
    const state = await renderer.evaluate('window.api.getUpdateState()');
    assert.equal(state.currentVersion, expectedVersion);
    if (mode === 'portable') {
      assert.equal(state.status, 'unsupported');
    } else if (mode === 'quit') {
      await main.evaluate("setTimeout(() => process.getBuiltinModule('node:module').createRequire(process.resourcesPath + '/app.asar/package.json')('electron').app.quit(), 150); undefined");
    } else if (mode === 'decline' || mode === 'update') {
      const useLocalFeed = `(() => {
        const req = process.getBuiltinModule('node:module').createRequire(process.resourcesPath + '/app.asar/package.json');
        const updater = req('electron-updater').autoUpdater;
        updater.setFeedURL({ provider: 'generic', url: 'http://127.0.0.1:9335' });
        updater.disableDifferentialDownload = true;
      })()`;
      await main.evaluate(useLocalFeed);
      let next = await renderer.evaluate('window.api.getUpdateState()');
      for (let attempt = 0; attempt < 8 && next.status !== 'available'; attempt++) {
        for (let i = 0; i < 50 && next.status === 'checking'; i++) {
          await pause(100);
          next = await renderer.evaluate('window.api.getUpdateState()');
        }
        next = await renderer.evaluate('window.api.checkForUpdates()');
        for (let i = 0; i < 50 && next.status === 'checking'; i++) {
          await pause(100);
          next = await renderer.evaluate('window.api.getUpdateState()');
        }
        if (next.status !== 'available') {
          await main.evaluate(useLocalFeed);
          await pause(200);
        }
      }
      assert.equal(next.status, 'available', JSON.stringify(next));
      assert.equal(await renderer.evaluate("document.querySelector('#updateDialog').matches(':modal')"), true);
      assert.equal(await renderer.evaluate("document.querySelectorAll('#updateDialog button').length"), 2);
      if (mode === 'decline') {
        await renderer.evaluate("document.querySelector('#skipUpdate').click()");
        assert.equal(await renderer.evaluate("document.querySelector('#updateDialog').open"), false);
        assert.equal((await renderer.evaluate('window.api.getUpdateState()')).status, 'available');
      } else {
        await renderer.evaluate("document.querySelector('#updateNow').click()");
      }
    } else if (mode === 'export') {
      await renderer.evaluate(`void (window.__nativeExport = window.api.trimVideo({ input: ${JSON.stringify(source)}, start: '0', duration: '60', format: 'avi' }))`);
      let busy = false;
      for (let i = 0; i < 100 && !busy; i++) {
        busy = await main.evaluate("import(process.getBuiltinModule('node:url').pathToFileURL(process.resourcesPath + '/app.asar/dist/main/ipc/export.js').href).then(m => m.isExporting())");
        if (!busy) await pause(100);
      }
      assert.ok(busy, 'The native app must really be exporting during the running-process test');
    } else if (mode === 'assert-export') {
      assert.equal(await main.evaluate("import(process.getBuiltinModule('node:url').pathToFileURL(process.resourcesPath + '/app.asar/dist/main/ipc/export.js').href).then(m => m.isExporting())"), true);
    } else if (mode === 'finish-export') {
      for (let i = 0; i < 400; i++) {
        const busy = await main.evaluate("import(process.getBuiltinModule('node:url').pathToFileURL(process.resourcesPath + '/app.asar/dist/main/ipc/export.js').href).then(m => m.isExporting())");
        if (!busy) break;
        if (i === 399) throw new Error('Export did not complete');
        await pause(150);
      }
      const result = await renderer.evaluate('window.__nativeExport');
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.ok(fs.statSync(result.output).size > 0);
      const ffmpeg = path.resolve('release/win-unpacked/resources/app.asar.unpacked/node_modules/ffmpeg-static/ffmpeg.exe');
      const decoded = spawnSync(ffmpeg, ['-v', 'error', '-i', result.output, '-f', 'null', '-']);
      assert.equal(decoded.status, 0, decoded.stderr?.toString());
    }
    console.log(`PASS packaged app ${mode}, version ${expectedVersion}`);
  } finally { renderer.close(); main.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
