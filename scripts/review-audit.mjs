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
if (process.argv.includes('--stress')) {
  for (const count of [10, 100, 500, 1499]) await check(`STRESS-${count}`, `${count} Kühlstellen innerhalb von 30 Sekunden`, () => {
    const output = execFileSync(process.execPath, [fileURLToPath(import.meta.url), `--stress-case=${count}`],
      { encoding: 'utf8', timeout: 30000, windowsHide: true });
    const result = JSON.parse(output);
    assert.equal(result.summary.fail, 0, JSON.stringify(result.checks));
    return result.checks[0];
  });
} else if (stressCase) {
  const count = Number(stressCase.split('=')[1]);
  assert.ok(Number.isInteger(count) && count >= 1 && count <= 1499);
  await check(`STRESS-${count}`, `${count} Kühlstellen im Kälteträgerbaum`, () => {
    const net = { nodes: [{ id: 's', type: 'start', x: 0, y: 0 }], edges: [] };
    let previous = net.nodes[0];
    for (let i = 0; i < count; i++) {
      const junction = { id: `j${i}`, type: 'junction', x: i + 1, y: 0 };
      const end = { id: `e${i}`, type: 'endpoint', x: i + 1, y: 1, coolingKW: 0.01, name: `S${i}` };
      for (const [from, to] of [[previous, junction], [junction, end]]) net.edges.push({ id: `${from.id}-${to.id}`, from: from.id, to: to.id, points: [{ x: from.x, y: from.y }, { x: to.x, y: to.y }] });
      net.nodes.push(junction, end); previous = junction;
    }
    const sizeId = '54x1.5';
    assert.ok(catalog.series.find(s => s.id === 'viega-temponox').sizes.some(s => `${s.odMm}x${s.wallMm}` === sizeId));
    for (const edge of net.edges) edge.thermal = Object.fromEntries(['suction', 'liquid'].map(type => [type, { mode: 'manual', sizeId }]));
    const result = engine.calculate(net, 1, secondary, data, catalog);
    assert.ok(finiteRows(result));
    assert.equal(result.rows.length, net.edges.length * 2);
    return { nodes: net.nodes.length, edges: net.edges.length, valid: result.valid, memoryMiB: Math.round(process.memoryUsage().rss / 1048576) };
  });
} else {
  await check('SEC-01', 'PDF.js besitzt den Fix oder die Mitigation für CVE-2024-4367', () => {
    const pdf = createContext({ console, TextDecoder, TextEncoder, URL, setTimeout, clearTimeout });
    runInContext(read('vendor/pdfjs/pdf.min.js'), pdf);
    const version = pdf.pdfjsLib.version, [major, minor, patch] = version.split('.').map(Number);
    const patched = major > 4 || major === 4 && (minor > 2 || minor === 2 && patch >= 67);
    assert.ok(patched || /isEvalSupported\s*:\s*false/.test(sourceFunction('loadPdfBytes')),
      `PDF.js ${version}; loadPdfBytes setzt isEvalSupported nicht auf false (GHSA-wgrm-67xf-hhpq).`);
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
    const c = createContext({ project: { ...network(), calibration: 1 }, dirty: false, runId: 0, pending: new Map(), calculationStatusTimer: null,
      $: id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
      performance, setInterval: () => 1, clearInterval() {}, setTool() {}, settingsFromUI: () => ({ ...base }),
      projectForCalculation: () => network(), ensureWorker: async () => ({ postMessage() {} }),
      syncSizingResetButton() {}, syncRiserButtons() {}, drawNetwork() {}, scheduleSave() {},
      showResult: result => { c.accepted = result; c.project.resultStale = false; }, accepted: null });
    runInContext(sourceFunction('calculate') + '\n' + sourceFunction('invalidate'), c);
    c.calculate(); await Promise.resolve();
    const [job] = c.pending.values(); assert.ok(job, 'Worker-Auftrag fehlt im Testaufbau');
    c.project.nodes[1].coolingKW = 20; c.invalidate();
    job.callback({ valid: true, rows: [], sourceCoolingKW: 3 });
    assert.equal(c.accepted, null, `Altes Ergebnis wurde akzeptiert; aktuelle Last 20 kW, Ergebnislast 3 kW; resultStale=${c.project.resultStale}.`);
  });
  await check('ASYNC-02', 'Asynchrones Speichern vermischt keine Projekt- und PDF-Stände', async () => {
    let release, record;
    const c = createContext({ projectHasBeenSaved: true, project: { id: 'A', nodes: [1] }, pdfName: 'A.pdf',
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
    assert.equal(result.edges.length, 1);
    assert.equal(result.edges[0].pipeRiserLengthM, 8, `Steigleitung schrumpft von 2+6 auf ${result.edges[0].pipeRiserLengthM} m.`);
  });
  await check('UI-01', 'Kälteträger-Druckverletzung erreicht die Statuszuordnung', () => {
    const net = network(), c = createContext({ project: { ...net, calibration: 1 }, RohrRunnerEngine: engine });
    runInContext(sourceFunction('resultStatusByEdge'), c);
    const status = c.resultStatusByEdge({ issues: [{ type: 'secondary-pressure', severity: 'critical', targetId: 'e', edgeIds: ['p'] }], rows: [] });
    assert.ok(status.size > 0, 'secondary-pressure ergibt eine leere Status-Map; renderSecondaryResult setzt ebenfalls keine limit/check-Klassen.');
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
