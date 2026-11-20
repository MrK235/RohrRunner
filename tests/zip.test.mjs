import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const context = { window: {}, TextEncoder, Uint8Array, Uint32Array, DataView, Error };
runInNewContext(readFileSync(new URL('../src/zip.js', import.meta.url), 'utf8'), context);
const create = context.window.RohrRunnerZip.create;

function unzipStored(archive) {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  let end = archive.length - 22;
  while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end--;
  assert.ok(end >= 0, 'ZIP-Endverzeichnis vorhanden');
  const count = view.getUint16(end + 10, true), directoryOffset = view.getUint32(end + 16, true), files = new Map();
  let cursor = directoryOffset;
  const decoder = new TextDecoder();
  for (let i = 0; i < count; i++) {
    assert.equal(view.getUint32(cursor, true), 0x02014b50);
    const crc = view.getUint32(cursor + 16, true), size = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true), extraLength = view.getUint16(cursor + 30, true), commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true), name = decoder.decode(archive.subarray(cursor + 46, cursor + 46 + nameLength));
    assert.equal(view.getUint32(localOffset, true), 0x04034b50);
    const localNameLength = view.getUint16(localOffset + 26, true), localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    assert.equal(view.getUint32(localOffset + 14, true), crc);
    files.set(name, archive.slice(dataStart, dataStart + size));
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

test('ZIP-Archiv enthält UTF-8-Dateinamen und exakte Text- und Binärdaten', () => {
  const binary = Uint8Array.from([0, 1, 2, 127, 255]);
  const archive = create([{ name: 'Projekt.rohrrunner', data: '{"version":1}' }, { name: 'Grundriss ä.pdf', data: binary }]);
  const files = unzipStored(archive);
  assert.equal(new TextDecoder().decode(files.get('Projekt.rohrrunner')), '{"version":1}');
  assert.deepEqual([...files.get('Grundriss ä.pdf')], [...binary]);
  const crcFixture = create([{ name: 'crc.txt', data: '123456789' }]), crcView = new DataView(crcFixture.buffer);
  let end = crcFixture.length - 22;
  while (crcView.getUint32(end, true) !== 0x06054b50) end--;
  assert.equal(crcView.getUint32(crcView.getUint32(end + 16, true) + 16, true), 0xcbf43926);
});

test('ZIP-Archiv unterstützt eine leere Dateiliste und begrenzt unzulässige Einträge', () => {
  assert.equal(unzipStored(create([])).size, 0);
  assert.throws(() => create([{ name: '', data: '' }]), /Dateiname darf nicht leer sein/);
});

test('Projektpaket enthält die vollständige Projektdatei und einen PDF-Plan nur bei vorhandenem Grundriss', async () => {
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const exportFunction = app.match(/  async function exportProject\(\)\{[^\n]*\}/)?.[0];
  assert.ok(exportFunction, 'ZIP-Exportfunktion vorhanden');
  for (const withPdf of [false, true]) {
    const savedProject = { version: 1, name: 'Testnetz', nodes: [], edges: [], lastResult: { valid: true }, pdfBase64: withPdf ? 'JVBERi0=' : null };
    let archive;
    const sandbox = {
      project: { name: 'Testnetz' },
      $: id => id === 'projectName' ? { value: 'Testnetz' } : { innerHTML: '' },
      safeName: name => name,
      projectFile: async () => JSON.stringify(savedProject),
      calculationCsv: () => 'Berechnung',
      materialCsv: () => 'Material',
      pdfBytes: withPdf ? new Uint8Array([1]).buffer : null,
      planPdfBytes: async includePdf => Uint8Array.from([includePdf ? 1 : 0]),
      RohrRunnerZip: { create },
      download: async data => { archive = data; return true; },
      toast: message => { throw new Error(message); }
    };
    runInNewContext(`${exportFunction}\nglobalThis.runExport=exportProject`, sandbox);
    await sandbox.runExport();
    const files = unzipStored(archive);
    assert.deepEqual(JSON.parse(new TextDecoder().decode(files.get('Testnetz.rohrrunner'))), savedProject);
    assert.ok(files.has('Testnetz-berechnung.csv'));
    assert.ok(files.has('Testnetz-materialliste.csv'));
    assert.ok(files.has('Testnetz-plan-ohne-pdf.pdf'));
    assert.equal(files.has('Testnetz-plan-mit-pdf.pdf'), withPdf);
  }
});
