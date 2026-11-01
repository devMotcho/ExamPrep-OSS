// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { consumeOAuthCallback } from './oauthCallback';

describe('consumeOAuthCallback', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/');
  });

  it('takes the code out of the address', () => {
    window.history.replaceState(null, '', '/dashboard?oauth_code=abc&x=1');
    expect(consumeOAuthCallback()).toBe('abc');
    expect(window.location.pathname + window.location.search).toBe('/dashboard?x=1');
  });

  it('ignores and removes tokens in a fragment', () => {
    window.history.replaceState(null, '', '/dashboard#access_token=a&refresh_token=b');
    expect(consumeOAuthCallback()).toBeNull();
    expect(window.location.hash).toBe('');
    expect(localStorage.getItem('oauth_access_token')).toBeNull();
  });

  it('leaves other fragments alone', () => {
    window.history.replaceState(null, '', '/page#section');
    expect(consumeOAuthCallback()).toBeNull();
    expect(window.location.hash).toBe('#section');
  });

  it('clears tokens stored by older versions', () => {
    localStorage.setItem('oauth_access_token', 'a');
    localStorage.setItem('oauth_refresh_token', 'b');
    localStorage.setItem('oauth_token_expires_at', '1');
    localStorage.setItem('theme', 'dark');
    consumeOAuthCallback();
    expect(localStorage.getItem('oauth_access_token')).toBeNull();
    expect(localStorage.getItem('oauth_refresh_token')).toBeNull();
    expect(localStorage.getItem('oauth_token_expires_at')).toBeNull();
    expect(localStorage.getItem('theme')).toBe('dark');
  });
});
