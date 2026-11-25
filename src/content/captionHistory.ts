const MAX_SENTENCES = 2;
const MAX_CHARS = 300;

function squash(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Remembers the last two distinct caption sentences so a lookup can send "previous + current" as context.
 * Auto-generated YouTube captions grow word by word; those updates replace the latest entry instead of
 * evicting the previous sentence.
 */
export class CaptionHistory {
  private sentences: string[] = [];

  /** Returns true if the caption text changed (so callers can react to a new line). */
  push(sentence: string): boolean {
    const next = squash(sentence);
    if (next === '') return false;
    const last = this.sentences[this.sentences.length - 1];
    if (last === next) return false;
    if (last !== undefined && (next.startsWith(last) || last.startsWith(next))) {
      this.sentences[this.sentences.length - 1] = next;
      return true;
    }
    this.sentences.push(next);
    if (this.sentences.length > MAX_SENTENCES) this.sentences.shift();
    return true;
  }

  getContext(): string {
    const joined = this.sentences.join(' ');
    return joined.length > MAX_CHARS ? joined.slice(joined.length - MAX_CHARS).trimStart() : joined;
  }

  clear(): void {
    this.sentences = [];
  }
}
