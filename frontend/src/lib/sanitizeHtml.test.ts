// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from './sanitizeHtml';

describe('sanitizeHtml', () => {
  it('keeps what the editor produces', () => {
    const html = '<h2>T</h2><p><strong>a</strong> <em>b</em> <u>c</u> <s>d</s> <code>e</code></p><ul><li><p>f</p></li></ul><pre><code>g</code></pre><blockquote><p>h</p></blockquote><hr>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it('removes scripts and event handlers', () => {
    expect(sanitizeHtml('<p onclick="x()">a</p><script>y()</script>')).toBe('<p>a</p>');
    expect(sanitizeHtml('<img src=x onerror="x()">')).toBe('');
  });

  it('removes form controls', () => {
    const out = sanitizeHtml('<form action="https://e.test"><input name="p"><button>go</button></form>');
    expect(out).not.toMatch(/<(form|input|button)/);
  });

  it('removes style and class, which could cover the page', () => {
    const out = sanitizeHtml('<p style="position:fixed;inset:0" class="fixed inset-0">a</p><style>*{display:none}</style>');
    expect(out).toBe('<p>a</p>');
  });

  it('only keeps http, https and mailto links, without opener access', () => {
    expect(sanitizeHtml('<a href="javascript:x()">a</a>')).toBe('<a>a</a>');
    expect(sanitizeHtml('<a href="data:text/html,x">a</a>')).toBe('<a>a</a>');
    expect(sanitizeHtml('<a href="https://e.test">a</a>'))
      .toBe('<a href="https://e.test" target="_blank" rel="noopener noreferrer nofollow">a</a>');
  });

  it('accepts empty values', () => {
    expect(sanitizeHtml(null)).toBe('');
  });
});
