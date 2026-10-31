import { createContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import api, { setAccessToken, getAccessToken, fetchCsrfToken } from '@/services/api';
import { type AxiosError } from 'axios';

export interface User {
  id: string;
  phone?: string;
  email?: string;
  fullName?: string;
  preferredLanguage: 'hi' | 'en';
  selectedExamId?: string;
  onboardingCompleted: boolean;
  avatarUrl?: string;
  role?: string;
}

export interface ProfileUpdate {
  fullName?: string;
  preferredLanguage?: 'hi' | 'en';
  avatarUrl?: string;
  selectedExamId?: string;
  onboardingCompleted?: boolean;
}

export interface LoginResponse {
  accessToken: string;
  user: User;
  nextStep: 'dashboard' | 'exam_selection' | 'profile_setup' | 'account_link';
  linkingInfo?: {
    existingPhone?: string;
    provider?: string;
  };
}

export interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (phone: string) => Promise<{ expiresIn: number; resendAfter: number }>;
  verifyOTP: (phone: string, otp: string, captchaToken?: string | null) => Promise<LoginResponse>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  updateProfile: (data: Partial<ProfileUpdate>) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider manages the authentication state for the application.
 *
 * Key behaviors:
 * - Access token stored in memory only (Req 7.4)
 * - Refresh token in HTTP-only cookie (managed server-side)
 * - CSRF token fetched on startup and stored in memory
 * - On mount, attempts silent token refresh to restore session
 * - Provides login, verifyOTP, loginWithGoogle, logout, refreshToken, updateProfile
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  /**
   * On mount: attempt to restore session via token refresh.
   * If a valid refresh token cookie exists, the server will issue a new access token.
   * Also fetches a CSRF token for subsequent state-changing requests.
   */
  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        // Fetch CSRF token first
        await fetchCsrfToken();

        // Attempt silent refresh to restore session
        const response = await api.post('/api/auth/token/refresh');
        const data = response.data?.data;

        if (mounted && data?.accessToken) {
          setAccessToken(data.accessToken);
          if (data.user) {
            setUser(data.user);
          } else {
            // Fetch profile to get user data (refresh only returns accessToken)
            try {
              const profileRes = await api.get('/api/profile');
              const profile = profileRes.data?.data;
              if (mounted && profile) {
                setUser({
                  id: profile.id,
                  phone: profile.phone,
                  email: profile.email,
                  fullName: profile.full_name,
                  preferredLanguage: profile.preferred_language || 'hi',
                  selectedExamId: profile.selected_exam_id,
                  onboardingCompleted: profile.onboarding_completed,
                  avatarUrl: profile.avatar_url,
                  role: profile.role,
                });
              }
            } catch { /* profile fetch failed, user stays null */ }
          }
        }
      } catch {
        // No valid session - user needs to log in
        if (mounted) {
          setAccessToken(null);
          setUser(null);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    initializeAuth();

    return () => {
      mounted = false;
    };
  }, []);

  /**
   * Send OTP to a phone number.
   * Returns timing info for countdown display.
   *
   * Requirement 2.1: Send OTP via SMS
   */
  const login = useCallback(async (phone: string): Promise<{ expiresIn: number; resendAfter: number }> => {
    const response = await api.post('/api/auth/otp/send', { phone });
    const data = response.data?.data;
    return {
      expiresIn: data?.expiresIn ?? 300,
      resendAfter: data?.resendAfter ?? 30,
    };
  }, []);

  /**
   * Verify OTP and authenticate the user.
   * On success: stores access token in memory, updates user state.
   *
   * Requirement 3.1: Authenticate on valid OTP
   * Requirement 7.4: Access token in memory only
   */
  const verifyOTP = useCallback(
    async (phone: string, otp: string, captchaToken?: string | null): Promise<LoginResponse> => {
      const response = await api.post('/api/auth/otp/verify', {
        phone,
        otp,
        captchaToken: captchaToken || null,
      });

      const data = response.data?.data;

      if (data?.accessToken) {
        setAccessToken(data.accessToken);
      }

      if (data?.user) {
        setUser(data.user);
      }

      return {
        accessToken: data?.accessToken ?? '',
        user: data?.user ?? null,
        nextStep: data?.nextStep ?? 'dashboard',
        linkingInfo: data?.linkingInfo,
      };
    },
    []
  );

  /**
   * Initiate Google OAuth login.
   * Redirects to Google consent screen.
   *
   * Requirement 5.1: Redirect to Google consent screen
   */
  const loginWithGoogle = useCallback(async () => {
    try {
      const response = await api.get('/api/auth/google');
      const authUrl = response.data?.data?.url;

      if (authUrl) {
        // Redirect to Google consent screen
        window.location.href = authUrl;
      }
    } catch (error) {
      throw error;
    }
  }, []);

  /**
   * Logout: clear access token, call server to invalidate session.
   *
   * Requirement 7.5: Invalidate both tokens on logout
   */
  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // Even if the server call fails, clear local state
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  /**
   * Manually refresh the access token.
   * Called by the response interceptor on 401, but can also be called directly.
   *
   * Requirement 7.2: Refresh access token without re-authentication
   */
  const refreshToken = useCallback(async () => {
    try {
      const response = await api.post('/api/auth/token/refresh');
      const data = response.data?.data;

      if (data?.accessToken) {
        setAccessToken(data.accessToken);
        if (data.user) {
          setUser(data.user);
        }
      } else {
        throw new Error('No access token in refresh response');
      }
    } catch (error) {
      // Refresh failed - clear session
      setAccessToken(null);
      setUser(null);
      throw error;
    }
  }, []);

  /**
   * Update user profile data (name, language, etc.).
   * Updates local state optimistically then syncs with server.
   *
   * Requirement 12.2: Update profile fields
   */
  const updateProfile = useCallback(
    async (data: Partial<ProfileUpdate>) => {
      const previous = user;

      // Optimistic update
      setUser((prev) => (prev ? { ...prev, ...data } : prev));

      // PATCH /api/profile only accepts snake_case full_name / preferred_language.
      const body: Record<string, unknown> = {};
      if (data.fullName !== undefined) body.full_name = data.fullName;
      if (data.preferredLanguage !== undefined) body.preferred_language = data.preferredLanguage;
      if (Object.keys(body).length === 0) return;

      try {
        const response = await api.patch('/api/profile', body);
        const p = response.data?.data;
        if (p) {
          setUser((prev) =>
            prev
              ? {
                  ...prev,
                  fullName: p.full_name ?? prev.fullName,
                  preferredLanguage: p.preferred_language ?? prev.preferredLanguage,
                  avatarUrl: p.avatar_url ?? prev.avatarUrl,
                }
              : prev,
          );
        }
      } catch (error) {
        // Revert optimistic update on failure
        setUser(previous);
        throw error;
      }
    },
    [user]
  );

  const contextValue = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated,
      isLoading,
      login,
      verifyOTP,
      loginWithGoogle,
      logout,
      refreshToken,
      updateProfile,
    }),
    [user, isAuthenticated, isLoading, login, verifyOTP, loginWithGoogle, logout, refreshToken, updateProfile]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}
