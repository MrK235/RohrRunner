/* Lokaler Stoffdaten-Zugang für die spätere Rohrberechnung. Alle Werte in SI. */
(function (global) {
  'use strict';
  const names = Object.freeze({ R513A: 'R513A.mix', R448A: 'R448A.mix', R744: 'R744' });
  // Chen et al., CIESC Journal 72 (2021), Tabelle 3: gemessene gesättigte R513A-Flüssigkeit,
  // https://hgxb.cip.com.cn/CN/10.11949/0438-1157.20210819 (T in K, μ in μPa·s).
  const r513aLiquidMu = Object.freeze([[253.15,287.59],[258.20,268.76],[263.09,252.23],[268.16,237.94],[273.19,224.13],[278.16,211.22],[283.13,198.83],[288.21,186.76],[293.18,175.40],[298.15,165.09],[303.13,154.84],[308.18,145.72],[313.17,136.84],[318.14,128.38],[323.12,119.87],[328.19,111.72],[333.16,103.81]]);
  // Honeywell Solstice N40 TDS: 138,1 µPa·s Flüssigkeit bei 25 °C.
  // Nur der relative Temperatur- und Druckverlauf stammt aus CoolProp.
  const r448aLiquidMuAt25C = 138.1e-6;
  const r448aLiquidTemperatureRangeK = [273.15, 323.15];
  const scriptBase = typeof document === 'undefined' ? null : new URL('.', document.currentScript?.src || document.baseURI);
  const cacheLimit = 4096;
  const stateCache = new Map();
  const scalarStateCache = new Map();
  const hydraulicStateCache = new Map();
  const saturationTemperatureCache = new Map();
  const saturationPressureCache = new Map();
  const saturationStateCache = new Map();
  const saturatedViscosityCache = new Map();
  const lowLevelStates = new Map();
  let loading;
  let module;

  function cacheGet(cache, key) {
    if (!cache.has(key)) return undefined;
    const value = cache.get(key);
    cache.delete(key);
    cache.set(key, value);
    return value;
  }
  function cacheSet(cache, key, value) {
    cache.delete(key);
    cache.set(key, value);
    if (cache.size > cacheLimit) cache.delete(cache.keys().next().value);
    return value;
  }
  const numberKey = value => Number(value).toPrecision(14);

  function requireFluid(fluid) {
    const name = names[String(fluid).toUpperCase()];
    if (!name) throw new Error('Kältemittel nicht unterstützt: ' + fluid);
    return name;
  }
  function positive(value, label) {
    if (!Number.isFinite(value) || value <= 0) throw new Error(label + ' muss positiv und endlich sein.');
  }
  function finite(value, label) {
    if (!Number.isFinite(value)) throw new Error(label + ' muss endlich sein.');
  }
  function lookup(output, key1, value1, key2, value2, fluid) {
    const fluidName = requireFluid(fluid);
    let result;
    // The hydraulic phase check already computed the exact saturation curve at T.
    // Reuse that evidence: mixture PT flashes otherwise repeat a costly phase search.
    // This WASM binding has no AbstractState.specify_phase, so use PropsSI's phase key.
    const pair = key1 + key2;
    const pressure = pair === 'PT' ? value1 : pair === 'TP' ? value2 : null;
    const temperature = pair === 'PT' ? value2 : pair === 'TP' ? value1 : null;
    if (fluidName !== 'R744' && pressure > 0 && ['D', 'H', 'S', 'V'].includes(output)) {
      const saturation = saturationStateCache.get(`${String(fluid).toUpperCase()}|${numberKey(temperature)}`);
      const phase = saturation && pressure < saturation.dewPressurePa * (1 - 1e-8) ? 'gas'
        : saturation && temperature <= 323.15 && pressure <= 3e6 && pressure > saturation.bubblePressurePa * (1 + 1e-8) ? 'liquid' : null;
      if (phase) {
        try {
          result = module.PropsSI(output, 'P|' + phase, pressure, 'T', temperature, fluidName);
          if (Number.isFinite(result) && result < 1e99) return result;
        } catch { /* Fall back to automatic phase determination. */ }
      }
    }
    try {
      let inputs = pair === 'PT' ? ['PT_INPUTS', value1, value2]
        : pair === 'TP' ? ['PT_INPUTS', value2, value1]
        : pair === 'TQ' ? ['QT_INPUTS', value2, value1]
        : pair === 'QT' ? ['QT_INPUTS', value1, value2] : null;
      if (fluidName === 'R744' && (pair === 'TQ' && value1 >= 304.1282 || pair === 'QT' && value2 >= 304.1282)) inputs = null;
      const getter = { D: 'rhomass', H: 'hmass', S: 'smass', V: 'viscosity', P: 'p', T: 'T' }[output];
      if (!inputs || !getter || !module.factory || !module.input_pairs) throw new Error('Low-Level-Zugriff nicht verfügbar.');
      let entry = lowLevelStates.get(fluidName);
      if (!entry) {
        entry = { state: module.factory('HEOS', fluidName), last: null };
        lowLevelStates.set(fluidName, entry);
      }
      const [inputPair, first, second] = inputs;
      if (!entry.last || entry.last[0] !== inputPair || entry.last[1] !== first || entry.last[2] !== second) {
        entry.last = null;
        entry.state.update(module.input_pairs[inputPair], first, second);
        entry.last = inputs;
      }
      result = entry.state[getter]();
    } catch {
      result = module.PropsSI(output, key1, value1, key2, value2, fluidName);
    }
    if (!Number.isFinite(result) || result >= 1e99) {
      throw new Error('Kein gültiger Stoffwert für ' + fluid + ' (' + output + ').');
    }
    return result;
  }
  function wasmBytes() {
    const encoded = global.CoolPropWasmBase64;
    if (!encoded) throw new Error('Lokale CoolProp-Daten fehlen.');
    const bytes = new Uint8Array(encoded.length * 3 / 4);
    let offset = 0;
    for (let i = 0; i < encoded.length; i += 32768) {
      const block = atob(encoded.slice(i, i + 32768));
      for (let j = 0; j < block.length; j++) bytes[offset++] = block.charCodeAt(j);
    }
    global.CoolPropWasmBase64 = null;
    return bytes.subarray(0, offset);
  }
  function insertLocalScript() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('../vendor/coolprop/coolprop-local.js', scriptBase).href;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Lokales CoolProp-Paket konnte nicht geladen werden.'));
      document.head.append(script);
    });
  }
  async function load() {
    if (module) return api;
    if (!loading) loading = (async () => {
      if (!global.CoolPropFactory) await insertLocalScript();
      module = await global.CoolPropFactory({ wasmBinary: wasmBytes() });
      if (!module || typeof module.PropsSI !== 'function') throw new Error('CoolProp konnte nicht initialisiert werden.');
      return api;
    })().catch(error => { loading = null; throw error; });
    return loading;
  }
  function pt(fluid, pressurePa, temperatureK) {
    if (!module) throw new Error('Stoffdaten zuerst mit load() initialisieren.');
    positive(pressurePa, 'Druck'); positive(temperatureK, 'Temperatur');
    const code = String(fluid).toUpperCase();
    const key = `${code}|${numberKey(pressurePa)}|${numberKey(temperatureK)}`;
    const cached = cacheGet(stateCache, key);
    if (cached) return cached;
    const inputs = ['P', pressurePa, 'T', temperatureK];
    return cacheSet(stateCache, key, Object.freeze({
      fluid: code, pressurePa, temperatureK,
      densityKgM3: lookup('D', ...inputs, fluid),
      enthalpyJKg: lookup('H', ...inputs, fluid),
      entropyJKgK: lookup('S', ...inputs, fluid),
      viscosityPaS: lookup('V', ...inputs, fluid)
    }));
  }
  function measuredR513aLiquidViscosity(temperatureK) {
    if (temperatureK < r513aLiquidMu[0][0] || temperatureK > r513aLiquidMu.at(-1)[0]) {
      throw new Error('R513A-Flüssigkeitsviskosität außerhalb der Messreihe (253,15–333,16 K).');
    }
    for (let i = 1; i < r513aLiquidMu.length; i++) {
      const [highT, highMu] = r513aLiquidMu[i];
      if (temperatureK <= highT) {
        const [lowT, lowMu] = r513aLiquidMu[i - 1];
        return (lowMu + (highMu - lowMu) * (temperatureK - lowT) / (highT - lowT)) * 1e-6;
      }
    }
    return r513aLiquidMu.at(-1)[1] * 1e-6;
  }
  function withDesignViscosity(code, pressurePa, temperatureK, raw) {
    if (code === 'R448A') {
      const sat = saturationAtTemperature(code, temperatureK);
      if (pressurePa < sat.bubblePressurePa) {
        if (pressurePa >= sat.dewPressurePa) throw new Error('R448A-Zweiphasenzustand: keine Einphasen-Reibungsrechnung.');
        return Object.freeze({ ...raw, viscositySource: 'CoolProp 8.0.0; R448A-Dampf modellbasiert', viscosityBasis: 'model' });
      }
      if (temperatureK < r448aLiquidTemperatureRangeK[0] || temperatureK > r448aLiquidTemperatureRangeK[1]) {
        throw new Error('R448A-Flüssigkeitsviskosität außerhalb des begrenzten Modellbereichs (0–50 °C).');
      }
      if (pressurePa > 1.5 * sat.bubblePressurePa) {
        throw new Error('R448A-Flüssigkeitsdruck außerhalb der begrenzten Korrektur (max. 1,5 × Blasendruck).');
      }
      const referenceKey = `${code}|298.15`;
      let rawAt25C = cacheGet(saturatedViscosityCache, referenceKey);
      if (rawAt25C === undefined) rawAt25C = cacheSet(saturatedViscosityCache, referenceKey, lookup('V', 'T', 298.15, 'Q', 0, code));
      return Object.freeze({ ...raw, viscosityPaS: r448aLiquidMuAt25C * raw.viscosityPaS / rawAt25C,
        viscositySource: 'Honeywell Solstice N40: 138,1 µPa·s bei 25 °C; relativer T-/p-Verlauf CoolProp 8.0.0',
        viscosityBasis: 'manufacturer-anchor-plus-model-shape', viscosityModelFactor: raw.viscosityPaS / rawAt25C });
    }
    if (code !== 'R513A') return Object.freeze({ ...raw, viscositySource: 'CoolProp 8.0.0; R744 gegen NIST-Stützpunkte geprüft', viscosityBasis: 'model' });
    const sat = saturationAtTemperature(code, temperatureK);
    if (pressurePa < sat.bubblePressurePa && pressurePa > sat.dewPressurePa) {
      throw new Error('R513A-Zweiphasenzustand: keine Einphasen-Reibungsrechnung.');
    }
    if (pressurePa < sat.bubblePressurePa) {
      return Object.freeze({ ...raw, viscositySource: 'CoolProp 8.0.0; R513A-Dampf nur punktuell verglichen', viscosityBasis: 'model' });
    }
    if (pressurePa > 1.5 * sat.bubblePressurePa) {
      throw new Error('R513A-Flüssigkeitsdruck außerhalb der begrenzten Korrektur (max. 1,5 × Blasendruck).');
    }
    const measuredAtSaturation = measuredR513aLiquidViscosity(temperatureK);
    const saturatedMuKey = `${code}|${numberKey(temperatureK)}`;
    let rawAtSaturation = cacheGet(saturatedViscosityCache, saturatedMuKey);
    if (rawAtSaturation === undefined) rawAtSaturation = cacheSet(saturatedViscosityCache, saturatedMuKey, lookup('V', 'T', temperatureK, 'Q', 0, code));
    const pressureFactor = raw.viscosityPaS / rawAtSaturation;
    return Object.freeze({ ...raw, viscosityPaS: measuredAtSaturation * pressureFactor,
      viscositySource: 'Chen et al. 2021, Tabelle 3 (linear T); CoolProp 8.0.0 nur für relativen Druckeinfluss',
      viscosityBasis: 'measured-saturation-plus-model-pressure', viscosityPressureFactor: pressureFactor });
  }
  function designPt(fluid, pressurePa, temperatureK) {
    const code = String(fluid).toUpperCase();
    return withDesignViscosity(code, pressurePa, temperatureK, pt(code, pressurePa, temperatureK));
  }
  function hydraulicPt(fluid, pressurePa, temperatureK) {
    if (!module) throw new Error('Stoffdaten zuerst mit load() initialisieren.');
    positive(pressurePa, 'Druck'); positive(temperatureK, 'Temperatur');
    const code = String(fluid).toUpperCase();
    const key = `${code}|${numberKey(pressurePa)}|${numberKey(temperatureK)}`;
    const cached = cacheGet(hydraulicStateCache, key);
    if (cached) return cached;
    // withDesignViscosity needs these same limits. Resolve them first so the PT
    // lookup can reuse the verified phase, including during table construction.
    if (code === 'R448A' || code === 'R513A') saturationAtTemperature(code, temperatureK);
    const raw = {
      fluid: code, pressurePa, temperatureK,
      densityKgM3: lookup('D', 'P', pressurePa, 'T', temperatureK, code),
      viscosityPaS: lookup('V', 'P', pressurePa, 'T', temperatureK, code)
    };
    return cacheSet(hydraulicStateCache, key, withDesignViscosity(code, pressurePa, temperatureK, raw));
  }
  function saturationTemperature(fluid, pressurePa, quality, guessK) {
    const key = `${String(fluid).toUpperCase()}|${numberKey(pressurePa)}|${quality}`;
    const cached = cacheGet(saturationTemperatureCache, key);
    if (cached !== undefined) return cached;
    try { return cacheSet(saturationTemperatureCache, key, lookup('T', 'P', pressurePa, 'Q', quality, fluid)); }
    catch (directError) {
      // Manche CoolProp-Gemischzustände unterstützen T(P,Q) nicht, obwohl P(T,Q) gültig ist.
      let bracket = null;
      if (Number.isFinite(guessK)) {
        // Dew and bubble temperatures of these blends are close. Expand around the
        // known bubble point geometrically instead of scanning a 24 K interval.
        for (let distance = 0.25; distance <= 16 && !bracket; distance *= 2) {
          try {
            const lowT = guessK - distance, highT = guessK + distance;
            const lowP = lookup('P', 'T', lowT, 'Q', quality, fluid);
            const highP = lookup('P', 'T', highT, 'Q', quality, fluid);
            if (lowP <= pressurePa && highP >= pressurePa) bracket = { lowT, highT };
          } catch { /* widen the bracket on the next iteration */ }
        }
      } else {
        let previous;
        for (let t = 180; t <= 450 && !bracket; t += 2) {
          let p;
          try { p = lookup('P', 'T', t, 'Q', quality, fluid); }
          catch { previous = null; continue; }
          if (previous && previous.p <= pressurePa && p >= pressurePa) bracket = { lowT: previous.t, highT: t };
          previous = { t, p };
        }
      }
      if (!bracket) throw directError;
      let { lowT, highT } = bracket;
      for (let i = 0; i < 28; i++) {
        const mid = (lowT + highT) / 2;
        const candidate = lookup('P', 'T', mid, 'Q', quality, fluid);
        if (candidate < pressurePa) lowT = mid;
        else highT = mid;
      }
      return cacheSet(saturationTemperatureCache, key, (lowT + highT) / 2);
    }
  }
  function saturationAtPressure(fluid, pressurePa) {
    if (!module) throw new Error('Stoffdaten zuerst mit load() initialisieren.');
    positive(pressurePa, 'Druck');
    const key = `${String(fluid).toUpperCase()}|${numberKey(pressurePa)}`;
    const cached = cacheGet(saturationPressureCache, key);
    if (cached) return cached;
    const bubbleK = saturationTemperature(fluid, pressurePa, 0);
    return cacheSet(saturationPressureCache, key, Object.freeze({
      fluid: String(fluid).toUpperCase(), pressurePa,
      bubbleK,
      dewK: saturationTemperature(fluid, pressurePa, 1, bubbleK)
    }));
  }
  function saturationAtTemperature(fluid, temperatureK) {
    if (!module) throw new Error('Stoffdaten zuerst mit load() initialisieren.');
    positive(temperatureK, 'Temperatur');
    const key = `${String(fluid).toUpperCase()}|${numberKey(temperatureK)}`;
    const cached = cacheGet(saturationStateCache, key);
    if (cached) return cached;
    return cacheSet(saturationStateCache, key, Object.freeze({
      fluid: String(fluid).toUpperCase(), temperatureK,
      bubblePressurePa: lookup('P', 'T', temperatureK, 'Q', 0, fluid),
      dewPressurePa: lookup('P', 'T', temperatureK, 'Q', 1, fluid)
    }));
  }
  function state(fluid, output, key1, value1, key2, value2) {
    if (!module) throw new Error('Stoffdaten zuerst mit load() initialisieren.');
    finite(value1, key1); finite(value2, key2);
    // Exact numeric inputs: no rounding or approximation for scalar cache hits.
    const key = JSON.stringify([String(fluid).toUpperCase(), output, key1, value1, key2, value2]);
    const cached = cacheGet(scalarStateCache, key);
    if (cached !== undefined) return cached;
    return cacheSet(scalarStateCache, key, lookup(output, key1, value1, key2, value2, fluid));
  }
  const api = Object.freeze({ version: 'CoolProp 8.0.0', fluids: Object.keys(names), load, pt, designPt, hydraulicPt, measuredR513aLiquidViscosity, saturationAtPressure, saturationAtTemperature, state });
  global.RohrStoffdaten = api;
})(window);
