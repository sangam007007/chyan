/**
 * Test utility helpers for the backend package.
 * Provides common test utilities, factories, and assertions.
 */

export { createMockUser, createMockSession, createMockExam } from './factories';
export { createTestContext, type TestContext } from './context';
export { generatePhone, generateOTP, generateUUID } from './generators';
