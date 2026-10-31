/**
 * Mock factories for frontend test dependencies.
 * Provides mock auth context, mock API responses, etc.
 */

export interface MockAuthContext {
  user: {
    id: string;
    phone: string | null;
    email: string | null;
    fullName: string | null;
    preferredLanguage: 'hi' | 'en';
    onboardingCompleted: boolean;
  } | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => Promise<void>;
  verifyOTP: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  updateProfile: () => Promise<void>;
}

/**
 * Creates a mock auth context with sensible defaults.
 * Override specific values as needed for your test scenario.
 */
export function createMockAuthContext(overrides: Partial<MockAuthContext> = {}): MockAuthContext {
  return {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: async () => {},
    verifyOTP: async () => {},
    loginWithGoogle: async () => {},
    logout: async () => {},
    refreshToken: async () => {},
    updateProfile: async () => {},
    ...overrides,
  };
}
