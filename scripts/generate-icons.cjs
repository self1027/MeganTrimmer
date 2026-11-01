// Render the existing SVG with Chromium and package Windows ICO sizes without new dependencies.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');

if (!process.versions.electron || process.env.ELECTRON_RUN_AS_NODE) {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const result = require('node:child_process').spawnSync(require('electron'), [__filename], {
    env, windowsHide: true, stdio: 'inherit',
  });
  if (result.error) console.error(result.error);
  process.exit(result.status ?? 1);
}

const { app, BrowserWindow } = require('electron');
const scratch = path.join(root, '.cache', 'icon-rendering');
fs.mkdirSync(scratch, { recursive: true });
app.setPath('userData', scratch);
app.setPath('sessionData', scratch);

app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false } });
  await window.loadURL('about:blank');
  const svg = fs.readFileSync(path.join(root, 'src/assets/logo.svg'), 'utf8');
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const rendered = await window.webContents.executeJavaScript(`(async () => {
    const image = new Image();
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(${JSON.stringify(svg)});
    await image.decode();
    return ${JSON.stringify([...sizes, 512])}.map(size => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const context = canvas.getContext('2d');
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, 0, 0, size, size);
      return canvas.toDataURL('image/png').split(',')[1];
    });
  })()`);
  const images = rendered.map(png => Buffer.from(png, 'base64'));
  const header = Buffer.alloc(6 + sizes.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  sizes.forEach((size, index) => {
    const entry = 6 + index * 16;
    header[entry] = header[entry + 1] = size === 256 ? 0 : size;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(images[index].length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    assert.equal(images[index].readUInt32BE(16), size);
    assert.equal(images[index].readUInt32BE(20), size);
    offset += images[index].length;
  });
  const ico = Buffer.concat([header, ...images.slice(0, sizes.length)]);
  assert.equal(ico.length, offset);
  fs.writeFileSync(path.join(root, 'src/assets/logo.ico'), ico);
  fs.writeFileSync(path.join(root, 'build/icon.ico'), ico);
  fs.writeFileSync(path.join(root, 'src/assets/logo.png'), images.at(-1));
  console.log(`Generated matching application/build icons: ${sizes.join(', ')} px, plus 512 px PNG.`);
  window.destroy();
  app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
