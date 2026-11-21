import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

test('Rohrstrecken zeigen Gesamtlänge und nur normale Geschwindigkeiten samt Prüfen-Button', () => {
  const app=read('src/app.js');
  const result=app.slice(app.indexOf('function showResult('),app.indexOf('    const endpoints=document.createElement',app.indexOf('function showResult(')));
  assert.match(result,/document\.createTextNode\(`\$\{format\(sl\?\.lengthM\?\?fl\?\.lengthM,1\)\} m`\)/);
  assert.match(result,/velocity\.innerHTML=`<span>SL \$\{format\(sl\?\.velocityMS,1\)\}<\/span><span>FL \$\{format\(fl\?\.velocityMS,1\)\}<\/span>`/);
  assert.doesNotMatch(result,/riserVelocityMinMS|\+ ↑/);
  assert.match(result,/riserButton\.textContent='Prüfen'/);
  assert.match(read('src/style.css'),/\.riser-open\{[^}]*margin:3px 2px 0 0/);
});

test('Steigleitung bleibt in Berechnung, CSV und Materialmengen als zusätzliche Sauglänge erhalten', () => {
  const app=read('src/app.js');
  assert.match(app, /riserLengthFor\(edge\)/);
  assert.match(app, /edge\.pipeRiser\?Math\.max\(0,Number\(edge\.pipeRiserLengthM\)\|\|0\):0/);
  const source=app.slice(app.indexOf('function splitRiserMaterialRows('),app.indexOf('  function renderMaterialList(')).trim();
  const split=runInNewContext(`(${source})`);
  const rows=split([{type:'suction',lengthM:9,riserLengthM:2,sizeId:'22x1',riserSizeId:'22x1'},
    {type:'suction',lengthM:6,riserLengthM:1,sizeId:'22x1',riserSizeId:'18x1'},
    {type:'liquid',lengthM:9,riserLengthM:0,sizeId:'12x1'}]);
  assert.deepEqual(rows.map(row=>[row.lengthM,row.sizeId,row.riser]),[[7,'22x1',false],[2,'22x1',true],[5,'22x1',false],[1,'18x1',true],[9,'12x1',false]]);
  assert.match(app, /\[true,'Steigleitung · Saugleitung'\]/);
  assert.match(app, /row\.riser===riser/);
  assert.match(app, /'Strecke ohne Steigleitung','Steigleitungslänge'/);
  assert.match(app, /data-edge-riser="enabled"/);
  assert.match(app, /data-edge-riser="length"/);
  assert.match(app, /class="terminal-riser edge-riser"/);
  assert.match(app, /class="terminal-riser-length edge-riser-length"/);
  assert.match(app, /riserLength\.closest\('label'\)\.classList\.toggle\('disabled',!enabled\.checked\)/);
  assert.match(app, /riserLength\.disabled=!enabled\.checked/);
  assert.match(read('src/style.css'), /\.edge-card-grid \.terminal-riser/);
  assert.match(app, /function migrateTerminalRisers\(/);
});

test('Gesamtlänge summiert Planstrecke, zusätzliche Rohrlänge und vertikale Steigleitung einmal', () => {
  const app=read('src/app.js'),source=app.slice(app.indexOf('function terminalRouteLength('),app.indexOf('  function updateLengthDisplays(')).trim();
  const node={id:'cold',type:'endpoint'};
  const project={calibration:1,nodes:[{id:'plant',type:'start'},node],edges:[{from:'plant',to:'cold',extraLengthM:1,pipeRiser:true,pipeRiserLengthM:3,points:[{x:0,y:0},{x:4,y:0}]}]};
  const length=runInNewContext(`(${source})`,{project,edgePoints:edge=>edge.points});
  assert.equal(length(node),8);
  project.edges[0].extraLengthM=2;
  assert.equal(length(node),9);
  project.edges[0].pipeRiser=false;
  assert.equal(length(node),6);
});

test('Zusätzliche Längen aktualisieren beide Längenanzeigen bei Eingabe, übrige Werte erst bei Bestätigung', () => {
  const app=read('src/app.js');
  const route=app.slice(app.indexOf('function terminalRouteLength('),app.indexOf('  function updateLengthDisplays(')).trim();
  const update=app.slice(app.indexOf('function updateLengthDisplays('),app.indexOf('  function renderTerminals(')).trim();
  const riser=app.slice(app.indexOf('function riserLengthFor('),app.indexOf('  function syncRiserButtons(')).trim();
  const node={id:'cold',type:'endpoint'};
  const edge={id:'pipe',from:'plant',to:'cold',extraLengthM:3,pipeRiser:true,pipeRiserLengthM:5,points:[{x:0,y:0},{x:4,y:0}]};
  const project={calibration:1,nodes:[{id:'plant',type:'start'},node],edges:[edge]};
  const terminalLabel={textContent:''},edgeLabel={textContent:''};
  const terminalRow={dataset:{terminalId:'cold'},querySelector:()=>terminalLabel},edgeCard={dataset:{edgeCard:'pipe'},querySelector:()=>edgeLabel};
  const document={querySelectorAll:selector=>selector.startsWith('.terminal-card')?[terminalRow]:[edgeCard]};
  const context={project,document,edgePoints:item=>item.points,format:(value)=>value.toFixed(1)};
  const refresh=runInNewContext(`(()=>{${route};${riser};return ${update}})()`,context);
  refresh();assert.equal(terminalLabel.textContent,'12.0 m');assert.equal(edgeLabel.textContent,'12.0 m');
  edge.extraLengthM=4;refresh();assert.equal(terminalLabel.textContent,'13.0 m');assert.equal(edgeLabel.textContent,'13.0 m');
  edge.pipeRiserLengthM=7;refresh();assert.equal(terminalLabel.textContent,'15.0 m');assert.equal(edgeLabel.textContent,'15.0 m');
  assert.match(app, /if\(key==='extraLengthM'\)\{field.onfocus=.*field.oninput=\(\)=>\{/);
  assert.doesNotMatch(app, /name.oninput=|value.oninput=|riserLength.oninput=|riserLengthInput.oninput=/);
  assert.match(app, /data-edge-riser="enabled"[^>]*><span>ja<\/span>/);
});

test('alte Kühlstellenlängen wandern einmalig auf die angeschlossene Rohrstrecke', () => {
  const app=read('src/app.js');
  const migration=app.slice(app.indexOf('function migrateTerminalRisers('),app.indexOf('  function renderAll(')).trim();
  const calculation=app.slice(app.indexOf('function projectForCalculation('),app.indexOf('  function resultStatusByEdge(')).trim();
  const project={nodes:[{id:'plant',type:'start'},{id:'cold',type:'endpoint',extraLengthM:2,suctionRiser:true,riserLengthM:3}],edges:[{id:'pipe',from:'plant',to:'cold',extraLengthM:1,pipeRiser:true,pipeRiserLengthM:4,riserSizeId:'18x1',suctionRiser:true,riserLengthM:3}]};
  const context={project,clone:value=>JSON.parse(JSON.stringify(value))};
  const migrate=runInNewContext(`(${migration})`,context),forCalculation=runInNewContext(`(${calculation})`,context);
  migrate();
  assert.equal(project.edges[0].extraLengthM,3);
  assert.equal(project.edges[0].pipeRiserLengthM,7);
  assert.equal(project.edges[0].riserSizeId,'18x1');
  assert.equal(project.nodes[1].extraLengthM,undefined);
  assert.equal(project.nodes[1].riserLengthM,undefined);
  assert.equal(project.nodes[1].suctionRiser,undefined);
  migrate();
  assert.equal(project.edges[0].extraLengthM,3);
  assert.equal(project.edges[0].pipeRiserLengthM,7);
  assert.equal(forCalculation().edges[0].riserLengthM,7);
  project.edges[0].pipeRiser=false;
  const disabled=forCalculation().edges[0];
  assert.equal(disabled.suctionRiser,false);
  assert.equal(disabled.riserSizeId,undefined);
  assert.match(app, /function renderAll\(\)\{migrateTerminalRisers\(\)/);
  const pending={nodes:[{id:'cold',type:'endpoint',extraLengthM:2,suctionRiser:true,riserLengthM:3}],edges:[]};
  const migratePending=runInNewContext(`(${migration})`,{project:pending});
  migratePending();
  assert.equal(pending.nodes[0].extraLengthM,2);
  pending.nodes.push({id:'plant',type:'start'});
  pending.edges.push({id:'pipe',from:'cold',to:'plant'});
  migratePending();
  assert.equal(pending.edges[0].extraLengthM,2);
  assert.equal(pending.edges[0].pipeRiserLengthM,3);
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

test('Kühlstellen enthalten nur Name, Leistung und Gesamtlänge in einer Zeile', () => {
  const app=read('src/app.js'),style=read('src/style.css');
  const terminals=app.slice(app.indexOf('function renderTerminals('),app.indexOf('  function renderEdges('));
  assert.match(terminals, /row\.append\(name,load,lengthBox\);list\.append\(row\)/);
  assert.doesNotMatch(terminals, /extraLengthM|suctionRiser|riserLengthM|terminal-delete/);
  assert.match(style, /\.terminal-card:not\(\.edge-card\)\{display:grid;grid-template-columns:/);
  assert.match(style, /\.edge-card-grid\{[^}]*minmax\(90px,1fr\)/);
  assert.ok(app.includes("$('deleteSelection').onclick=onDelete"));
});

test('Steigleitungsdialog zeigt vorhandene Werte und berechnet bei Rohrwahl neu', () => {
  const app=read('src/app.js'),html=read('index.html');
  const source=app.slice(app.indexOf('function renderRiserPreview('),app.indexOf('  function openRiserDialog(')).trim();
  const preview={className:'',innerHTML:''},render=runInNewContext(`(${source})`,{$:()=>preview,displaySizeLabel:()=> '22 × 1 mm',format:(v,d)=>Number.isFinite(v)?v.toFixed(d):'—'});
  const result={settings:{minVelocityMS:7},rows:[{edgeId:'e',type:'suction',riserLengthM:3,riserVelocityMinMS:8.4,temperatureDropK:0.42}],issues:[]};
  render(result,'e');
  assert.match(preview.innerHTML,/8\.4 m\/s/);
  assert.match(preview.innerHTML,/7\.0 m\/s/);
  assert.match(preview.innerHTML,/0\.42 K/);
  result.issues=[{type:'oil-return',edgeId:'e',severity:'check'}];render(result,'e');
  assert.match(preview.className,/check/);
  assert.match(app, /renderRiserPreview\(project\.lastResult,edge\.id,project\.resultStale\)/);
  assert.ok(app.includes("$('riserSize').addEventListener('change',()=>checkRiserDialog())"));
  assert.doesNotMatch(html,/id="riserCheck"|id="riserLength"|id="riserApply"/);
  assert.ok(!app.includes("$('riserCheck')")&&!app.includes("$('riserLength')")&&!app.includes("$('riserApply')"));
  assert.match(app,/token!==dialog\._runId/);
  assert.match(app,/edge\.riserSizeId=sizeId;project\.settings=settingsFromUI\(\);showResult\(result,0\)/);
});

test('Rohrwahl übernimmt nur die letzte erfolgreiche Nachrechnung', async () => {
  const app=read('src/app.js'),source=app.slice(app.indexOf('async function checkRiserDialog('),app.indexOf('  function resultEdgeOrder(')).trim();
  const edge={id:'e',pipeRiser:true,pipeRiserLengthM:2},project={edges:[edge],lastResult:{rows:[]},resultStale:false,calibration:1};
  const dialog={_runId:0,dataset:{edgeId:'e'},open:true},size={value:'18x1'},preview={},pending=[];
  const result={rows:[{edgeId:'e',type:'suction'}]};let saved=0,shown=0;
  const ctx={project,$:id=>({riserDialog:dialog,riserSize:size,riserPreview:preview})[id],riserLengthFor:()=>2,
    projectForCalculation:()=>({edges:[{id:'e'}]}),settingsFromUI:()=>({}),RohrStoffdaten:{load:()=>new Promise(resolve=>pending.push(resolve))},
    RohrRunnerEngine:{calculate:()=>result},RohrKatalog:{},remember:()=>saved++,showResult:()=>shown++,renderRiserPreview:()=>{}};
  const check=runInNewContext(`(${source})`,ctx);
  const first=check();size.value='15x1';const second=check();
  pending[0]();await first;assert.equal(shown,0);
  pending[1]();await second;
  assert.equal(edge.riserSizeId,'15x1',preview.textContent);assert.equal(saved,1);assert.equal(shown,1);
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
  for(const control of ['openPdf','exportPlanPdf','calibrate','calculate','exportCsv','projectFile','edgeList','riserDialog','riserSize','riserPreview'])assert.ok(html.includes(`id="${control}"`),`UI: ${control}`);
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
