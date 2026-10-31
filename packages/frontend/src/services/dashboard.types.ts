export interface LeaderboardEntry {
  rank: number;
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  totalScore: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  userRank: LeaderboardEntry | null;
  type: 'state' | 'national';
}

export interface StreakResponse {
  currentStreak: number;
  bestStreak: number;
  streakDates: string[]; // ISO date strings (YYYY-MM-DD)
  todayRecorded: boolean;
  milestoneReached: boolean;
}

export interface RankEstimateResponse {
  estimatedRank: number;
  totalApplicants: number;
  marks: number;
  percentile: number; // 2 decimal places
}

/** Wrapper shape for all API responses from the backend */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

/** Error response shape from the backend */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}
