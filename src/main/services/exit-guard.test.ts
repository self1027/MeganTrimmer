import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExitGuard } from './exit-guard.js';

test('export in the main process prevents quitting without asking to discard', async () => {
  let prompts = 0;
  const guard = new ExitGuard(() => true, () => true, async () => { prompts++; return true; });
  assert.equal(await guard.approve(), false);
  assert.equal(prompts, 0);
});

test('cancel keeps the window open, discard allows closing, clean session needs no prompt', async () => {
  let discard = false;
  let dirty = true;
  const guard = new ExitGuard(() => false, () => dirty, async () => discard);
  assert.equal(await guard.approve(), false);
  discard = true;
  assert.equal(await guard.approve(), true);
  dirty = false;
  discard = false;
  assert.equal(await guard.approve(), true);
});

test('export beginning during the discard dialog still blocks installation', async () => {
  let busy = false;
  const guard = new ExitGuard(() => busy, () => true, async () => { busy = true; return true; });
  assert.equal(await guard.approve(), false);
});

test('duplicate close requests share no extra dialog and cannot bypass cancellation', async () => {
  let answer: (value: boolean) => void;
  let prompts = 0;
  const guard = new ExitGuard(() => false, () => true, () => {
    prompts++;
    return new Promise<boolean>(resolve => { answer = resolve; });
  });
  const first = guard.approve();
  assert.equal(await guard.approve(), false);
  answer!(false);
  assert.equal(await first, false);
  assert.equal(prompts, 1);
});
