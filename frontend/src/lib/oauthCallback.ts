const OLD_TOKEN_KEYS = ['oauth_access_token', 'oauth_refresh_token', 'oauth_token_expires_at'];

/**
 * Runs once, before the router reads the address. Takes the single-use sign-in code out of the URL so it
 * stays out of the history, ignores tokens in a fragment (no version of the server sends them any more), and
 * removes what older versions left in storage.
 */
export const consumeOAuthCallback = (): string | null => {
  try {
    OLD_TOKEN_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Storage can be unavailable; there is then nothing to clear.
  }

  const url = new URL(window.location.href);
  const code = url.searchParams.get('oauth_code');
  const fragment = new URLSearchParams(url.hash.slice(1));
  const tokenFragment = fragment.has('access_token') || fragment.has('refresh_token');
  if (!code && !tokenFragment) return null;

  url.searchParams.delete('oauth_code');
  if (tokenFragment) url.hash = '';
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  return code;
};
