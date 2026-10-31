/**
 * Smoke test to verify testing infrastructure is properly configured.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { generatePhone, generateOTP } from './helpers/generators';

describe('Testing Infrastructure', () => {
  it('vitest is working', () => {
    expect(1 + 1).toBe(2);
  });

  it('fast-check is working', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        return a + b === b + a; // Commutativity of addition
      })
    );
  });

  it('test helpers are importable', () => {
    const phone = generatePhone();
    expect(phone).toHaveLength(10);
    expect(/^[6-9]\d{9}$/.test(phone)).toBe(true);

    const otp = generateOTP();
    expect(otp).toHaveLength(6);
    expect(/^\d{6}$/.test(otp)).toBe(true);
  });
});
