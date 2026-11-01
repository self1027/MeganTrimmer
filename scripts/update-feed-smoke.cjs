// Exercises real electron-updater HTTP downloads and checksum rejection, never installation.
const { app } = require('electron');
const { NsisUpdater } = require('electron-updater');
const { ElectronHttpExecutor } = require('electron-updater/out/electronHttpExecutor');
const { pathToFileURL } = require('node:url');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const yaml = require('js-yaml');
const root = path.resolve(__dirname, '..');
const artifacts = path.join(root, '.cache/update-feed-smoke', String(Date.now()));
fs.mkdirSync(artifacts, { recursive: true });
app.setPath('userData', path.join(artifacts, 'electron'));
let server;
setTimeout(() => { console.error('Feed smoke timed out'); app.exit(1); }, 60000).unref();

app.whenReady().then(async () => {
  const { UpdateService } = await import(pathToFileURL(path.join(root, 'dist/main/services/updater.js')).href);
  const manifest = yaml.load(fs.readFileSync(path.join(root, 'release/latest.yml'), 'utf8'));
  const installer = manifest.files[0].url;
  let tamper = false;
  let downloads = 0;
  server = http.createServer((request, response) => {
    const name = new URL(request.url, 'http://127.0.0.1').pathname.slice(1);
    if (name === 'latest.yml') {
      const info = JSON.parse(JSON.stringify(manifest));
      if (tamper) info.sha512 = info.files[0].sha512 = Buffer.alloc(64).toString('base64');
      response.end(yaml.dump(info));
    } else if (name === installer) {
      downloads++;
      response.setHeader('Content-Length', fs.statSync(path.join(root, 'release', installer)).size);
      fs.createReadStream(path.join(root, 'release', installer)).pipe(response);
    } else { response.statusCode = 404; response.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  for (const corrupted of [false, true]) {
    tamper = corrupted;
    const folder = path.join(artifacts, corrupted ? 'tampered' : 'valid');
    fs.mkdirSync(folder, { recursive: true });
    const config = path.join(folder, 'app-update.yml');
    fs.writeFileSync(config, yaml.dump({ provider: 'generic', url, updaterCacheDirName: 'cache' }));
    const adapter = {
      version: '1.2.2', name: 'update-feed-test', isPackaged: true,
      appUpdateConfigPath: config, userDataPath: folder, baseCachePath: folder,
      whenReady: () => app.whenReady(),
      quit: () => { throw new Error('Test must never quit for installation'); },
      relaunch: () => { throw new Error('Test must never relaunch'); },
      onQuit: () => { throw new Error('Test must never register auto-install'); },
    };
    const updater = new NsisUpdater(null, adapter);
    updater.httpExecutor = new ElectronHttpExecutor(() => {});
    updater.setFeedURL({ provider: 'generic', url });
    updater.disableDifferentialDownload = true;
    updater.logger = { info() {}, warn() {}, debug() {}, error() {} };
    const service = new UpdateService(updater, adapter.version);
    const count = downloads;
    await service.check();
    assert.equal(service.getState().status, 'available');
    assert.equal(service.getState().availableVersion, manifest.version);
    assert.equal(downloads, count, 'Default check must not download');
    await service.download();
    assert.equal(downloads, count + 1);
    assert.equal(service.getState().status, corrupted ? 'error' : 'downloaded');
    if (corrupted) assert.equal(service.install(true), false);
    console.log(`PASS real local feed: ${corrupted ? 'corrupt checksum rejected' : 'installer downloaded and verified without installation'}`);
  }
  server.close(); app.exit(0);
}).catch(error => { console.error(error); server?.close(); app.exit(1); });
