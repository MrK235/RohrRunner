import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
const ensureWorker = app.match(/async function ensureWorker\(\)\{[^\n]*\}/)?.[0];

test('Worker-Start unterstützt file:// per Bundle und HTTP mit Worker-Datei', async () => {
  assert.ok(ensureWorker, 'Worker-Startfunktion fehlt');
  for (const protocol of ['file:', 'http:']) {
    let workerCount = 0, scriptCount = 0;
    const context = {
      Blob, Map, Promise, Error, URL: class extends URL {
        static createObjectURL() { return 'blob:worker-test'; }
        static revokeObjectURL() {}
      },
      location: { protocol }, appScriptUrl: protocol === 'file:' ? 'file:///app/src/app.js' : 'http://127.0.0.1:4173/src/app.js',
      worker: null, workerUnavailable: false, workerSourceLoading: null, workerStarting: null, workerUrl: null,
      pending: new Map(), window: null,
      document: { createElement: () => ({ remove() {} }), head: { append(script) {
        scriptCount++;
        context.RohrRunnerWorkerBundle = 'self.onmessage = () => {};';
        queueMicrotask(() => script.onload());
      } } },
      Worker: class { constructor(url) { this.url = url; workerCount++; } terminate() {} postMessage() {} }
    };
    context.window = context;
    const vm=createContext(context);
    const create = runInContext(`let worker=null,workerUnavailable=false,workerSourceLoading=null,workerStarting=null,workerUrl=null,pending=new Map(); const appScriptUrl=${JSON.stringify(context.appScriptUrl)}; const location=${JSON.stringify(context.location)}; const window=globalThis, document=globalThis.document, URL=globalThis.URL, Blob=globalThis.Blob, Worker=globalThis.Worker; ${ensureWorker}; ensureWorker`, vm);
    const workers = await Promise.all(Array.from({ length: 20 }, () => create()));
    assert.equal(workerCount, 1, `${protocol}: Worker wurde mehrfach erzeugt`);
    assert.ok(workers.every(worker => worker === workers[0]));
    assert.equal(String(workers[0].url.href || workers[0].url), protocol === 'file:' ? 'blob:worker-test' : 'http://127.0.0.1:4173/src/worker.js');
    assert.equal(scriptCount, protocol === 'file:' ? 1 : 0);
    let delivered=0;context.workerCallback=(result,error)=>{assert.equal(error,undefined);assert.equal(result.ok,true);delivered++};
    context.calculateOnMainThread=(job,callback)=>callback({ok:job.id===7});
    runInContext('pending.set(7,{payload:{id:7},callback:workerCallback})',vm);
    workers[0].onerror(new Error('synthetischer Worker-Fehler'));
    assert.equal(delivered,1);
    assert.equal(runInContext('pending.size',vm),0);
    assert.equal(runInContext('workerUnavailable',vm),true);
  }
});
