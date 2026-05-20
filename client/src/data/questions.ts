import { RIASECKey } from '../types';

export interface RIASECQuestion {
  dimension: RIASECKey;
  text: string;
  index: number; // 0-based within dimension
}

const QUESTIONS_MAP: Record<RIASECKey, string[]> = {
  realistic: [
    'I enjoy building, fixing, or working with tools and machines.',
    'I prefer hands-on or physical work over sitting at a desk.',
    'I like learning how things work mechanically or electronically.',
    'I would enjoy working outdoors or with animals or plants.',
  ],
  investigative: [
    'I like doing research, experiments, or scientific analysis.',
    'I enjoy solving complex problems or puzzles.',
    'I prefer thinking through problems carefully before acting.',
    'I am curious about how and why things work the way they do.',
  ],
  artistic: [
    'I enjoy expressing myself through art, music, writing, or performance.',
    'I prefer open-ended tasks over strict rules and procedures.',
    'I like coming up with creative or original ideas.',
    'I enjoy activities that allow me to use my imagination.',
  ],
  social: [
    'I enjoy helping, teaching, or supporting other people.',
    'I feel comfortable working in groups or teams.',
    'I like listening to others and offering advice or guidance.',
    'I find it rewarding to make a positive difference in people\'s lives.',
  ],
  enterprising: [
    'I enjoy leading or persuading others toward a goal.',
    'I like taking charge of projects or making decisions.',
    'I am comfortable with competition and taking risks.',
    'I enjoy selling ideas, products, or plans to others.',
  ],
  conventional: [
    'I like organizing information, data, or objects in a clear system.',
    'I prefer following clear instructions over figuring things out on my own.',
    'I enjoy tasks that require accuracy and attention to detail.',
    'I feel productive when I complete structured, step-by-step tasks.',
  ],
};

export const RIASEC_DIMENSIONS: RIASECKey[] = [
  'realistic',
  'investigative',
  'artistic',
  'social',
  'enterprising',
  'conventional',
];

// Flat list of all 24 RIASEC questions in order
export const ALL_RIASEC_QUESTIONS: RIASECQuestion[] = RIASEC_DIMENSIONS.flatMap((dim) =>
  QUESTIONS_MAP[dim].map((text, index) => ({ dimension: dim, text, index }))
);

export const LIKERT_OPTIONS = [
  { label: 'Strongly Disagree', value: 1, emoji: '👎' },
  { label: 'Disagree',          value: 2, emoji: '➖' },
  { label: "I'm Neutral",       value: 3, emoji: '😐' },
  { label: 'Agree',             value: 4, emoji: '✅' },
  { label: 'Strongly Agree',    value: 5, emoji: '👍' },
] as const;
