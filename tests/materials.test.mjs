import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const context = { console };
context.globalThis = context;
runInContext(readFileSync(new URL('../src/materials.js', import.meta.url), 'utf8'), createContext(context));
const { teePositions } = context.RohrRunnerMaterials;

test('gleiche T-Stücke und nötige Absatznippel werden je Abzweig und Leitungsart gezählt', () => {
  const nodes = [{ id: 't1', type: 'junction' }, { id: 't2', type: 'junction' }];
  const edges = [
    { id: 'a', from: 'start', to: 't1' },
    { id: 'b', from: 't1', to: 't2' },
    { id: 'c', from: 't1', to: 'end1' },
    { id: 'd', from: 't2', to: 'end2' },
    { id: 'e', from: 't2', to: 'end3' }
  ];
  const sizes = {
    a: { suction: 35, liquid: 22 },
    b: { suction: 35, liquid: 22 },
    c: { suction: 22, liquid: 18 },
    d: { suction: 35, liquid: 22 },
    e: { suction: 28, liquid: 18 }
  };
  const rows = Object.entries(sizes).flatMap(([edgeId, byType]) => Object.entries(byType).map(([type, diameterMm]) => ({ edgeId, type, diameterMm })));
  const result = teePositions(nodes, edges, rows, ['suction', 'liquid'], row => row.diameterMm);
  const teeCounts = Object.groupBy(result.tees, item => item.diameterMm);
  assert.equal(teeCounts[35].length, 2);
  assert.equal(teeCounts[22].length, 2);
  assert.deepEqual(Array.from(result.reducers, item => `${item.outerMm}a-${item.innerMm}i`).sort(), ['22a-18i', '22a-18i', '35a-22i', '35a-28i']);
});

test('gleiche Anschlussgrößen erzeugen keine Reduzierung', () => {
  const nodes = [{ id: 't', type: 'junction' }];
  const edges = ['a', 'b', 'c'].map(id => ({ id, from: 't', to: id }));
  const rows = edges.map(edge => ({ edgeId: edge.id, type: 'suction', diameterMm: 35 }));
  const result = teePositions(nodes, edges, rows, ['suction'], row => row.diameterMm);
  assert.equal(result.tees.length, 1);
  assert.equal(result.reducers.length, 0);
});
