import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveOutputPath } from './output-path.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'megantrimmer-test-'));
}

function touch(filePath: string): void {
  fs.writeFileSync(filePath, 'x');
}

test('free path is returned unchanged', () => {
  const dir = tmpDir();
  const p = path.join(dir, 'livre.mp4');
  assert.equal(resolveOutputPath(p), p);
  assert.ok(!fs.existsSync(p), 'resolver must not create the file');
});

test('existing a.mp4 → a (1).mp4', () => {
  const dir = tmpDir();
  touch(path.join(dir, 'a.mp4'));
  assert.equal(resolveOutputPath(path.join(dir, 'a.mp4')), path.join(dir, 'a (1).mp4'));
});

test('existing a.mp4 and a (1).mp4 → a (2).mp4', () => {
  const dir = tmpDir();
  touch(path.join(dir, 'a.mp4'));
  touch(path.join(dir, 'a (1).mp4'));
  assert.equal(resolveOutputPath(path.join(dir, 'a.mp4')), path.join(dir, 'a (2).mp4'));
});

test('no extension: existing a → a (1)', () => {
  const dir = tmpDir();
  touch(path.join(dir, 'a'));
  assert.equal(resolveOutputPath(path.join(dir, 'a')), path.join(dir, 'a (1)'));
});

test('multiple dots: existing a.b.mp4 → a.b (1).mp4', () => {
  const dir = tmpDir();
  touch(path.join(dir, 'a.b.mp4'));
  assert.equal(resolveOutputPath(path.join(dir, 'a.b.mp4')), path.join(dir, 'a.b (1).mp4'));
});

test('hidden file: existing .env → .env (1)', () => {
  const dir = tmpDir();
  touch(path.join(dir, '.env'));
  assert.equal(resolveOutputPath(path.join(dir, '.env')), path.join(dir, '.env (1)'));
});

test('gap: a.mp4, a (1).mp4 and a (3).mp4 exist → a (2).mp4', () => {
  const dir = tmpDir();
  touch(path.join(dir, 'a.mp4'));
  touch(path.join(dir, 'a (1).mp4'));
  touch(path.join(dir, 'a (3).mp4'));
  assert.equal(resolveOutputPath(path.join(dir, 'a.mp4')), path.join(dir, 'a (2).mp4'));
});

test('unicode, accents, spaces and parentheses are preserved literally', () => {
  const dir = tmpDir();
  const unicode = path.join(dir, 'vídeo de São João (final).mp4');
  touch(unicode);
  assert.equal(resolveOutputPath(unicode), path.join(dir, 'vídeo de São João (final) (1).mp4'));

  const relativeBase = path.join(dir, 'my (draft)');
  touch(relativeBase);
  assert.equal(resolveOutputPath(relativeBase), path.join(dir, 'my (draft) (1)'));
});

test('relative paths keep working', () => {
  const dir = tmpDir();
  const previous = process.cwd();
  process.chdir(dir);
  try {
    touch('a.mp4');
    assert.equal(resolveOutputPath('a.mp4'), 'a (1).mp4');
  } finally {
    process.chdir(previous);
  }
});

test('empty or invalid path throws early', () => {
  assert.throws(() => resolveOutputPath(''), /Invalid output path/);
  assert.throws(() => resolveOutputPath('   '), /Invalid output path/);
});

test('999 collisions → throws descriptive error', () => {
  const dir = tmpDir();
  touch(path.join(dir, 'a.mp4'));
  for (let i = 1; i <= 999; i++) touch(path.join(dir, `a (${i}).mp4`));
  assert.throws(
    () => resolveOutputPath(path.join(dir, 'a.mp4')),
    /Could not resolve a unique output path .* after 999 attempts/
  );
});
