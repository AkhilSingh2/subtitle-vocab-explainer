import type { Cefr, LevelInfo } from './types';
import { lemmatize } from './lemma';
import { wordFrequency } from './wordFrequency';

export function levelFromRank(rank: number | undefined): Cefr {
  if (rank === undefined) return 'C2';
  if (rank <= 1500) return 'A2';
  if (rank <= 3000) return 'B1';
  if (rank <= 5000) return 'B2';
  if (rank <= 9000) return 'C1';
  return 'C2';
}

/**
 * Estimate a learner level from word frequency. Always `estimated: true`.
 * Idioms are reported as B2 (the UI renders them as "B2+").
 */
export function estimateLevel(term: string, isIdiom: boolean): LevelInfo {
  if (isIdiom) return { level: 'B2', estimated: true };
  const key = term.toLowerCase().trim();
  // An inflected form is never harder than its base form, so use the easier (lower) rank of the two.
  const base = lemmatize(key, (candidate) => candidate !== key && candidate in wordFrequency);
  const ranks = [wordFrequency[key], wordFrequency[base]].filter(
    (rank): rank is number => rank !== undefined,
  );
  return { level: levelFromRank(ranks.length > 0 ? Math.min(...ranks) : undefined), estimated: true };
}
