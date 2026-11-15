import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = path => readFileSync(resolve(root, path), 'utf8');
const dependencies = [
  'vendor/coolprop/coolprop-local.js',
  'data/pipe-catalog.js',
  'src/stoffdaten.js',
  'src/fast-data.js',
  'src/engine.js'
];
const handler = read('src/worker.js').match(/self\.onmessage = async event => \{[\s\S]*$/)?.[0];
if (!handler) throw new Error('Worker-Nachrichtenhandler fehlt.');
const source = [
  "self.window = self;",
  "self.document = { currentScript: { src: 'https://rohrrunner.invalid/vendor/coolprop/coolprop-local.js' }, baseURI: 'https://rohrrunner.invalid/' };",
  read(dependencies[0]),
  "self.document.currentScript.src = 'https://rohrrunner.invalid/src/stoffdaten.js';",
  ...dependencies.slice(1).map(read),
  handler
].join('\n');
writeFileSync(resolve(root, 'src/worker-bundle.js'), 'window.RohrRunnerWorkerBundle = ' + JSON.stringify(source) + ';\n');
console.log('src/worker-bundle.js erstellt.');
