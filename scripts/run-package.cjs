const { spawnSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const result = spawnSync(path.join(root, 'release/win-unpacked/MeganTrimmer.exe'),
  [path.join(__dirname, 'check-package.cjs')], {
    cwd: root, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, stdio: 'inherit',
  });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
