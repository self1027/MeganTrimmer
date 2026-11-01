import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { UpdateService } from './updater.js';

class FakeUpdater extends EventEmitter {
  autoDownload = true;
  autoInstallOnAppQuit = true;
  allowPrerelease = true;
  allowDowngrade = true;
  checks = 0;
  downloads = 0;
  installs: boolean[][] = [];
  failCheck = false;
  failDownload = false;
  async checkForUpdates() {
    this.checks++;
    if (this.failCheck) throw new Error('offline');
    this.emit('update-available', { version: '1.3.1' });
    return null;
  }
  async downloadUpdate() {
    this.downloads++;
    if (this.failDownload) throw new Error('SHA512 mismatch');
    this.emit('download-progress', { percent: 45 });
    return [];
  }
  quitAndInstall(silent: boolean, relaunch: boolean) { this.installs.push([silent, relaunch]); }
}

function fixture() {
  const updater = new FakeUpdater();
  let exporting = false;
  const service = new UpdateService(updater, '1.3.0', () => !exporting);
  return { updater, service, setExporting: (value: boolean) => { exporting = value; } };
}

test('default checks announce updates without downloading or installing on quit', async () => {
  const { updater, service } = fixture();
  await service.check();
  assert.equal(updater.autoDownload, false);
  assert.equal(updater.autoInstallOnAppQuit, false);
  assert.equal(updater.allowPrerelease, false);
  assert.equal(updater.allowDowngrade, false);
  assert.equal(service.getState().status, 'available');
  assert.equal(service.getState().availableVersion, '1.3.1');
  assert.equal(updater.downloads, 0);
});

test('manual download publishes progress and only installs when ready', async () => {
  const { updater, service } = fixture();
  const states: string[] = [];
  const unsubscribe = service.subscribe(state => states.push(state.status));
  assert.equal(service.install(true), false);
  await service.check();
  await service.download();
  assert.equal(service.getState().percent, 45);
  assert.equal(service.install(true), false);
  updater.emit('update-downloaded', { version: '1.3.1' });
  assert.equal(service.install(true), true);
  assert.deepEqual(updater.installs, [[true, true]]);
  assert.equal(service.install(true), false, 'duplicate install is ignored');
  assert.ok(states.includes('downloading'));
  unsubscribe();
});

test('exporting blocks explicitly requested installation', async () => {
  const { updater, service, setExporting } = fixture();
  await service.check();
  updater.emit('update-downloaded', { version: '1.3.1' });
  setExporting(true);
  assert.equal(service.install(true), false);
  assert.deepEqual(updater.installs, []);
  setExporting(false);
  assert.equal(service.install(true), true);
});

test('errors remain recoverable and an invalid download cannot be installed', async () => {
  const { updater, service } = fixture();
  updater.failCheck = true;
  await service.check();
  assert.equal(service.getState().status, 'error');
  updater.failCheck = false;
  await service.check();
  updater.failDownload = true;
  await service.download();
  assert.equal(service.getState().status, 'error');
  assert.equal(service.install(true), false);
  updater.failDownload = false;
  await service.download();
  updater.emit('update-downloaded', { version: '1.3.1' });
  assert.equal(service.getState().status, 'downloaded');
});

test('concurrent checks and downloads are deduplicated', async () => {
  const { updater, service } = fixture();
  await Promise.all([service.check(), service.check()]);
  await Promise.all([service.download(), service.download()]);
  assert.equal(updater.checks, 1);
  assert.equal(updater.downloads, 1);
});

test('runtime updater errors are caught and unsubscription removes UI callbacks', async () => {
  const { updater, service } = fixture();
  let notifications = 0;
  const unsubscribe = service.subscribe(() => notifications++);
  updater.emit('error', new Error('network failure'));
  assert.equal(service.getState().status, 'error');
  const before = notifications;
  unsubscribe();
  updater.emit('error', new Error('another failure'));
  assert.equal(notifications, before);
});

test('development and portable have an inert unsupported service', async () => {
  const service = new UpdateService(null, '1.3.0');
  await service.check();
  await service.download();
  assert.equal(service.getState().status, 'unsupported');
  assert.equal(service.install(true), false);
});

test('an installer error emitted synchronously refuses exit and permits a retry', async () => {
  const { updater, service } = fixture();
  await service.check();
  await service.download();
  updater.emit('update-downloaded', { version: '1.3.1' });
  updater.quitAndInstall = () => { updater.emit('error', new Error('installer missing')); };
  assert.equal(service.install(true), false);
  assert.equal(service.getState().status, 'error');
  await service.check();
  assert.equal(updater.checks, 2);
});

test('an asynchronous installer error unlocks checking again', async () => {
  const { updater, service } = fixture();
  await service.check();
  updater.emit('update-downloaded', { version: '1.3.1' });
  assert.equal(service.install(true), true);
  updater.emit('error', new Error('could not launch installer'));
  await service.check();
  assert.equal(updater.checks, 2);
});
