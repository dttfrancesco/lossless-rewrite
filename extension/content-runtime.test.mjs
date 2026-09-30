import test from 'node:test';
import assert from 'node:assert/strict';
import { createContentRuntime } from './content-runtime.js';

for (const asynchronous of [false, true]) {
  test(`extension reload cleans up on ${asynchronous ? 'rejected' : 'synchronously thrown'} messages`, async () => {
    let cleanups = 0, calls = 0;
    const failure = new Error('Extension context invalidated.');
    const runtime = createContentRuntime({id:'old-extension', sendMessage() {
      calls++;
      if (asynchronous) return Promise.reject(failure);
      throw failure;
    }}, () => cleanups++);
    await assert.rejects(runtime.send({kind:'page-changed'}), /context invalidated/);
    await assert.rejects(runtime.send({kind:'inline-check'}), /Refresh this chat/);
    assert.equal(runtime.active(), false);
    assert.equal(cleanups, 1);
    assert.equal(calls, 1);
  });
}

test('a missing runtime ID stops before sending; temporary worker failures do not tear down the UI', async () => {
  let cleanups = 0, calls = 0;
  const api = {id:'extension', sendMessage() {calls++;throw new Error('Receiving end does not exist.');}};
  const runtime = createContentRuntime(api, () => cleanups++);
  await assert.rejects(runtime.send({}), /Receiving end/);
  assert.equal(runtime.active(), true);
  api.id = undefined;
  assert.equal(runtime.active(), false);
  await assert.rejects(runtime.send({}), /Refresh/);
  assert.equal(cleanups, 1);
  assert.equal(calls, 1);
});
