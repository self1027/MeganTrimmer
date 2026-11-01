import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { register } from 'node:module';

// Stub de 'electron' via loader hook (data: URL) — sem dependências novas.
// getPath lê as envs em tempo de chamada, então cada teste pode apontar para um tmp dir.
const stubUrl = 'data:text/javascript,' + encodeURIComponent(
  `export const app = {
     getPath: (name) => name === 'userData' ? process.env.MT_USERDATA : process.env.MT_VIDEOS,
   };`
);
const hooksUrl = 'data:text/javascript,' + encodeURIComponent(
  `const STUB = ${JSON.stringify(stubUrl)};
   export async function resolve(specifier, context, next) {
     if (specifier === 'electron') return { url: STUB, shortCircuit: true };
     return next(specifier, context);
   }`
);
register(hooksUrl);

const { getSettingsPath, loadSettings, saveSettings, resolveOutputFolder } =
  await import('./settings.js');

function useTmpDirs(): { userData: string; videos: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-settings-'));
  const userData = path.join(root, 'userdata');
  const videos = path.join(root, 'videos');
  process.env.MT_USERDATA = userData;
  process.env.MT_VIDEOS = videos;
  return { userData, videos };
}

test('getSettingsPath aponta para userData/settings.json', () => {
  const { userData } = useTmpDirs();
  assert.equal(getSettingsPath(), path.join(userData, 'settings.json'));
});

test('sem arquivo: retorna defaults e NÃO cria nada (lazy)', () => {
  const { userData } = useTmpDirs();
  assert.deepEqual(loadSettings(), { outputFolder: '' });
  assert.ok(!fs.existsSync(userData), 'diretorio userData nao deve ser criado no load');
});

test('saveSettings cria diretorio e persiste; loadSettings relê do disco', () => {
  const { userData } = useTmpDirs();
  saveSettings({ outputFolder: '/tmp/clipes' });
  assert.ok(fs.existsSync(path.join(userData, 'settings.json')));
  assert.deepEqual(loadSettings(), { outputFolder: '/tmp/clipes' });
});

test('escrita atômica: não deixa settings.json.tmp para trás', () => {
  const { userData } = useTmpDirs();
  saveSettings({ outputFolder: '/tmp/a' });
  saveSettings({ outputFolder: '/tmp/b' });
  assert.deepEqual(fs.readdirSync(userData), ['settings.json']);
  assert.deepEqual(loadSettings(), { outputFolder: '/tmp/b' });
});

test('JSON inválido: warning fixo + defaults, sem crash', () => {
  useTmpDirs();
  fs.mkdirSync(process.env.MT_USERDATA!, { recursive: true });
  fs.writeFileSync(getSettingsPath(), '{ not valid json !!!');
  assert.deepEqual(loadSettings(), { outputFolder: '' });
});

test('merge defensivo: chaves ausentes ou de tipo errado voltam ao default', () => {
  useTmpDirs();
  fs.mkdirSync(process.env.MT_USERDATA!, { recursive: true });

  fs.writeFileSync(getSettingsPath(), '{}');
  assert.deepEqual(loadSettings(), { outputFolder: '' });

  fs.writeFileSync(getSettingsPath(), JSON.stringify({ outputFolder: 12345 }));
  assert.deepEqual(loadSettings(), { outputFolder: '' }, 'tipo errado -> default');

  fs.writeFileSync(getSettingsPath(), JSON.stringify(null));
  assert.deepEqual(loadSettings(), { outputFolder: '' }, 'null -> default');
});

test('legacy silent preference cannot enable unattended installation', () => {
  const { userData } = useTmpDirs();
  fs.mkdirSync(userData, { recursive: true });
  fs.writeFileSync(getSettingsPath(), JSON.stringify({ outputFolder: '/clips', silentUpdates: true }));
  assert.deepEqual(loadSettings(), { outputFolder: '/clips' });
});

test('resolveOutputFolder usa a pasta configurada quando existe no disco', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-folder-'));
  useTmpDirs();
  const existing = path.join(root, 'existentes');
  fs.mkdirSync(existing, { recursive: true });
  assert.equal(resolveOutputFolder({ outputFolder: existing }), existing);
});

test('resolveOutputFolder sem config: Videos/MeganTrimmer criado sob demanda', () => {
  const { videos } = useTmpDirs();
  const fallback = path.join(videos, 'MeganTrimmer');
  assert.ok(!fs.existsSync(fallback));
  assert.equal(resolveOutputFolder({ outputFolder: '' }), fallback);
  assert.ok(fs.existsSync(fallback), 'pasta fallback criada');
});

test('resolveOutputFolder com pasta apagada: cai no fallback sem crash', () => {
  const { videos } = useTmpDirs();
  const gone = path.join(videos, 'nao-existe-mais');
  const result = resolveOutputFolder({ outputFolder: gone });
  assert.equal(result, path.join(videos, 'MeganTrimmer'));
  assert.ok(fs.existsSync(result));
});

test('resolveOutputFolder nunca retorna string vazia', () => {
  const { videos } = useTmpDirs();
  const result = resolveOutputFolder({ outputFolder: '' });
  assert.ok(path.isAbsolute(result));
  assert.notEqual(result, '');
});
