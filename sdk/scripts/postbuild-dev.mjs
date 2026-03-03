import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const distDir = new URL('../dist/', import.meta.url).pathname;
const srcOutDir = join(distDir, 'src');
const examplesOutDir = join(distDir, 'examples');

if (!existsSync(srcOutDir)) {
  process.exit(0);
}

// Move top-level emitted src artifacts to dist root.
for (const name of readdirSync(srcOutDir)) {
  const from = join(srcOutDir, name);
  const to = join(distDir, name);
  renameSync(from, to);
}

// Rewrite dev example imports to flattened dist layout.
if (existsSync(examplesOutDir)) {
  for (const name of readdirSync(examplesOutDir)) {
    if (!name.endsWith('.js')) continue;
    const file = join(examplesOutDir, name);
    const content = readFileSync(file, 'utf8').replaceAll('../src/index.js', '../index.js');
    writeFileSync(file, content, 'utf8');
  }
}

rmSync(srcOutDir, { recursive: true, force: true });
