import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CaptionController, type TermActivation } from '../src/content/captionController';
import { wrapLine } from '../src/content/captionWrapper';
import { findPhrasesInSentence } from '../src/content/idiomMatcher';
import { youtubeAdapter } from '../src/content/siteAdapters';
import { IDIOMS } from '../src/shared/idioms';

beforeAll(() => {
  // jsdom has no layout engine; give ranges a rect so activationForSelection can read one.
  if (!Range.prototype.getBoundingClientRect) {
    Range.prototype.getBoundingClientRect = () => new DOMRect(10, 20, 100, 16);
  }
});

let onActivate: ReturnType<typeof vi.fn<(a: TermActivation) => void>>;
let controller: CaptionController;

function addLine(text: string): HTMLElement {
  const line = document.createElement('span');
  line.className = 'ytp-caption-segment';
  line.textContent = text;
  document.body.append(line);
  const phrases = findPhrasesInSentence(text, IDIOMS).filter((p) => p.endToken > p.startToken);
  wrapLine(line, { phrases, saved: new Set() });
  return line;
}

function select(from: Node, fromOffset: number, to: Node, toOffset: number): Selection {
  const range = document.createRange();
  range.setStart(from, fromOffset);
  range.setEnd(to, toOffset);
  const selection = window.getSelection() as Selection;
  selection.removeAllRanges();
  selection.addRange(range);
  return selection;
}

beforeEach(() => {
  document.body.innerHTML = '';
  window.getSelection()?.removeAllRanges();
  onActivate = vi.fn<(a: TermActivation) => void>();
  controller = new CaptionController(youtubeAdapter, onActivate);
});

describe('activationFor / navigation', () => {
  it('builds a word activation and an idiom activation with its bundled meaning', () => {
    const line = addLine('He had to break the ice today');
    const word = line.querySelector<HTMLElement>('.sve-w[data-sve-i="0"]') as HTMLElement;
    expect(controller.activationFor(word)).toMatchObject({ term: 'He', isPhrase: false, anchor: word });

    const group = line.querySelector<HTMLElement>('.sve-p') as HTMLElement;
    const activation = controller.activationFor(group);
    expect(activation).toMatchObject({ term: 'break the ice', isPhrase: true });
    expect(activation?.phraseMeaning).toBe(IDIOMS['break the ice']);
  });

  it('strips edge punctuation from the shown term', () => {
    const line = addLine("Don't stop -well-");
    const words = Array.from(line.querySelectorAll<HTMLElement>('.sve-w'));
    expect(words.map((w) => controller.activationFor(w)?.term)).toEqual(["Don't", 'stop', 'well']);
  });

  it('moves to the next/previous item in the line, treating an idiom as one item, and wraps', () => {
    const line = addLine('We must break the ice now');
    const items = Array.from(line.querySelectorAll<HTMLElement>(':scope > .sve-w, :scope > .sve-p'));
    expect(items.map((i) => i.textContent)).toEqual(['We', 'must', 'break the ice', 'now']);

    const must = items[1] as HTMLElement;
    expect(controller.getAdjacentActivation(must, 1)?.term).toBe('break the ice');
    expect(controller.getAdjacentActivation(items[2] as HTMLElement, 1)?.term).toBe('now');
    expect(controller.getAdjacentActivation(items[3] as HTMLElement, 1)?.term).toBe('We');
    expect(controller.getAdjacentActivation(items[0] as HTMLElement, -1)?.term).toBe('now');
  });

  it('returns null for navigation from an element that is not in a wrapped line', () => {
    const stray = document.createElement('span');
    document.body.append(stray);
    expect(controller.getAdjacentActivation(stray, 1)).toBeNull();
  });
});

describe('activationForSelection (drag-select)', () => {
  it('opens a phrase activation for 2–6 selected words, with a fixed anchor rect', () => {
    const line = addLine('She said hello to everyone');
    const first = line.querySelector('.sve-w[data-sve-i="1"]')?.firstChild as Node; // "said"
    const last = line.querySelector('.sve-w[data-sve-i="3"]')?.firstChild as Node; // "to"
    const selection = select(first, 0, last, 2);
    const activation = controller.activationForSelection(selection);
    expect(activation).toMatchObject({ term: 'said hello to', isPhrase: true, anchor: line });
    expect(activation?.anchorRect).toEqual({ top: 20, left: 10, width: 100, height: 16 });
    expect(activation?.phraseMeaning).toBeUndefined();
  });

  it('attaches the idiom meaning when the selection is exactly a known idiom', () => {
    const line = addLine('He had to break the ice today');
    const group = line.querySelector('.sve-p') as HTMLElement;
    const range = document.createRange();
    range.selectNodeContents(group);
    const selection = window.getSelection() as Selection;
    selection.removeAllRanges();
    selection.addRange(range);
    const activation = controller.activationForSelection(selection);
    expect(activation?.term).toBe('break the ice');
    expect(activation?.phraseMeaning).toBe(IDIOMS['break the ice']);
  });

  it('treats a one-word selection like a click on that word', () => {
    const line = addLine('Hello wonderful world');
    const word = line.querySelector('.sve-w[data-sve-i="1"]') as HTMLElement;
    const selection = select(word.firstChild as Node, 0, word.firstChild as Node, 9);
    expect(controller.activationForSelection(selection)).toMatchObject({
      term: 'wonderful',
      isPhrase: false,
      anchor: word,
    });
  });

  it('ignores selections that span two caption lines or leave the captions', () => {
    const a = addLine('First line here');
    const b = addLine('Second line here');
    const across = select(a.querySelector('.sve-w')?.firstChild as Node, 0, b.querySelector('.sve-w')?.firstChild as Node, 3);
    expect(controller.activationForSelection(across)).toBeNull();

    const outside = document.createElement('p');
    outside.textContent = 'Some page text';
    document.body.append(outside);
    const elsewhere = select(outside.firstChild as Node, 0, outside.firstChild as Node, 9);
    expect(controller.activationForSelection(elsewhere)).toBeNull();
  });

  it('ignores selections of more than 6 words or more than 60 characters', () => {
    const seven = addLine('one two three four five six seven eight');
    const words = Array.from(seven.querySelectorAll('.sve-w'));
    const tooMany = select(words[0]?.firstChild as Node, 0, words[6]?.firstChild as Node, 5);
    expect(controller.activationForSelection(tooMany)).toBeNull();

    const long = addLine('extraordinarily unbelievably incomprehensibly disproportionately unquestionably');
    const lw = Array.from(long.querySelectorAll('.sve-w'));
    const tooLong = select(lw[0]?.firstChild as Node, 0, lw[4]?.firstChild as Node, 13);
    expect(controller.activationForSelection(tooLong)).toBeNull();
  });
});

describe('clicks', () => {
  it('opens the card on a word click and stops the host page from seeing it', () => {
    const line = addLine('Hello world');
    controller.start();
    const hostListener = vi.fn();
    document.body.addEventListener('click', hostListener);

    const word = line.querySelector('.sve-w') as HTMLElement;
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    word.dispatchEvent(event);

    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onActivate.mock.calls[0]?.[0]).toMatchObject({ term: 'Hello' });
    expect(event.defaultPrevented).toBe(true);
    expect(hostListener).not.toHaveBeenCalled();
    controller.stop();
  });

  it('ignores clicks elsewhere and lets them through', () => {
    controller.start();
    const hostListener = vi.fn();
    document.body.addEventListener('click', hostListener);
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onActivate).not.toHaveBeenCalled();
    expect(hostListener).toHaveBeenCalledTimes(1);
    controller.stop();
  });

  it('swallows the click that follows a drag-selection', () => {
    const line = addLine('Hello world');
    controller.start();
    controller.suppressClicks(300);
    (line.querySelector('.sve-w') as HTMLElement).dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );
    expect(onActivate).not.toHaveBeenCalled();
    controller.stop();
  });

  it('does not let the host page see pointer/mouse events on caption words', () => {
    const line = addLine('Hello world');
    controller.start();
    const hostListener = vi.fn();
    document.body.addEventListener('mousedown', hostListener);
    (line.querySelector('.sve-w') as HTMLElement).dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(hostListener).not.toHaveBeenCalled();
    controller.stop();
  });

  it('removes its listeners and styles on stop', () => {
    const line = addLine('Hello world');
    controller.start();
    expect(document.getElementById('sve-page-styles')).not.toBeNull();
    controller.stop();
    expect(document.getElementById('sve-page-styles')).toBeNull();
    (line.querySelector('.sve-w') as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('identifies caption targets', () => {
    const line = addLine('Hello world');
    const other = document.createElement('div');
    document.body.append(other);
    expect(controller.isCaptionTarget(line)).toBe(true);
    expect(controller.isCaptionTarget(line.querySelector('.sve-w'))).toBe(true);
    expect(controller.isCaptionTarget(other)).toBe(false);
    expect(controller.isCaptionTarget(null)).toBe(false);
  });
});
