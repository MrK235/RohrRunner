#!/usr/bin/env node
// Separater Offline-Benchmark; keine Test-Suite und keine fachliche Referenzprüfung.
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { performance } from 'node:perf_hooks';
import { webcrypto } from 'node:crypto';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
function optionsFrom(args) {
  const options = { repetitions: 1, spots: [1, 3, 5], method: 'both', json: false };
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const [flag, inline] = args[i].split('=', 2);
    if (seen.has(flag)) throw new Error(`Option doppelt: ${flag}`);
    seen.add(flag);
    if (flag === '--json' && inline === undefined) { options.json = true; continue; }
    if (flag === '--method') {
      const value = inline ?? args[++i];
      if (!['both', 'direct', 'fast'].includes(value)) throw new Error(`Unbekannte Methode: ${value}`);
      options.method = value;
      continue;
    }
    if (flag === '--fluid') {
      const value = inline ?? args[++i];
      if (!['R513A', 'R448A', 'R744', 'R134A', 'R404A', 'R407C', 'R449A', 'R452A'].includes(value)) throw new Error(`Unbekanntes Kältemittel: ${value}`);
      options.fluid = value;
      continue;
    }
    if (flag === '--repetitions' || flag === '-r' || flag === '--spots') {
      const value = inline ?? args[++i];
      if (!/^[1-9]\d*$/.test(value || '') || !Number.isSafeInteger(Number(value))) throw new Error(`Ungültige Zahl für ${flag}: ${value}`);
      if (flag === '--spots') {
        if (![1, 3, 5].includes(Number(value))) throw new Error('--spots erlaubt nur 1, 3 oder 5.');
        options.spots = [Number(value)];
      } else options.repetitions = Number(value);
      continue;
    }
    throw new Error('Aufruf: node scripts/benchmark-refrigerants.mjs [--repetitions N] [--spots 1|3|5] [--fluid R513A|...] [--method both|direct|fast] [--json]');
  }
  return options;
}

function network(count) {
  const nodes = [{ id: 'plant', type: 'start', name: 'Start', x: 0, y: 0 }];
  const edges = [];
  let previous = nodes[0];
  for (let i = 0; i < count; i++) {
    const x = 4 * (i + 1);
    const last = i === count - 1;
    const node = last ? { id: `cold-${i}`, type: 'endpoint', name: `Kühlstelle ${i + 1}`, coolingKW: 2 + i, x, y: 0 }
      : { id: `junction-${i}`, type: 'junction', name: `T${i + 1}`, x, y: 0 };
    nodes.push(node);
    edges.push({ id: `trunk-${i}`, from: previous.id, to: node.id,
      points: [{ x: previous.x, y: 0 }, { x, y: 0 }] });
    if (!last) {
      const y = i % 2 ? -5 : 5;
      const endpoint = { id: `cold-${i}`, type: 'endpoint', name: `Kühlstelle ${i + 1}`, coolingKW: 2 + i, x, y };
      nodes.push(endpoint);
      edges.push({ id: `branch-${i}`, from: node.id, to: endpoint.id,
        points: [{ x, y: 0 }, { x, y }] });
    }
    previous = node;
  }
  return { nodes, edges };
}

const rowFields = ['diameterMm', 'lengthM', 'flowKgS', 'velocityMS', 'pressureDropPa', 'temperatureDropK'];
const endpointFields = ['evaporationC', 'suctionK', 'liquidK', 'remainingSubcoolingK', 'suctionPressureBar', 'liquidPressureBar'];
function compare(direct, fast) {
  const difference = { abs: 0, rel: 0, absField: '-', relField: '-', mismatches: 0 };
  function check(label, a, b) {
    if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error(`Nicht endlicher Ergebniswert: ${label}`);
    const abs = Math.abs(a - b), rel = abs / Math.max(Math.abs(a), Math.abs(b), 1e-12);
    if (abs > difference.abs) { difference.abs = abs; difference.absField = label; }
    if (rel > difference.rel) { difference.rel = rel; difference.relField = label; }
  }
  function entries(items, id) { return new Map(items.map(item => [id(item), item])); }
  for (const [kind, ids, fields] of [
    ['Rohr', item => `${item.edgeId}:${item.type}`, rowFields],
    ['Kühlstelle', item => item.id, endpointFields]
  ]) {
    const left = entries(kind === 'Rohr' ? direct.rows : direct.endpoints, ids);
    const right = entries(kind === 'Rohr' ? fast.rows : fast.endpoints, ids);
    if (left.size !== right.size || [...left.keys()].some(key => !right.has(key))) throw new Error(`${kind}: unterschiedliche Ergebnis-IDs`);
    for (const [key, a] of left) {
      const b = right.get(key);
      if (kind === 'Rohr' && a.sizeId !== b.sizeId) difference.mismatches++;
      for (const field of fields) check(`${kind} ${key}.${field}`, a[field], b[field]);
    }
  }
  const issueKey = issue => [issue.type, issue.severity, issue.edgeId, issue.targetId, ...(issue.targetIds || [])].join(':');
  if (direct.valid !== fast.valid ||
      direct.issues.map(issueKey).sort().join('|') !== fast.issues.map(issueKey).sort().join('|')) difference.mismatches++;
  return difference;
}

async function main() {
  const options = optionsFrom(process.argv.slice(2));
  const { repetitions, spots, method, json } = options;
  const context = { console, WebAssembly, Uint8Array, ArrayBuffer, URL, TextDecoder, TextEncoder, atob,
    crypto: webcrypto, setTimeout, clearTimeout, location: { href: new URL('index.html', root).href } };
  context.window = context;
  context.document = { currentScript: { src: new URL('src/stoffdaten.js', root).href }, baseURI: new URL('index.html', root).href };
  const vm = createContext(context);
  const start = performance.now();
  for (const path of ['vendor/coolprop/coolprop-local.js', 'src/stoffdaten.js', 'src/fast-data.js', 'src/engine.js'])
    runInContext(read(path), vm, { filename: path });
  const catalog = JSON.parse(read('data/pipe-catalog.json'));
  await context.RohrStoffdaten.load();
  const initMs = performance.now() - start;
  const data = context.RohrStoffdaten, fastPath = context.RohrnetzFastData;
  const fluids = options.fluid ? [options.fluid] : ['R513A', 'R448A', 'R744', 'R134A', 'R404A', 'R407C', 'R449A', 'R452A'];
  const nets = spots.map(count => [count, network(count)]);
  const output = { repetitions, method, initializationMs: initMs, comparedFields: { rows: rowFields, endpoints: endpointFields }, results: [] };
  if (!json) {
    console.log(`Initialisierung (Module + CoolProp): ${initMs.toFixed(1)} ms | Wiederholungen: ${repetitions}`);
    console.log('Stoff   K  Fast-Erzeugung ms  Direkt ms/Lauf  Fast ms/Lauf  max |Δ| (Feld)  max rel Δ (Feld)  Größe/Status Δ');
    console.log('Vergleich: Rohr diameterMm,lengthM,flowKgS,velocityMS,pressureDropPa,temperatureDropK; Kühlstelle evaporationC,suctionK,liquidK,remainingSubcoolingK,suctionPressureBar,liquidPressureBar.');
  }
  for (const fluid of fluids) {
    const settings = { fluid, simultaneity: 0.5, evaporationC: -10, condensationC: fluid === 'R744' ? 5 : 45,
      superheatK: 25, subcoolingK: 2, suctionLimitK: 2, liquidLimitK: 1,
      minVelocityMS: 0, maxVelocityMS: 30, designPressureBar: fluid === 'R744' ? 100 : 24,
      roughnessMicroM: 1.5, fittingsFactor: 1.5, viscosityMarginPercent: 15 };
    const began = performance.now();
    const prepared = method === 'direct' ? data : fastPath.create(data, settings);
    const creationMs = performance.now() - began;
    const eligible = method === 'direct' ? fluid !== 'R744' : prepared !== data;
    for (const [count, net] of nets) {
      console.error(`Berechne ${fluid}, ${count} Kühlstelle(n) ...`);
      let directMs = 0, fastMs = 0, delta = null;
      for (let i = 0; i < repetitions; i++) {
        // Der Solver aktiviert Fast-Data intern: für den direkten Pfad gezielt ausschalten.
        let direct, fast, t;
        if (method !== 'fast' || !eligible) {
          context.RohrnetzFastData = null;
          t = performance.now();
          direct = context.RohrRunnerEngine.calculate(net, 1, settings, data, catalog);
          directMs += performance.now() - t;
        }
        if (method !== 'direct' && eligible) {
          context.RohrnetzFastData = fastPath;
          t = performance.now();
          fast = context.RohrRunnerEngine.calculate(net, 1, settings, data, catalog);
          fastMs += performance.now() - t;
        }
        if (direct && fast) delta = compare(direct, fast);
      }
      const item = { fluid, spots: count, fastDataCreationMs: eligible && method !== 'direct' ? creationMs : null,
        directMsPerRun: method === 'fast' && eligible ? null : directMs / repetitions, fastMsPerRun: method === 'direct' || !eligible ? null : fastMs / repetitions,
        maxAbsoluteDifference: delta?.abs ?? null, maxAbsoluteField: delta?.absField ?? null,
        maxRelativeDifference: delta?.rel ?? null, maxRelativeField: delta?.relField ?? null,
        sizeOrStatusMismatches: delta?.mismatches ?? null };
      output.results.push(item);
      if (json) console.error(`Fertig ${fluid}, ${count}: direkt ${item.directMsPerRun?.toFixed(1) ?? '–'} ms, fast ${item.fastMsPerRun?.toFixed(1) ?? '–'} ms`);
      if (!json) console.log(`${fluid.padEnd(6)} ${count}  ${(item.fastDataCreationMs?.toFixed(1) ?? '—').padStart(16)}  ${(item.directMsPerRun?.toFixed(1) ?? '—').padStart(14)}  ${(item.fastMsPerRun?.toFixed(1) ?? '—').padStart(12)}  ${delta ? `${delta.abs.toExponential(2)} (${delta.absField})  ${(delta.rel * 100).toFixed(3)}% (${delta.relField})  ${delta.mismatches}` : '—  —  —'}`);
    }
  }
  if (json) console.log(JSON.stringify(output, null, 2));
  else console.log('Zeiten: erster Lauf ohne Warmlauf; Stoffwert-Caches bleiben zwischen Läufen warm. Δ = Fast minus Direkt (Betrag), kein Referenznachweis.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
