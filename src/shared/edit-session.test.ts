import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEditDirty, type EditSnapshot } from './edit-session.js';

const saved: EditSnapshot = { input: 'video.mp4', start: 0, end: 10, format: 'original', resolution: 'original', frameRate: 'original' };
test('opening a video and reverting edits are clean', () => {
  assert.equal(isEditDirty(saved, saved), false);
  assert.equal(isEditDirty({ ...saved, start: 1 }, saved), true);
  assert.equal(isEditDirty({ ...saved }, saved), false);
});
test('each export option and trim endpoint dirties the current cut', () => {
  for (const patch of [{ end: 8 }, { format: 'mkv' }, { resolution: '640:480' }, { frameRate: '24' }]) {
    assert.equal(isEditDirty({ ...saved, ...patch }, saved), true);
  }
});
test('successful export becomes the baseline; failed export keeps the old baseline', () => {
  const changed = { ...saved, start: 2 };
  assert.equal(isEditDirty(changed, saved), true);
  assert.equal(isEditDirty(changed, changed), false);
});
test('hidden video options do not dirty an audio export', () => {
  const audio = { ...saved, format: 'mp3' };
  assert.equal(isEditDirty({ ...audio, resolution: '640:480', frameRate: '24' }, audio), false);
});
