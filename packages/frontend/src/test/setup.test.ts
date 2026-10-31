/**
 * Smoke test to verify testing infrastructure is properly configured.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

describe('Testing Infrastructure', () => {
  it('vitest is working', () => {
    expect(1 + 1).toBe(2);
  });

  it('fast-check is working', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        return s.length >= 0; // Strings always have non-negative length
      })
    );
  });
});
