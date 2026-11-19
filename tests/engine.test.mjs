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

test('metrischer Katalog und Browserdaten enthalten nur die freigegebenen Größen', async () => {
  const browserCatalog=createContext({window:{}});
  runInContext(read('data/pipe-catalog.js'),browserCatalog);
  assert.deepEqual(JSON.parse(JSON.stringify(browserCatalog.window.RohrKatalog)),catalog);
  const metric=catalog.series.find(series=>series.id==='cuprofrio-metric');
  const has=(od,wall)=>metric.sizes.some(size=>size.odMm===od&&size.wallMm===wall);
  assert.ok(has(88.9,2));
  assert.ok(!has(35,1)&&!has(54,2));
  const large=metric.sizes.find(size=>size.odMm===88.9&&size.wallMm===2);
  assert.equal(large.catalogBar,26);
  assert.ok(large.catalogBar>=24.98+1.01325);
  assert.ok(large.catalogBar<28+1.01325);
  await context.RohrStoffdaten.load();
  for(const sizeId of ['35x1','54x2']){
    const plan=network();plan.edges[0].thermal={liquid:{mode:'manual',sizeId}};
    assert.throws(()=>context.RohrRunnerEngine.calculate(plan,1,{...settings,designPressureBar:28},context.RohrStoffdaten,catalog),/manuelle Rohrgröße/);
  }
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

test('Grenzwertfehler verwenden die Beschriftungen der Berechnungsansicht', () => {
  for(const [key,value,label] of [['suctionLimitK',-1,'Druckverlustgrenze SL'],['liquidLimitK',-1,'Druckverlustgrenze FL'],['maxVelocityMS',41,'Sauggasgeschwindigkeit max.']])
    assert.throws(()=>context.RohrRunnerEngine.calculate(network(),1,{...settings,[key]:value},null,catalog),new RegExp(label));
});

test('topology and scale validation reject loops and uncalibrated plans', () => {
  assert.throws(() => context.RohrRunnerEngine.analyze(network(), 0), /Kalibriere/);
  const loop = network(); loop.edges.push({ id: 'loop', from: 'cold-a', to: 'plant', points: [{ x: 8, y: 0 }, { x: 0, y: 0 }] });
  assert.throws(() => context.RohrRunnerEngine.analyze(loop, 1), /Kreis|doppelte Verbindung/);
});

test('terminal pipe allowance is added to the final section and riser is retained', () => {
  const plan=network();
  plan.nodes.find(node=>node.id==='cold-a').extraLengthM=3.5;
  plan.nodes.find(node=>node.id==='cold-a').suctionRiser=true;
  plan.edges.find(edge=>edge.id==='branch-a').extraLengthM=1.5;
  const graph=context.RohrRunnerEngine.analyze(plan,1);
  const branch=graph.edges.find(edge=>edge.id==='branch-a');
  assert.equal(branch._lengthM,9);
  assert.equal(branch._terminalRiser,true);
  assert.equal(graph.edges.find(edge=>edge.id==='branch-b')._terminalRiser,false);
});

test('R744 meldet erschöpfte Unterkühlung im verzweigten Netz ohne Stoffwertfehler', async () => {
  await context.RohrStoffdaten.load();
  const plan=network();
  plan.edges[0].thermal={liquid:{deltaZ:27}};
  const input={...settings,fluid:'R744',superheatK:25,subcoolingK:2,liquidLimitK:1,condensationC:5,designPressureBar:100};
  const result=context.RohrRunnerEngine.calculate(plan,1,input,context.RohrStoffdaten,catalog);
  assert.ok(result.issues.some(issue=>issue.type==='phase'));
  assert.ok(result.endpoints.some(end=>end.remainingSubcoolingK===0));
  const moreSubcooling=context.RohrRunnerEngine.calculate(plan,1,{...input,subcoolingK:3},context.RohrStoffdaten,catalog);
  assert.ok(!moreSubcooling.issues.some(issue=>issue.type==='phase'));
  const isolated=network();isolated.edges[1].thermal={liquid:{deltaZ:27}};
  const branch=context.RohrRunnerEngine.calculate(isolated,1,input,context.RohrStoffdaten,catalog);
  const phase=branch.issues.filter(issue=>issue.type==='phase');
  assert.equal(phase.length,1);
  assert.equal(phase[0].targetId,'cold-a');
  assert.deepEqual([...phase[0].edgeIds],['branch-a']);
  const app=read('src/app.js'),fn=app.slice(app.indexOf('function resultStatusByEdge('),app.indexOf('  function endpointStates(')).trim();
  const status=runInContext(`(${fn})`,createContext({project:{...isolated,calibration:1,settings:input},RohrRunnerEngine:context.RohrRunnerEngine}))(branch);
  assert.equal(status.get('branch-a:liquid'),'limit');
  assert.equal(status.has('main:liquid'),false);
  assert.equal(status.has('branch-b:liquid'),false);
});

test('SL zum Start und FL zu den Kühlstellen sind unabhängig von Zeichenreihenfolge und Kantenrichtung', async () => {
  await context.RohrStoffdaten.load();
  const plan=network();
  for(const edge of plan.edges)edge.thermal={suction:{mode:'manual',sizeId:'22x1',deltaZ:2},liquid:{mode:'manual',sizeId:'12x1',deltaZ:-2}};
  const input={...settings,superheatK:25,subcoolingK:2,liquidLimitK:1,designPressureBar:28};
  const original=context.RohrRunnerEngine.calculate(plan,1,input,context.RohrStoffdaten,catalog);
  const reversed=structuredClone(plan);
  reversed.nodes.reverse();reversed.edges.reverse();
  for(const edge of reversed.edges){[edge.from,edge.to]=[edge.to,edge.from];edge.points.reverse()}
  const result=context.RohrRunnerEngine.calculate(reversed,1,input,context.RohrStoffdaten,catalog);
  for(const row of original.rows){const other=result.rows.find(item=>item.edgeId===row.edgeId&&item.type===row.type);assert.ok(other);for(const field of ['pressureDropPa','velocityMS','temperatureDropK','flowKgS'])assert.ok(Math.abs(row[field]-other[field])<1e-6,`${row.edgeId} ${row.type} ${field}`)}
  for(const end of original.endpoints){const other=result.endpoints.find(item=>item.id===end.id);for(const field of ['suctionK','liquidK','remainingSubcoolingK'])assert.ok(Math.abs(end[field]-other[field])<1e-6,`${end.id} ${field}`)}
  const app=read('src/app.js'),fn=app.slice(app.indexOf('function resultStatusByEdge('),app.indexOf('  function endpointStates(')).trim();
  const statusByEdge=runInContext(`(${fn})`,createContext({project:{...reversed,calibration:1,settings:input},RohrRunnerEngine:context.RohrRunnerEngine}));
  const flaggedRows=result.rows.map(row=>row.type==='liquid'&&['main','branch-a'].includes(row.edgeId)?{...row,temperatureDropK:2}:row);
  const status=statusByEdge({...result,rows:flaggedRows,issues:[{type:'liquid',targetId:'cold-a'}]});
  assert.ok(status.has('main:liquid')&&status.has('branch-a:liquid'));
  assert.equal(status.has('branch-b:liquid'),false);
});

test('summierter Druckverlust markiert die Kühlstelle, nicht unkritische Einzelabschnitte', async () => {
  await context.RohrStoffdaten.load();
  const plan=network();for(const edge of plan.edges)edge.thermal={suction:{mode:'manual',sizeId:'22x1'},liquid:{mode:'manual',sizeId:'12x1'}};
  const input={...settings,superheatK:25,subcoolingK:2,designPressureBar:28,simultaneity:0,suctionLimitK:1,maxVelocityMS:40};
  const result=context.RohrRunnerEngine.calculate(plan,1,input,context.RohrStoffdaten,catalog);
  const suction=result.issues.filter(issue=>issue.type==='suction');
  assert.equal(suction.length,1);
  assert.equal(suction[0].targetId,'cold-a');
  assert.equal(suction[0].edgeIds.length,0);
  const app=read('src/app.js'),fn=app.slice(app.indexOf('function resultStatusByEdge('),app.indexOf('  function endpointStates(')).trim();
  const status=runInContext(`(${fn})`,createContext({project:{...plan,calibration:1,settings:input},RohrRunnerEngine:context.RohrRunnerEngine}))(result);
  assert.equal(status.has('main:suction'),false);
  assert.equal(status.has('branch-a:suction'),false);
});

test('Geschwindigkeitswarnung bleibt auf die betroffene Leitung und Kühlstelle begrenzt', async () => {
  await context.RohrStoffdaten.load();
  const plan=network();
  for(const edge of plan.edges)edge.thermal={suction:{mode:'manual',sizeId:edge.id==='branch-a'?'16x1':'28x1.5'},liquid:{mode:'manual',sizeId:'12x1'}};
  const input={...settings,superheatK:25,subcoolingK:2,designPressureBar:28,simultaneity:1,
    suctionLimitK:30,liquidLimitK:30,maxVelocityMS:25,minVelocityMS:0};
  const result=context.RohrRunnerEngine.calculate(plan,1,input,context.RohrStoffdaten,catalog);
  const velocity=result.issues.filter(issue=>issue.type==='velocity');
  assert.equal(velocity.length,1);
  assert.equal(velocity[0].edgeId,'branch-a');
  assert.deepEqual([...velocity[0].targetIds],['cold-a']);
  const app=read('src/app.js'),statusFn=app.slice(app.indexOf('function resultStatusByEdge('),app.indexOf('  function endpointStates(')).trim(),stateFn=app.slice(app.indexOf('function endpointStates('),app.indexOf('  function showResult(')).trim();
  const status=runInContext(`(${statusFn})`,createContext({project:{...plan,calibration:1,settings:input},RohrRunnerEngine:context.RohrRunnerEngine}))(result);
  assert.equal(status.get('branch-a:suction'),'limit');
  assert.equal(status.has('branch-b:suction'),false);
  assert.equal(status.has('main:suction'),false);
  const endpoint=runInContext(`(${stateFn})`,createContext({}));
  assert.equal(endpoint(result,'cold-a').other,'check');
  assert.equal(endpoint(result,'cold-b').row,'');
  plan.edges[0].thermal.suction.sizeId='16x1';
  plan.edges[1].thermal.suction.sizeId='28x1.5';
  const shared=context.RohrRunnerEngine.calculate(plan,1,input,context.RohrStoffdaten,catalog);
  const sharedWarnings=shared.issues.filter(issue=>issue.type==='velocity');
  assert.equal(sharedWarnings.length,1,'gemeinsame Leitung erscheint nur einmal');
  assert.equal(sharedWarnings[0].edgeId,'main');
  assert.deepEqual([...sharedWarnings[0].targetIds].sort(),['cold-a','cold-b']);
});

test('Nachrechnung einer Ergebnisgröße verändert keine anderen Rohrgrößen', async () => {
  await context.RohrStoffdaten.load();
  const plan=network(),input={...settings,superheatK:25,subcoolingK:2,liquidLimitK:1,designPressureBar:28};
  const before=context.RohrRunnerEngine.calculate(plan,1,input,context.RohrStoffdaten,catalog);
  const changed=plan.edges.find(edge=>edge.id==='branch-a');
  changed.thermal={suction:{mode:'manual',sizeId:'28x1.5'}};
  const app=read('src/app.js'),fn=app.slice(app.indexOf('function projectForCalculation('),app.indexOf('  function resultStatusByEdge(')).trim();
  const prepare=runInContext(`(${fn})`,createContext({project:plan,clone:value=>JSON.parse(JSON.stringify(value))}));
  const frozen=prepare({rows:before.rows,changedKey:'branch-a:suction'});
  const after=context.RohrRunnerEngine.calculate(frozen,1,input,context.RohrStoffdaten,catalog);
  for(const row of before.rows){const next=after.rows.find(item=>item.edgeId===row.edgeId&&item.type===row.type);assert.equal(next.sizeId,row.edgeId==='branch-a'&&row.type==='suction'?'28x1.5':row.sizeId,`${row.edgeId}:${row.type}`)}
  assert.equal(plan.edges[0].thermal,undefined,'automatische Größen bleiben im Projekt automatisch');
  assert.notEqual(before.endpoints[0].suctionK,after.endpoints[0].suctionK,'Stoffwerte und Druckverluste werden neu gerechnet');
});

test('Rohränderung koppelt Massenstrom, aber nicht einen unbelasteten Seitenast', async () => {
  await context.RohrStoffdaten.load();
  const input={...settings,superheatK:25,subcoolingK:2,liquidLimitK:1,designPressureBar:28,simultaneity:0};
  const plan=network();
  for(const edge of plan.edges)edge.thermal={suction:{mode:'manual',sizeId:'22x1'},liquid:{mode:'manual',sizeId:'12x1'}};
  const run=()=>context.RohrRunnerEngine.calculate(plan,1,input,context.RohrStoffdaten,catalog);
  const before=run();
  plan.edges[1].thermal.suction.sizeId='28x1.5';
  const after=run();
  const endpoint=(result,id)=>result.endpoints.find(item=>item.id===id);
  const row=(result,id,type)=>result.rows.find(item=>item.edgeId===id&&item.type===type);
  assert.notEqual(row(before,'branch-a','liquid').flowKgS,row(after,'branch-a','liquid').flowKgS);
  assert.notEqual(endpoint(before,'cold-a').liquidK,endpoint(after,'cold-a').liquidK);
  assert.deepEqual(endpoint(before,'cold-b'),endpoint(after,'cold-b'));
  for(const type of ['suction','liquid'])assert.deepEqual(row(before,'branch-b',type),row(after,'branch-b',type));
  // Bei gemeinsamer Volllast ändert sich der Massenstrom im Stamm und damit auch der zweite Endpunkt.
  input.simultaneity=1;
  plan.edges[1].thermal.suction.sizeId='22x1';
  const sharedBefore=run();
  plan.edges[1].thermal.suction.sizeId='28x1.5';
  const sharedAfter=run();
  assert.notEqual(row(sharedBefore,'main','liquid').flowKgS,row(sharedAfter,'main','liquid').flowKgS);
  assert.notEqual(endpoint(sharedBefore,'cold-b').liquidK,endpoint(sharedAfter,'cold-b').liquidK);
});

test('neue UI-Betriebspunkte sind für alle drei Kältemittel berechenbar', async () => {
  await context.RohrStoffdaten.load();
  for (const fluid of ['R513A','R448A','R744']) {
    const input={...settings,fluid,superheatK:25,subcoolingK:2,liquidLimitK:1,
      condensationC:fluid==='R744'?5:45,designPressureBar:fluid==='R744'?100:28};
    const result=context.RohrRunnerEngine.calculate(network(),1,input,context.RohrStoffdaten,catalog);
    assert.equal(result.endpoints.length,2,fluid);
    assert.ok(result.rows.every(row=>Number.isFinite(row.pressureDropPa)),fluid);
  }
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

test('25 K Überhitzung nutzt Stoffwert-Stützpunkte statt CoolProp in jedem Rohrschritt', async () => {
  await context.RohrStoffdaten.load();
  const input = { ...settings, superheatK: 25 };
  const originalFast = context.RohrnetzFastData;
  let calls = 0;
  const data = { ...context.RohrStoffdaten,
    hydraulicPt(...args) { calls++; return context.RohrStoffdaten.hydraulicPt(...args); },
    state(...args) { calls++; return context.RohrStoffdaten.state(...args); },
    saturationAtPressure(...args) { calls++; return context.RohrStoffdaten.saturationAtPressure(...args); } };
  try {
    context.RohrnetzFastData = null;
    const start = performance.now();
    const reference = context.RohrRunnerEngine.calculate(network(), 1, input, data, catalog);
    const slowMs = performance.now() - start, slowCalls = calls;
    calls = 0;
    context.RohrnetzFastData = originalFast;
    const fastStart = performance.now();
    const fast = context.RohrRunnerEngine.calculate(network(), 1, input, data, catalog);
    console.log(`25 K: CoolProp direkt ${slowMs.toFixed(0)} ms/${slowCalls} Aufrufe, Interpolation ${(performance.now() - fastStart).toFixed(0)} ms/${calls} Aufrufe`);
    assert.ok(calls < slowCalls / 3, `CoolProp-Aufrufe: schnell ${calls}, Referenz ${slowCalls}`);
    assert.equal(fast.valid, reference.valid);
    for (let i = 0; i < fast.endpoints.length; i++) {
      assert.ok(Math.abs(fast.endpoints[i].suctionK - reference.endpoints[i].suctionK) < 0.1);
      assert.ok(Math.abs(fast.endpoints[i].liquidK - reference.endpoints[i].liquidK) < 0.1);
    }
  } finally { context.RohrnetzFastData = originalFast; }
});

test('Fast-Path bleibt außerhalb geprüfter Bereiche und beim R448A-Viskositätslimit deaktiviert', () => {
  const data = context.RohrStoffdaten;
  for (const overrides of [
    { fluid: 'R744' }, { superheatK: 2.9 }, { suctionLimitK: 5.01 },
    { fluid: 'R448A', condensationC: 55, subcoolingK: 4 }
  ]) assert.equal(context.RohrnetzFastData.create(data, { ...settings, ...overrides }), data);
});

test('Stoffwert-Grenzen knapp außerhalb der bisherigen Schaltwerte bleiben schnell und vergleichbar', async t => {
  await context.RohrStoffdaten.load();
  for (const overrides of [
    { fluid: 'R513A', evaporationC: -26, condensationC: 29, subcoolingK: 5.1, suctionLimitK: 3.01 },
    { fluid: 'R448A', evaporationC: 6, condensationC: 51, subcoolingK: 6, suctionLimitK: 4 }
  ]) {
    const input = { ...settings, ...overrides };
    let calls = 0;
    const data = { ...context.RohrStoffdaten,
      hydraulicPt(...args) { calls++; return context.RohrStoffdaten.hydraulicPt(...args); },
      state(...args) { calls++; return context.RohrStoffdaten.state(...args); },
      saturationAtPressure(...args) { calls++; return context.RohrStoffdaten.saturationAtPressure(...args); } };
    const originalFast = context.RohrnetzFastData;
    try {
      context.RohrnetzFastData = null;
      const reference = context.RohrRunnerEngine.calculate(network(), 1, input, data, catalog);
      const directCalls = calls;
      calls = 0;
      context.RohrnetzFastData = originalFast;
      const fast = context.RohrRunnerEngine.calculate(network(), 1, input, data, catalog);
      assert.ok(calls < directCalls / 3, `${input.fluid}: ${calls} statt ${directCalls} direkte Stoffwertaufrufe`);
      assert.equal(fast.valid, reference.valid);
      for (let i = 0; i < fast.endpoints.length; i++) {
        assert.ok(Math.abs(fast.endpoints[i].suctionK - reference.endpoints[i].suctionK) < 0.1);
        assert.ok(Math.abs(fast.endpoints[i].liquidK - reference.endpoints[i].liquidK) < 0.1);
      }
      t.diagnostic(`${input.fluid}: ${directCalls} → ${calls} direkte Stoffwertaufrufe`);
    } finally { context.RohrnetzFastData = originalFast; }
  }
});

test('synthetische Netze mit 2, 5 und 10 Kühlstellen halten Grenzwerte ein und reizen sie aus', async t => {
  await context.RohrStoffdaten.load();
  const input = { ...settings, fluid: 'R513A', simultaneity: 0.5, maxVelocityMS: 30, minVelocityMS: 0,
    designPressureBar: 28, suctionLimitK: 2, liquidLimitK: 2 };
  const manyEndpoints = count => {
    const nodes = [{ id: 'plant', type: 'start', name: 'Verbund', x: 0, y: 0 }], edges = [];
    let previous = 'plant';
    for (let i = 0; i < count; i++) {
      const junction = `junction-${i}`, x = (i + 1) * 8, endpoint = `cold-${i}`, branchY = i % 2 ? -5 : 5;
      nodes.push({ id: junction, type: 'junction', name: `T${i + 1}`, x, y: 0 });
      edges.push({ id: `main-${i}`, from: previous, to: junction, points: [{ x: i * 8, y: 0 }, { x, y: 0 }] });
      nodes.push({ id: endpoint, type: 'endpoint', name: `Kühlstelle ${i + 1}`, coolingKW: 3 + i % 3, x, y: branchY });
      edges.push({ id: `branch-${i}`, from: junction, to: endpoint, points: [{ x, y: 0 }, { x, y: branchY }] });
      previous = junction;
    }
    return { nodes, edges };
  };
  for (const count of [2, 5, 10]) {
    const started = performance.now();
    const result = context.RohrRunnerEngine.calculate(manyEndpoints(count), 1, input, context.RohrStoffdaten, catalog);
    const durationMs = performance.now() - started;
    assert.equal(result.valid, true, `${count} Kühlstellen: ${result.issues.map(issue => issue.message).join(' ')}`);
    assert.equal(result.endpoints.length, count);
    assert.ok(result.endpoints.every(end => end.suctionK <= input.suctionLimitK + 1e-6), `${count}: Saugverlust`);
    assert.ok(result.endpoints.every(end => end.liquidK <= input.liquidLimitK + 1e-6 && end.remainingSubcoolingK > 0), `${count}: Flüssigkeitsverlust und Restunterkühlung`);
    assert.ok(result.rows.filter(row => row.type === 'suction').every(row => row.velocityMS <= input.maxVelocityMS + 1e-6), `${count}: Maximalgeschwindigkeit`);
    for (const type of ['suction', 'liquid']) {
      const mainRows = Array.from({ length: count }, (_, i) => result.rows.find(row => row.edgeId === `main-${i}` && row.type === type));
      const branchRows = Array.from({ length: count }, (_, i) => result.rows.find(row => row.edgeId === `branch-${i}` && row.type === type));
      assert.ok(mainRows.every((row, i) => i === 0 || row.diameterMm <= mainRows[i - 1].diameterMm), `${count}: ${type} fällt entlang des Hauptstrangs nicht ab`);
      assert.ok(branchRows.every((row, i) => row.diameterMm <= mainRows[i].diameterMm), `${count}: ${type} ist in einem Einzelzweig größer als der Hauptstrang`);
    }
    const utilization = Math.max(...result.endpoints.flatMap(end => [end.suctionK / input.suctionLimitK, end.liquidK / input.liquidLimitK]));
    assert.ok(utilization >= 0.9, `${count}: Grenzwerte werden nicht ausreichend ausgenutzt (${utilization.toFixed(2)})`);
    t.diagnostic(`${count} Kühlstellen: gültig, max. Grenzwertausnutzung ${(utilization * 100).toFixed(1)} %, ${durationMs.toFixed(0)} ms`);
  }
  const constrained=context.RohrRunnerEngine.calculate(manyEndpoints(10),1,{...input,designPressureBar:35},context.RohrStoffdaten,catalog);
  assert.ok(constrained.issues.some(issue=>issue.type==='suction'),'35 bar: nicht erfüllte Sauggrenze wird gemeldet');
});

test('R744 transcritical and a missing terminal load are refused explicitly', async () => {
  await context.RohrStoffdaten.load();
  assert.throws(() => context.RohrRunnerEngine.calculate(network(), 1, { ...settings, fluid: 'R744', condensationC: 35,
    designPressureBar: 100 }, context.RohrStoffdaten, catalog), /Transkritisches/);
  const broken = network(); broken.nodes.find(n => n.id === 'cold-a').coolingKW = 0;
  assert.throws(() => context.RohrRunnerEngine.calculate(broken, 1, settings, context.RohrStoffdaten, catalog), /Leistung/);
});

test('Kälteträger-Stoffdaten liefern Wasser- und Glykolwerte im Modellbereich', async () => {
  await context.RohrStoffdaten.load();
  const water=context.RohrStoffdaten.secondaryPt('WATER',10,0),meg=context.RohrStoffdaten.secondaryPt('MEG',10,30),mpg=context.RohrStoffdaten.secondaryPt('MPG',10,30);
  for(const state of [water,meg,mpg])assert.ok(state.densityKgM3>0&&state.specificHeatJKgK>0&&state.viscosityPaS>0);
  assert.ok(meg.freezeTemperatureC<0&&mpg.freezeTemperatureC<0);
  assert.throws(()=>context.RohrStoffdaten.secondaryPt('MEG',10,61),/0 und 60 Masse-%/);
});

test('Kälteträger-Solver berechnet Wasser sowie Ethylen- und Propylenglykol in den gewählten Rohrserien', async () => {
  await context.RohrStoffdaten.load();
  const base={...settings,mode:'secondary',secondaryFluid:'WATER',glycolConcentrationMassPercent:0,supplyTemperatureC:6,returnTemperatureC:12,secondaryPipeSeries:'viega-temponox',secondaryPressureLimitKPa:50,secondaryMaxVelocityMS:1.5,roughnessMicroM:1.5};
  const water=context.RohrRunnerEngine.calculate(network(),1,base,context.RohrStoffdaten,catalog);
  assert.equal(water.valid,true,water.issues.map(issue=>issue.message).join(' '));
  assert.equal(water.rows.length,6);
  assert.ok(water.secondary.totalMassFlowKgS>0&&water.secondary.totalVolumeFlowM3H>0);
  assert.ok(water.secondary.totalPipeVolumeL>0);
  assert.equal(water.secondary.glycolMassInPipesKg,0);
  const expectedPipeVolumeL=water.rows.reduce((sum,row)=>sum+Math.PI*((row.diameterMm-2*row.wallMm)/1000)**2/4*row.lengthM*1000,0);
  assert.ok(Math.abs(water.secondary.totalPipeVolumeL-expectedPipeVolumeL)<1e-9);
  assert.ok(water.rows.every(row=>['suction','liquid'].includes(row.type)&&row.velocityMS<=1.5));
  for(const [fluid,series,concentration] of [['MEG','black-steel-en10255-medium',30],['MPG','viega-temponox',30]]){
    const result=context.RohrRunnerEngine.calculate(network(),1,{...base,secondaryFluid:fluid,glycolConcentrationMassPercent:concentration,secondaryPipeSeries:series,roughnessMicroM:catalog.series.find(item=>item.id===series).roughnessMicroM},context.RohrStoffdaten,catalog);
    assert.equal(result.mode,'secondary');
    assert.equal(result.rows.length,6);
    assert.ok(result.rows.every(row=>row.diameterMm>0&&row.pressureDropKPa>=0));
    assert.ok(result.secondary.concentrationMassPercent===30);
    assert.ok(result.secondary.glycolMassInPipesKg>0);
    assert.ok(Math.abs(result.secondary.glycolMassInPipesKg-result.secondary.totalPipeVolumeL/1000*((result.rows[0].densityKgM3+result.rows[1].densityKgM3)/2)*0.3)<1e-9);
  }
});

test('Kälteträger-Solver stoppt vor dem Gefrierpunkt und meldet manuelle Fremdgrößen', async () => {
  await context.RohrStoffdaten.load();
  const base={...settings,mode:'secondary',secondaryFluid:'MPG',glycolConcentrationMassPercent:30,supplyTemperatureC:6,returnTemperatureC:12,secondaryPipeSeries:'viega-temponox',secondaryPressureLimitKPa:50,secondaryMaxVelocityMS:1.5,roughnessMicroM:1.5};
  assert.throws(()=>context.RohrRunnerEngine.calculate(network(),1,{...base,supplyTemperatureC:-35,returnTemperatureC:-30},context.RohrStoffdaten,catalog),/Gefrierpunkt/);
  const plan=network();plan.edges[0].thermal={suction:{mode:'manual',sizeId:'165.1x4.85'}};
  assert.throws(()=>context.RohrRunnerEngine.calculate(plan,1,base,context.RohrStoffdaten,catalog),/manuelle Rohrgröße/);
});
