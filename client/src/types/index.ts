// ─── Auth & User ─────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  display_name: string;
  role: 'student' | 'admin';
}

export interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;
}

// ─── Assessment Inputs ────────────────────────────────────────────────────────
export interface Grades {
  math: number;   // 60–100
  science: number;
  english: number;
}

export type RIASECKey = 'realistic' | 'investigative' | 'artistic' | 'social' | 'enterprising' | 'conventional';

export type RIASECScores = Record<RIASECKey, number>; // 0–100 after averaging & scaling

export interface AptitudeRatings {
  logical: number;   // 25 | 50 | 75 | 100
  spatial: number;
  linguistic: number;
}

export interface FISInput {
  grades: Grades;
  riasecScores: RIASECScores;
  aptitude: AptitudeRatings;
}

// ─── FIS Output ───────────────────────────────────────────────────────────────
export type StrandKey = 'STEM' | 'ABM' | 'HUMSS' | 'TVL' | 'GAS';

export interface FISResult {
  strand: StrandKey;
  degreeOfMatch: number; // 0–100
  drivenBy: string[];    // top input labels that fired this strand
}

// ─── Saved Assessment ─────────────────────────────────────────────────────────
export interface Assessment {
  id: string;
  user_id: string;
  grades: Grades;
  riasec_scores: RIASECScores;
  aptitude_ratings: AptitudeRatings;
  recommendations: FISResult[];
  created_at: string;
  display_name?: string;
  email?: string;
}

// ─── RIASEC Raw Answers ───────────────────────────────────────────────────────
export type RIASECAnswers = Record<RIASECKey, number[]>; // each dimension has 4 answers (1–5)

// ─── Assessment Wizard State ──────────────────────────────────────────────────
export type AptitudeKey = 'logical' | 'spatial' | 'linguistic';

export interface AptitudeCardOption {
  label: string;
  value: number;
}
