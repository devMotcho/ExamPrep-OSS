import { describe, expect, it } from 'vitest';
import { paginate } from './pagination';

const items = [1, 2, 3, 4, 5, 6, 7];

describe('paginate', () => {
  it('returns the requested page', () => {
    expect(paginate(items, 2, 3)).toEqual({ pageItems: [4, 5, 6], currentPage: 2, totalPages: 3 });
    expect(paginate(items, 3, 3).pageItems).toEqual([7]);
  });

  it('falls back when the list shrinks or the page is invalid', () => {
    expect(paginate([1, 2], 5, 3)).toEqual({ pageItems: [1, 2], currentPage: 1, totalPages: 1 });
    expect(paginate(items, 0, 3).currentPage).toBe(1);
  });

  it('treats an empty list as one empty page', () => {
    expect(paginate([], 1, 3)).toEqual({ pageItems: [], currentPage: 1, totalPages: 1 });
  });
});
