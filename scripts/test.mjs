import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const allTests = ['tests/editor.test.mjs', 'tests/engine.test.mjs', 'tests/browser-shell.test.mjs', 'tests/worker-start.test.mjs', 'tests/zip.test.mjs'];
const testByGroup = {
  editor: 'tests/editor.test.mjs',
  engine: 'tests/engine.test.mjs',
  shell: 'tests/browser-shell.test.mjs',
  worker: 'tests/worker-start.test.mjs',
  zip: 'tests/zip.test.mjs'
};

function changedFiles() {
  try {
    const tracked = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: root, encoding: 'utf8' });
    const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' });
    return `${tracked}\n${untracked}`.split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

function groupsFor(file) {
  if (file.startsWith('tests/')) {
    const match = Object.entries(testByGroup).find(([, testFile]) => testFile === file);
    return match ? [match[0]] : ['all'];
  }
  if (file === 'src/editor-core.js') return ['editor'];
  if (file === 'src/app.js') return ['editor', 'shell', 'worker'];
  if (file === 'src/engine.js' || file === 'src/stoffdaten.js' || file === 'src/fast-data.js' || file.startsWith('data/')) return ['engine'];
  if (file === 'src/worker.js' || file === 'src/worker-bundle.js' || file === 'scripts/build-worker-bundle.mjs') return ['engine', 'worker'];
  if (file === 'src/zip.js') return ['zip'];
  if (file === 'index.html' || file === 'src/style.css') return ['editor', 'shell', 'worker'];
  if (file === 'package.json' || file === 'scripts/test.mjs') return ['all'];
  if (file.endsWith('.md') || file === '.gitignore') return [];
  return ['all'];
}

const args = process.argv.slice(2);
const explicit = args.filter(arg => !arg.startsWith('-'));
const files = explicit.length ? explicit : changedFiles();
const selectedGroups = new Set(files.flatMap(groupsFor));
const selected = selectedGroups.has('all') || files.length === 0
  ? allTests
  : [...selectedGroups].map(group => testByGroup[group]).filter(Boolean);

if (selected.length === 0) {
  console.log('Keine relevanten Tests für die geänderten Dateien.');
  process.exit(0);
}

const unknown = selected.filter(file => !existsSync(resolve(root, file)));
if (unknown.length) throw new Error(`Testdatei fehlt: ${unknown.join(', ')}`);
console.log(`Relevante Tests: ${selected.join(', ')}`);
const result = spawnSync(process.execPath, ['--test', ...selected, ...args.filter(arg => arg.startsWith('-'))], {
  cwd: root,
  stdio: 'inherit'
});
process.exit(result.status ?? 1);
