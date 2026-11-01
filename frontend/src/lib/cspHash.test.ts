// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Content-Security-Policy', () => {
  it('allows the inline theme script of index.html and no other', () => {
    const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');
    const nginx = readFileSync(resolve(__dirname, '../../../infra/nginx.conf'), 'utf8');
    const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    expect(inline).toHaveLength(1);
    const hash = createHash('sha256').update(inline[0]).digest('base64');
    expect(nginx).toContain(`'sha256-${hash}'`);
  });
});
