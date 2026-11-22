import { cp, mkdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(fileURLToPath(import.meta.url));
const root = join(projectRoot, '..');
const dist = join(root, 'dist');
const runtimeFiles = ['index.html', 'manifest.webmanifest', 'sw.js'];
const runtimeDirectories = ['data', 'icons', 'src', 'vendor'];

// Generate from current sources before copying the desktop runtime.
execFileSync(process.execPath, [join(root, 'scripts/build-worker-bundle.mjs')], { cwd: root, stdio: 'inherit' });

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const file of runtimeFiles) {
  await cp(join(root, file), join(dist, file));
}
for (const directory of runtimeDirectories) {
  await cp(join(root, directory), join(dist, directory), { recursive: true });
}

console.log(`Desktop-Dateien vorbereitet: ${dist}`);
