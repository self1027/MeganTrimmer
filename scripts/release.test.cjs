const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { validateVersion, validateArtifacts, publishRelease } = require('./release.cjs');

test('release tags must be stable, match both lock versions and advance the public version', () => {
  const pkg = { version: '1.3.0' }, lock = { version: '1.3.0', packages: { '': { version: '1.3.0' } } };
  assert.equal(validateVersion('v1.3.0', pkg, lock, 'v1.2.0'), '1.3.0');
  for (const tag of ['1.3.0', 'v1.3.0-beta.1', 'v01.3.0', 'v1.2.0']) {
    assert.throws(() => validateVersion(tag, pkg, lock, 'v1.2.0'));
  }
  assert.throws(() => validateVersion('v1.3.0', pkg, { ...lock, version: '1.2.0' }));
  assert.throws(() => validateVersion('v1.3.0', pkg, { ...lock, packages: { '': { version: '1.2.0' } } }));
  assert.throws(() => validateVersion('v1.3.0', pkg, lock, 'v1.3.0'));
  assert.throws(() => validateVersion('v1.3.0', pkg, lock, 'v2.0.0'));
});

function fixture(t, version = '1.3.0') {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-release-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const setup = `MeganTrimmer-${version}-Setup.exe`;
  for (const name of [setup, `${setup}.blockmap`, `MeganTrimmer-${version}-Portable.exe`]) {
    fs.writeFileSync(path.join(folder, name), 'example binary');
  }
  const hash = createHash('sha512').update('example binary').digest('base64');
  const manifest = { version, path: setup, sha512: hash, files: [{ url: setup, sha512: hash, size: 14 }] };
  const writeManifest = () => fs.writeFileSync(path.join(folder, 'latest.yml'), JSON.stringify(manifest));
  writeManifest();
  return { folder, setup, manifest, writeManifest };
}

test('only the exact release artifacts are selected and checksummed', async t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.folder, 'old-setup.exe'), 'stale build');
  const files = await validateArtifacts(f.folder, '1.3.0');
  assert.equal(files.length, 4);
  assert.ok(files.every(file => !file.includes('old-setup')));
  fs.writeFileSync(path.join(f.folder, f.setup), 'corrupted file');
  await assert.rejects(validateArtifacts(f.folder, '1.3.0'), /checksum/i);
});

test('reject missing files, wrong versions and a portable or external URL in the feed', async t => {
  const f = fixture(t);
  f.manifest.version = '1.2.0'; f.writeManifest();
  await assert.rejects(validateArtifacts(f.folder, '1.3.0'));
  f.manifest.version = '1.3.0';
  f.manifest.files[0].url = 'https://example.com/installer.exe'; f.writeManifest();
  await assert.rejects(validateArtifacts(f.folder, '1.3.0'));
  f.manifest.files[0].url = f.setup; f.writeManifest();
  fs.unlinkSync(path.join(f.folder, `${f.setup}.blockmap`));
  await assert.rejects(validateArtifacts(f.folder, '1.3.0'));
});

function publisherFixture(t) {
  const version = require('../package.json').version;
  const { folder } = fixture(t, version);
  let release = null;
  const calls = [];
  const run = args => {
    calls.push(args);
    if (args[0] === 'api') {
      if (args[1].endsWith('/latest')) return JSON.stringify({ tag_name: 'v1.2.0' });
      return JSON.stringify(release);
    }
    if (args[1] === 'create') release = { draft: true, assets: [] };
    if (args[1] === 'upload') release.assets = args.slice(3, 7).map(file => ({ name: path.basename(file), size: fs.statSync(file).size }));
    return '';
  };
  return { folder, tag: `v${version}`, calls, run, setRelease: value => { release = value; } };
}

test('publishes only after upload verification and can resume drafts', async t => {
  const f = publisherFixture(t);
  f.setRelease({ draft: true, assets: [] });
  await publishRelease(f.tag, f.folder, f.run);
  assert.equal(f.calls.filter(args => args[1] === 'create').length, 0);
  assert.equal(f.calls.at(-1)[1], 'edit');
  assert.ok(f.calls.at(-1).includes('--draft=false'));
});

test('never changes an existing published release or promotes a failed upload', async t => {
  const f = publisherFixture(t);
  f.setRelease({ draft: false, assets: [] });
  await assert.rejects(publishRelease(f.tag, f.folder, f.run));
  assert.equal(f.calls.filter(args => args[0] === 'release').length, 0);
  f.setRelease({ draft: true, assets: [] });
  await assert.rejects(publishRelease(f.tag, f.folder, args => {
    if (args[1] === 'upload') throw new Error('upload failed');
    return f.run(args);
  }));
  assert.equal(f.calls.filter(args => args[1] === 'edit').length, 0);
});
