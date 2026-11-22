/* Begrenzte Stoffwerttabellen für die Netz-Auslegung; außerhalb der Tabellen gilt CoolProp. */
(function (global) {
  'use strict';
  const cache = new Map();
  const interpolate = (a, b, fraction) => a + (b - a) * fraction;
  const inside = (values, value) => value >= values[0] && value <= values.at(-1);
  function position(values, value) {
    let i = 0;
    while (i < values.length - 2 && value > values[i + 1]) i++;
    return { i, f: (value - values[i]) / (values[i + 1] - values[i]) };
  }
  function linear(values, outputs, value) {
    const { i, f } = position(values, value);
    return interpolate(outputs[i], outputs[i + 1], f);
  }
  function inverse(pressures, temperatures, pressure) {
    const { i } = position(pressures, pressure);
    const first = Math.max(0, Math.min(pressures.length - 4, i - 1));
    let result = 0;
    for (let j = first; j < first + 4; j++) {
      let basis = 1;
      for (let k = first; k < first + 4; k++) if (j !== k)
        basis *= (pressure - pressures[k]) / (pressures[j] - pressures[k]);
      result += temperatures[j] * basis;
    }
    return result;
  }
  function curve(data, fluid, firstK, lastK, steps) {
    const temperatures = Array.from({ length: steps + 1 }, (_, i) => firstK + (lastK - firstK) * i / steps);
    const states = temperatures.map(t => data.saturationAtTemperature(fluid, t));
    return { temperatures,
      dew: states.map(value => value.dewPressurePa),
      bubble: states.map(value => value.bubblePressurePa) };
  }
  function build(data, settings) {
    const fluid = settings.fluid, evaporationK = settings.evaporationC + 273.15;
    const condensationK = settings.condensationC + 273.15;
    const liquidK = condensationK - settings.subcoolingK;
    // Gemische mit Temperaturgleit: Blasen- und Taudruckkurve sind gegeneinander verschoben.
    // Beide Kurven müssen denselben Druckbereich abdecken, sonst fällt jede Abfrage auf CoolProp.
    const glideAt = t => { const s = data.saturationAtTemperature(fluid, t);
      const r = data.saturationAtPressure(fluid, s.dewPressurePa); return Math.max(0, r.dewK - r.bubbleK); };
    const gasGlide = glideAt(evaporationK), liquidGlide = glideAt(condensationK);
    const gasCurve = curve(data, fluid, evaporationK - 6 - Math.ceil(gasGlide), evaporationK + Math.max(18, settings.suctionLimitK * 3 + 6), 8 + Math.ceil(gasGlide / 3));
    const liquidCurve = curve(data, fluid, liquidK - 6, condensationK + 4 + Math.ceil(liquidGlide), 4 + Math.ceil(liquidGlide / 3));
    const startP = data.saturationAtTemperature(fluid, evaporationK).dewPressurePa;
    const upperP = Math.min(gasCurve.dew.at(-1), startP * 1.8);
    const lowerP = Math.max(gasCurve.dew[0], startP * 0.75);
    const gasPressures = Array.from({ length: 9 }, (_, i) => lowerP + (upperP - lowerP) * i / 8);
    const superheats = [Math.max(0.5, settings.superheatK - 3), settings.superheatK,
      settings.superheatK + 5];
    const dewAt = p => inverse(gasCurve.dew, gasCurve.temperatures, p);
    const bubbleAt = p => inverse(liquidCurve.bubble, liquidCurve.temperatures, p);
    const gasValues = gasPressures.map(p => superheats.map(sh => data.hydraulicPt(fluid, p, dewAt(p) + sh)));
    const gasEnthalpyPressures = Array.from({ length: 5 }, (_, i) => gasPressures[0] + (upperP - gasPressures[0]) * i / 4);
    const gasEnthalpies = gasEnthalpyPressures.map(p => data.state(fluid, 'H', 'P', p, 'T', dewAt(p) + settings.superheatK));
    const liquidStartP = data.saturationAtTemperature(fluid, condensationK).bubblePressurePa;
    const liquidMinP = data.saturationAtTemperature(fluid, liquidK).bubblePressurePa * 1.001;
    const liquidEnthalpyPressures = Array.from({ length: 5 }, (_, i) => liquidMinP + (liquidStartP * 1.01 - liquidMinP) * i / 4);
    const liquidEnthalpies = liquidEnthalpyPressures.map(p => data.state(fluid, 'H', 'P', p, 'T', liquidK));
    const liquidHydraulics = liquidEnthalpyPressures.map(p => data.hydraulicPt(fluid, p, liquidK));
    const saturationAtTemperature = (code, t) => {
      if (code === fluid) {
        const selected = inside(gasCurve.temperatures, t) ? gasCurve
          : inside(liquidCurve.temperatures, t) ? liquidCurve : null;
        // Kubisch wie die Umkehrung T(p): lineare P(T)-Interpolation verschiebt sonst
        // den Startdruck, sobald die Verdampfungstemperatur nicht auf einem Stützpunkt liegt.
        if (selected) return { bubblePressurePa: inverse(selected.temperatures, selected.bubble, t),
          dewPressurePa: inverse(selected.temperatures, selected.dew, t) };
      }
      return data.saturationAtTemperature(code, t);
    };
    const saturationAtPressure = (code, p) => {
      if (code !== fluid) return data.saturationAtPressure(code, p);
      if (inside(gasCurve.dew, p) && inside(gasCurve.bubble, p))
        return { dewK: dewAt(p), bubbleK: inverse(gasCurve.bubble, gasCurve.temperatures, p) };
      if (inside(liquidCurve.dew, p) && inside(liquidCurve.bubble, p))
        return { dewK: inverse(liquidCurve.dew, liquidCurve.temperatures, p), bubbleK: bubbleAt(p) };
      return data.saturationAtPressure(code, p);
    };
    const hydraulicPt = (code, p, t) => {
      if (code === fluid && Math.abs(t - liquidK) < 1e-8 && inside(liquidEnthalpyPressures, p)) {
        const field = key => linear(liquidEnthalpyPressures, liquidHydraulics.map(value => value[key]), p);
        return { densityKgM3: field('densityKgM3'), viscosityPaS: field('viscosityPaS'),
          viscositySource: 'CoolProp-Stützpunkttabelle' };
      }
      if (code !== fluid || !inside(gasPressures, p)) return data.hydraulicPt(code, p, t);
      const sh = t - dewAt(p);
      if (!inside(superheats, sh)) return data.hydraulicPt(code, p, t);
      const { i, f } = position(gasPressures, p), { i: j, f: g } = position(superheats, sh);
      const field = key => interpolate(interpolate(gasValues[i][j][key], gasValues[i + 1][j][key], f),
        interpolate(gasValues[i][j + 1][key], gasValues[i + 1][j + 1][key], f), g);
      return { densityKgM3: field('densityKgM3'), viscosityPaS: field('viscosityPaS'),
        viscositySource: 'CoolProp-Stützpunkttabelle' };
    };
    const state = (code, output, key1, p, key2, t) => {
      if (code === fluid && output === 'H' && key1 === 'P' && key2 === 'T') {
        if (Math.abs(t - liquidK) < 1e-8 && inside(liquidEnthalpyPressures, p))
          return linear(liquidEnthalpyPressures, liquidEnthalpies, p);
        if (inside(gasEnthalpyPressures, p) && Math.abs(t - dewAt(p) - settings.superheatK) < 0.02)
          return linear(gasEnthalpyPressures, gasEnthalpies, p);
      }
      return data.state(code, output, key1, p, key2, t);
    };
    return Object.freeze({ ...data, saturationAtTemperature, saturationAtPressure, hydraulicPt, state });
  }
  function create(data, settings) {
    if (!['R448A', 'R513A', 'R134A', 'R404A', 'R407C', 'R449A', 'R452A'].includes(settings.fluid)) return data;
    if (settings.evaporationC < -35 || settings.evaporationC > 10 ||
        settings.condensationC < 25 || settings.condensationC > 55 ||
        settings.superheatK < 3 || settings.superheatK > 40 ||
        settings.subcoolingK < 1 || settings.subcoolingK > 10 ||
        settings.suctionLimitK > 5 ||
        (settings.fluid === 'R448A' && settings.condensationC - settings.subcoolingK > 50)) return data;
    const key = [settings.fluid, settings.evaporationC, settings.condensationC,
      settings.superheatK, settings.subcoolingK, settings.suctionLimitK].join('|');
    if (!cache.has(key)) {
      try {
        cache.set(key, build(data, settings));
        if (cache.size > 4) cache.delete(cache.keys().next().value);
      }
      catch { return data; }
    }
    return cache.get(key);
  }
  global.RohrnetzFastData = Object.freeze({ create });
})(window);
