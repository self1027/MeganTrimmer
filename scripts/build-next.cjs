const { build, Platform, Arch } = require('electron-builder');
const pkg = require('../package.json');
const parts = pkg.version.split('.');
parts[2] = String(Number(parts[2]) + 1);
const version = parts.join('.');
build({
  targets: Platform.WINDOWS.createTarget(['nsis'], Arch.x64), publish: 'never',
  config: {
    ...pkg.build, extraMetadata: { version },
    directories: { ...pkg.build.directories, output: '.cache/native-next' },
  },
}).then(() => console.log(`Built native test update ${version}`))
  .catch(error => { console.error(error); process.exitCode = 1; });
