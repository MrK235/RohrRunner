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
  assert.match(app, /stage\.addEventListener\('lostpointercapture',\(\)=>\{finishNetworkDrag\(true\);dragPan=null\}\)/);
  assert.match(app, /window\.addEventListener\('blur',\(\)=>\{finishNetworkDrag\(true\);dragPan=null\}\)/);
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
