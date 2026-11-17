(() => {
  'use strict';
  const encoder = new TextEncoder();
  const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
    let crc = value;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    return crc >>> 0;
  });
  const crc32 = bytes => {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  };
  function create(files) {
    if (files.length > 0xffff) throw new Error('Zu viele Dateien für ein ZIP-Archiv.');
    const localParts = [], directoryParts = [];
    let offset = 0;
    for (const file of files) {
      const name = encoder.encode(file.name), data = typeof file.data === 'string' ? encoder.encode(file.data) : new Uint8Array(file.data);
      if (!name.length) throw new Error('ZIP-Dateiname darf nicht leer sein.');
      if (name.length > 0xffff || data.length > 0xffffffff || offset > 0xffffffff) throw new Error('Datei ist für ein ZIP-Archiv zu groß.');
      const crc = crc32(data), local = new Uint8Array(30 + name.length), localView = new DataView(local.buffer);
      localView.setUint32(0, 0x04034b50, true); localView.setUint16(4, 20, true); localView.setUint16(6, 0x0800, true);
      localView.setUint16(8, 0, true); localView.setUint16(12, 0, true); localView.setUint16(10, 0x21, true); localView.setUint32(14, crc, true); localView.setUint32(18, data.length, true);
      localView.setUint32(22, data.length, true); localView.setUint16(26, name.length, true); local.set(name, 30);
      localParts.push(local, data);
      const entry = new Uint8Array(46 + name.length), view = new DataView(entry.buffer);
      view.setUint32(0, 0x02014b50, true); view.setUint16(4, 20, true); view.setUint16(6, 20, true);
      view.setUint16(8, 0x0800, true); view.setUint16(10, 0, true); view.setUint16(12, 0, true); view.setUint16(14, 0x21, true); view.setUint32(16, crc, true);
      view.setUint32(20, data.length, true); view.setUint32(24, data.length, true); view.setUint16(28, name.length, true);
      view.setUint32(42, offset, true); entry.set(name, 46); directoryParts.push(entry);
      offset += local.length + data.length;
    }
    const directorySize = directoryParts.reduce((sum, part) => sum + part.length, 0);
    if (offset + directorySize > 0xffffffff) throw new Error('ZIP-Archiv ist zu groß.');
    const end = new Uint8Array(22), endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054b50, true); endView.setUint16(8, files.length, true); endView.setUint16(10, files.length, true);
    endView.setUint32(12, directorySize, true); endView.setUint32(16, offset, true);
    const parts = [...localParts, ...directoryParts, end], archive = new Uint8Array(offset + directorySize + end.length);
    let cursor = 0;
    for (const part of parts) { archive.set(part, cursor); cursor += part.length; }
    return archive;
  }
  window.RohrRunnerZip = { create };
})();
