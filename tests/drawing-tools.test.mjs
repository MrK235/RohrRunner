import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
const setToolSource = app.split('\n').find(line => line.includes('function setTool('));
const selectPointSource = app.split('\n').find(line => line.includes('function selectCalibrationPoint('));

test('Aufteilen einer Rohrstrecke verteilt die Steigleitungslänge ohne Verdopplung', () => {
  const split=app.slice(app.indexOf('function splitEdgeAt('),app.indexOf('  function orthogonal(')).trim();
  const project={nodes:[{id:'a',x:0,y:0},{id:'b',x:10,y:0}],edges:[{id:'original',from:'a',to:'b',points:[{x:0,y:0},{x:10,y:0}],pipeRiser:true,pipeRiserLengthM:4,extraLengthM:2,thermal:{suction:{deltaZ:2}}}]};
  let index=0;const context=createContext({project,Editor:{},clone:value=>structuredClone(value),uid:()=>`new-${++index}`,near:()=>false,toast:()=>{}});
  runInContext(split,context);
  context.splitEdgeAt(project.edges[0],{x:2.5,y:0});
  assert.equal(project.edges.length,2);
  assert.deepEqual(project.edges.map(edge=>edge.pipeRiserLengthM),[1,3]);
  assert.equal(project.edges.reduce((sum,edge)=>sum+edge.pipeRiserLengthM,0),4);
  assert.equal(project.edges.reduce((sum,edge)=>sum+edge.extraLengthM,0),2);
  assert.equal(project.edges.reduce((sum,edge)=>sum+edge.thermal.suction.deltaZ,0),2);
});

test('switching away from calibration releases its click interception', () => {
  const buttons = ['calibrate', 'start', 'endpoint', 'pipe'].map(tool => ({ dataset: { tool }, classList: { toggle() {} } }));
  const stage = { dataset: {} }, emptyState = { classList: { add() {} } }, canvasHint = {};
  const context = createContext({
    tool: 'calibrate', calibrationPending: true, calibrationPoints: [{ x: 12, y: 4 }], calibrationHover: { x: 15, y: 6 },
    pipeStart: null, pipePoints: [], pipeAxis: null, pipeHover: null, pipeCornerHistory: [],
    stage, document: { querySelectorAll: () => buttons }, $: id => ({ emptyState, canvasHint })[id], drawNetwork() {}, resetPipe() {},
  });
  runInContext(`${setToolSource}\n${selectPointSource}`, context);
  context.setTool('pipe');
  assert.equal(context.calibrationPending, false);
  assert.equal(context.calibrationPoints.length, 0);
  assert.equal(context.calibrationHover, null);
  assert.equal(stage.dataset.tool, 'pipe');
  let intercepted = false;
  context.selectCalibrationPoint({ preventDefault() { intercepted = true; }, stopPropagation() { intercepted = true; } });
  assert.equal(intercepted, false);
});

test('Tastaturposition setzt Punkte und beendet Leitungen ohne Pointer', () => {
  const source=app.slice(app.indexOf("  stage.addEventListener('focus'"),app.indexOf("  stage.addEventListener('contextmenu'"));
  const listeners={},stage={addEventListener:(name,fn)=>listeners[name]=fn},net={querySelector:()=>null},fields={coordX:{},coordY:{}};
  let point,finished,draws=0;const sandbox=createContext({stage,net,$:id=>fields[id],renderViewport:{width:100,height:80},keyboardPoint:{x:50,y:40},document:{activeElement:stage},drawNetwork:()=>draws++,tool:'endpoint',onCanvasClick:event=>{point=event.planPoint},selectCalibrationPoint:()=>{},finishPipeAt:p=>{finished=p},undoPipeCorner:()=>{},pipeStart:null});
  runInContext(source,sandbox);
  const event=key=>({key,target:stage,shiftKey:false,preventDefault(){},stopPropagation(){}});
  listeners.keydown(event('ArrowRight'));listeners.keydown(event('Enter'));
  assert.equal(point.x,60);assert.equal(point.y,40);assert.ok(draws>0);
  sandbox.tool='pipe';sandbox.pipeStart={id:'start'};listeners.keydown(event('f'));
  assert.equal(finished.x,60);
  assert.match(app,/g\.setAttribute\('tabindex','0'\)/);
  assert.match(app,/hitPath\.setAttribute\('tabindex','0'\)/);
});

test('stage accepts drawing clicks beyond the SVG page bounds', () => {
  assert.match(app, /stage\.addEventListener\('click',e=>\{if\(e\.target!==stage\)return;if\(tool==='calibrate'\)selectCalibrationPoint\(e\);else onCanvasClick\(e\)\}\)/);
  assert.match(app, /stage\.addEventListener\('dblclick',e=>\{if\(e\.target===stage\)onPipeDoubleClick\(e\)\}\)/);
});

test('pointer capture loss and window blur clear unfinished drags', () => {
  assert.match(app, /stage\.addEventListener\('lostpointercapture',\(\)=>\{finishNetworkDrag\(true\);dragPan=null;panMoved=false\}\)/);
  assert.match(app, /window\.addEventListener\('blur',\(\)=>\{finishNetworkDrag\(true\);dragPan=null;panMoved=false\}\)/);
});

test('Nach dem Verschieben der Ansicht nehmen Werkzeuge wieder Klicks an', () => {
  // Regression: panMoved blieb gesetzt und jeder spätere Klick wurde verworfen.
  assert.match(app, /const wasPanning=Boolean\(dragPan\)&&panMoved;dragPan=null;panMoved=false;if\(wasPanning\)\{ignoreCanvasClick=true/);
});

test('Pointer blendet Tastaturcursor aus und fokussiert ohne Scrollen oder Neuzeichnen', () => {
  const source=app.slice(app.indexOf('  let keyboardPoint='),app.indexOf('  let keyboardPoint=')+app.slice(app.indexOf('  let keyboardPoint=')).indexOf('\n  function '));
  const listeners={};let removed=0,prevented=0,options;
  const stage={addEventListener:(name,fn)=>listeners[name]=fn,focus:value=>{options=value}};
  const context=createContext({stage,document:{addEventListener(){}},net:{querySelector:()=>({remove:()=>removed++})}});
  runInContext(source,context);
  listeners.pointerdown({button:0,preventDefault:()=>prevented++});
  assert.equal(removed,1);assert.equal(prevented,1);assert.equal(options.preventScroll,true);
  assert.equal(runInContext('keyboardNavigation',context),false);
  assert.match(app,/if\(keyboardNavigation&&document.activeElement===stage\)/);
  assert.match(app,/if\(e.target!==stage\|\|!keyboardNavigation\)return/);
});

test('Kühlstellen setzen verschiebt den Fokus nicht in die Seitenleiste', () => {
  const source=app.split('\n').find(line=>line.includes('function createEndpoint('));
  assert.doesNotMatch(source,/\.focus\(|requestAnimationFrame/);
});

test('Zoom platziert Beschriftungen in jedem Animationsframe neu, vollständiges Neuzeichnen nur am Ende', () => {
  const source=app.split('\n').find(line=>line.includes('function animateZoom('));
  let layouts=0,labels=0,views=0,frames=0;
  const context=createContext({zoomTime:0,zoom:1,zoomTarget:2,pan:{x:0,y:0},panTarget:{x:20,y:10},zoomFrame:1,pdf:null,Math,applyView:()=>views++,drawNetwork:()=>layouts++,updateLabelPositions:()=>labels++,requestAnimationFrame:()=>++frames});
  runInContext(source,context);
  for(let time=16;time<=160;time+=16)context.animateZoom(time);
  assert.equal(layouts,0);assert.equal(labels,10);assert.equal(views,10);assert.equal(frames,10);
  context.zoom=2;context.pan={x:20,y:10};context.animateZoom(176);
  assert.equal(layouts,1);assert.equal(context.zoomFrame,0);
});

const topologyContext=createContext({console});
runInContext(readFileSync(new URL('../src/editor-core.js',import.meta.url),'utf8'),topologyContext);
const topologyEditor=topologyContext.RohrRunnerEditor;
function drawingHarness(network){
  let serial=0;
  const fields={};const messages=[];
  const context=createContext({project:structuredClone(network),Editor:topologyEditor,clone:structuredClone,uid:type=>`${type}-${++serial}`,near:(a,b,t=1)=>topologyEditor.close(a,b,t),toast:m=>messages.push(m),remember(){},renderAll(){},invalidate(){},setTool(){},resetPipe(){},selection:null,pipeStart:null,pipeAxis:null,pipePoints:[],pipeCornerHistory:[],$:id=>fields[id]||=( {} )});
  const names=['edgeAt','splitEdgeAt','newEdge','addConnection','connectPipe','connectPipeToEdge','attachPlacedNode','createEndpoint','createStart','finishPipeAt','routeLength','branchAxis'];
  for(const name of names)runInContext(app.split('\n').find(line=>line.startsWith(`  function ${name}(`)),context);
  context.edgePoints=edge=>edge.points||[context.project.nodes.find(n=>n.id===edge.from),context.project.nodes.find(n=>n.id===edge.to)];
  return {context,messages};
}
const node=(id,x,y,type='junction')=>({id,x,y,type,name:id,coolingKW:type==='endpoint'?2:undefined});
const line=(id,a,b,extra={})=>({id,from:a.id,to:b.id,points:[{x:a.x,y:a.y},{x:b.x,y:b.y}],...extra});
function assertGeometry(network){
  assert.equal(topologyEditor.geometryIssues(network).length,0);
  for(const edge of network.edges){assert.ok(topologyEditor.isOrthogonal(edge.points));assert.ok(network.nodes.some(n=>n.id===edge.from));assert.ok(network.nodes.some(n=>n.id===edge.to));}
  for(const terminal of network.nodes.filter(n=>n.type==='endpoint'))assert.ok(network.edges.filter(e=>e.from===terminal.id||e.to===terminal.id).length<=1);
}

test('Klick neben einer Leitung und Abgriff nahe einem vorhandenen Knoten behalten exakte Anschlüsse',()=>{
  for(const reverse of [false,true])for(const offset of [0,1,5]){
    const a=node('a',0,0,'start'),b=node('b',100,0,'endpoint'),c=node('c',51,50,'endpoint');
    const {context:cxt}=drawingHarness({nodes:[a,b,c],edges:[line('main',...(reverse?[b,a]:[a,b]))]});
    cxt.pipeStart=cxt.project.nodes[2];
    assert.equal(cxt.connectPipeToEdge(cxt.project.edges[0],{x:51,y:offset},[{x:51,y:50},{x:51,y:offset}]),true);
    assertGeometry(cxt.project);assert.equal(cxt.project.edges.length,3);
  }
  const a=node('a',0,0,'start'),b=node('b',51,0),c=node('c',50,50,'endpoint');
  const {context:cxt}=drawingHarness({nodes:[a,b,c],edges:[line('main',a,b)]});cxt.pipeStart=cxt.project.nodes[2];
  assert.equal(cxt.connectPipeToEdge(cxt.project.edges[0],{x:50,y:0},[{x:50,y:50},{x:50,y:0}]),true);assertGeometry(cxt.project);assert.equal(cxt.project.edges.length,2);
});

test('Hauptleitung und Abgriff funktionieren in beiden Reihenfolgen und Zeichenrichtungen',()=>{
  for(const reverseMain of [false,true])for(const reverseBranch of [false,true])for(const branchFirst of [false,true]){
    const a=node('a',0,0,'start'),b=node('b',100,0,'endpoint'),t=node('t',50,0),c=node('c',50,50,'endpoint');
    const {context:cxt}=drawingHarness({nodes:[a,b,t,c],edges:[]});
    const pairs=[reverseMain?[t,a]:[a,t],reverseMain?[b,t]:[t,b],reverseBranch?[c,t]:[t,c]];if(branchFirst)pairs.reverse();
    for(const [from,to] of pairs)assert.equal(cxt.addConnection(from.id,to.id,[from,to]),true);
    assertGeometry(cxt.project);assert.equal(cxt.project.edges.length,3);
    assert.equal(cxt.project.edges.filter(e=>e.from==='t'||e.to==='t').length,3);
  }
});

test('Start und Kühlstellen können vor oder nach den Rohrstrecken gesetzt werden',()=>{
  for(const terminalsFirst of [false,true]){
    const a=node('a',0,0),b=node('b',100,0);const {context:cxt}=drawingHarness({nodes:[a,b],edges:[]});
    if(terminalsFirst){cxt.createStart(a);cxt.createEndpoint(b);}
    const from=cxt.project.nodes.find(n=>n.x===0),to=cxt.project.nodes.find(n=>n.x===100);
    assert.equal(cxt.addConnection(from.id,to.id,[from,to]),true);
    if(!terminalsFirst){cxt.createEndpoint(b);cxt.createStart(a);}
    assertGeometry(cxt.project);assert.equal(cxt.project.nodes.length,2);assert.equal(cxt.project.edges.length,1);
    assert.equal(cxt.project.nodes.filter(n=>n.type==='start').length,1);assert.equal(cxt.project.nodes.filter(n=>n.type==='endpoint').length,1);
  }
});

test('Kühlstelle auf einer Hauptleitung behält einen eigenen Anschluss ohne erfundene Planlänge',()=>{
  for(const terminalFirst of [true,false]){
    const a=node('a',0,0,'start'),b=node('b',100,0,'endpoint');const {context:cxt}=drawingHarness({nodes:[a,b],edges:[]});
    if(terminalFirst){cxt.createEndpoint({x:50,y:0});const terminal=cxt.project.nodes.at(-1);cxt.addConnection(a.id,terminal.id,[a,terminal]);cxt.addConnection(terminal.id,b.id,[terminal,b]);}else cxt.addConnection(a.id,b.id,[a,b]);
    if(!terminalFirst)cxt.createEndpoint({x:50,y:0});
    assertGeometry(cxt.project);assert.equal(cxt.project.edges.length,3);
    const total=cxt.project.edges.reduce((sum,e)=>sum+e.points.slice(1).reduce((s,p,i)=>s+Math.abs(p.x-e.points[i].x)+Math.abs(p.y-e.points[i].y),0),0);
    assert.equal(total,100);
    const before=JSON.stringify(cxt.project);topologyEditor.connectTopology(cxt.project,()=>{throw Error('Keine neuen IDs bei erneutem Normalisieren erwartet')});assert.equal(JSON.stringify(cxt.project),before);
  }
});

test('Über eine Leitung hinaus zeichnen erzeugt eine Kreuzung ohne Verbindung',()=>{
  const a=node('a',0,0,'start'),b=node('b',100,0,'endpoint'),c=node('c',50,-50),d=node('d',50,50,'endpoint');
  const {context:cxt}=drawingHarness({nodes:[a,b,c,d],edges:[line('main',a,b)]});cxt.pipeStart=cxt.project.nodes[2];cxt.connectPipe(d,[c,d]);
  assertGeometry(cxt.project);assert.equal(cxt.project.edges.length,2);assert.equal(cxt.project.nodes.length,4);assert.ok(cxt.project.edges.some(e=>e.from==='c'&&e.to==='d'));assert.deepEqual(JSON.parse(JSON.stringify(cxt.project.edges.find(e=>e.id==='main'))),line('main',a,b));
});

test('Überlappende Leitungen werden atomar abgelehnt',()=>{
  const a=node('a',0,0,'start'),b=node('b',100,0,'endpoint'),c=node('c',30,0),d=node('d',70,0);
  const {context:cxt,messages}=drawingHarness({nodes:[a,b,c,d],edges:[line('main',a,b)]});
  const before=JSON.stringify(cxt.project);assert.equal(cxt.addConnection(c.id,d.id,[c,d]),false);assert.equal(JSON.stringify(cxt.project),before);assert.match(messages[0],/Überlappende/);
});

test('Anschlussreparatur nutzt bekannte Knoten-IDs und lässt größere Abweichungen stehen',()=>{
  const a=node('a',0,0),b=node('b',51,0),c=node('c',100,50);
  const network={nodes:[a,b,c],edges:[{...line('small',a,b),points:[a,{x:50,y:0}]},{...line('large',b,c),points:[b,{x:51,y:40},{x:100,y:40}]}]};
  assert.deepEqual([...topologyEditor.repairAnchors(network)],['small']);assert.equal(topologyEditor.geometryIssues(network).length,1);assert.equal(topologyEditor.geometryIssues(network)[0].edgeId,'large');assert.ok(topologyEditor.isOrthogonal(network.edges[0].points));
});

test('Aufteilen an mehreren Abgriffen erhält sämtliche extensiven Leitungswerte',()=>{
  const a=node('a',0,0,'start'),b=node('b',100,0,'endpoint'),c=node('c',25,0),d=node('d',75,0);
  const network={nodes:[a,b,c,d],edges:[line('main',a,b,{extraLengthM:8,pipeRiserLengthM:4,riserLengthM:6,zeta:2,thermal:{suction:{deltaZ:-4,mode:'manual',sizeId:'22x1'},liquid:{deltaZ:4}}})]};let id=0;
  topologyEditor.connectTopology(network,()=>`id-${++id}`,{attachments:[{nodeId:c.id,edgeId:'main'},{nodeId:d.id,edgeId:'main'}]});assertGeometry(network);assert.equal(network.edges.length,3);
  for(const key of ['extraLengthM','pipeRiserLengthM','riserLengthM','zeta'])assert.equal(network.edges.reduce((sum,e)=>sum+e[key],0),{extraLengthM:8,pipeRiserLengthM:4,riserLengthM:6,zeta:2}[key]);
  assert.equal(network.edges.reduce((sum,e)=>sum+e.thermal.suction.deltaZ,0),-4);assert.ok(network.edges.every(e=>e.thermal.suction.sizeId==='22x1'));
});

test('Rohrwerkzeug beginnt auf freier Fläche und erlaubt Start/Kühlstelle nach dem Zeichnen',()=>{
  const {context:cxt}=drawingHarness({nodes:[],edges:[]});
  Object.assign(cxt,{tool:'pipe',ignoreCanvasClick:false,svgPoint:e=>e.planPoint,drawNetwork(){},pipeHover:null});
  runInContext(app.split('\n').find(line=>line.startsWith('  function onCanvasClick(')),cxt);
  cxt.onCanvasClick({planPoint:{x:0,y:0}});assert.equal(cxt.project.nodes.length,1);assert.ok(cxt.pipeStart);
  cxt.finishPipeAt({x:100,y:0});assert.equal(cxt.project.edges.length,1);
  cxt.createStart({x:0,y:0});cxt.createEndpoint({x:100,y:0});assertGeometry(cxt.project);
  assert.equal(cxt.project.nodes.length,2);assert.equal(cxt.project.edges.length,1);
});

test('Fehlgeschlagener Abgriff lässt auch die zuvor aufgeteilte Hauptleitung unverändert',()=>{
  const a=node('a',0,0,'start'),b=node('b',100,0,'endpoint');const {context:cxt}=drawingHarness({nodes:[a,b],edges:[line('main',a,b)]});
  cxt.pipeStart=cxt.project.nodes[0];const before=JSON.stringify(cxt.project);
  assert.equal(cxt.connectPipeToEdge(cxt.project.edges[0],{x:50,y:0},[a,{x:50,y:0}]),false);
  assert.equal(JSON.stringify(cxt.project),before);
});

test('Weitere Zeichenaktionen kaschieren keine große Anschlussabweichung im Altbestand',()=>{
  const a=node('a',0,0,'start'),b=node('b',100,0,'endpoint'),c=node('c',0,50,'endpoint');
  const invalid={...line('main',a,b),points:[{x:10,y:0},b]};const {context:cxt}=drawingHarness({nodes:[a,b,c],edges:[invalid]});
  const before=JSON.stringify(cxt.project);assert.equal(cxt.addConnection(a.id,c.id,[a,c]),false);assert.equal(JSON.stringify(cxt.project),before);
});

test('Überkreuzungen bleiben in beiden Zeichenreihenfolgen und nach weiteren Änderungen unverbunden',()=>{
  for(const reverse of [false,true])for(const verticalFirst of [false,true]){
    const a=node('a',0,0,'start'),b=node('b',100,0,'endpoint'),c=node('c',50,-50),d=node('d',50,50,'endpoint');
    const {context:cxt}=drawingHarness({nodes:[a,b,c,d],edges:[]});
    const pairs=verticalFirst?[[c,d],[a,b]]:[[a,b],[c,d]];
    for(const pair of pairs){if(reverse)pair.reverse();assert.equal(cxt.addConnection(pair[0].id,pair[1].id,pair),true);}
    assert.equal(cxt.project.nodes.length,4);assert.equal(cxt.project.edges.length,2);assertGeometry(cxt.project);
    cxt.createEndpoint({x:200,y:200});assert.equal(cxt.project.edges.length,2);assert.equal(cxt.project.nodes.length,5);
  }
});

test('Über einen vorhandenen T-Knoten zeichnen schließt die neue Leitung nicht an',()=>{
  const a=node('a',0,0,'start'),t=node('t',50,0),b=node('b',100,0,'endpoint'),c=node('c',50,-50),d=node('d',50,50,'endpoint');
  const {context:cxt}=drawingHarness({nodes:[a,t,b,c,d],edges:[line('left',a,t),line('right',t,b)]});
  assert.equal(cxt.addConnection(c.id,d.id,[c,d]),true);assertGeometry(cxt.project);
  assert.equal(cxt.project.edges.filter(e=>e.from==='t'||e.to==='t').length,2);
  assert.ok(cxt.project.edges.some(e=>e.from==='c'&&e.to==='d'));
});

test('Expliziter Klick an einer Kreuzung teilt nur die ausgewählte Leitung',()=>{
  const a=node('a',0,0,'start'),b=node('b',100,0,'endpoint'),c=node('c',50,-50),d=node('d',50,50,'endpoint'),t=node('t',50,0);
  const {context:cxt}=drawingHarness({nodes:[a,b,c,d,t],edges:[line('horizontal',a,b),line('up',c,t),line('down',t,d)]});
  const clicked=cxt.splitEdgeAt(cxt.project.edges[0],{x:50,y:0});
  assert.notEqual(clicked.id,'t');assert.equal(cxt.project.edges.length,4);
  assert.equal(cxt.project.edges.filter(e=>e.from===clicked.id||e.to===clicked.id).length,2);
  assert.equal(cxt.project.edges.filter(e=>e.from==='t'||e.to==='t').length,2);
  cxt.createEndpoint({x:200,y:200});
  assert.equal(cxt.project.edges.filter(e=>e.from===clicked.id||e.to===clicked.id).length,2);assertGeometry(cxt.project);
});
