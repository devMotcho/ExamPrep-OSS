import { describe, expect, it } from 'vitest';
import { readinessAreaId } from './readiness';

const exam = (studyAreaId: string, daysLeft: number) => ({ studyAreaId, daysLeft });

describe('readinessAreaId', () => {
  it('prefers the plan, then the nearest coming exam, then progress', () => {
    expect(readinessAreaId('plan', [exam('near', 2)], 'progress')).toBe('plan');
    expect(readinessAreaId(null, [exam('far', 9), exam('near', 2), exam('past', -1)], 'progress')).toBe('near');
    expect(readinessAreaId(null, [exam('past', -1)], 'progress')).toBe('progress');
    expect(readinessAreaId(null, undefined, undefined)).toBeNull();
  });
});
