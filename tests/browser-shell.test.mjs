import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

test('Steigleitung wird in Ergebnis, CSV und Materialmengen als zusätzliche Sauglänge geführt', () => {
  const app=read('src/app.js');
  assert.match(app, /length\.readOnly=true/);
  assert.match(app, /node\.suctionRiser\?Math\.max\(0,Number\(node\.riserLengthM\)\|\|0\):0/);
  const source=app.slice(app.indexOf('function splitRiserMaterialRows('),app.indexOf('  function renderMaterialList(')).trim();
  const split=runInNewContext(`(${source})`);
  const rows=split([{type:'suction',lengthM:9,riserLengthM:2,sizeId:'22x1',riserSizeId:'22x1'},
    {type:'suction',lengthM:6,riserLengthM:1,sizeId:'22x1',riserSizeId:'18x1'},
    {type:'liquid',lengthM:9,riserLengthM:0,sizeId:'12x1'}]);
  assert.deepEqual(rows.map(row=>[row.lengthM,row.sizeId,row.riser]),[[7,'22x1',false],[2,'22x1',true],[5,'22x1',false],[1,'18x1',true],[9,'12x1',false]]);
  assert.match(app, /\[true,'Steigleitung · Saugleitung'\]/);
  assert.match(app, /row\.riser===riser/);
  assert.match(app, /sl\.lengthM-sl\.riserLengthM/);
  assert.match(app, /'Strecke ohne Steigleitung','Steigleitungslänge'/);
  assert.match(app, /data-edge-riser="enabled"/);
  assert.match(app, /data-edge-riser="length"/);
  assert.match(app, /class="terminal-riser edge-riser"/);
  assert.match(app, /class="terminal-riser-length edge-riser-length"/);
  assert.match(app, /riserLength\.closest\('label'\)\.classList\.toggle\('disabled',!enabled\.checked\)/);
  assert.match(app, /riserLength\.disabled=!enabled\.checked/);
  assert.match(read('src/style.css'), /\.terminal-card-grid \.terminal-riser,\.edge-card-grid \.terminal-riser/);
  assert.match(app, /if\(!riserEnabled\.checked\)\{node\.riserLengthM=0;.*delete edge\.suctionRiser/);
  assert.match(app, /function migrateTerminalRisers\(/);
});

test('Gesamtlänge summiert Planstrecke, zusätzliche Rohrlänge und vertikale Steigleitung einmal', () => {
  const app=read('src/app.js'),source=app.slice(app.indexOf('function terminalRouteLength('),app.indexOf('  function updateLengthDisplays(')).trim();
  const node={id:'cold',type:'endpoint',extraLengthM:2,suctionRiser:true,riserLengthM:3};
  const project={calibration:1,nodes:[{id:'plant',type:'start'},node],edges:[{from:'plant',to:'cold',extraLengthM:1,suctionRiser:true,riserLengthM:3,points:[{x:0,y:0},{x:4,y:0}]}]};
  const length=runInNewContext(`(${source})`,{project,edgePoints:edge=>edge.points});
  assert.equal(length(node),10);
  project.edges[0].pipeRiser=true;project.edges[0].pipeRiserLengthM=5;
  assert.equal(length(node),15);
  node.suctionRiser=false;node.riserLengthM=0;
  delete project.edges[0].suctionRiser;
  assert.equal(length(node),12);
  project.edges[0].pipeRiser=false;
  assert.equal(length(node),7);
});

test('Zusätzliche Längen aktualisieren beide Längenanzeigen bei Eingabe, übrige Werte erst bei Bestätigung', () => {
  const app=read('src/app.js');
  const route=app.slice(app.indexOf('function terminalRouteLength('),app.indexOf('  function updateLengthDisplays(')).trim();
  const update=app.slice(app.indexOf('function updateLengthDisplays('),app.indexOf('  function renderTerminals(')).trim();
  const riser=app.slice(app.indexOf('function riserLengthFor('),app.indexOf('  function syncRiserButtons(')).trim();
  const node={id:'cold',type:'endpoint',extraLengthM:2,suctionRiser:true,riserLengthM:3};
  const edge={id:'pipe',from:'plant',to:'cold',extraLengthM:1,pipeRiser:true,pipeRiserLengthM:5,points:[{x:0,y:0},{x:4,y:0}]};
  const project={calibration:1,nodes:[{id:'plant',type:'start'},node],edges:[edge]};
  const terminalLabel={textContent:''},edgeLabel={textContent:''};
  const terminalRow={dataset:{terminalId:'cold'},querySelector:()=>terminalLabel},edgeCard={dataset:{edgeCard:'pipe'},querySelector:()=>edgeLabel};
  const document={querySelectorAll:selector=>selector.startsWith('.terminal-card')?[terminalRow]:[edgeCard]};
  const context={project,document,edgePoints:item=>item.points,format:(value)=>value.toFixed(1)};
  const refresh=runInNewContext(`(()=>{${route};${riser};return ${update}})()`,context);
  refresh();assert.equal(terminalLabel.textContent,'15.0 m');assert.equal(edgeLabel.textContent,'15.0 m');
  edge.extraLengthM=4;refresh();assert.equal(terminalLabel.textContent,'18.0 m');assert.equal(edgeLabel.textContent,'18.0 m');
  node.extraLengthM=5;refresh();assert.equal(terminalLabel.textContent,'21.0 m');assert.equal(edgeLabel.textContent,'21.0 m');
  assert.match(app, /extra.oninput=\(\)=>\{/);
  assert.match(app, /if\(key==='extraLengthM'\)\{field.onfocus=.*field.oninput=\(\)=>\{/);
  assert.doesNotMatch(app, /name.oninput=|value.oninput=|riserLength.oninput=|riserLengthInput.oninput=/);
  assert.match(app, /riserLabel.textContent='ja'/);
  assert.match(app, /data-edge-riser="enabled"[^>]*><span>ja<\/span>/);
});

test('Kühlstellen-Steigleitung bleibt nach Deaktivieren aus und wird nur einmal übernommen', () => {
  const app=read('src/app.js');
  const migration=app.slice(app.indexOf('function migrateTerminalRisers('),app.indexOf('  function renderAll(')).trim();
  const calculation=app.slice(app.indexOf('function projectForCalculation('),app.indexOf('  function resultStatusByEdge(')).trim();
  const project={nodes:[{id:'plant',type:'start'},{id:'cold',type:'endpoint'}],edges:[{id:'pipe',from:'plant',to:'cold',suctionRiser:true,riserLengthM:2,riserSizeId:'18x1'}]};
  const context={project,clone:value=>JSON.parse(JSON.stringify(value))};
  const migrate=runInNewContext(`(${migration})`,context),forCalculation=runInNewContext(`(${calculation})`,context);
  migrate();
  assert.equal(project.nodes[1].riserLengthM,2);
  assert.equal(forCalculation().edges[0].riserLengthM,2);
  project.edges[0].pipeRiser=true;project.edges[0].pipeRiserLengthM=4;
  assert.equal(forCalculation().edges[0].riserLengthM,6);
  project.nodes[1].suctionRiser=false;
  migrate();
  const disabled=forCalculation().edges[0];
  assert.equal(project.nodes[1].suctionRiser,false);
  assert.equal(disabled.suctionRiser,true);
  assert.equal(disabled.riserLengthM,4);
  assert.equal(disabled.riserSizeId,'18x1');
  project.nodes[1].suctionRiser=true;project.nodes[1].riserLengthM=3;
  const enabled=forCalculation().edges[0];
  assert.equal(enabled.riserLengthM,7);
  assert.equal(enabled.riserSizeId,'18x1');
  project.edges[0].pipeRiser=false;
  project.nodes[1].suctionRiser=false;
  const inactive=forCalculation().edges[0];
  assert.equal(inactive.suctionRiser,false);
  assert.equal(inactive.riserSizeId,undefined);
});

test('ältere Steigleitung an gemeinsamer Rohrstrecke wird ohne Verdopplung überführt', () => {
  const app=read('src/app.js');
  const migration=app.slice(app.indexOf('function migrateTerminalRisers('),app.indexOf('  function renderAll(')).trim();
  const calculation=app.slice(app.indexOf('function projectForCalculation('),app.indexOf('  function resultStatusByEdge(')).trim();
  const project={nodes:[{id:'start',type:'start'},{id:'branch',type:'junction'}],edges:[{id:'main',from:'start',to:'branch',suctionRiser:true,riserLengthM:5,riserSizeId:'18x1'}]};
  const context={project,clone:value=>JSON.parse(JSON.stringify(value))};
  runInNewContext(`(${migration})`,context)();
  const edge=runInNewContext(`(${calculation})`,context)().edges[0];
  assert.equal(project.edges[0].pipeRiserLengthM,5);
  assert.equal(edge.riserLengthM,5);
  assert.equal(edge.riserSizeId,'18x1');
});

test('Rohrstrecken in Vorgaben und Ergebnissen folgen Kühlstellen zum Verbund', () => {
  const app=read('src/app.js'),source=app.slice(app.indexOf('function resultEdgeOrder('),app.indexOf('  function projectForCalculation(')).trim();
  const project={nodes:[{id:'start',type:'start',name:'Verbund'},{id:'tee',type:'junction',name:'T1'},{id:'cold-a',type:'endpoint',name:'Kühlstelle A'},{id:'cold-b',type:'endpoint',name:'Kühlstelle B'}],edges:[{id:'main',from:'start',to:'tee'},{id:'b',from:'tee',to:'cold-b'},{id:'a',from:'cold-a',to:'tee'}]};
  const ordered=runInNewContext(`(${source})`,{project})();
  assert.deepEqual(Array.from(ordered.orderedEdges,edge=>edge.id),['b','a','main']);
  assert.equal(ordered.edgeNodes.get('a').child,'cold-a');
  assert.equal(ordered.edgeNodes.get('main').parent,'start');
  assert.match(app, /const nodes=new Map\(project.nodes.map\(node=>\[node.id,node\]\)\),\{orderedEdges,edgeNodes\}=resultEdgeOrder\(\)/);
  assert.match(app, /for\(const edge of orderedEdges\)\{\s*const relation=edgeNodes.get\(edge.id\),child=relation\?\.child/);
  assert.match(app, /from=target,to=source/);
  project.edges.push({id:'draft',from:'start',to:'missing'});
  assert.equal(runInNewContext(`(${source})`,{project})().orderedEdges.at(-1).id,'draft');
  const draft={nodes:[{id:'start',type:'start'},{id:'cold',type:'endpoint'},{id:'tee',type:'junction'}],edges:[{id:'plant',from:'start',to:'tee'},{id:'terminal',from:'tee',to:'cold'}]};
  assert.deepEqual(Array.from(runInNewContext(`(${source})`,{project:draft})().orderedEdges,edge=>edge.id),['terminal','plant']);
  draft.nodes=draft.nodes.filter(node=>node.id!=='start');
  assert.deepEqual(Array.from(runInNewContext(`(${source})`,{project:draft})().orderedEdges,edge=>edge.id),['terminal','plant']);
});

test('browser shell ships local calculation assets and workflow controls', () => {
  const html=read('index.html'),worker=read('src/worker.js'),style=read('src/style.css'),app=read('src/app.js'),thermo=read('src/stoffdaten.js'),launcher=read('RohrRunner.bat'),linuxLauncher=read('RohrRunner.sh'),manifest=read('manifest.webmanifest'),serviceWorker=read('sw.js'),pwa=read('src/pwa.js'),tauriConfig=read('src-tauri/tauri.conf.json'),tauriLib=read('src-tauri/src/lib.rs');
  assert.match(html, /rel="manifest" href="manifest\.webmanifest"/);
  assert.match(html, /src="vendor\/pdfjs\/pdf\.min\.js"/);
  assert.match(html, /src="vendor\/pdf-lib\/pdf-lib\.min\.js"/);
  assert.match(app, /vendor\/pdfjs\/pdf\.worker\.min\.js/);
  assert.doesNotMatch(html, /https:\/\/(?:cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)\/.*(?:pdf|pdf-lib)/);
  for(const path of ['data/pipe-catalog.js','src/stoffdaten.js','src/fast-data.js','src/engine.js','src/editor-core.js','src/app.js'])assert.ok(html.includes(path),`index.html: ${path}`);
  for(const path of ['../vendor/coolprop/coolprop-local.js','../data/pipe-catalog.js','./stoffdaten.js','./fast-data.js','./engine.js'])assert.ok(worker.includes(path),`worker: ${path}`);
  assert.ok(worker.includes('self.document =')&&worker.includes('document.currentScript.src'),'worker supplies the Emscripten script URL without a browser document');
  for(const control of ['openPdf','exportPlanPdf','calibrate','calculate','exportCsv','projectFile','edgeList','riserDialog','riserLength','riserSize','riserCheck','riserApply'])assert.ok(html.includes(`id="${control}"`),`UI: ${control}`);
  for(const panel of ['panelTerminals','panelCalculation','panelResults'])assert.ok(html.includes(`id="${panel}"`),`sidebar tab panel: ${panel}`);
  assert.ok(html.includes('role="tablist"')&&html.includes('Kühlstellen</button>')&&html.includes('Berechnung</button>')&&html.includes('Ergebnis</button>'),'sidebar exposes the three workflow tabs');
  assert.ok(html.indexOf('id="calcBadge"')<html.indexOf('<main class="shell">')&&!html.includes('inspector-head'),'calculation status sits in the top header without a heading above the tabs');
  assert.ok(app.includes("setInspectorTab('panelResults')"),'successful calculation opens the result tab');
  assert.ok(app.includes('RohrRunnerEngine.sizeLabel(size)')&&app.includes("new Option(`${size.label} (auto)`,'auto')")&&app.includes('autoSizeIdFor(edge,type,row)')&&app.includes("directLimit?'limit':'check'"),'catalog labels, calculated sizes and manual selections remain available');
  assert.ok(style.includes('.result-section.check')&&style.includes('.result-section.limit')&&!style.includes('.result-section.valid'),'normal pipe sections have no green status highlight');
  assert.ok(app.includes('calibrationHover=svgPoint(e);drawNetwork()'),'calibration line updates while positioning the second point');
  assert.ok(style.includes('.shell')&&style.includes('.inspector')&&style.includes('.stage'));
  assert.ok(style.includes('.inspector-tabs{')&&style.includes('background:#101920'),'sidebar tabs match the PDF toolbar background');
  assert.ok(style.includes('.canvas-toolbar{grid-column:1/3;grid-row:1}')&&style.includes('.rail{grid-column:1;grid-row:2/4}'),'PDF toolbar spans above the tool rail');
  assert.ok(html.includes('R513A')&&html.includes('R448A')&&html.includes('R744'));
  assert.ok(app.includes("location.protocol==='file:'")&&app.includes("new Blob([window.RohrRunnerWorkerBundle]"),'file:// starts the bundled Blob worker');
  assert.ok(app.includes('window.__TAURI__?.core?.invoke')&&app.includes("invoke('save_export_file'")&&app.includes('Array.from(bytes)'),'desktop exports use the native save dialog');
  assert.match(tauriConfig, /"withGlobalTauri": true/);
  assert.ok(tauriLib.includes('tauri_plugin_dialog')&&tauriLib.includes('blocking_save_file')&&tauriLib.includes('generate_handler![save_export_file]'),'Tauri registers the native export command');
  assert.ok(thermo.includes("new URL('../vendor/coolprop/coolprop-local.js', scriptBase)"));
  assert.ok(launcher.includes('scripts\\serve.mjs')&&launcher.includes('http://127.0.0.1:%ROHRRUNNER_PORT%/'),'Windows launcher starts the server and opens the browser');
  assert.ok(linuxLauncher.includes('#!/usr/bin/env bash')&&linuxLauncher.includes('scripts/serve.mjs')&&linuxLauncher.includes('xdg-open'),'Linux launcher starts the server and opens the browser');
  assert.ok(read('scripts/build-worker-bundle.mjs').includes('src/worker-bundle.js'),'worker bundle can be regenerated from local sources');
  assert.ok(read('src/worker-bundle.js').includes('window.RohrRunnerWorkerBundle = '),'generated standalone worker bundle exists');
  assert.match(manifest, /"display": "standalone"/);
  assert.match(manifest, /rohrRunner-192\.png/);
  assert.match(manifest, /rohrRunner-512\.png/);
  for(const asset of ['./index.html','./src/app.js','./vendor/coolprop/coolprop.wasm'])assert.ok(serviceWorker.includes(asset),`PWA cache: ${asset}`);
  assert.match(pwa, /serviceWorker\.register\('\.\/sw\.js'/);
});
