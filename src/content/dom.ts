export type Child = Node | string | null | undefined | false;

export interface ElementProps {
  class?: string;
  text?: string;
  attrs?: Record<string, string>;
  on?: { [K in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[K]) => void };
}

/**
 * Tiny element builder. Strings become text nodes and `text` sets textContent, so untrusted text
 * (captions, dictionary and AI output) can never be parsed as HTML.
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElementProps = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props.class) el.className = props.class;
  if (props.text !== undefined) el.textContent = props.text;
  if (props.attrs) for (const [k, v] of Object.entries(props.attrs)) el.setAttribute(k, v);
  if (props.on) {
    for (const [type, handler] of Object.entries(props.on)) {
      el.addEventListener(type, handler as EventListener);
    }
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return el;
}
