// Separater Review-Audit mit ausschließlich synthetischen Netzen.
// Exit 1 bedeutet verletzte Erwartungen; offene Defekte werden nicht als Erfolg gewertet.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const app = read('src/app.js');
const sourceFunction = name => {
  const lines = app.split(/\r?\n/), start = lines.findIndex(line => new RegExp(`^  (?:async )?function ${name}\\(`).test(line));
  assert.ok(start >= 0, `Funktion fehlt: ${name}`);
  let end = start + 1;
  if (!lines[start].trimEnd().endsWith('}')) {
    while (end < lines.length && !/^  }\s*$/.test(lines[end])) end++;
    assert.ok(end < lines.length, `Funktionsende fehlt: ${name}`);
    end++;
  }
  return lines.slice(start, end).join('\n');
};
const context = { console, WebAssembly, Uint8Array, ArrayBuffer, URL, TextDecoder, TextEncoder, atob,
  crypto: webcrypto, setTimeout, clearTimeout, location: { href: new URL('index.html', root).href } };
context.window = context;
context.document = { currentScript: { src: new URL('src/stoffdaten.js', root).href }, baseURI: new URL('index.html', root).href };
const vm = createContext(context);
for (const path of ['vendor/coolprop/coolprop-local.js', 'data/secondary-fluids.js', 'src/stoffdaten.js', 'src/fast-data.js', 'src/engine.js', 'src/editor-core.js'])
  runInContext(read(path), vm, { filename: path });
await context.RohrStoffdaten.load();
const engine = context.RohrRunnerEngine, editor = context.RohrRunnerEditor, data = context.RohrStoffdaten;
const catalog = JSON.parse(read('data/pipe-catalog.json'));
const base = { fluid: 'R513A', simultaneity: 1, evaporationC: -10, condensationC: 45, superheatK: 25,
  subcoolingK: 2, suctionLimitK: 2, liquidLimitK: 1, minVelocityMS: 0, maxVelocityMS: 30,
  designPressureBar: 24, roughnessMicroM: 1.5, fittingsFactor: 1.5, viscosityMarginPercent: 15 };
const secondary = { ...base, mode: 'secondary', secondaryFluid: 'WATER', glycolConcentrationMassPercent: 0,
  supplyTemperatureC: 6, returnTemperatureC: 12, secondaryPipeSeries: 'viega-temponox',
  secondaryPressureLimitKPa: 50, secondaryMaxVelocityMS: 1.5 };
const network = (length = 10, coolingKW = 3) => ({
  nodes: [{ id: 's', type: 'start', name: 'Start', x: 0, y: 0 },
    { id: 'e', type: 'endpoint', name: 'Synthetisch', x: length, y: 0, coolingKW }],
  edges: [{ id: 'p', from: 's', to: 'e', points: [{ x: 0, y: 0 }, { x: length, y: 0 }] }]
});
const checks = [];
async function check(id, title, fn) {
  const start = performance.now();
  try { checks.push({ id, title, status: 'pass', evidence: await fn(), durationMs: performance.now() - start }); }
  catch (error) { checks.push({ id, title, status: 'fail', error: error.message.replaceAll(process.execPath, '<node>'), durationMs: performance.now() - start }); }
}
const plain = value => JSON.parse(JSON.stringify(value));
const finiteRows = result => result.rows.every(row => ['lengthM', 'flowKgS', 'velocityMS', 'pressureDropPa'].every(key => Number.isFinite(row[key])));

const stressCase = process.argv.find(arg => arg.startsWith('--stress-case='));
// Laufzeitziele vor der Messung festgelegt; sie gelten für den Kindprozess einschließlich Start auf der Prüfmaschine.
const STRESS_TARGET_MS = { secondary: 10000, refrigerant: 60000 };
const STRESS_CASES = [
  ...[10, 100, 500, 1499].map(count => ({ topology: 'comb', count, sizing: 'manual', mode: 'secondary' })),
  ...['star', 'tree', 'distributor'].map(topology => ({ topology, count: 1499, sizing: 'manual', mode: 'secondary' })),
  ...['comb', 'star', 'tree', 'distributor'].map(topology => ({ topology, count: 1499, sizing: 'auto', mode: 'secondary' })),
  ...[10, 20, 50].map(count => ({ topology: 'comb', count, sizing: 'auto', mode: 'refrigerant' })),
  { topology: 'tree', count: 20, sizing: 'auto', mode: 'refrigerant' }
];
const stressNetwork = (topology, count) => {
  const net = { nodes: [{ id: 's', type: 'start', x: 0, y: 0 }], edges: [] };
  const link = (from, to) => net.edges.push({ id: `${from.id}-${to.id}`, from: from.id, to: to.id, points: from.x === to.x || from.y === to.y ? [{ x: from.x, y: from.y }, { x: to.x, y: to.y }] : [{ x: from.x, y: from.y }, { x: from.x, y: to.y }, { x: to.x, y: to.y }] });
  const endpoint = (i, x, y) => ({ id: `e${i}`, type: 'endpoint', x, y, coolingKW: 0.01, name: `S${i}` });
  if (topology === 'comb') {
    let previous = net.nodes[0];
    for (let i = 0; i < count; i++) {
      const junction = { id: `j${i}`, type: 'junction', x: i + 1, y: 0 }, end = endpoint(i, i + 1, 1);
      link(previous, junction); link(junction, end); net.nodes.push(junction, end); previous = junction;
    }
  } else if (topology === 'star') {
    const hub = { id: 'hub', type: 'junction', x: 1, y: 0 }; net.nodes.push(hub); link(net.nodes[0], hub);
    for (let i = 0; i < count; i++) { const end = endpoint(i, 2, i); net.nodes.push(end); link(hub, end); }
  } else if (topology === 'tree') {
    const first = { id: 'r', type: 'junction', x: 1, y: 0 }; net.nodes.push(first); link(net.nodes[0], first);
    let level = [first], made = 0, depth = 1;
    while (made < count) {
      const next = [];
      for (const parent of level) for (const side of [0, 1]) {
        if (made + next.length >= count) break;
        next.push({ parent, child: { id: `${parent.id}${side}`, type: 'junction', x: depth + 1, y: parent.y * 2 + side } });
      }
      if (next.length * 2 >= count - made || depth > 20) {
        for (const [index, { parent }] of next.entries()) { const end = endpoint(made, depth + 1, index); made++; net.nodes.push(end); link(parent, end); if (made >= count) break; }
        while (made < count) for (const parent of level) { if (made >= count) break; const end = endpoint(made, depth + 2, made); made++; net.nodes.push(end); link(parent, end); }
        break;
      }
      for (const { parent, child } of next) { net.nodes.push(child); link(parent, child); }
      level = next.map(item => item.child); depth++;
    }
  } else if (topology === 'distributor') {
    const branches = Math.ceil(Math.sqrt(count)); let made = 0, previous = net.nodes[0];
    for (let b = 0; b < branches && made < count; b++) {
      const tap = { id: `t${b}`, type: 'junction', x: b + 1, y: 0 }; net.nodes.push(tap); link(previous, tap); previous = tap;
      let branchPrevious = tap;
      for (let k = 0; k < branches && made < count; k++) {
        const junction = { id: `b${b}-${k}`, type: 'junction', x: b + 1, y: k + 1 }, end = endpoint(made++, b + 1.5, k + 1);
        net.nodes.push(junction, end); link(branchPrevious, junction); link(junction, end); branchPrevious = junction;
      }
    }
  } else throw new Error(`Unbekannte Netzform ${topology}`);
  assert.equal(net.nodes.filter(node => node.type === 'endpoint').length, count);
  return net;
};
const stressId = item => `STRESS-${item.mode === 'refrigerant' ? 'KM' : 'KT'}-${item.topology}-${item.sizing}-${item.count}`;
if (process.argv.includes('--stress')) {
  for (const item of STRESS_CASES) await check(stressId(item), `${item.count} Kühlstellen, ${item.topology}, ${item.sizing}, ${item.mode}: Ziel ≤ ${STRESS_TARGET_MS[item.mode] / 1000} s`, () => {
    const started = performance.now();
    const output = execFileSync(process.execPath, [fileURLToPath(import.meta.url), `--stress-case=${item.mode}:${item.topology}:${item.sizing}:${item.count}`],
      { encoding: 'utf8', timeout: STRESS_TARGET_MS[item.mode] * 3, windowsHide: true, maxBuffer: 1 << 24 });
    const elapsedMs = Math.round(performance.now() - started), result = JSON.parse(output);
    assert.equal(result.summary.fail, 0, JSON.stringify(result.checks));
    assert.ok(elapsedMs <= STRESS_TARGET_MS[item.mode], `${elapsedMs} ms überschreiten das Ziel von ${STRESS_TARGET_MS[item.mode]} ms.`);
    return { ...result.checks[0].evidence, elapsedMsIncludingStart: elapsedMs, targetMs: STRESS_TARGET_MS[item.mode] };
  });
} else if (stressCase) {
  const [mode, topology, sizing, countText] = stressCase.split('=')[1].split(':'), count = Number(countText);
  assert.ok(Number.isInteger(count) && count >= 1 && count <= 1499);
  assert.ok(['secondary', 'refrigerant'].includes(mode) && ['manual', 'auto'].includes(sizing));
  await check(stressId({ mode, topology, sizing, count }), `${count} Kühlstellen, ${topology}`, () => {
    const net = stressNetwork(topology, count);
    if (mode === 'refrigerant') for (const node of net.nodes) if (node.type === 'endpoint') node.coolingKW = 1;
    if (sizing === 'manual') {
      const sizeId = '54x1.5';
      assert.ok(catalog.series.find(s => s.id === 'viega-temponox').sizes.some(s => `${s.odMm}x${s.wallMm}` === sizeId));
      for (const edge of net.edges) edge.thermal = Object.fromEntries(['suction', 'liquid'].map(type => [type, { mode: 'manual', sizeId }]));
    } else if (mode === 'secondary') for (const node of net.nodes) if (node.type === 'endpoint') node.coolingKW = 0.1;
    const started = performance.now(), result = engine.calculate(net, 1, mode === 'secondary' ? secondary : base, data, catalog), calculationMs = Math.round(performance.now() - started);
    assert.ok(finiteRows(result));
    assert.equal(result.rows.length, net.edges.length * 2);
    return { nodes: net.nodes.length, edges: net.edges.length, valid: result.valid, issues: result.issues.length, calculationMs, memoryMiB: Math.round(process.memoryUsage().rss / 1048576) };
  });
} else {
  await check('SEC-01', 'PDF.js besitzt den Fix oder die Mitigation für CVE-2024-4367', () => {
    const pdf = createContext({ console, TextDecoder, TextEncoder, URL, setTimeout, clearTimeout });
    runInContext(read('vendor/pdfjs/pdf.min.js'), pdf);
    const version = pdf.pdfjsLib.version, [major, minor, patch] = version.split('.').map(Number);
    const patched = major > 4 || major === 4 && (minor > 2 || minor === 2 && patch >= 67);
    assert.ok(patched || /isEvalSupported\s*:\s*false/.test(sourceFunction('preparePdfDocument')),
      `PDF.js ${version}; preparePdfDocument setzt isEvalSupported nicht auf false (GHSA-wgrm-67xf-hhpq).`);
    return { version };
  });
  await check('SEC-02', 'Lokaler Server sperrt private Dateien auch bei Windows-Pfadtrennern', async () => {
    const probe = createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
    const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
    const server = spawn(process.execPath, [fileURLToPath(new URL('scripts/serve.mjs', root))],
      { env: { ...process.env, ROHRRUNNER_PORT: String(port) }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Testserver startet nicht innerhalb 5 Sekunden')), 5000);
        server.once('error', error => { clearTimeout(timer); reject(error); });
        server.stdout.once('data', () => { clearTimeout(timer); resolve(); });
        server.once('exit', code => { clearTimeout(timer); reject(new Error(`Testserver beendet: ${code}`)); });
      });
      const responses = [];
      for (const path of ['/', '/.git/config', '/src/x%5c..%5c..%5cAGENTS.md']) {
        const response = await fetch(`http://127.0.0.1:${port}${path}`, { signal: AbortSignal.timeout(5000) });
        responses.push({ path, status: response.status }); await response.body.cancel();
      }
      assert.equal(responses[0].status, 200);
      assert.ok(responses.slice(1).every(r => [403, 404].includes(r.status)), JSON.stringify(responses));
      return responses;
    } finally { server.kill(); }
  });
  await check('BUILD-01', 'Eingebetteter Worker entspricht den aktuellen Quellen', () => {
    const dependencies = ['vendor/coolprop/coolprop-local.js', 'data/pipe-catalog.js', 'data/secondary-fluids.js', 'src/stoffdaten.js', 'src/fast-data.js', 'src/engine.js'];
    const handler = read('src/worker.js').match(/self\.onmessage = async event => \{[\s\S]*$/)?.[0];
    assert.ok(handler);
    const expected = ["self.window = self;", "self.document = { currentScript: { src: 'https://rohrrunner.invalid/vendor/coolprop/coolprop-local.js' }, baseURI: 'https://rohrrunner.invalid/' };",
      read(dependencies[0]), "self.document.currentScript.src = 'https://rohrrunner.invalid/src/stoffdaten.js';", ...dependencies.slice(1).map(read), handler].join('\n');
    const bundled = createContext({ window: {} }); runInContext(read('src/worker-bundle.js'), bundled);
    assert.ok(bundled.window.RohrRunnerWorkerBundle.replace(/\r\n/g, '\n') === expected.replace(/\r\n/g, '\n'), 'Worker-Bundle weicht auch nach Zeilenendennormalisierung von den Quellen ab.');
    return { bytes: Buffer.byteLength(bundled.window.RohrRunnerWorkerBundle), normalizedLineEndings: true };
  });
  await check('PWA-01', 'Alle Dateien der Offline-App-Shell sind vorhanden', () => {
    const shell = read('sw.js').match(/const APP_SHELL = (\[[\s\S]*?\]);/)[1];
    const paths = runInContext(shell, createContext({}));
    for (const path of paths) if (path !== './') assert.ok(readFileSync(new URL(path, root)).byteLength > 0, path);
    return { files: paths.length - 1 };
  });
  await check('DATA-01', 'Kataloge und Versionen sind konsistent', () => {
    const c = createContext({ window: {} }); runInContext(read('data/pipe-catalog.js'), c);
    assert.deepEqual(plain(c.window.RohrKatalog), catalog);
    const version = JSON.parse(read('package.json')).version;
    for (const file of ['package-lock.json', 'src-tauri/tauri.conf.json']) assert.equal(JSON.parse(read(file)).version, version);
    assert.ok(read('src-tauri/Cargo.toml').includes(`version = "${version}"`));
    assert.ok(read('README.md').includes(`Version ${version}`));
    assert.ok(read('index.html').includes(`Version ${version}`));
    for (const series of catalog.series) for (const size of series.sizes) assert.ok(size.odMm > 2 * size.wallMm && size.wallMm > 0);
    return { version, series: catalog.series.length };
  });
  await check('INPUT-01', 'Import weist null-Knoten vor dem Projektwechsel ab', () => {
    const c = createContext({ MAX_PDF_BYTES: 25 * 1024 * 1024 });
    runInContext(sourceFunction('validateProjectImport'), c);
    assert.throws(() => c.validateProjectImport({ version: 1, nodes: [null], edges: [] }), undefined,
      'validateProjectImport akzeptiert nodes:[null]; renderAll/migrateStartName dereferenziert anschließend node.type.');
  });
  await check('INPUT-02', 'Unvollständige Koordinaten ergeben kein gültiges NaN-Ergebnis', () => {
    const net = network(); net.edges[0].points = [{ x: 0, y: 0 }, { y: 0 }];
    let result;
    try { result = engine.calculate(net, 1, secondary, data, catalog); } catch { return { rejected: true }; }
    assert.ok(!result.valid && finiteRows(result), `valid=${result.valid}; lengthM=${result.rows[0].lengthM}; pressureDropPa=${result.rows[0].pressureDropPa}; issues=${result.issues.length}`);
  });
  await check('INPUT-03', 'Maßstab Infinity wird abgewiesen', () => {
    assert.throws(() => engine.analyze(network(), Infinity), undefined, 'analyze akzeptiert Infinity als Maßstab.');
  });
  await check('INPUT-04', 'Pfad muss zu den angegebenen Knoten passen', () => {
    const net = network(100); net.edges[0].points = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
    assert.throws(() => engine.analyze(net, 1), undefined, 'Knotenabstand 100 m, Pfad nur 1 m: analyze akzeptiert die falsche Länge.');
  });
  await check('ASYNC-01', 'Eine Netzänderung verwirft das laufende Berechnungsergebnis', async () => {
    const elements = new Map();
    const element = () => ({ classList: { add() {}, remove() {} }, dataset: {}, querySelector: () => null, prepend() {}, disabled: false });
    const c = createContext({ project: { ...network(), calibration: 1 }, dirty: false, runId: 0, pending: new Map(), calculationStatusTimer: null, worker: null,
      $: id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
      performance, setInterval: () => 1, clearInterval() {}, setTool() {}, settingsFromUI: () => ({ ...base }),
      projectForCalculation: () => network(), ensureWorker: async () => ({ postMessage() {} }),
      syncSizingResetButton() {}, syncRiserButtons() {}, drawNetwork() {}, scheduleSave() {},
      showResult: result => { c.accepted = result; c.project.resultStale = false; }, accepted: null });
    runInContext(sourceFunction('abortWorkerJobs') + '\n' + sourceFunction('calculate') + '\n' + sourceFunction('invalidate'), c);
    c.calculate(); await Promise.resolve();
    const [job] = c.pending.values(); assert.ok(job, 'Worker-Auftrag fehlt im Testaufbau');
    c.project.nodes[1].coolingKW = 20; c.invalidate();
    job.callback({ valid: true, rows: [], sourceCoolingKW: 3 });
    assert.equal(c.accepted, null, `Altes Ergebnis wurde akzeptiert; aktuelle Last 20 kW, Ergebnislast 3 kW; resultStale=${c.project.resultStale}.`);
  });
  await check('ASYNC-02', 'Asynchrones Speichern vermischt keine Projekt- und PDF-Stände', async () => {
    let release, record;
    const c = createContext({ projectHasBeenSaved: true, project: { id: 'A', nodes: [1] }, pdfName: 'A.pdf', saveQueue: Promise.resolve(),
      $: () => ({ value: 'A', innerHTML: '' }), settingsFromUI: () => ({}), clone: plain,
      projectPdfBytes: () => new Promise(resolve => { release = resolve; }),
      putStoredProject: async value => { record = value; }, Uint8Array, localStorage: { setItem() {} }, ACTIVE: 'test', renderProjectList() {} });
    runInContext(sourceFunction('persistProject'), c);
    const saving = c.persistProject(); c.project = { id: 'B', nodes: [2] }; c.pdfName = 'B.pdf';
    release(new Uint8Array([65]).buffer); await saving;
    assert.equal(record.id, 'A', `Datensatz ${record.id}/${record.pdfName} enthält PDF-Bytes aus Projekt A.`);
  });
  await check('EDIT-01', 'Löschen eines Abzweigs erhält beide Steigleitungslängen', () => {
    const net = { nodes: [{ id: 's', type: 'start', x: 0, y: 0 }, { id: 'j', type: 'junction', x: 10, y: 0 },
      { id: 'a', type: 'endpoint', x: 20, y: 0, coolingKW: 3 }, { id: 'b', type: 'endpoint', x: 10, y: 10, coolingKW: 2 }],
      edges: [{ id: 'trunk', from: 's', to: 'j', pipeRiser: true, pipeRiserLengthM: 2 },
        { id: 'keep', from: 'j', to: 'a', pipeRiser: true, pipeRiserLengthM: 6 }, { id: 'remove', from: 'j', to: 'b' }] };
    const result = editor.deleteSelection(net, { kind: 'node', id: 'b' });
    assert.equal(result.edges.length, 2);
    assert.equal(result.edges.reduce((sum, edge) => sum + Number(edge.pipeRiserLengthM || 0), 0), 8,
      'Die beiden hydraulisch getrennten Steigleitungen müssen erhalten bleiben.');
  });
  await check('UI-01', 'Kälteträger-Druckverletzung erreicht die Statuszuordnung', () => {
    const net = network(), c = createContext({ project: { ...net, calibration: 1 }, RohrRunnerEngine: engine });
    runInContext(sourceFunction('resultStatusByEdge'), c);
    const status = c.resultStatusByEdge({ issues: [{ type: 'secondary-pressure', severity: 'critical', targetId: 'e', edgeIds: ['p'] }], rows: [] });
    assert.ok(status.size > 0, 'secondary-pressure ergibt eine leere Status-Map; renderSecondaryResult setzt ebenfalls keine limit/check-Klassen.');
  });
  await check('UI-02', 'Kombinierte Kälteträgerverstöße markieren genau die betroffenen Zeilen in Tabelle und CSV', () => {
    const net = { nodes: [{ id: 's', type: 'start', name: 'Start', x: 0, y: 0 }, { id: 'j', type: 'junction', x: 10, y: 0 },
      { id: 'a', type: 'endpoint', name: 'A', x: 20, y: 0, coolingKW: 4 }, { id: 'b', type: 'endpoint', name: 'B', x: 10, y: 10, coolingKW: 4 },
      { id: 'c', type: 'endpoint', name: 'C', x: 0, y: 5, coolingKW: 0.5 }],
      edges: [{ id: 'trunk', from: 's', to: 'j', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] }, { id: 'ea', from: 'j', to: 'a', points: [{ x: 10, y: 0 }, { x: 20, y: 0 }] },
        { id: 'eb', from: 'j', to: 'b', points: [{ x: 10, y: 0 }, { x: 10, y: 10 }] }, { id: 'ec', from: 's', to: 'c', points: [{ x: 0, y: 0 }, { x: 0, y: 5 }] }] };
    const manual = (edge, suction, liquid) => { edge.thermal = { suction: { mode: 'manual', sizeId: suction }, liquid: { mode: 'manual', sizeId: liquid } }; };
    manual(net.edges[0], '18x1', '42x1.5'); manual(net.edges[1], '42x1.5', '15x1'); manual(net.edges[2], '42x1.5', '42x1.5'); manual(net.edges[3], '42x1.5', '42x1.5');
    const settings = { ...secondary, secondaryPressureLimitKPa: 5, secondaryMaxVelocityMS: 1 }, result = engine.calculate(net, 1, settings, data, catalog);
    const velocity = [...result.issues].filter(issue => issue.type === 'velocity').map(issue => `${issue.edgeId}:${issue.lineType}`).sort();
    const pressure = [...result.issues].filter(issue => issue.type === 'secondary-pressure').map(issue => issue.targetId).sort();
    assert.deepEqual(velocity, ['ea:liquid', 'trunk:suction'], `Geschwindigkeitsmeldungen: ${velocity}`);
    assert.deepEqual(pressure, ['a', 'b'], `Druckmeldungen für Kreise: ${pressure}`);
    const c = createContext({ project: { ...net, calibration: 1, settings }, RohrRunnerEngine: engine });
    runInContext(sourceFunction('resultStatusByEdge'), c);
    const status = Object.fromEntries(c.resultStatusByEdge(result));
    assert.deepEqual(Object.keys(status).sort(), ['ea:liquid', 'ea:suction', 'eb:liquid', 'eb:suction', 'trunk:liquid', 'trunk:suction']);
    assert.ok(!('ec:suction' in status) && !('ec:liquid' in status), 'Unbeteiligter Kreis C wurde markiert.');
    const csvBlock = app.slice(app.indexOf('  const csvSafeLabel='), app.indexOf('  function calculationCsv(')) + '\n' + sourceFunction('secondaryCalculationCsv');
    const csv = createContext({ project: { ...net, name: 'Synthetisch' }, document: { querySelector: () => null }, RohrKatalog: catalog, displaySizeLabel: row => row.sizeId, Date });
    runInContext(csvBlock + '\nthis.out = secondaryCalculationCsv(result);', Object.assign(csv, { result }));
    const lines = csv.out.split('\r\n').map(line => line.replace(/^﻿/, '').split(';').map(cell => cell.replace(/^"|"$/g, '')));
    const pipeHeader = lines.findIndex(line => line[0] === 'Nr.'), pipeRows = lines.slice(pipeHeader + 1).filter(line => /^\d+$/.test(line[0]));
    const csvStatus = Object.fromEntries(pipeRows.map(line => [`${line[1]}>${line[2]}:${line[3]}`, line.at(-1)]));
    const flagged = Object.entries(csvStatus).filter(([, value]) => value && value !== 'OK' && value !== 'ok').map(([key]) => key).sort();
    const endRows = lines.slice(lines.findIndex(line => line[0] === 'Kühlstelle') + 1).filter(line => ['A', 'B', 'C'].includes(line[0]));
    const label = { s: 'Start', j: 'j', a: 'A', b: 'B', c: 'C' }, keyOf = id => { const edge = net.edges.find(e => e.id === id.split(':')[0]); return `${label[edge.from]}>${label[edge.to]}:${id.endsWith(':suction') ? 'Vorlauf' : 'Rücklauf'}`; };
    assert.deepEqual(flagged, Object.keys(status).map(keyOf).sort(), 'CSV und Tabelle markieren unterschiedliche Leitungen.');
    assert.deepEqual(endRows.map(line => [line[0], line.at(-1) !== 'OK']), [['A', true], ['B', true], ['C', false]]);
    const onlyVelocity = engine.calculate(net, 1, { ...settings, secondaryPressureLimitKPa: 500 }, data, catalog);
    assert.equal([...onlyVelocity.issues].filter(issue => issue.type === 'secondary-pressure').length, 0);
    const c2 = createContext({ project: { ...net, calibration: 1, settings }, RohrRunnerEngine: engine });
    runInContext(sourceFunction('resultStatusByEdge'), c2);
    const velocityStatus = Object.keys(Object.fromEntries(c2.resultStatusByEdge(onlyVelocity))).sort();
    assert.deepEqual(velocityStatus, ['ea:liquid', 'trunk:suction'], `Nur-Geschwindigkeit: ${velocityStatus}`);
    runInContext('this.out2 = secondaryCalculationCsv(result2);', Object.assign(csv, { result2: onlyVelocity }));
    const velocityCsv = csv.out2.split('\r\n').map(line => line.replace(/^\uFEFF/, '').split(';').map(cell => cell.replace(/^"|"$/g, '')))
      .filter(line => /^\d+$/.test(line[0]) && line.length > 10 && line.at(-1) !== 'OK').map(line => `${line[1]}>${line[2]}:${line[3]}`).sort();
    assert.deepEqual(velocityCsv, velocityStatus.map(keyOf).sort(), `CSV Nur-Geschwindigkeit: ${velocityCsv}`);
    return { velocity, pressure, tableStatus: status, csvFlagged: flagged, csvEndpoints: endRows.map(line => [line[0], line.at(-1)]), velocityOnly: { table: velocityStatus, csv: velocityCsv } };
  });
  await check('HYD-01', 'Einzelne Flüssigkeitsstrecke und Endpunkt verwenden dieselbe Temperaturbasis', () => {
    const config = { ...base, fluid: 'R448A' }, result = engine.calculate(network(), 1, config, data, catalog);
    const row = result.rows.find(row => row.type === 'liquid'), end = result.endpoints[0];
    assert.ok(Math.abs(row.temperatureDropK - end.liquidK) < 1e-6,
      `FL-Zeile=${row.temperatureDropK} K (Taupunkt); identischer Einzelpfad=${end.liquidK} K (Blasenpunkt).`);
  });
  await check('HYD-02', 'Kälteträger stimmt mit unabhängiger Darcy-Weisbach-Nachrechnung überein', () => {
    const net = network(20, 5), size = catalog.series.find(s => s.id === secondary.secondaryPipeSeries).sizes.find(s => s.odMm === 28);
    const sizeId = `${size.odMm}x${size.wallMm}`;
    net.edges[0].thermal = Object.fromEntries(['suction', 'liquid'].map(type => [type, { mode: 'manual', sizeId }]));
    net.edges[0].zeta = 2;
    const result = engine.calculate(net, 1, secondary, data, catalog), d = (size.odMm - 2 * size.wallMm) / 1000;
    const props = [data.secondaryPt('WATER', 6, 0), data.secondaryPt('WATER', 12, 0)];
    const cp = (props[0].specificHeatJKgK + props[1].specificHeatJKgK) / 2, mass = 5000 / (cp * 6);
    let sum = 0;
    for (const [i, type] of ['suction', 'liquid'].entries()) {
      const p = props[i], v = mass / (p.densityKgM3 * Math.PI * d * d / 4), re = p.densityKgM3 * v * d / (p.viscosityPaS * 1.15);
      const friction = re < 2300 ? 64 / re : (-1.8 * Math.log10((1.5e-6 / (3.7 * d)) ** 1.11 + 6.9 / re)) ** -2;
      const drop = (friction * 20 / d * 1.5 + 2) * p.densityKgM3 * v * v / 2;
      assert.ok(Math.abs(result.rows.find(r => r.type === type).pressureDropPa - drop) < 1e-8);
      sum += drop;
    }
    assert.ok(Math.abs(result.endpoints[0].pressureDropKPa * 1000 - sum) < 1e-8);
    return { circuitPressureDropPa: sum, massFlowKgS: mass, propertySource: 'dieselbe lokale CoolProp-Instanz; keine unabhängige Stoffwertvalidierung' };
  });
  // Referenzwerte: NIST Chemistry WebBook, SRD 69, Thermophysical Properties of Fluid Systems, abgerufen am 26.11.2026.
  // Wasser isobar 0,101325 MPa exakt bei 10/20 °C; Sättigung R-134a und CO2 als benachbarte Tabellenzeilen, linear interpoliert.
  await check('REF-01', 'Stoffwertkette stimmt mit NIST-WebBook-Referenzwerten überein', () => {
    const rel = (a, b) => Math.abs(a / b - 1), between = (t, [t0, v0], [t1, v1]) => v0 + (v1 - v0) * (t - t0) / (t1 - t0), evidence = [];
    for (const [t, rho, cp, mu] of [[10, 999.702, 4195.16, 0.00130590], [20, 998.207, 4184.05, 0.00100160]]) {
      const p = data.secondaryPt('WATER', t, 0);
      const dev = { density: rel(p.densityKgM3, rho), cp: rel(p.specificHeatJKgK, cp), viscosity: rel(p.viscosityPaS, mu) };
      assert.ok(dev.density < 5e-5 && dev.cp < 5e-5 && dev.viscosity < 5e-4, `Wasser ${t} °C: ${JSON.stringify(dev)}`);
      evidence.push({ fluid: 'Wasser', temperatureC: t, maxRelativeDeviation: Math.max(...Object.values(dev)) });
    }
    for (const [fluid, t, lower, upper] of [['R134A', 0, [-0.144137, 291.277], [0.490454, 298.042]], ['R134A', 40, [39.9457, 1015.11], [40.1935, 1021.88]],
      ['R744', -10, [-10.0574, 2644.35], [-9.90590, 2655.78]], ['R744', 0, [-0.0676621, 3478.90], [0.0562725, 3490.34]]]) {
      const reference = between(t, lower, upper) * 1000, sat = data.saturationAtTemperature(fluid, t + 273.15), dev = rel(sat.dewPressurePa, reference);
      assert.ok(dev < 1e-3, `${fluid} ${t} °C: ${sat.dewPressurePa} Pa gegenüber ${reference} Pa`);
      evidence.push({ fluid, temperatureC: t, saturationPressureKPa: +(sat.dewPressurePa / 1000).toFixed(3), referenceKPa: +(reference / 1000).toFixed(3), relativeDeviation: dev });
    }
    return { source: 'NIST Chemistry WebBook SRD 69, abgerufen 26.11.2026', note: 'CoolProp und NIST verwenden dieselben Referenz-Zustandsgleichungen; geprüft ist die Implementierungs- und Einheitenkette, nicht die Zustandsgleichung gegen Messwerte.', evidence };
  });
  await check('REF-02', 'Reibungsbeiwert weicht höchstens 2 % von der iterativ gelösten Colebrook-White-Gleichung ab', () => {
    const colebrook = (re, k) => { let f = 0.02; for (let i = 0; i < 100; i++) { const next = (-2 * Math.log10(k / 3.7 + 2.51 / (re * Math.sqrt(f)))) ** -2; if (Math.abs(next - f) < 1e-14) return next; f = next; } return f; };
    let worst = { deviation: 0 };
    for (const re of [4e3, 1e4, 3e4, 1e5, 3e5, 1e6, 1e7]) for (const k of [0, 1e-6, 1e-5, 1e-4, 1e-3, 5e-3, 1e-2]) {
      const value = engine.frictionFactor(re, k * 0.05, 0.05), reference = colebrook(re, k), deviation = Math.abs(value / reference - 1);
      if (deviation > worst.deviation) worst = { re, relativeRoughness: k, deviation };
    }
    assert.ok(worst.deviation < 0.02, JSON.stringify(worst));
    for (const re of [100, 1000, 2299]) assert.equal(engine.frictionFactor(re, 1e-6, 0.05), 64 / re);
    return { correlation: 'Haaland (Programm) gegen Colebrook-White (iterativ)', worst };
  });
  await check('MEDIA-01', 'Alle acht Kältemittel liefern endliche Ergebnisse im kleinen Standardnetz', () => {
    const results = [];
    for (const fluid of ['R513A', 'R448A', 'R744', 'R134A', 'R404A', 'R407C', 'R449A', 'R452A']) {
      const result = engine.calculate(network(2, 2), 1, { ...base, fluid, condensationC: fluid === 'R744' ? 5 : 45, designPressureBar: fluid === 'R744' ? 100 : 24 }, data, catalog);
      assert.ok(finiteRows(result), fluid); results.push({ fluid, valid: result.valid, sizes: result.rows.map(r => r.sizeId) });
    }
    return results;
  });
  await check('MEDIA-02', 'Neun Kälteträger in beiden Rohrserien liefern endliche Ergebnisse', () => {
    let count = 0;
    for (const fluid of ['WATER', 'MEG', 'MPG', ...Object.keys(context.RohrSecondaryFluids.products)]) for (const series of ['viega-temponox', 'black-steel-en10255-medium']) {
      const info = data.secondaryInfo(fluid), concentration = fluid === 'WATER' ? 0 : Math.max(35, info.min);
      const result = engine.calculate(network(10, 5), 1, { ...secondary, secondaryFluid: fluid, secondaryPipeSeries: series,
        glycolConcentrationMassPercent: concentration, supplyTemperatureC: 6, returnTemperatureC: 12 }, data, catalog);
      assert.ok(finiteRows(result), `${fluid}/${series}`); assert.ok(result.valid, `${fluid}/${series}`); count++;
    }
    return { cases: count };
  });
  await check('EDIT-02', 'Deterministische Geometrieprobe mit 1000 Verschiebungen bleibt orthogonal', () => {
    let seed = 235; const random = () => ((seed = Math.imul(1664525, seed) + 1013904223 >>> 0) / 4294967296);
    for (let i = 0; i < 1000; i++) {
      const net = network(1 + Math.floor(random() * 1000)), dx = Math.floor(random() * 1000) - 500, dy = Math.floor(random() * 1000) - 500;
      const moved = editor.moveNode(net, 'e', dx, dy);
      assert.ok(editor.isOrthogonal(moved.edges[0].points));
      assert.ok(editor.close(moved.edges[0].points.at(-1), moved.nodes[1]));
      assert.equal(net.nodes[1].y, 0, 'Originalnetz wurde verändert');
    }
    return { seed: 235, cases: 1000 };
  });
}
let commit = 'unknown';
try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: new URL('.', root), encoding: 'utf8' }).trim(); } catch {}
const output = { node: process.version, platform: process.platform, commit, checks,
  summary: { pass: checks.filter(c => c.status === 'pass').length, fail: checks.filter(c => c.status === 'fail').length } };
console.log(JSON.stringify(output, null, 2));
process.exitCode = output.summary.fail ? 1 : 0;
