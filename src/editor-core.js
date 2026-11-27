/* Pure editor helpers shared by the browser UI and Node.js tests. */
((root, factory) => {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.RohrRunnerEditor = api;
})(typeof globalThis === 'object' ? globalThis : this, () => {
  'use strict';

  const EPSILON = 1e-6;
  const close = (a, b, tolerance = EPSILON) =>
    Math.hypot(Number(a.x) - Number(b.x), Number(a.y) - Number(b.y)) <= tolerance;
  const clonePoint = point => ({ x: Number(point.x), y: Number(point.y) });

  function parseDecimal(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
    const source = String(value ?? '').trim().replace(/\s/g, '');
    if (!source) return NaN;
    const lastComma = source.lastIndexOf(','), lastDot = source.lastIndexOf('.');
    let normalized = source;
    if (lastComma >= 0 && lastDot >= 0) {
      const decimal = lastComma > lastDot ? ',' : '.';
      normalized = decimal === ',' ? source.replace(/\./g, '').replace(',', '.') : source.replace(/,/g, '');
    } else if (lastComma >= 0) normalized = source.replace(',', '.');
    const result = Number(normalized);
    return Number.isFinite(result) ? result : NaN;
  }

  function orthogonalPath(from, to, preferAxis = 'x') {
    const a = clonePoint(from), b = clonePoint(to);
    if (close(a, b)) return [];
    if (Math.abs(a.x - b.x) <= EPSILON || Math.abs(a.y - b.y) <= EPSILON) return [b];
    return preferAxis === 'y' ? [{ x: a.x, y: b.y }, b] : [{ x: b.x, y: a.y }, b];
  }

  function chooseAxis(from, to) {
    return Math.abs(Number(to.x) - Number(from.x)) >= Math.abs(Number(to.y) - Number(from.y)) ? 'x' : 'y';
  }

  function commitCorner(points, pointer, axis = null) {
    if (!Array.isArray(points) || !points.length) throw new Error('Ein Leitungsstart ist erforderlich.');
    const route = points.map(clonePoint), last = route.at(-1), activeAxis = axis || chooseAxis(last, pointer);
    const corner = activeAxis === 'x'
      ? { x: Number(pointer.x), y: last.y }
      : { x: last.x, y: Number(pointer.y) };
    if (!close(last, corner)) route.push(corner);
    return { points: route, axis: activeAxis === 'x' ? 'y' : 'x' };
  }

  function finishOrthogonal(points, target, axis = null) {
    if (!Array.isArray(points) || !points.length) throw new Error('Ein Leitungsstart ist erforderlich.');
    const route = points.map(clonePoint), last = route.at(-1);
    route.push(...orthogonalPath(last, target, axis || chooseAxis(last, target)));
    return dedupe(route);
  }

  function dedupe(points) {
    return points.map(clonePoint).filter((point, index, all) => !index || !close(point, all[index - 1]));
  }

  function isOrthogonal(points) {
    return Array.isArray(points) && points.slice(1).every((point, index) => {
      const previous = points[index];
      return Math.abs(point.x - previous.x) <= EPSILON || Math.abs(point.y - previous.y) <= EPSILON;
    });
  }

  function pointOnSegment(point, a, b, tolerance = EPSILON) {
    const p = clonePoint(point), start = clonePoint(a), end = clonePoint(b);
    if (Math.abs(start.x - end.x) <= tolerance) {
      return Math.abs(p.x - start.x) <= tolerance && p.y >= Math.min(start.y, end.y) - tolerance && p.y <= Math.max(start.y, end.y) + tolerance;
    }
    if (Math.abs(start.y - end.y) <= tolerance) {
      return Math.abs(p.y - start.y) <= tolerance && p.x >= Math.min(start.x, end.x) - tolerance && p.x <= Math.max(start.x, end.x) + tolerance;
    }
    return false;
  }

  function segmentIntersection(a, b, c, d) {
    const abVertical = Math.abs(a.x - b.x) <= EPSILON, cdVertical = Math.abs(c.x - d.x) <= EPSILON;
    if (abVertical === cdVertical) return null;
    const verticalA = abVertical ? a : c, verticalB = abVertical ? b : d;
    const horizontalA = abVertical ? c : a, horizontalB = abVertical ? d : b;
    const point = { x: Number(verticalA.x), y: Number(horizontalA.y) };
    return pointOnSegment(point, verticalA, verticalB) && pointOnSegment(point, horizontalA, horizontalB) ? point : null;
  }

  function nearestSegment(points, point, tolerance = Infinity) {
    let best = null;
    for (let index = 0; index < points.length - 1; index++) {
      const a = points[index], b = points[index + 1];
      const lengthSquared = (b.x - a.x) ** 2 + (b.y - a.y) ** 2 || 1;
      const factor = Math.max(0, Math.min(1, ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / lengthSquared));
      const projected = { x: a.x + factor * (b.x - a.x), y: a.y + factor * (b.y - a.y) };
      const distance = Math.hypot(point.x - projected.x, point.y - projected.y);
      if (distance <= tolerance && (!best || distance < best.distance)) best = { index, point: projected, distance };
    }
    return best;
  }

  function simplifyOrthogonal(points) {
    const result = [];
    for (const raw of points) {
      const point = clonePoint(raw);
      if (result.length && close(result.at(-1), point)) continue;
      result.push(point);
      while (result.length >= 3) {
        const a = result.at(-3), b = result.at(-2), c = result.at(-1);
        const collinearX = Math.abs(a.x - b.x) <= EPSILON && Math.abs(b.x - c.x) <= EPSILON;
        const collinearY = Math.abs(a.y - b.y) <= EPSILON && Math.abs(b.y - c.y) <= EPSILON;
        if (!collinearX && !collinearY) break;
        result.splice(result.length - 2, 1);
      }
    }
    return result;
  }

  function anchorRoute(points, from, to) {
    const end = (path, target) => {
      const old = path.pop(), previous = path.at(-1);
      if(close(old,target)){path.push(clonePoint(target));return path;}
      // Keep the final approach direction: an offset must not create a short
      // overlapping tail along the main pipe at the connection.
      path.push(...orthogonalPath(previous, target, Math.abs(previous.y-old.y)<=EPSILON?'y':'x'));
      if(path.length===1)path.push(clonePoint(target));
      path[path.length-1]=clonePoint(target);
      return path;
    };
    return end(end(points.map(clonePoint),to).reverse(),from).reverse();
  }

  function geometryIssues(network) {
    const nodes=new Map(network.nodes.map(node=>[node.id,node]));
    return network.edges.flatMap(edge=>{
      const from=nodes.get(edge.from),to=nodes.get(edge.to),p=edge.points;
      if(!from||!to||!p?.length)return [];
      const deviation=Math.max(Math.hypot(p[0].x-from.x,p[0].y-from.y),Math.hypot(p.at(-1).x-to.x,p.at(-1).y-to.y));
      return deviation>1e-5?[{edgeId:edge.id,deviation,message:`Leitung ${from.name||from.id} ↔ ${to.name||to.id}: Rohrende weicht ${deviation.toFixed(3)} Planpunkte vom Anschluss ab.`}]:[];
    });
  }

  function repairAnchors(network, tolerance=2) {
    const repaired=[];
    for(const issue of geometryIssues(network)){
      const edge=network.edges.find(e=>e.id===issue.edgeId);
      if(issue.deviation>tolerance||edge.points.length<2||!isOrthogonal(edge.points))continue;
      edge.points=anchorRoute(edge.points,network.nodes.find(n=>n.id===edge.from),network.nodes.find(n=>n.id===edge.to));
      repaired.push(edge.id);
    }
    return repaired;
  }

  // Run on a transaction copy. Only explicit node/edge attachments connect.
  function connectTopology(network, uid, {attachments=[]}={}) {
    const nodes=network.nodes,originals=network.edges;
    const pointOf=id=>nodes.find(n=>n.id===id);
    const pathOf=e=>e.points||[pointOf(e.from),pointOf(e.to)];
    const junctionAt=point=>{
      const node={id:uid('junction'),type:'junction',name:`T-${nodes.filter(n=>n.type==='junction').length+1}`,...clonePoint(point)};
      nodes.push(node);return node;
    };

    // A placement at an existing pipe end reuses that explicit connection.
    for(const attachment of attachments){
      const node=pointOf(attachment.nodeId),edge=originals.find(e=>e.id===attachment.edgeId);
      if(!node||!edge||node.type==='endpoint')continue;
      const old=[pointOf(edge.from),pointOf(edge.to)].find(n=>n.id!==node.id&&n.type==='junction'&&close(n,node));
      if(!old)continue;
      for(const pipe of originals){if(pipe.from===old.id)pipe.from=node.id;if(pipe.to===old.id)pipe.to=node.id;}
      nodes.splice(nodes.indexOf(old),1);
    }
    // Collinear overlap is ambiguous, unlike a perpendicular crossing.
    for(let i=0;i<originals.length;i++)for(let j=i+1;j<originals.length;j++){
      const a=pathOf(originals[i]),b=pathOf(originals[j]);
      for(let x=1;x<a.length;x++)for(let y=1;y<b.length;y++){
        const p=a[x-1],q=a[x],r=b[y-1],t=b[y];
        for(const [axis,fixed] of [['x','y'],['y','x']]){
          if(Math.abs(p[fixed]-q[fixed])>EPSILON||Math.abs(r[fixed]-t[fixed])>EPSILON||Math.abs(p[fixed]-r[fixed])>EPSILON)continue;
          if(Math.min(Math.max(p[axis],q[axis]),Math.max(r[axis],t[axis]))-Math.max(Math.min(p[axis],q[axis]),Math.min(r[axis],t[axis]))>EPSILON)throw Error('Überlappende oder doppelte Rohrstrecken: bitte die vorhandene Leitung verwenden.');
        }
      }
    }
    const links=[];
    for(const terminal of [...nodes].filter(n=>n.type==='endpoint')){
      const incident=originals.filter(e=>e.from===terminal.id||e.to===terminal.id);
      const interior=attachments.some(a=>a.nodeId===terminal.id&&originals.some(e=>e.id===a.edgeId&&e.from!==terminal.id&&e.to!==terminal.id));
      const attachedEdges=originals.filter(e=>incident.includes(e)||attachments.some(a=>a.nodeId===terminal.id&&a.edgeId===e.id));
      const existing=nodes.find(n=>n.type!=='endpoint'&&close(n,terminal)&&attachedEdges.some(e=>e.from===n.id||e.to===n.id));
      if(incident.length>1||interior||existing){
        const junction=existing||junctionAt(terminal);
        attachments=attachments.map(a=>a.nodeId===terminal.id?{...a,nodeId:junction.id}:a);
        for(const edge of incident){if(edge.from===terminal.id)edge.from=junction.id;if(edge.to===terminal.id)edge.to=junction.id;}
        // Retain an existing terminal link and its hydraulic properties.
        const previous=incident.find(e=>e.from===e.to);
        links.push({...previous,id:previous?.id||uid('edge'),from:junction.id,to:terminal.id,points:[clonePoint(junction),clonePoint(terminal)]});
      }
    }
    const result=[];
    for(const edge of originals){
      if(edge.from===edge.to)continue;
      const path=pathOf(edge),lengths=[0];
      for(let i=1;i<path.length;i++)lengths.push(lengths.at(-1)+Math.abs(path[i].x-path[i-1].x)+Math.abs(path[i].y-path[i-1].y));
      const total=lengths.at(-1),cuts=[{node:pointOf(edge.from),at:0}];
      for(const node of nodes){
        if(node.type==='endpoint'||node.id===edge.from||node.id===edge.to||!attachments.some(a=>a.nodeId===node.id&&a.edgeId===edge.id))continue;
        for(let i=1;i<path.length;i++)if(pointOnSegment(node,path[i-1],path[i])){
          const at=lengths[i-1]+Math.abs(node.x-path[i-1].x)+Math.abs(node.y-path[i-1].y);
          if(at>EPSILON&&at<total-EPSILON)cuts.push({node,at});break;
        }
      }
      cuts.push({node:pointOf(edge.to),at:total});cuts.sort((a,b)=>a.at-b.at);
      for(let i=1;i<cuts.length;i++){
        const a=cuts[i-1],b=cuts[i];if(a.node.id===b.node.id)continue;
        if(result.some(e=>(e.from===a.node.id&&e.to===b.node.id)||(e.from===b.node.id&&e.to===a.node.id)))throw Error('Überlappende oder doppelte Rohrstrecken: bitte die vorhandene Leitung verwenden.');
        const points=[clonePoint(a.node),...path.filter((p,k)=>lengths[k]>a.at+EPSILON&&lengths[k]<b.at-EPSILON).map(clonePoint),clonePoint(b.node)];
        const fraction=total?(b.at-a.at)/total:1,copy=JSON.parse(JSON.stringify(edge));
        Object.assign(copy,{id:i===1?edge.id:uid('edge'),from:a.node.id,to:b.node.id,points});
        for(const key of ['extraLengthM','pipeRiserLengthM','riserLengthM','zeta'])if(copy[key]!==undefined)copy[key]=Number(copy[key])*fraction;
        for(const state of Object.values(copy.thermal||{}))if(state.deltaZ!==undefined)state.deltaZ=Number(state.deltaZ)*fraction;
        result.push(copy);
      }
    }
    network.edges=[...result,...links];return network;
  }

  function moveNode(network, nodeId, dx, dy) {
    const nodes = (network.nodes || []).map(node => ({ ...node }));
    const node = nodes.find(item => item.id === nodeId);
    if (!node) return { nodes, edges: (network.edges || []).map(edge => ({ ...edge, points: edge.points?.map(clonePoint) })) };
    node.x += Number(dx); node.y += Number(dy);
    const byId = new Map(nodes.map(item => [item.id, item]));
    const edges = (network.edges || []).map(edge => {
      const copy = { ...edge, points: edge.points?.map(clonePoint) };
      if (edge.from !== nodeId && edge.to !== nodeId) return copy;
      const from = byId.get(edge.from), to = byId.get(edge.to), old = edge.points || [from, to];
      const first = old[0], second = old[1] || old[0];
      const axis = Math.abs(first.y - second.y) <= EPSILON ? 'x' : 'y';
      copy.points = simplifyOrthogonal([clonePoint(from), ...orthogonalPath(from, to, axis)]);
      return copy;
    });
    return { nodes, edges };
  }

  function moveEdgeSegment(network, edgeId, segmentIndex, dx, dy) {
    const nodes = (network.nodes || []).map(node => ({ ...node }));
    const edges = (network.edges || []).map(edge => {
      const copy = { ...edge, points: edge.points?.map(clonePoint) };
      if (edge.id !== edgeId || !copy.points?.[segmentIndex + 1]) return copy;
      const a = copy.points[segmentIndex], b = copy.points[segmentIndex + 1];
      const vertical = Math.abs(a.x - b.x) <= EPSILON;
      const movedA = vertical ? { x: a.x + Number(dx), y: a.y } : { x: a.x, y: a.y + Number(dy) };
      const movedB = vertical ? { x: b.x + Number(dx), y: b.y } : { x: b.x, y: b.y + Number(dy) };
      copy.points.splice(segmentIndex, 2, clonePoint(a), movedA, movedB, clonePoint(b));
      copy.points = simplifyOrthogonal(copy.points);
      return copy;
    });
    return { nodes, edges };
  }

  function deleteSelection(network, selection) {
    const nodes = (network.nodes || []).map(node => ({ ...node }));
    let edges = (network.edges || []).map(edge => ({ ...edge, points: edge.points?.map(clonePoint) }));
    if (!selection) return { nodes, edges };
    let remainingNodes = nodes;
    if (selection.kind === 'edge') edges = edges.filter(edge => edge.id !== selection.id);
    else {
      remainingNodes = nodes.filter(node => node.id !== selection.id);
      edges = edges.filter(edge => edge.from !== selection.id && edge.to !== selection.id);
    }
    // A T-piece only exists while three pipes meet there. Join the two remaining
    // pipe sections so deleting a branch does not leave a false junction behind.
    let changed = true;
    while (changed) {
      changed = false;
      for (const node of remainingNodes.filter(item => item.type === 'junction')) {
        const incident = edges.filter(edge => edge.from === node.id || edge.to === node.id);
        if (incident.length >= 3) continue;
        if (incident.length === 2) {
          const [first, second] = incident;
          // A single merged edge cannot represent two risers with different sizes.
          // Keep the degree-two junction and both hydraulic sections intact.
          if (first.pipeRiser && Number(first.pipeRiserLengthM) > 0 ||
              second.pipeRiser && Number(second.pipeRiserLengthM) > 0) continue;
          const otherA = first.from === node.id ? first.to : first.from;
          const otherB = second.from === node.id ? second.to : second.from;
          const point = id => remainingNodes.find(item => item.id === id);
          const oriented = (edge, from) => {
            const points = edge.points || [point(edge.from), point(edge.to)];
            return (edge.from === from ? points : [...points].reverse()).map(clonePoint);
          };
          const thermal = Object.fromEntries(['suction', 'liquid'].map(type => {
            const a = first.thermal?.[type] || {}, b = second.thermal?.[type] || {};
            return [type, { ...a, mode: a.mode === b.mode && a.sizeId === b.sizeId ? a.mode || 'auto' : 'auto', sizeId: a.sizeId === b.sizeId ? a.sizeId : null, deltaZ: (Number(a.deltaZ) || 0) + (Number(b.deltaZ) || 0) }];
          }));
          const merged = { ...first, from: otherA, to: otherB,
            points: simplifyOrthogonal([...oriented(first, otherA), ...oriented(second, node.id).slice(1)]),
            extraLengthM: (Number(first.extraLengthM) || 0) + (Number(second.extraLengthM) || 0),
            zeta: (Number(first.zeta) || 0) + (Number(second.zeta) || 0), thermal };
          edges = edges.filter(edge => edge !== first && edge !== second);
          if (otherA !== otherB) edges.push(merged);
        } else edges = edges.filter(edge => !incident.includes(edge));
        remainingNodes = remainingNodes.filter(item => item.id !== node.id);
        changed = true;
        break;
      }
    }
    return { nodes: remainingNodes, edges };
  }

  return Object.freeze({
    EPSILON,
    anchorRoute, geometryIssues, repairAnchors, connectTopology,
    close,
    parseDecimal,
    orthogonalPath,
    chooseAxis,
    commitCorner,
    finishOrthogonal,
    dedupe,
    isOrthogonal,
    pointOnSegment,
    segmentIntersection,
    nearestSegment,
    simplifyOrthogonal,
    moveNode,
    moveEdgeSegment,
    deleteSelection
  });
});
