/**
 * Mamdani Fuzzy Inference System — CareerTrack
 * Fully deterministic, runs entirely on-device with no network calls.
 */

import { FISInput, FISResult, StrandKey } from '../types';

// ─── Trapezoidal Membership Function ─────────────────────────────────────────
// trapMF(x, a, b, c, d): 0 outside [a,d], ramps up a→b, full b→c, ramps down c→d
function trapMF(x: number, a: number, b: number, c: number, d: number): number {
  if (x <= a || x >= d) return 0;
  if (x >= b && x <= c) return 1;
  if (x < b) return (x - a) / (b - a);
  return (d - x) / (d - c);
}

// ─── Membership Functions for grade/RIASEC inputs (0–100 scale) ──────────────
function LOW(x: number): number       { return trapMF(x,  0,  0, 50, 70); }
function MEDIUM(x: number): number    { return trapMF(x, 50, 65, 75, 85); }
function HIGH(x: number): number      { return trapMF(x, 75, 85, 95, 100); }
function VERY_HIGH(x: number): number { return trapMF(x, 90, 95, 100, 100); }

// ─── Aptitude membership (already discretized to 25/50/75/100) ───────────────
function aptMF(val: number, level: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH'): number {
  const map: Record<number, Record<string, number>> = {
    25:  { LOW: 1, MEDIUM: 0, HIGH: 0, VERY_HIGH: 0 },
    50:  { LOW: 0, MEDIUM: 1, HIGH: 0, VERY_HIGH: 0 },
    75:  { LOW: 0, MEDIUM: 0, HIGH: 1, VERY_HIGH: 0 },
    100: { LOW: 0, MEDIUM: 0, HIGH: 0, VERY_HIGH: 1 },
  };
  return map[val]?.[level] ?? 0;
}

const and = (...vals: number[]) => Math.min(...vals);

export interface FISEngineInput {
  math: number;
  science: number;
  english: number;
  realistic: number;
  investigative: number;
  artistic: number;
  social: number;
  enterprising: number;
  conventional: number;
  logical: number;   // aptitude, 25/50/75/100
  spatial: number;   // aptitude, 25/50/75/100
  linguistic: number; // aptitude, 25/50/75/100
}

interface RuleActivation {
  strand: StrandKey;
  strength: number;
  inputs: string[];
}

function evaluateRules(v: FISEngineInput): RuleActivation[] {
  const rules: RuleActivation[] = [];

  // Helper to push a rule result
  const rule = (strand: StrandKey, strength: number, inputs: string[]) => {
    if (strength > 0) rules.push({ strand, strength, inputs });
  };

  // ─── STEM (7 rules) ────────────────────────────────────────────────────────
  rule('STEM', and(HIGH(v.math), HIGH(v.science)),
    ['Math (High)', 'Science (High)']);
  rule('STEM', and(VERY_HIGH(v.math), VERY_HIGH(v.science)),
    ['Math (Very High)', 'Science (Very High)']);
  rule('STEM', and(HIGH(v.math), aptMF(v.logical, 'HIGH')),
    ['Math (High)', 'Logical Reasoning (High)']);
  rule('STEM', and(VERY_HIGH(v.math), aptMF(v.logical, 'VERY_HIGH')),
    ['Math (Very High)', 'Logical Reasoning (Very High)']);
  rule('STEM', and(HIGH(v.science), HIGH(v.investigative)),
    ['Science (High)', 'Investigative (High)']);
  rule('STEM', and(VERY_HIGH(v.science), VERY_HIGH(v.investigative)),
    ['Science (Very High)', 'Investigative (Very High)']);
  rule('STEM', and(HIGH(v.math), HIGH(v.science), HIGH(v.investigative)),
    ['Math (High)', 'Science (High)', 'Investigative (High)']);

  // ─── ABM (3 rules) ─────────────────────────────────────────────────────────
  rule('ABM', and(HIGH(v.enterprising), HIGH(v.conventional)),
    ['Enterprising (High)', 'Conventional (High)']);
  rule('ABM', and(VERY_HIGH(v.enterprising), MEDIUM(v.math)),
    ['Enterprising (Very High)', 'Math (Medium)']);
  rule('ABM', and(VERY_HIGH(v.conventional), HIGH(v.math)),
    ['Conventional (Very High)', 'Math (High)']);

  // ─── HUMSS (5 rules) ───────────────────────────────────────────────────────
  rule('HUMSS', and(HIGH(v.english), HIGH(v.social)),
    ['English (High)', 'Social (High)']);
  rule('HUMSS', and(VERY_HIGH(v.english), VERY_HIGH(v.social)),
    ['English (Very High)', 'Social (Very High)']);
  rule('HUMSS', and(HIGH(v.artistic), HIGH(v.english)),
    ['Artistic (High)', 'English (High)']);
  rule('HUMSS', and(VERY_HIGH(v.social), HIGH(v.artistic)),
    ['Social (Very High)', 'Artistic (High)']);
  rule('HUMSS', and(aptMF(v.linguistic, 'HIGH'), HIGH(v.social), HIGH(v.english)),
    ['Linguistic Skill (High)', 'Social (High)', 'English (High)']);

  // ─── TVL (3 rules) ─────────────────────────────────────────────────────────
  rule('TVL', and(HIGH(v.realistic), aptMF(v.spatial, 'HIGH')),
    ['Realistic (High)', 'Spatial Awareness (High)']);
  rule('TVL', and(VERY_HIGH(v.realistic), MEDIUM(v.math)),
    ['Realistic (Very High)', 'Math (Medium)']);
  rule('TVL', and(aptMF(v.spatial, 'VERY_HIGH'), MEDIUM(v.math)),
    ['Spatial Awareness (Very High)', 'Math (Medium)']);

  // ─── GAS (1 rule + fallback) ───────────────────────────────────────────────
  rule('GAS', and(MEDIUM(v.social), MEDIUM(v.math)),
    ['Social (Medium)', 'Math (Medium)']);
  // Fallback rule
  rule('GAS', and(MEDIUM(v.math), MEDIUM(v.english)),
    ['Math (Medium)', 'English (Medium)']);

  return rules;
}

// ─── Aggregation: max strength per strand ─────────────────────────────────────
function aggregate(rules: RuleActivation[]): Map<StrandKey, { strength: number; inputs: string[] }> {
  const result = new Map<StrandKey, { strength: number; inputs: string[] }>();
  for (const r of rules) {
    const existing = result.get(r.strand);
    if (!existing || r.strength > existing.strength) {
      result.set(r.strand, { strength: r.strength, inputs: r.inputs });
    }
  }
  return result;
}

// ─── Public API ───────────────────────────────────────────────────────────────
export function runFIS(input: FISInput): FISResult[] {
  const v: FISEngineInput = {
    math: input.grades.math,
    science: input.grades.science,
    english: input.grades.english,
    realistic: input.riasecScores.realistic,
    investigative: input.riasecScores.investigative,
    artistic: input.riasecScores.artistic,
    social: input.riasecScores.social,
    enterprising: input.riasecScores.enterprising,
    conventional: input.riasecScores.conventional,
    logical: input.aptitude.logical,
    spatial: input.aptitude.spatial,
    linguistic: input.aptitude.linguistic,
  };

  const rules = evaluateRules(v);
  const aggregated = aggregate(rules);

  const allStrands: StrandKey[] = ['STEM', 'ABM', 'HUMSS', 'TVL', 'GAS'];
  const results: FISResult[] = allStrands.map((strand) => {
    const agg = aggregated.get(strand);
    const strength = agg?.strength ?? 0;
    return {
      strand,
      degreeOfMatch: Math.round(strength * 1000) / 10, // 0–100, 1 decimal
      drivenBy: agg?.inputs ?? [],
    };
  });

  // Sort descending
  results.sort((a, b) => b.degreeOfMatch - a.degreeOfMatch);

  // Fallback: if all zero, force GAS = 15
  const allZero = results.every((r) => r.degreeOfMatch === 0);
  if (allZero) {
    const gasIdx = results.findIndex((r) => r.strand === 'GAS');
    if (gasIdx !== -1) {
      results[gasIdx].degreeOfMatch = 15;
      results[gasIdx].drivenBy = ['No strong strand match — GAS keeps all college options open.'];
      // Re-sort
      results.sort((a, b) => b.degreeOfMatch - a.degreeOfMatch);
    }
  }

  return results;
}

/**
 * Compute RIASEC score for one dimension from 4 raw answers (1–5 scale).
 * Score = (average of 4 answers) × 20 → 0–100 range
 */
export function computeRIASECScore(answers: number[]): number {
  if (answers.length === 0) return 0;
  const avg = answers.reduce((sum, v) => sum + v, 0) / answers.length;
  return Math.round(avg * 20 * 10) / 10; // 1 decimal
}
