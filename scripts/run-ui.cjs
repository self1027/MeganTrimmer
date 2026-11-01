const { spawnSync } = require('node:child_process');
const path = require('node:path');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const files = process.argv.length > 2 ? process.argv.slice(2) : ['smoke.cjs', 'update-smoke.cjs'];
for (const file of files) {
  const result = spawnSync(require('electron'), [path.join(__dirname, file)], { env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
