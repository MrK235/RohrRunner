import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { webcrypto } from 'node:crypto';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const context = { console, WebAssembly, Uint8Array, ArrayBuffer, URL, TextDecoder, TextEncoder, atob,
  crypto: webcrypto, setTimeout, clearTimeout, location: { href: new URL('index.html', root).href } };
context.window = context;
context.document = { currentScript: { src: new URL('src/stoffdaten.js', root).href }, baseURI: new URL('index.html', root).href };
const vm = createContext(context);
runInContext(read('vendor/coolprop/coolprop-local.js'), vm, { filename: 'coolprop-local.js' });
runInContext(read('src/stoffdaten.js'), vm, { filename: 'stoffdaten.js' });
runInContext(read('src/fast-data.js'), vm, { filename: 'fast-data.js' });
runInContext(read('src/engine.js'), vm, { filename: 'engine.js' });
const catalog = JSON.parse(read('data/pipe-catalog.json'));
const settings = { fluid: 'R513A', simultaneity: 0.5, evaporationC: -10, condensationC: 45,
  superheatK: 5, subcoolingK: 3, suctionLimitK: 2, liquidLimitK: 2,
  minVelocityMS: 0, maxVelocityMS: 20, designPressureBar: 35,
  roughnessMicroM: 1.5, fittingsFactor: 1.5, viscosityMarginPercent: 15 };
const network = (length = 8) => ({
  nodes: [{ id: 'plant', type: 'start', name: 'Verbund', x: 0, y: 0 },
    { id: 'junction', type: 'junction', name: 'T1', x: length / 2, y: 0 },
    { id: 'cold-a', type: 'endpoint', name: 'Kühlstelle A', coolingKW: 8, x: length, y: 0 },
    { id: 'cold-b', type: 'endpoint', name: 'Kühlstelle B', coolingKW: 4, x: length / 2, y: length }],
  edges: [{ id: 'main', from: 'plant', to: 'junction', points: [{ x: 0, y: 0 }, { x: length / 2, y: 0 }] },
    { id: 'branch-a', from: 'junction', to: 'cold-a', points: [{ x: length / 2, y: 0 }, { x: length, y: 0 }] },
    { id: 'branch-b', from: 'junction', to: 'cold-b', points: [{ x: length / 2, y: 0 }, { x: length / 2, y: length }] }]
});

test('K65-Rohrgrößen tragen für R744 durchgehend Zollbezeichnungen', () => {
  const k65 = catalog.series.find(series => series.id === 'k65-inch-120bar');
  assert.equal(context.RohrRunnerEngine.sizeLabel(k65.sizes.find(size => size.inch === '3/4')), '3/4"');
  assert.equal(context.RohrRunnerEngine.sizeLabel(k65.sizes.find(size => size.inch === '1 3/8')), '1-3/8"');
  assert.equal(context.RohrRunnerEngine.sizeLabel(catalog.series[0].sizes[0]), '6 × 1 mm');
});

test('Darcy friction helper follows laminar limit and turbulent monotonicity', () => {
  const ff = context.RohrRunnerEngine.frictionFactor;
  assert.equal(ff(1000, 1e-6, .01), .064);
  assert.ok(ff(100000, 1e-6, .01) < ff(10000, 1e-6, .01));
});

test('browser shell ships local calculation assets and workflow controls', () => {
  const html=read('index.html'),worker=read('src/worker.js'),style=read('src/style.css'),app=read('src/app.js'),thermo=read('src/stoffdaten.js'),launcher=read('RohrRunner.bat');
  for(const path of ['data/pipe-catalog.js','src/stoffdaten.js','src/fast-data.js','src/engine.js','src/editor-core.js','src/app.js'])assert.ok(html.includes(path),`index.html: ${path}`);
  for(const path of ['../vendor/coolprop/coolprop-local.js','../data/pipe-catalog.js','./stoffdaten.js','./fast-data.js','./engine.js'])assert.ok(worker.includes(path),`worker: ${path}`);
  assert.ok(worker.includes('self.document =')&&worker.includes('document.currentScript.src'),'worker supplies the Emscripten script URL without a browser document');
  for(const control of ['openPdf','exportPlanPdf','calibrate','calculate','exportCsv','projectFile','edgeEditor'])assert.ok(html.includes(`id="${control}"`),`UI: ${control}`);
  for(const panel of ['panelTerminals','panelCalculation','panelResults'])assert.ok(html.includes(`id="${panel}"`),`sidebar tab panel: ${panel}`);
  assert.ok(html.includes('role="tablist"')&&html.includes('Kühlstellen</button>')&&html.includes('Berechnung</button>')&&html.includes('Ergebnis</button>'),'sidebar exposes the three workflow tabs');
  assert.ok(html.indexOf('id="calcBadge"')<html.indexOf('<main class="shell">')&&!html.includes('inspector-head'),'calculation status sits in the top header without a heading above the tabs');
  assert.ok(app.includes("setInspectorTab('panelResults')"),'successful calculation opens the result tab');
  assert.ok(app.includes('`${size.odMm}x${size.wallMm}mm`')&&app.includes("new Option(`${size.label} (auto)`,'auto')")&&app.includes('autoSizeIdFor(edge,type,row)')&&app.includes("directLimit?'limit':'check'"),'calculated size is the selected auto entry and remains available after manual selection');
  assert.ok(app.includes('status.textContent=`${type===\'suction\'?\'SL\':\'FL\'} prüfen`')&&!app.includes('section-state'),'inspection note sits below its SL/FL size without a separate row');
  assert.ok(style.includes('.size-cell{height:31px')&&style.includes('grid-template-rows:22px 8px'),'inspection note fits within the existing result row height');
  assert.ok(style.includes('.result-section.check')&&style.includes('.result-section.limit')&&!style.includes('.result-section.valid'),'normal pipe sections have no green status highlight');
  assert.ok(app.includes('calibrationHover=svgPoint(e);drawNetwork()'),'calibration line updates while positioning the second point');
  assert.ok(style.includes('.shell')&&style.includes('.inspector')&&style.includes('.stage'));
  assert.ok(style.includes('.inspector-tabs{')&&style.includes('background:#101920'),'sidebar tabs match the PDF toolbar background');
  assert.ok(style.includes('.canvas-toolbar{grid-column:1/3;grid-row:1}')&&style.includes('.rail{grid-column:1;grid-row:2/4}'),'PDF toolbar spans above the tool rail');
  assert.ok(html.includes('R513A')&&html.includes('R448A')&&html.includes('R744'));
  assert.ok(app.includes("location.protocol==='file:'")&&app.includes("new Blob([window.RohrRunnerWorkerBundle]"),'file:// starts the bundled Blob worker');
  assert.ok(thermo.includes("new URL('../vendor/coolprop/coolprop-local.js', scriptBase)"));
  assert.ok(launcher.includes('index.html'),'Windows shortcut opens the app directly');
  assert.ok(read('scripts/build-worker-bundle.mjs').includes('src/worker-bundle.js'),'worker bundle can be regenerated from local sources');
  assert.ok(read('src/worker-bundle.js').includes('window.RohrRunnerWorkerBundle = '),'generated standalone worker bundle exists');
});

test('topology and scale validation reject loops and uncalibrated plans', () => {
  assert.throws(() => context.RohrRunnerEngine.analyze(network(), 0), /Kalibriere/);
  const loop = network(); loop.edges.push({ id: 'loop', from: 'cold-a', to: 'plant', points: [{ x: 8, y: 0 }, { x: 0, y: 0 }] });
  assert.throws(() => context.RohrRunnerEngine.analyze(loop, 1), /Kreis|doppelte Verbindung/);
});

test('CoolProp checks all three requested refrigerants on a branched network', async () => {
  await context.RohrStoffdaten.load();
  const cases = [
    { fluid: 'R513A', condensationC: 45, designPressureBar: 35 },
    { fluid: 'R448A', condensationC: 45, designPressureBar: 35 },
    { fluid: 'R744', condensationC: 20, designPressureBar: 100 }
  ];
  for (const overrides of cases) {
    const input = { ...settings, ...overrides };
    const result = context.RohrRunnerEngine.calculate(network(), 1, input, context.RohrStoffdaten, catalog);
    assert.equal(result.valid, true, `${input.fluid}: ${result.issues.map(x=>x.message).join(' ')}`);
    assert.equal(result.endpoints.length, 2, input.fluid);
    assert.equal(result.rows.length, 6, input.fluid);
    assert.ok(result.rows.every(row => row.diameterMm > 0 && row.flowKgS > 0), input.fluid);
    assert.ok(result.endpoints.every(end => Number.isFinite(end.suctionK) && end.remainingSubcoolingK > 0), input.fluid);
    assert.ok(result.endpoints.every(end => Math.abs(end.evaporationC - (input.evaporationC + end.suctionK)) < 1e-6), `${input.fluid}: tatsächliche Verdampfungstemperatur je Kühlstelle`);
    assert.ok(result.endpoints.every(end => end.coolingKW === network().nodes.find(node => node.id === end.id).coolingKW), `${input.fluid}: Leistungsvorgabe je Kühlstelle`);
    assert.ok(result.rows.filter(row => row.type === 'suction').every(row => row.psBar >= input.designPressureBar), input.fluid);
    if (input.fluid === 'R744') assert.ok(result.rows.every(row => /^\d+(?:-\d+\/\d+|\/\d+)?"$/.test(row.sizeLabel)), 'R744-Rohrbezeichnungen in Zoll');
  }
});

test('R744 transcritical and a missing terminal load are refused explicitly', async () => {
  await context.RohrStoffdaten.load();
  assert.throws(() => context.RohrRunnerEngine.calculate(network(), 1, { ...settings, fluid: 'R744', condensationC: 35,
    designPressureBar: 100 }, context.RohrStoffdaten, catalog), /Transkritisches/);
  const broken = network(); broken.nodes.find(n => n.id === 'cold-a').coolingKW = 0;
  assert.throws(() => context.RohrRunnerEngine.calculate(broken, 1, settings, context.RohrStoffdaten, catalog), /Leistung/);
});
