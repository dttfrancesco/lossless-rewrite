// Exact identities for the existing unpacked installation and store draft.
// Unknown IDs must never fall back to another app's website.
export const AUTH_CALLBACK = 'https://andpcbaahgmkebhklmdcgcnaimmfmjoj.chromiumapp.org/lossless';
export const STORE_AUTH_CALLBACK = 'https://cnnhnhonmpadooefbdnpokpipokghigb.chromiumapp.org/lossless';

export function registeredCallback(redirectTo) {
  if (![AUTH_CALLBACK, STORE_AUTH_CALLBACK].includes(redirectTo)) throw new Error('This extension build is not registered for sign-in. Use the current Lossless build and try again.');
  return redirectTo;
}

export function callbackCode(callback, redirectTo) {
  if (!callback) throw new Error('Sign-in was cancelled. Try again when ready.');
  const expected = new URL(redirectTo), actual = new URL(callback);
  if (actual.origin !== expected.origin || actual.pathname !== expected.pathname || actual.username || actual.password) throw new Error('Sign-in did not return to Lossless. Please try again.');
  const hash = new URLSearchParams(actual.hash.slice(1));
  if (actual.searchParams.has('error') || hash.has('error')) throw new Error('Google sign-in was not completed. Please try again.');
  const code = actual.searchParams.get('code');
  if (!code) throw new Error('Sign-in was not completed. Please try again.');
  return code;
}
