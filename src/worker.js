/* Dedicated worker isolates CoolProp and network sizing from the editor. */
self.window = self;
self.document = { currentScript: { src: new URL('../vendor/coolprop/coolprop-local.js', self.location.href).href }, baseURI: self.location.href };
importScripts('../vendor/coolprop/coolprop-local.js');
self.document.currentScript.src = new URL('./stoffdaten.js', self.location.href).href;
importScripts('../data/pipe-catalog.js', './stoffdaten.js', './fast-data.js', './engine.js');
self.onmessage = async event => {
  const { id, project, calibration, settings } = event.data || {};
  try {
    await self.RohrStoffdaten.load();
    const result = self.RohrRunnerEngine.calculate(project, calibration, settings, self.RohrStoffdaten, self.RohrKatalog);
    self.postMessage({ id, result });
  } catch (error) { self.postMessage({ id, error: error?.message || String(error) }); }
};
