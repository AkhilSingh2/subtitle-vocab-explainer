import { act, createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export interface Mounted {
  container: HTMLElement;
  root: Root;
  unmount: () => Promise<void>;
}

export async function mount(element: ReactElement): Promise<Mounted> {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(element);
  });
  return {
    container,
    root,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

/** Lets pending promises (storage reads, message replies) settle inside act. */
export async function flush(times = 3): Promise<void> {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

export async function click(el: Element | null | undefined): Promise<void> {
  if (!el) throw new Error('element to click not found');
  await act(async () => {
    (el as HTMLElement).click();
  });
}

export async function typeInto(input: HTMLInputElement, value: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (!setter) throw new Error('no value setter');
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

export async function choose(select: HTMLSelectElement, value: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  if (!setter) throw new Error('no value setter');
  await act(async () => {
    setter.call(select, value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

export const byText = (root: ParentNode, selector: string, text: string): HTMLElement | null =>
  Array.from(root.querySelectorAll<HTMLElement>(selector)).find((el) => el.textContent?.includes(text)) ?? null;

export { createElement };
