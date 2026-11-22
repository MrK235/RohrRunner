import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

test('Veraltete Ergebnisse werden nicht exportiert und CSV-Namen sind keine Formeln', () => {
  const app=read('src/app.js');
  const helper=app.slice(app.indexOf('const csvSafeLabel='),app.indexOf('  function calculationCsv(')).trim();
  const csv=app.slice(app.indexOf('function calculationCsv('),app.indexOf('  async function exportCsv(')).trim();
  const material=app.slice(app.indexOf('function materialCsv('),app.indexOf('  async function exportMaterialCsv(')).trim();
  const nodes=[{id:'plant',name:'Verbund'},{id:'cold',name:' =EVIL()'}],edges=[{id:'edge',from:'plant',to:'cold'}];
  const project={name:'=FORMEL()',nodes,edges,resultStale:false,lastResult:{fluid:'R513A',settings:{},totalCoolingKW:1,rows:[{edgeId:'edge',type:'suction',lengthM:2,sizeId:'22x1',velocityMS:1}],issues:[]}};
  const context={project,resultEdgeOrder:()=>({orderedEdges:edges,edgeNodes:new Map([['edge',{parent:'plant',child:'cold'}]])}),displaySizeLabel:()=> '22 × 1 mm',$:()=>({querySelectorAll:()=>[]})};
  const api=runInNewContext(`(()=>{${helper};${csv};${material};return {calculationCsv,materialCsv}})()`,context);
  const result=api.calculationCsv();assert.match(result,/"'=FORMEL\(\)"/);assert.match(result,/"' =EVIL\(\) → Verbund"/);
  nodes[0].name=' =PLANT()';project.lastResult={mode:'secondary',settings:{},fluid:'WATER',secondary:{},rows:[{edgeId:'edge',type:'suction'}]};
  assert.match(api.calculationCsv(),/"'=FORMEL\(\)"/);
  assert.match(api.calculationCsv(),/"' =PLANT\(\) →  =EVIL\(\)"/);
  const materialRow={querySelector:selector=>({b:{textContent:'2 m'},span:{textContent:'+FORMEL()'}}[selector])};
  const section={querySelector:selector=>({'.material-section-heading b':{textContent:'=GRUPPE()'},'.material-unit':{textContent:'m'}}[selector]),querySelectorAll:()=>[materialRow]};
  context.$=()=>({querySelectorAll:()=>[section]});
  assert.match(api.materialCsv(),/"'=GRUPPE\(\)";"'\+FORMEL\(\)";"2";"m"/);
  project.resultStale=true;assert.equal(api.calculationCsv(),null);assert.equal(api.materialCsv(),null);
  assert.match(app,/,calculation=calculationCsv\(\),materials=materialCsv\(\)/);
  assert.match(app,/\$\('exportCsv'\)\.classList\.add\('hidden'\);\$\('exportMaterialsCsv'\)\.classList\.add\('hidden'\)/);
});

test('Projekt- und PDF-Import haben Größen- und Komplexitätsgrenzen', async () => {
  const app=read('src/app.js'),source=app.slice(app.indexOf('const MAX_PDF_BYTES='),app.indexOf('  const fromBase64=')).trim();
  const validate=runInNewContext(`(()=>{${source};return validateProjectImport})()`);
  validate({version:1,nodes:[],edges:[],pdfBase64:null});
  assert.throws(()=>validate({version:1,nodes:[],edges:[],pdfBase64:123}),/Eingebettetes PDF/);
  assert.throws(()=>validate({version:1,nodes:Array(3001),edges:[]}),/zu viele Knoten/);
  assert.throws(()=>validate({version:1,nodes:[],edges:Array(5001)}),/zu viele/);
  assert.throws(()=>validate({version:1,nodes:[],edges:[],pdfBase64:'a'.repeat(Math.ceil(25*1024*1024/3)*4+1)}),/Eingebettetes PDF/);
  const pdf=app.slice(app.indexOf('async function importPdfFile('),app.indexOf('  stage.addEventListener(\'dragover\'')).trim();
  const importPdf=runInNewContext(`(${pdf})`,{MAX_PDF_BYTES:25*1024*1024});
  await assert.rejects(importPdf({size:25*1024*1024+1,arrayBuffer:()=>{throw new Error('PDF wurde geladen')}}),/PDF ist zu groß/);
  assert.match(app,/if\(file\.size>MAX_PROJECT_BYTES\)throw Error/);
  assert.match(app,/if\(bytes\.byteLength>MAX_PDF_BYTES\)throw new Error/);
  const load=app.slice(app.indexOf('async function loadPdfBytes('),app.indexOf("  $('openPdf')")).trim();
  const old={destroy:()=>{}},next={getPage:async()=>({getViewport:()=>({width:12000,height:800})}),destroy(){this.destroyed=true}};
  const ctx={MAX_PDF_BYTES:25*1024*1024,window:{pdfjsLib:{}},pdfjsLib:{getDocument:()=>({promise:Promise.resolve(next)})},pdf:old,pdfBytes:new ArrayBuffer(1),pdfName:'alt.pdf'};
  const loadPdf=runInNewContext(`(${load})`,ctx);
  await assert.rejects(loadPdf(new ArrayBuffer(10)),/PDF-Seite überschreitet/);
  assert.equal(ctx.pdf,old);assert.equal(ctx.pdfName,'alt.pdf');assert.equal(next.destroyed,true);
});

test('Projektwechsel verwirft laufende Berechnungen und Undo aus anderen Projekten', async () => {
  const app=read('src/app.js');
  const stop=app.slice(app.indexOf('function stopPreviousCalculation('),app.indexOf('  function startEmpty(')).trim();
  const open=app.slice(app.indexOf('async function activateProject('),app.indexOf('  async function restoreProjects(')).trim();
  const block=()=>({innerHTML:'',dataset:{},classList:{add(){}},replaceChildren(){}});
  const nodes={calculate:{disabled:true,innerHTML:''},projectName:{value:''},pageLabel:{textContent:''},projectsDialog:{close(){}},
    results:block(),materials:block(),issues:block(),calculationError:block(),exportCsv:block(),exportMaterialsCsv:block()};
  const ctx={clearInterval:()=>{},clearTimeout:()=>{},scheduleSave:{timer:0},pending:new Map([[3,{}]]),$:id=>nodes[id],
    storedProjects:async()=>[{id:'new',settings:{},nodes:[],edges:[]}],persistProject:async()=>{},
    pdfRenderTask:null,pdf:null,pdfPage:null,pdfBytes:null,renderViewport:null,canvas:{},pdfName:'',
    migrateTerminalRisers:()=>{},defaults:{},document:{querySelector:()=>null},renderAll:()=>{},updateScale:()=>{},
    invalidate:()=>{},localStorage:{setItem:()=>{}},ACTIVE:'active',toast:message=>{ctx.error=message},updateHistoryButtons:()=>{}};
  const api=runInNewContext(`(()=>{let project={id:'old'},runId=3,calculationStatusTimer=1,history=['old'],future=['old'],selection={id:'old'},projectHasBeenSaved=true;${stop};${open};return {activateProject,state:()=>({project,runId,history,future,selection})}})()`,ctx);
  await api.activateProject('new');
  const state=api.state();assert.equal(state.project.id,'new',ctx.error);assert.equal(state.runId,4);
  assert.equal(state.history.length,0);assert.equal(state.future.length,0);assert.equal(state.selection,null);
  assert.equal(ctx.pending.size,0);assert.equal(nodes.calculate.disabled,false);
  assert.equal(nodes.results.dataset.hasResult,'');assert.match(nodes.results.innerHTML,/Berechnung starten/);
  assert.match(app,/const embeddedPdf=data\.pdfBase64;await persistProject\(\);stopPreviousCalculation\(\);history=\[\];future=\[\];selection=null/);
});

test('Lokaler Server liefert nur öffentliche Anwendungsdateien aus', async t => {
  const reservation=createServer();await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));
  const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
  const server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,ROHRRUNNER_PORT:String(port)},stdio:['ignore','pipe','pipe']});
  t.after(()=>server.kill());
  let timeout;try{await Promise.race([new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('exit',()=>reject(new Error('Server konnte nicht starten')))}),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Serverstart dauert zu lange')),3000)})])}finally{clearTimeout(timeout)}
  const get=async path=>(await fetch(`http://127.0.0.1:${port}${path}`)).status;
  assert.equal(await get('/'),200);assert.equal(await get('/src/app.js'),200);
  assert.equal(await get('/.git/config'),403);assert.equal(await get('/package.json'),403);
  assert.equal(await get('/node_modules/.package-lock.json'),403);
  assert.equal(await get('/src%2f..%2f.git%2fconfig'),403);
});

test('SL prüfen erscheint nur bei betroffener oder bereits angepasster Steigleitung', () => {
  const app=read('src/app.js'),source=app.slice(app.indexOf('function showRiserButton('),app.indexOf('  function syncRiserButtons(')).trim();
  const visible=runInNewContext(`(${source})`,{riserLengthFor:edge=>edge.pipeRiser?edge.pipeRiserLengthM:0});
  const edge={id:'e',pipeRiser:true,pipeRiserLengthM:2},result={issues:[]};
  assert.equal(visible(edge,result),false);
  result.issues=[{type:'oil-return',edgeId:'other'}];assert.equal(visible(edge,result),false);
  result.issues=[{type:'velocity',edgeId:'e'}];assert.equal(visible(edge,result),false);
  result.issues=[{type:'oil-return',edgeId:'e'}];assert.equal(visible(edge,result),true);
  result.issues=[];edge.riserSizeId='18x1';assert.equal(visible(edge,result),true);
  edge.pipeRiser=false;assert.equal(visible(edge,result),false);
  assert.match(app,/riserButton\.hidden=!showRiserButton\(edge,result\)/);
  assert.match(app,/showRiserButton\(edge,project\.lastResult\)/);
  assert.match(read('src/style.css'),/\.riser-open\[hidden\]\{display:none\}/);
});

test('Rohrstrecken zeigen Gesamtlänge und nur normale Geschwindigkeiten samt SL-prüfen-Button', () => {
  const app=read('src/app.js');
  const result=app.slice(app.indexOf('function showResult('),app.indexOf('    const endpoints=document.createElement',app.indexOf('function showResult(')));
  assert.match(result,/document\.createTextNode\(`\$\{format\(sl\?\.lengthM\?\?fl\?\.lengthM,1\)\} m`\)/);
  assert.match(result,/velocity\.innerHTML=`<span>SL \$\{format\(sl\?\.velocityMS,1\)\}<\/span><span>FL \$\{format\(fl\?\.velocityMS,1\)\}<\/span>`/);
  assert.doesNotMatch(result,/riserVelocityMinMS|\+ ↑/);
  assert.match(result,/riserButton\.textContent='SL prüfen'/);
  assert.match(read('src/style.css'),/\.riser-open\{[^}]*margin:6px 2px 0 0/);
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

test('Steigleitungsdialog zeigt ausschließlich relevante Geschwindigkeiten und Status', () => {
  const app=read('src/app.js'),html=read('index.html');
  const source=app.slice(app.indexOf('function renderRiserPreview('),app.indexOf('  function openRiserDialog(')).trim();
  const preview={className:'',innerHTML:''},current={textContent:''},render=runInNewContext(`(${source})`,{$:id=>id==='riserPreview'?preview:current,displaySizeLabel:()=> '22 × 1 mm',format:(v,d)=>Number.isFinite(v)?v.toFixed(d):'—'});
  const result={settings:{minVelocityMS:7},rows:[{edgeId:'e',type:'suction',lengthM:9,riserLengthM:3,riserVelocityMinMS:8.4,temperatureDropK:0.42}],issues:[]};
  render(result,'e');
  assert.match(preview.className,/ok/);
  assert.match(preview.innerHTML,/8\.4/);
  assert.match(preview.innerHTML,/7\.0/);
  assert.doesNotMatch(preview.innerHTML,/0\.42|Steigleitung.*m<\/strong>/);
  result.issues=[{type:'oil-return',edgeId:'e',severity:'check'}];render(result,'e');
  assert.match(preview.className,/check/);
  assert.match(html,/id="riserCheck"/);
  assert.match(html,/id="riserLength"/);
  assert.match(app,/\$\('riserCheck'\)\.addEventListener\('click',\(\)=>checkRiserDialog\(\)\)/);
  assert.doesNotMatch(app,/\$\('riserSize'\)\.addEventListener\('change',\(\)=>checkRiserDialog\(\)\)/);
});

test('Steigleitung übernimmt Größe und Länge erst nach erfolgreicher Prüfung', async () => {
  const app=read('src/app.js'),source=app.slice(app.indexOf('async function checkRiserDialog('),app.indexOf('  function resultEdgeOrder(')).trim();
  const edge={id:'e',pipeRiser:true,pipeRiserLengthM:2},project={edges:[edge],lastResult:{rows:[]},resultStale:false,calibration:1};
  const dialog={_runId:0,dataset:{edgeId:'e'},open:true},size={value:'18x1'},length={value:'3,5'},button={disabled:false},preview={},pending=[],candidates=[];
  const result={rows:[{edgeId:'e',type:'suction'}]};let saved=0,shown=0;
  const ctx={project,$:id=>({riserDialog:dialog,riserSize:size,riserLength:length,riserCheck:button,riserPreview:preview})[id],Editor:{parseDecimal:v=>Number(v.replace(',','.'))},
    projectForCalculation:()=>({edges:[{id:'e'}]}),settingsFromUI:()=>({}),RohrStoffdaten:{load:()=>new Promise(resolve=>pending.push(resolve))},
    RohrRunnerEngine:{calculate:candidate=>{candidates.push(candidate);return result}},RohrKatalog:{},remember:()=>saved++,showResult:()=>shown++,updateLengthDisplays:()=>{},renderRiserPreview:()=>{}};
  const check=runInNewContext(`(${source})`,ctx);
  const first=check();assert.equal(edge.pipeRiserLengthM,2);assert.equal(saved,0);
  size.value='15x1';length.value='4';const second=check();
  pending[0]();await first;assert.equal(shown,0);
  pending[1]();await second;
  assert.equal(candidates[0].edges[0].riserLengthM,4);
  assert.equal(edge.riserSizeId,'15x1');assert.equal(edge.pipeRiserLengthM,4);
  assert.equal(saved,1);assert.equal(shown,1);assert.equal(button.disabled,false);
});

test('PWA cached ausschließlich App-Dateien und keine Fehlerseiten', async () => {
  const listeners={},saved=[],scope='http://127.0.0.1:4173/';
  const self={registration:{scope},location:{origin:new URL(scope).origin},addEventListener:(type,handler)=>listeners[type]=handler};
  const caches={match:async()=>null,open:async()=>({put:async(path)=>saved.push(path)})};
  let response=new Response('ok',{status:200,headers:{'content-type':'text/html'}});
  runInNewContext(read('sw.js'),{self,caches,URL,fetch:async()=>response,Set,Promise});
  const request=(path,mode='no-cors',method='GET')=>{const event={request:{url:new URL(path,scope).href,mode,method},respondWith(promise){this.promise=promise}};listeners.fetch(event);return event};
  assert.equal(request('private/customer.pdf').promise,undefined);
  assert.equal(request('src/app.js','no-cors','POST').promise,undefined);
  assert.equal(request('unknown','navigate').promise,undefined);
  response=new Response('Fehler',{status:404,headers:{'content-type':'text/html'}});const missing=request('./','navigate');await missing.promise;
  await new Promise(resolve=>setImmediate(resolve));assert.equal(saved.length,0);
  response=new Response('Falscher Inhalt',{status:200,headers:{'content-type':'text/plain'}});await request('./','navigate').promise;
  await new Promise(resolve=>setImmediate(resolve));assert.equal(saved.length,0);
  response=new Response('App',{status:200,headers:{'content-type':'text/html'}});await request('./','navigate').promise;
  await request('src/app.js').promise;
  await new Promise(resolve=>setImmediate(resolve));assert.equal(saved.length,2);
});

test('Desktop-Konfiguration beschränkt Ressourcen und Testauswahl deckt Materiallisten ab', () => {
  const config=JSON.parse(read('src-tauri/tauri.conf.json'));
  assert.match(config.app.security.csp,/default-src 'self'/);
  assert.match(config.app.security.csp,/object-src 'none'/);
  assert.match(config.app.security.csp,/worker-src 'self' blob:/);
  assert.match(read('scripts/test.mjs'),/tests\/materials\.test\.mjs/);
  assert.match(read('index.html'),/id="stage"[^>]*tabindex="0"[^>]*aria-describedby="canvasHint"/);
  assert.match(read('src/app.js'),/e\.target\.closest\?\.\('button,input,select,textarea,dialog,\[contenteditable\]'\)/);
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
