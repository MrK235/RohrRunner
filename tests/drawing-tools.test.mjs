import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
const setToolSource = app.split('\n').find(line => line.includes('function setTool('));
const selectPointSource = app.split('\n').find(line => line.includes('function selectCalibrationPoint('));

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

test('stage accepts drawing clicks beyond the SVG page bounds', () => {
  assert.match(app, /stage\.addEventListener\('click',e=>\{if\(e\.target!==stage\)return;if\(tool==='calibrate'\)selectCalibrationPoint\(e\);else onCanvasClick\(e\)\}\)/);
  assert.match(app, /stage\.addEventListener\('dblclick',e=>\{if\(e\.target===stage\)onPipeDoubleClick\(e\)\}\)/);
});

test('pointer capture loss and window blur clear unfinished drags', () => {
  assert.match(app, /stage\.addEventListener\('lostpointercapture',\(\)=>\{finishNetworkDrag\(true\);dragPan=null\}\)/);
  assert.match(app, /window\.addEventListener\('blur',\(\)=>\{finishNetworkDrag\(true\);dragPan=null\}\)/);
});
