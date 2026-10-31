/**
 * Random data generators for tests.
 * Used in both unit tests and property-based tests for creating test inputs.
 */

import { randomUUID, randomInt } from 'crypto';

/**
 * Generate a valid random Indian phone number (10 digits starting with 6-9).
 */
export function generatePhone(): string {
  const firstDigit = randomInt(6, 10); // 6, 7, 8, or 9
  const remaining = Array.from({ length: 9 }, () => randomInt(0, 10)).join('');
  return `${firstDigit}${remaining}`;
}

/**
 * Generate a random 6-digit OTP string (000000-999999).
 */
export function generateOTP(): string {
  return randomInt(0, 1000000).toString().padStart(6, '0');
}

/**
 * Generate a random UUID v4.
 */
export function generateUUID(): string {
  return randomUUID();
}

/**
 * Generate a random email address.
 */
export function generateEmail(domain = 'test.example.com'): string {
  const prefix = `user_${randomInt(10000, 99999)}`;
  return `${prefix}@${domain}`;
}

/**
 * Generate a random valid full name (2-50 chars, letters and spaces only).
 */
export function generateName(): string {
  const firstNames = ['Ram', 'Shyam', 'Priya', 'Anita', 'Vijay', 'Sunita', 'Rahul', 'Neha'];
  const lastNames = ['Kumar', 'Singh', 'Sharma', 'Verma', 'Gupta', 'Yadav', 'Patel'];
  const first = firstNames[randomInt(0, firstNames.length)];
  const last = lastNames[randomInt(0, lastNames.length)];
  return `${first} ${last}`;
}
