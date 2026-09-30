import test from 'node:test';
import assert from 'node:assert/strict';
import { AUTH_CALLBACK, STORE_AUTH_CALLBACK, registeredCallback, callbackCode } from './auth-callback.js';

test('sign-in uses the installed build callback and rejects the old build before launching OAuth', () => {
  assert.equal(registeredCallback(AUTH_CALLBACK), AUTH_CALLBACK);
  assert.equal(registeredCallback(STORE_AUTH_CALLBACK), STORE_AUTH_CALLBACK);
  assert.equal(callbackCode(STORE_AUTH_CALLBACK+'?code=store-test', STORE_AUTH_CALLBACK),'store-test');
  assert.throws(()=>callbackCode(AUTH_CALLBACK+'?code=wrong-build',STORE_AUTH_CALLBACK),/did not return/);
  assert.throws(()=>registeredCallback(STORE_AUTH_CALLBACK+'/extra'),/not registered/);
  assert.throws(() => registeredCallback('https://mpfkfajpkinfkgfkgeajjmkeoigkdenm.chromiumapp.org/lossless'), /not registered/);
  assert.throws(() => registeredCallback('https://example.com'), /not registered/);
});

test('only the exact extension callback can supply an authorization code', () => {
  assert.equal(callbackCode(AUTH_CALLBACK+'?code=test-code', AUTH_CALLBACK), 'test-code');
  for(const callback of ['https://llmderby.com/?code=test-code',AUTH_CALLBACK+'/extra?code=test-code',AUTH_CALLBACK+'?error=access_denied',AUTH_CALLBACK+'#error=access_denied',AUTH_CALLBACK]) {
    assert.throws(() => callbackCode(callback,AUTH_CALLBACK), /Sign-in|Google sign-in/);
  }
  assert.throws(() => callbackCode(undefined,AUTH_CALLBACK), /cancelled/);
});
