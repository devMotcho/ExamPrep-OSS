// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { escapeHtml, stripHtml } from './stripHtml';

describe('stripHtml', () => {
  it('returns the text of the markup', () => {
    expect(stripHtml('<p>Hello <strong>world</strong></p>')).toBe('Hello world');
  });

  it('does not run anything in the markup', () => {
    const w = window as unknown as { __ran?: boolean };
    stripHtml('<img src=x onerror="window.__ran = true"><script>window.__ran = true</script>');
    expect(w.__ran).toBeUndefined();
  });

  it('accepts empty values', () => {
    expect(stripHtml(null)).toBe('');
    expect(stripHtml(undefined)).toBe('');
  });
});

describe('escapeHtml', () => {
  it('escapes markup characters', () => {
    expect(escapeHtml('<b a="1">&\'')).toBe('&lt;b a=&quot;1&quot;&gt;&amp;&#39;');
  });
});
