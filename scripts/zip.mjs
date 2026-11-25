import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const { version } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const dist = resolve(root, 'dist');
const releaseDir = resolve(root, 'release');
const outFile = resolve(releaseDir, `vocab-explainer-${version}.zip`);

if (!existsSync(dist)) {
  console.error('dist/ not found. Run "npm run build" first.');
  process.exit(1);
}

// A build with a demo API key baked in must never be packaged: anyone with the zip can read the key.
if (existsSync(resolve(dist, 'embedded-key-warning.txt'))) {
  console.error(
    [
      'Refusing to zip: this build contains an embedded API key (VITE_EMBEDDED_API_KEY).',
      'Anyone who receives the zip can read the key. To package a shareable build, remove the key from',
      '.env.local (or rename the file), then run "npm run zip" again.',
    ].join('\n'),
  );
  process.exit(1);
}

mkdirSync(releaseDir, { recursive: true });
rmSync(outFile, { force: true });

if (process.platform === 'win32') {
  execFileSync(
    'powershell',
    ['-NoProfile', '-Command', `Compress-Archive -Path "${dist}\\*" -DestinationPath "${outFile}"`],
    { stdio: 'inherit' },
  );
} else {
  execFileSync('zip', ['-r', '-q', outFile, '.'], { cwd: dist, stdio: 'inherit' });
}

console.log(`Created ${outFile}`);
