import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import '../popup/index.css';

const SAMPLE_VIDEO = 'https://www.youtube.com/watch?v=iG9CE55wbtY';

function Step(props: { n: number; title: string; text: string; children: ReactNode }): ReactNode {
  return (
    <li className="flex flex-1 flex-col gap-3 rounded-xl border border-light-border p-4 dark:border-white/10">
      <div className="flex h-20 items-center justify-center rounded-lg bg-black/5 dark:bg-white/5" aria-hidden="true">
        {props.children}
      </div>
      <h2 className="text-sm font-semibold">
        {props.n}. {props.title}
      </h2>
      <p className="text-sm text-light-secondary dark:text-dark-secondary">{props.text}</p>
    </li>
  );
}

export function Onboarding(): ReactNode {
  return (
    <main className="mx-auto flex min-h-screen max-w-[640px] flex-col gap-8 px-6 py-12 font-sans text-light-text dark:text-dark-text">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Understand every word you hear.</h1>
        <p className="text-light-secondary dark:text-dark-secondary">
          Subtitle Vocab Explainer works on YouTube and Netflix captions.
        </p>
      </header>

      <ol className="flex flex-col gap-4 sm:flex-row">
        <Step n={1} title="Turn on captions" text="Turn on English captions or subtitles.">
          <span className="rounded border-2 border-current px-2 py-0.5 text-lg font-bold">CC</span>
        </Step>
        <Step n={2} title="Click a word" text="Click any word, or drag across a phrase.">
          <span className="rounded bg-black px-3 py-1.5 text-sm text-white">
            Let’s{' '}
            <span className="rounded bg-[rgba(124,156,255,0.45)] px-0.5">break</span>{' '}
            the ice
          </span>
        </Step>
        <Step n={3} title="Optional: add AI" text="Paste an Anthropic API key in Settings for in-context meanings.">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/20 text-xl">✨</span>
        </Step>
      </ol>

      <div className="flex flex-col items-start gap-3">
        <a
          href={SAMPLE_VIDEO}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg bg-light-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-light-accent dark:bg-accent dark:text-black"
        >
          Try it on a YouTube video
        </a>
        <p className="text-sm text-light-secondary dark:text-dark-secondary">
          Tip: press <kbd className="rounded border border-light-border px-1.5 py-0.5 text-xs dark:border-white/20">Alt+Shift+V</kbd> to
          turn it on or off.
        </p>
      </div>
    </main>
  );
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <Onboarding />
    </StrictMode>,
  );
}
