const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const yaml = require('js-yaml');
const repo = 'self1027/megan-trimmer';
const root = path.resolve(__dirname, '..');

function stableVersion(tag) {
  assert.match(tag, /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/, 'Use a stable tag vX.Y.Z');
  return tag.slice(1);
}

function validateVersion(tag, pkg, lock, latestTag) {
  const version = stableVersion(tag);
  assert.equal(pkg.version, version, 'Tag must match package.json');
  assert.equal(lock.version, version, 'Tag must match package-lock.json');
  assert.equal(lock.packages[''].version, version, 'Lock root version must match');
  if (latestTag) {
    const latest = stableVersion(latestTag).split('.').map(BigInt);
    const parts = version.split('.').map(BigInt);
    const differing = parts.findIndex((part, index) => part !== latest[index]);
    assert.ok(differing >= 0 && parts[differing] > latest[differing], 'Version must advance the latest published release');
  }
  return version;
}

async function validateArtifacts(folder, version) {
  const setup = `MeganTrimmer-${version}-Setup.exe`;
  const names = [setup, `${setup}.blockmap`, `MeganTrimmer-${version}-Portable.exe`, 'latest.yml'];
  const files = names.map(name => path.resolve(folder, name));
  files.forEach(file => assert.ok(fs.statSync(file).isFile() && fs.statSync(file).size > 0, `Missing or empty artifact: ${file}`));
  const manifest = yaml.load(fs.readFileSync(files[3], 'utf8'));
  assert.equal(manifest.version, version, 'Wrong manifest version');
  assert.equal(manifest.files?.length, 1, 'Feed must point to exactly one NSIS installer');
  assert.equal(manifest.files[0].url, setup, 'Feed must point to this release NSIS installer');
  assert.equal(manifest.files[0].size, fs.statSync(files[0]).size, 'Wrong installer size');
  const hash = createHash('sha512');
  for await (const chunk of fs.createReadStream(files[0])) hash.update(chunk);
  const checksum = hash.digest('base64');
  assert.equal(manifest.files[0].sha512, checksum, 'Installer checksum mismatch');
  if (manifest.path !== undefined) assert.equal(manifest.path, setup);
  if (manifest.sha512 !== undefined) assert.equal(manifest.sha512, checksum, 'Legacy checksum mismatch');
  return files;
}

function gh(args) {
  try { return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (error) {
    if (args[0] === 'api' && /HTTP 404/.test(String(error.stderr))) return 'null';
    throw error;
  }
}

function latestTag(run) {
  return JSON.parse(run(['api', `repos/${repo}/releases/latest`]))?.tag_name;
}

async function publishRelease(tag, folder, run = gh) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  const version = validateVersion(tag, pkg, lock, latestTag(run));
  const files = await validateArtifacts(folder, version);
  const endpoint = `repos/${repo}/releases/tags/${tag}`;
  let release = JSON.parse(run(['api', endpoint]));
  assert.ok(!release || release.draft, 'A published release cannot be changed');
  if (!release) run(['release', 'create', tag, '--repo', repo, '--draft', '--verify-tag', '--title', tag, '--generate-notes']);
  run(['release', 'upload', tag, ...files, '--repo', repo, '--clobber']);
  release = JSON.parse(run(['api', endpoint]));
  assert.ok(release?.draft, 'Release must remain a draft until verification finishes');
  assert.equal(release.assets.length, files.length, 'Unexpected or incomplete uploaded assets');
  files.forEach(file => {
    const asset = release.assets.find(item => item.name === path.basename(file));
    assert.equal(asset?.size, fs.statSync(file).size, `Uploaded asset mismatch: ${file}`);
  });
  validateVersion(tag, pkg, lock, latestTag(run));
  run(['release', 'edit', tag, '--repo', repo, '--draft=false', '--latest']);
}

module.exports = { validateVersion, validateArtifacts, publishRelease };
if (require.main === module) {
  const [command, tag = process.env.GITHUB_REF_NAME] = process.argv.slice(2);
  const pkg = require('../package.json');
  const lock = require('../package-lock.json');
  const folder = path.join(root, 'release');
  Promise.resolve().then(async () => {
    if (command === 'verify-version') {
      const version = validateVersion(tag, pkg, lock, latestTag(gh));
      if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\n`);
    }
    else if (command === 'verify-artifacts') await validateArtifacts(folder, pkg.version);
    else if (command === 'publish') await publishRelease(tag, folder);
    else throw new Error('Use verify-version, verify-artifacts or publish');
    console.log(`PASS ${command}`);
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
