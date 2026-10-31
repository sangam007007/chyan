/**
 * Test data factories for creating mock entities.
 * Used in unit and property-based tests.
 */

import { randomUUID } from 'crypto';

export interface MockUser {
  id: string;
  phone: string | null;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  preferred_language: 'hi' | 'en';
  selected_exam_id: string | null;
  google_id: string | null;
  google_avatar_url: string | null;
  onboarding_completed: boolean;
  exam_change_count_this_month: number;
  exam_change_month: number | null;
  deletion_scheduled_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface MockSession {
  id: string;
  user_id: string;
  refresh_token_hash: string;
  token_family: string;
  device_type: 'mobile' | 'desktop' | 'tablet';
  device_info: Record<string, unknown>;
  ip_address: string;
  city: string | null;
  is_active: boolean;
  last_active_at: Date;
  created_at: Date;
  expires_at: Date;
}

export interface MockExam {
  id: string;
  name_en: string;
  name_hi: string;
  description_en: string | null;
  description_hi: string | null;
  category: 'state' | 'central';
  state: string | null;
  icon_url: string | null;
  is_active: boolean;
  display_order: number;
  created_at: Date;
}

export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
  const now = new Date();
  return {
    id: randomUUID(),
    phone: '9876543210',
    email: null,
    full_name: null,
    avatar_url: null,
    preferred_language: 'hi',
    selected_exam_id: null,
    google_id: null,
    google_avatar_url: null,
    onboarding_completed: false,
    exam_change_count_this_month: 0,
    exam_change_month: null,
    deletion_scheduled_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

export function createMockSession(overrides: Partial<MockSession> = {}): MockSession {
  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  return {
    id: randomUUID(),
    user_id: randomUUID(),
    refresh_token_hash: 'hash_' + randomUUID(),
    token_family: randomUUID(),
    device_type: 'mobile',
    device_info: { browser: 'Chrome', os: 'Android' },
    ip_address: '192.168.1.1',
    city: null,
    is_active: true,
    last_active_at: now,
    created_at: now,
    expires_at: thirtyDaysLater,
    ...overrides,
  };
}

export function createMockExam(overrides: Partial<MockExam> = {}): MockExam {
  return {
    id: randomUUID(),
    name_en: 'UP Police Constable',
    name_hi: 'यूपी पुलिस कांस्टेबल',
    description_en: 'UP Police Constable Recruitment Exam',
    description_hi: 'यूपी पुलिस कांस्टेबल भर्ती परीक्षा',
    category: 'state',
    state: 'Uttar Pradesh',
    icon_url: null,
    is_active: true,
    display_order: 1,
    created_at: new Date(),
    ...overrides,
  };
}
