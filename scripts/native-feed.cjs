const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const folder = path.resolve(process.argv[2]);
const manifest = yaml.load(fs.readFileSync(path.join(folder, 'latest.yml'), 'utf8'));
const allowed = new Set(['latest.yml', manifest.files[0].url, `${manifest.files[0].url}.blockmap`]);
http.createServer((request, response) => {
  const name = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname.slice(1));
  if (!allowed.has(name)) { response.writeHead(404).end(); return; }
  const file = path.join(folder, name);
  response.setHeader('Content-Length', fs.statSync(file).size);
  fs.createReadStream(file).pipe(response);
}).listen(9335, '127.0.0.1', () => console.log(`Serving native update ${manifest.version} on loopback only`));
