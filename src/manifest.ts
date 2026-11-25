import { defineManifest } from '@crxjs/vite-plugin';
import pkg from '../package.json';
import { API_HOST_PERMISSION } from './shared/apiConfig';

export default defineManifest({
  manifest_version: 3,
  name: 'Subtitle Vocab Explainer',
  version: pkg.version,
  description:
    'Click any word or idiom in YouTube and Netflix captions to see what it means in the scene.',
  icons: {
    '16': 'public/icons/icon-16.png',
    '32': 'public/icons/icon-32.png',
    '48': 'public/icons/icon-48.png',
    '128': 'public/icons/icon-128.png',
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'Subtitle Vocab Explainer',
  },
  background: { service_worker: 'src/background/index.ts', type: 'module' },
  content_scripts: [
    {
      matches: ['https://www.youtube.com/*', 'https://www.netflix.com/*'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
      all_frames: false,
    },
  ],
  permissions: ['storage', 'activeTab'],
  host_permissions: ['https://api.dictionaryapi.dev/*', API_HOST_PERMISSION],
  commands: {
    'toggle-extension': {
      suggested_key: { default: 'Alt+Shift+V' },
      description: 'Turn Subtitle Vocab Explainer on or off',
    },
  },
});
