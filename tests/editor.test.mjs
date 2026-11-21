import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const context = { console };
context.globalThis = context;
runInContext(read('src/editor-core.js'), createContext(context), { filename: 'editor-core.js' });
const editor = context.RohrRunnerEditor;

test('Standard-Betriebspunkte sind je Kältemittel konsistent mit der Oberfläche', () => {
  const app=read('src/app.js'),html=read('index.html');
  const definitions=app.match(/  const defaults=\{[^\n]+\};\r?\n  const defaultsForFluid=[^\n]+;/)?.[0];
  assert.ok(definitions,'Vorgaben und Kältemittelauswahl vorhanden');
  const getDefaults=runInContext(`${definitions}\ndefaultsForFluid`,createContext({}));
  for(const fluid of ['R513A','R448A','R744']){
    const values=getDefaults(fluid);
    assert.equal(values.fluid,fluid);
    for(const [key,value] of Object.entries({superheatK:25,subcoolingK:2,liquidLimitK:1,condensationC:fluid==='R744'?5:45,designPressureBar:fluid==='R744'?100:28})){
      assert.equal(values[key],value,`${fluid}: ${key}`);
      if(fluid==='R513A')assert.match(html,new RegExp(`data-setting="${key}"[^>]*value="${value}"`));
    }
  }
  assert.match(app,/\['condensationC','superheatK','subcoolingK','liquidLimitK','designPressureBar'\]/);
  assert.match(app,/resetSettings'\)\.onclick=.*defaultsForFluid\(document\.querySelector/);
});

test('frei definierbare Leistungen akzeptieren deutsche und internationale Dezimalwerte', () => {
  assert.equal(editor.parseDecimal('3,75'), 3.75);
  assert.equal(editor.parseDecimal('1.234,56'), 1234.56);
  assert.equal(editor.parseDecimal('1,234.56'), 1234.56);
  assert.equal(editor.parseDecimal(' 0,125 '), 0.125);
  assert.ok(Number.isNaN(editor.parseDecimal('fünf')));
});

test('jeder Leitungs-Klick erzeugt genau einen rechtwinkligen Richtungsabschnitt', () => {
  let route = editor.commitCorner([{ x: 10, y: 10 }], { x: 90, y: 45 });
  assert.deepEqual(route.points.map(p => [p.x, p.y]), [[10, 10], [90, 10]]);
  assert.equal(route.axis, 'y');
  route = editor.commitCorner(route.points, { x: 130, y: 80 }, route.axis);
  assert.deepEqual(route.points.map(p => [p.x, p.y]), [[10, 10], [90, 10], [90, 80]]);
  assert.equal(route.axis, 'x');
  const finished = editor.finishOrthogonal(route.points, { x: 150, y: 120 }, route.axis);
  assert.equal(editor.isOrthogonal(finished), true);
  assert.deepEqual(finished.map(p => [p.x, p.y]), [[10, 10], [90, 10], [90, 80], [150, 80], [150, 120]]);
});

test('Doppelklick auf freier Fläche beendet die Leitung mit einem T-Stück', () => {
  const app=read('src/app.js'),implementation=app.match(/  function finishPipeAt\(point\)\{[^\n]+\}/)?.[0];
  assert.ok(implementation);
  const connections=[],project={nodes:[{id:'start',type:'start',x:0,y:0}],edges:[]};
  const sandbox={
    project,pipeStart:project.nodes[0],pipePoints:[{x:0,y:0}],pipeAxis:null,selection:null,
    Editor:{finishOrthogonal:(points,target)=>[...points,target]},routeLength:()=>40,routeHits:()=>[],
    remember:()=>{},uid:()=> 'junction-1',addConnection:(from,to,route)=>connections.push({from,to,route}),
    resetPipe:()=>{},renderAll:()=>{},invalidate:()=>{},$:()=>({textContent:''}),toast:message=>{throw Error(message)}
  };
  runInContext(`${implementation}\nglobalThis.finishPipeAt=finishPipeAt`,createContext(sandbox));
  sandbox.finishPipeAt({x:40,y:0});
  assert.equal(project.nodes[1].type,'junction');
  assert.equal(project.nodes[1].name,'T-1');
  assert.equal(project.nodes[1].coolingKW,undefined);
  assert.equal(connections[0].to,project.nodes[1].id);
});

test('Schnittpunkte rechtwinkliger Rohre werden für automatische T-Stücke erkannt', () => {
  assert.deepEqual(
    Object.values(editor.segmentIntersection({ x: 50, y: 0 }, { x: 50, y: 100 }, { x: 0, y: 40 }, { x: 100, y: 40 })),
    [50, 40]
  );
  assert.equal(editor.segmentIntersection({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 20 }, { x: 100, y: 20 }), null);
  assert.equal(editor.pointOnSegment({ x: 50, y: 40 }, { x: 0, y: 40 }, { x: 100, y: 40 }), true);
});

test('Knoten und Rohrsegmente lassen sich rechtwinklig und dynamisch verschieben', () => {
  const network = {
    nodes: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 100, y: 100 }],
    edges: [{ id: 'e', from: 'a', to: 'b', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }] }]
  };
  const movedNode = editor.moveNode(network, 'b', 40, -20);
  assert.equal(JSON.stringify(movedNode.nodes.find(node => node.id === 'b')), JSON.stringify({ id: 'b', x: 140, y: 80 }));
  assert.equal(editor.isOrthogonal(movedNode.edges[0].points), true);
  assert.equal(JSON.stringify(movedNode.edges[0].points.at(-1)), JSON.stringify({ x: 140, y: 80 }));

  const movedSegment = editor.moveEdgeSegment(network, 'e', 0, 0, 30);
  assert.equal(JSON.stringify(movedSegment.edges[0].points.map(point => [point.x, point.y])), JSON.stringify([[0, 0], [0, 30], [100, 30], [100, 100]]));
  assert.equal(editor.isOrthogonal(movedSegment.edges[0].points), true);
  assert.equal(editor.nearestSegment(movedSegment.edges[0].points, { x: 50, y: 31 }, 5).index, 1);

  const withoutEdge = editor.deleteSelection(network, { kind: 'edge', id: 'e' });
  assert.equal(withoutEdge.edges.length, 0);
  assert.equal(withoutEdge.nodes.length, 2);
  const withoutNode = editor.deleteSelection(network, { kind: 'node', id: 'b' });
  assert.equal(withoutNode.nodes.length, 1);
  assert.equal(withoutNode.edges.length, 0);
});

test('beim Löschen eines T-Abzweigs wird die verbleibende Leitung verbunden', () => {
  const network = {
    nodes: [
      { id: 'start', type: 'start', x: 0, y: 0 },
      { id: 'tee', type: 'junction', x: 50, y: 0 },
      { id: 'end', type: 'endpoint', x: 100, y: 0 },
      { id: 'branch', type: 'endpoint', x: 50, y: 50 }
    ],
    edges: [
      { id: 'left', from: 'start', to: 'tee', points: [{ x: 0, y: 0 }, { x: 50, y: 0 }], extraLengthM: 1, zeta: 2 },
      { id: 'right', from: 'tee', to: 'end', points: [{ x: 50, y: 0 }, { x: 100, y: 0 }], extraLengthM: 3, zeta: 4 },
      { id: 'spur', from: 'tee', to: 'branch', points: [{ x: 50, y: 0 }, { x: 50, y: 50 }] }
    ]
  };
  const afterBranch = editor.deleteSelection(network, { kind: 'edge', id: 'spur' });
  assert.equal(afterBranch.nodes.some(node => node.id === 'tee'), false);
  assert.equal(afterBranch.edges.length, 1);
  assert.equal(afterBranch.edges[0].from, 'start');
  assert.equal(afterBranch.edges[0].to, 'end');
  assert.equal(JSON.stringify(afterBranch.edges[0].points.map(point => [point.x, point.y])), JSON.stringify([[0, 0], [100, 0]]));
  assert.equal(afterBranch.edges[0].extraLengthM, 4);
  assert.equal(afterBranch.edges[0].zeta, 6);

  const afterEndpoint = editor.deleteSelection(network, { kind: 'node', id: 'branch' });
  assert.equal(afterEndpoint.nodes.some(node => node.id === 'tee'), false);
  assert.equal(afterEndpoint.edges.length, 1);
  const afterMain = editor.deleteSelection(network, { kind: 'edge', id: 'left' });
  assert.equal(afterMain.nodes.some(node => node.id === 'tee'), false);
  assert.equal(afterMain.edges.length, 1);
  assert.deepEqual([afterMain.edges[0].from, afterMain.edges[0].to], ['end', 'branch']);
});

test('eine von PDF.js abgelöste PDF wird vor dem Projektexport wiederhergestellt', async () => {
  const app = read('src/app.js');
  const helper = app.match(/async function projectPdfBytes\(\)\{[^\n]*\}/)?.[0];
  const serializer = app.match(/async function projectFile\(\)\{[^\n]*\}/)?.[0];
  const base64 = app.match(/const toBase64=bytes=>\{[^\n]*\};/)?.[0];
  assert.ok(helper && serializer && base64);
  assert.match(app, /pdfjsLib\.getDocument\(\{data:new Uint8Array\(nextBytes\.slice\(0\)\)\}\)/);
  const fixture = Buffer.from('%PDF-1.4\n%%EOF\n');
  const original = Uint8Array.from(fixture).buffer;
  const detached = original.slice(0);
  structuredClone(detached, { transfer: [detached] });
  const sandbox = { pdfBytes: detached, pdf: { getData: async () => new Uint8Array(original) }, pdfName: 'fixture.pdf', project: { nodes: [], edges: [] }, $: () => ({ value: 'Testnetz' }), settingsFromUI: () => ({}), btoa };
  runInContext(`${base64}\n${helper}\n${serializer}\nglobalThis.recoverPdf=projectPdfBytes;globalThis.serialize=projectFile`, createContext(sandbox));
  const recovered = await sandbox.recoverPdf();
  assert.equal(Buffer.compare(Buffer.from(recovered), fixture), 0);
  const saved = JSON.parse(await sandbox.serialize());
  assert.equal(saved.name, 'Testnetz');
  assert.equal(Buffer.compare(Buffer.from(saved.pdfBase64, 'base64'), fixture), 0);
});

test('Rohrangaben an senkrechter Leitung haben Vorrang vor Kühlstellennamen', () => {
  const app = read('src/app.js');
  const layout = app.slice(app.indexOf('function layoutNetworkLabels(){'), app.indexOf('function drawNetwork(){'));
  const displayLabel = app.match(/function displaySizeLabel\(row\)\{[^\n]*\}/)?.[0];
  assert.ok(layout.indexOf('const annotations=[]') < layout.indexOf('const nodeLabels=new Map()'));
  const edge = { id: 'e', from: 's', to: 'e1', points: [{ x: 100, y: 20 }, { x: 100, y: 140 }] };
  const sandbox = {
    baseScale: 1, zoom: 1, dirty: false,
    project: { nodes: [{ id: 's', type: 'start', name: 'Verbund', x: 100, y: 20 }, { id: 'e1', type: 'endpoint', name: 'Kühlstelle A', x: 100, y: 140 }, { id: 'e2', type: 'endpoint', name: 'Kühlstelle B', x: 230, y: 90 }], edges: [edge], lastResult: { rows: [{ edgeId: 'e', type: 'suction', sizeLabel: '16 × 1 mm', lengthM: 12 }, { edgeId: 'e', type: 'liquid', sizeLabel: '10 × 1 mm', lengthM: 12 }] } },
    edgePoints: item => item.points, markerRadiusPx: () => 5, labelWidth: text => text.length * 7,
    format: (value, digits) => value.toFixed(digits),
    RohrKatalog: { series: [{ id: 'k65-inch-120bar', sizes: [{ odMm: 19.05, wallMm: 1.19, inch: '3/4' }, { odMm: 34.92, wallMm: 2.17, inch: '1 3/8' }] }] },
    RohrRunnerEngine: { sizeLabel: size => `${size.inch.replace(/\s+/g, '-')}"` },
    overlaps: (a, b, pad = 2) => a.left < b.right + pad && a.right > b.left - pad && a.top < b.bottom + pad && a.bottom > b.top - pad,
    crossesSegment: (box, line) => Math.abs(line.a.y - line.b.y) < .5 ? line.a.y >= box.top && line.a.y <= box.bottom && Math.max(Math.min(line.a.x, line.b.x), box.left) <= Math.min(Math.max(line.a.x, line.b.x), box.right) : line.a.x >= box.left && line.a.x <= box.right && Math.max(Math.min(line.a.y, line.b.y), box.top) <= Math.min(Math.max(line.a.y, line.b.y), box.bottom),
    labelBox: (x, y, width, height) => ({ left: x - width / 2, right: x + width / 2, top: y - height / 2, bottom: y + height / 2 })
  };
  runInContext(`${displayLabel}\n${layout};globalThis.layout=layoutNetworkLabels`, createContext(sandbox));
  const result = sandbox.layout();
  assert.equal(result.annotations.length, 2);
  assert.ok(result.annotations[0].x < 100 && result.annotations[1].x > 100);
  assert.ok(result.annotations.every(item => Math.abs(item.y - 80) < 1));
  assert.ok(result.nodeLabels.get('e2').dx > 0);
  edge.points = [{ x: 100, y: 20 }, { x: 100, y: 50 }, { x: 300, y: 50 }];
  const longestSegmentResult = sandbox.layout();
  assert.equal(longestSegmentResult.annotations.length, 2);
  assert.ok(longestSegmentResult.annotations.every(item => Math.abs(item.x - 200) < 1));
  sandbox.project.lastResult.fluid = 'R744';
  sandbox.project.lastResult.rows[0].sizeId = '19.05x1.19';
  sandbox.project.lastResult.rows[1].sizeId = '34.92x2.17';
  const inchResult = sandbox.layout();
  assert.equal(inchResult.annotations[0].text, '3/4" / 1-3/8"');
});

test('Ergebnis-Nachrechnung hält alle anderen Rohrgrößen fest, ohne den Editor zu ändern', () => {
  const app=read('src/app.js');
  const helper=app.slice(app.indexOf('function projectForCalculation('),app.indexOf('  function resultStatusByEdge(')).trim();
  const project={nodes:[],edges:[
    {id:'a',thermal:{suction:{mode:'manual',sizeId:'28x1.5'},liquid:{mode:'auto'}}},
    {id:'b',thermal:{suction:{mode:'auto'},liquid:{mode:'manual',sizeId:'12x1'}}}
  ]};
  const make=runInContext(`(${helper})`,createContext({project,clone:value=>JSON.parse(JSON.stringify(value))}));
  const locked={changedKey:'a:suction',rows:[
    {edgeId:'a',type:'suction',sizeId:'22x1'}, {edgeId:'a',type:'liquid',sizeId:'15x1'},
    {edgeId:'b',type:'suction',sizeId:'22x1'}, {edgeId:'b',type:'liquid',sizeId:'12x1'}
  ]};
  const calculated=make(locked);
  assert.equal(calculated.edges[0].thermal.suction.sizeId,'28x1.5');
  assert.equal(calculated.edges[0].thermal.liquid.sizeId,'15x1');
  assert.equal(calculated.edges[1].thermal.suction.sizeId,'22x1');
  assert.equal(calculated.edges[1].thermal.liquid.sizeId,'12x1');
  assert.equal(project.edges[1].thermal.suction.mode,'auto');
  project.edges[0].thermal.suction={mode:'auto',sizeId:null};
  assert.equal(make(locked).edges[0].thermal.suction.mode,'auto','nur die geänderte Größe darf automatisch neu gewählt werden');
  assert.match(app,/if\(locked\?\.rows\)for\(const row of result\.rows\)/);
});

test('UI-Verträge decken Dialoge, Kalibrierung und alle referenzierten Elemente ab', () => {
  const html = read('index.html'), app = read('src/app.js');
  assert.match(html, /src\/editor-core\.js/);
  assert.match(html, /id="nodeLoad" type="text" inputmode="decimal"/);
  assert.match(app, /addEventListener\('click',selectCalibrationPoint,true\)/);
  assert.match(app, /classList\.toggle\('calibrated',calibrated\)/);
  assert.doesNotMatch(app, /project\.calibrationGuide=/);
  assert.match(app, /tool==='select'&&background/);
  assert.match(app, /else if\(tool==='endpoint'\)createEndpoint\(p\)/);
  assert.match(app, /dataset\.terminalId=node\.id/);
  assert.match(app, /preview=Editor\.finishOrthogonal\(pipePoints,pipeHover,pipeAxis\)/);
  assert.match(app, /Leitung abgeschlossen · nächsten Startpunkt wählen/);
  assert.doesNotMatch(html, /data-tool="junction"/);
  assert.doesNotMatch(app, /tool==='junction'/);
  assert.match(app, /Editor\.moveNode\(drag\.original/);
  assert.match(app, /Editor\.moveEdgeSegment\(drag\.original/);
  assert.match(app, /function updateNetworkAppearance\(\)/);
  assert.doesNotMatch(html, /id="startBlank"|class="empty-state"/);
  assert.doesNotMatch(app, /\$\('startBlank'\)/);
  assert.match(app, /function createStart\(point\).*name:'Verbund'.*setTool\('endpoint'\)/);
  assert.doesNotMatch(app, /showSaveFilePicker|prepareProjectDownload/);
  assert.match(app, /async function exportProject\(\)\{try\{project\.name=.*?files=\[\{name:`\$\{base\}\.rohrrunner`,data:await projectFile\(\)\}/);
  assert.match(app, /document\.body\.append\(a\);a\.click\(\)/);
  assert.doesNotMatch(html, /id="saveDialog"/);
  assert.match(html, /id="confirmDialog"/);
  for(const [label,key] of [['Druckverlust SL max.','suctionLimitK'],['Druckverlust FL max.','liquidLimitK'],['Sauggasgeschwindigkeit max.','maxVelocityMS']])
    assert.ok(html.includes(`<label>${label}<span class="field-unit"><input data-setting="${key}"`),`${label}: Beschriftung`);
  assert.doesNotMatch(app, /window\.(?:confirm|prompt)\(/);
  assert.match(app, /\$\('resetProject'\)\.onclick=\(\)=>resetProject\(\)/);
  assert.match(app, /project-rename/);
  assert.doesNotMatch(html, /id="downloadProject"/);
  assert.match(html, /src="src\/zip\.js"/);
  assert.match(app, /RohrRunnerZip\.create\(files\)/);
  assert.match(app, /planPdfBytes\(\)/);
  assert.match(app, /vertical\?dimWidth:height/);
  assert.match(app, /vertical\?lenWidth:height/);
  assert.match(app, /document\.addEventListener\('click'.*\[data-close\]/s);

  const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
  const referencedIds = new Set([...app.matchAll(/\$\('([^']+)'\)/g)].map(match => match[1]));
  const missing = [...referencedIds].filter(id => !htmlIds.has(id));
  assert.deepEqual(missing, [], `Fehlende UI-Elemente: ${missing.join(', ')}`);

  const dialogs = [...html.matchAll(/<dialog\b[\s\S]*?<\/dialog>/g)].map(match => match[0]);
  assert.equal(dialogs.length, 5);
  for (const dialog of dialogs) {
    for (const button of dialog.matchAll(/<button\b([^>]*)>/g)) {
      assert.match(button[1], /\btype="(?:button|submit)"/, `Dialogbutton ohne expliziten Typ: ${button[0]}`);
    }
  }
});
