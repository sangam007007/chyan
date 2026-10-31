/**
 * Custom render utility that wraps components with necessary providers.
 * Use this instead of @testing-library/react's render for components
 * that need Auth, i18n, or Router context.
 */

import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';

export interface RenderOptions {
  /** Optional wrapper component for providing context */
  wrapper?: ({ children }: { children: ReactNode }) => ReactElement;
  /** Locale to use for i18n context */
  locale?: 'hi' | 'en';
  /** Whether user is authenticated */
  isAuthenticated?: boolean;
}

/**
 * Renders a component wrapped with all necessary providers for testing.
 * Defaults to unauthenticated state with Hindi locale.
 */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderOptions = {}
): RenderResult {
  const { wrapper } = options;

  if (wrapper) {
    return render(ui, { wrapper });
  }

  return render(ui);
}
