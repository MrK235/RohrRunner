/* Pure material takeoff helpers for the browser and synthetic tests. */
((root, factory) => {
  root.RohrRunnerMaterials = factory();
})(typeof globalThis === 'object' ? globalThis : this, () => {
  'use strict';

  function teePositions(nodes, edges, rows, types, diameterOf) {
    const byEdge = new Map(rows.map(row => [`${row.edgeId}:${row.type}`, row]));
    const tees = [], reducers = [];
    for (const node of nodes.filter(item => item.type === 'junction')) {
      const incident = edges.filter(edge => edge.from === node.id || edge.to === node.id);
      for (const type of types) {
        const diameters = incident
          .map(edge => byEdge.get(`${edge.id}:${type}`))
          .filter(Boolean)
          .map(diameterOf);
        if (diameters.length < 3 || diameters.some(diameter => !(diameter > 0))) continue;
        const outerMm = Math.max(...diameters);
        tees.push({ diameterMm: outerMm, value: 1 });
        for (const innerMm of diameters) {
          if (innerMm < outerMm) reducers.push({ outerMm, innerMm, value: 1 });
        }
      }
    }
    return { tees, reducers };
  }

  return { teePositions };
});
