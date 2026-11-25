const IRREGULAR: Readonly<Record<string, string>> = {
  was: 'be', were: 'be', been: 'be', is: 'be', are: 'be', am: 'be', being: 'be',
  went: 'go', gone: 'go', goes: 'go',
  broke: 'break', broken: 'break',
  took: 'take', taken: 'take',
  made: 'make',
  got: 'get', gotten: 'get',
  came: 'come',
  saw: 'see', seen: 'see',
  gave: 'give', given: 'give',
  knew: 'know', known: 'know',
  thought: 'think',
  told: 'tell',
  found: 'find',
  kept: 'keep',
  left: 'leave',
  felt: 'feel',
  ran: 'run',
  brought: 'bring',
  held: 'hold',
  stood: 'stand',
  said: 'say',
  paid: 'pay',
  met: 'meet',
  fell: 'fall', fallen: 'fall',
  threw: 'throw', thrown: 'throw',
  drew: 'draw', drawn: 'draw',
  ate: 'eat', eaten: 'eat',
  wrote: 'write', written: 'write',
  spoke: 'speak', spoken: 'speak',
  won: 'win',
  lost: 'lose',
  did: 'do', done: 'do', does: 'do',
  had: 'have', has: 'have',
  began: 'begin', begun: 'begin',
  chose: 'choose', chosen: 'choose',
  drove: 'drive', driven: 'drive',
  grew: 'grow', grown: 'grow',
  hung: 'hang',
  hid: 'hide', hidden: 'hide',
  rose: 'rise', risen: 'rise',
  sold: 'sell',
  sent: 'send',
  slept: 'sleep',
  sat: 'sit',
  stuck: 'stick',
  woke: 'wake', woken: 'wake',
  wore: 'wear', worn: 'wear',
  put: 'put', set: 'set', cut: 'cut', let: 'let',
};

const DOUBLED = /([bcdfghjklmnpqrstvwxz])\1$/;

/** Candidate base forms for a word, most likely first. Never empty; first entry is the cheapest guess. */
function suffixCandidates(word: string): string[] {
  const out: string[] = [];
  const push = (s: string): void => {
    if (s.length >= 2 && s !== word && !out.includes(s)) out.push(s);
  };

  if (word.endsWith('ies') && word.length > 4) push(word.slice(0, -3) + 'y');
  if (word.endsWith('ied') && word.length > 4) push(word.slice(0, -3) + 'y');
  if (word.endsWith('ing') && word.length > 4) {
    const stem = word.slice(0, -3);
    if (DOUBLED.test(stem)) push(stem.slice(0, -1));
    push(stem);
    push(stem + 'e');
  }
  if (word.endsWith('ed') && word.length > 3) {
    const stem = word.slice(0, -2);
    if (DOUBLED.test(stem)) push(stem.slice(0, -1));
    push(stem);
    push(stem + 'e');
  }
  if (word.endsWith('es') && word.length > 3) push(word.slice(0, -2));
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 2) push(word.slice(0, -1));
  return out;
}

function normalizeWord(word: string): string {
  let w = word.toLowerCase().replace(/[’]/g, "'").trim();
  if (w.endsWith("'s")) w = w.slice(0, -2);
  return w.replace(/^['-]+|['-]+$/g, '');
}

/**
 * Every plausible base form of a word (irregular form, or all suffix-rule guesses), most likely first.
 * The word itself is not included. Used by the idiom matcher, which tries each candidate against its
 * dictionary instead of guessing a single lemma.
 */
export function lemmaCandidates(word: string): string[] {
  const w = normalizeWord(word);
  if (!w) return [];
  const irregular = IRREGULAR[w];
  if (irregular) return irregular === w ? [] : [irregular];
  return suffixCandidates(w);
}

/**
 * Reduce a word to a base form.
 * - `exists` (optional) lets callers that have a vocabulary (e.g. the word-frequency list)
 *   pick the first candidate that is a known word. Without it, the first suffix-rule candidate wins.
 *   The content script never passes `exists`, so it never bundles the frequency list.
 */
export function lemmatize(word: string, exists?: (candidate: string) => boolean): string {
  const w = normalizeWord(word);
  if (!w) return w;

  const irregular = IRREGULAR[w];
  if (irregular) return irregular;

  const candidates = suffixCandidates(w);
  if (exists) {
    if (exists(w)) return w;
    for (const candidate of candidates) if (exists(candidate)) return candidate;
    return w;
  }
  return candidates[0] ?? w;
}
