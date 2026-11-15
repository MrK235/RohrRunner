/* RohrRunner calculation core. SI units internally; graph traversal is iterative. */
(function (root) {
  'use strict';
  const G = 9.80665;
  const fluids = new Set(['R513A', 'R448A', 'R744']);
  const idOf = size => `${size.odMm}x${size.wallMm}`;
  const sizeLabelOf = size => size.inch ? `${size.inch.trim().replace(/\s+/g, '-')}"` : `${size.odMm} × ${size.wallMm} mm`;
  const diOf = size => (size.odMm - 2 * size.wallMm) / 1000;
  const fail = message => { throw new Error(message); };
  function frictionFactor(re, roughness, d) {
    if (!(re > 0)) return 0;
    if (re < 2300) return 64 / re;
    const a = -1.8 * Math.log10(Math.pow(roughness / d / 3.7, 1.11) + 6.9 / re);
    return 1 / (a * a);
  }
  function analyze(project, calibration) {
    const nodes = project.nodes || [], edges = project.edges || [];
    const starts = nodes.filter(n => n.type === 'start'), terminals = nodes.filter(n => n.type === 'endpoint');
    if (starts.length !== 1) fail('Das Netz braucht genau einen Anlagenstart.');
    if (!terminals.length) fail('Füge mindestens eine Kühlstelle hinzu.');
    if (!(calibration > 0)) fail('Kalibriere den Plan mit einer bekannten Strecke.');
    const byId = new Map(nodes.map(n => [n.id, n]));
    if (byId.size !== nodes.length || new Set(edges.map(e=>e.id)).size!==edges.length) fail('Knoten- oder Leitungs-IDs sind nicht eindeutig.');
    const adj = new Map(nodes.map(n => [n.id, []]));
    for (const e of edges) {
      if (!byId.has(e.from) || !byId.has(e.to) || e.from === e.to) fail('Ein Leitungsabschnitt verweist auf ungültige Knoten.');
      const pts = e.points || [byId.get(e.from), byId.get(e.to)];
      if (pts.length < 2) fail('Ein Leitungsabschnitt braucht mindestens zwei Punkte.');
      let units = 0;
      for (let i=1;i<pts.length;i++) {
        const dx=Math.abs(pts[i].x-pts[i-1].x), dy=Math.abs(pts[i].y-pts[i-1].y);
        if (dx>1e-5 && dy>1e-5) fail('Leitungen müssen im Plan rechtwinklig verlaufen.');
        units += dx+dy;
      }
      e._lengthM = units * calibration + Math.max(0, Number(e.extraLengthM)||0);
      adj.get(e.from).push(e); adj.get(e.to).push(e);
    }
    const parent = new Map(), parentEdgeId = new Map(), order = [starts[0].id], seen = new Set(order);
    for (let i=0;i<order.length;i++) for (const e of adj.get(order[i])) {
      if(e.id===parentEdgeId.get(order[i])) continue;
      const next=e.from===order[i]?e.to:e.from;
      if (seen.has(next)) fail('Das Netz enthält einen geschlossenen Kreis oder doppelte Verbindung.');
      seen.add(next); parent.set(next,{id:order[i],edge:e}); parentEdgeId.set(next,e.id); order.push(next);
    }
    if (seen.size!==nodes.length || order.length!==edges.length+1) fail('Das Netz muss zusammenhängend und kreisfrei sein.');
    for (const n of terminals) if (!(Number(n.coolingKW)>0)) fail(`${n.name||'Kühlstelle'}: Leistung muss größer als 0 kW sein.`);
    for (const n of nodes) {
      const degree=adj.get(n.id).length;
      if(n.type==='endpoint'&&degree!==1)fail(`${n.name||'Kühlstelle'} muss genau einen Leitungsanschluss haben.`);
      if(n.type==='junction'&&degree<2)fail(`${n.name||'Abzweig'} braucht mindestens zwei Leitungsanschlüsse.`);
      if(n.type==='start'&&degree<1)fail('Der Anlagenstart ist noch nicht mit dem Netz verbunden.');
    }
    return {nodes,edges,starts,terminals,byId,adj,parent,order,start:starts[0]};
  }
  function calculate(project, calibration, settings, data, catalog) {
    const graph=analyze(project,calibration), f=settings.fluid;
    if(!fluids.has(f)) fail('Kältemittel nicht unterstützt.');
    const n=(key,label,min,max=Infinity)=>{const v=Number(settings[key]);if(!Number.isFinite(v)||v<min||v>max)fail(`${label} ist außerhalb des zulässigen Bereichs.`);return v;};
    const simultaneity=n('simultaneity','Gleichzeitigkeit',0,1), te=n('evaporationC','Verdampfung',-60,30), tc=n('condensationC','Verflüssigung',-60,70), sh=n('superheatK','Überhitzung',0.1,40), sc=n('subcoolingK','Unterkühlung',0.1,40);
    const limS=n('suctionLimitK','Saugverlustgrenze',0.01,30), limL=n('liquidLimitK','Flüssigkeitsverlustgrenze',0.01,30), vmax=n('maxVelocityMS','Maximalgeschwindigkeit',0.1,40), vmin=n('minVelocityMS','Mindestgeschwindigkeit',0,30), ps=n('designPressureBar','Auslegungsdruck',1,200), rough=n('roughnessMicroM','Rauheit',0,100)*1e-6, fittings=n('fittingsFactor','Einbautenzuschlag',1,10), margin=1+n('viscosityMarginPercent','Viskositätszuschlag',0,99)/100;
    if(f==='R744' && tc+273.15>=304.1282) fail('Transkritisches R744 wird in dieser Version nicht ausgelegt.');
    data=root.RohrnetzFastData?.create(data,settings)||data;
    const rootP=data.saturationAtTemperature(f,te+273.15).dewPressurePa, liquidP=data.saturationAtTemperature(f,tc+273.15).bubblePressurePa, liquidT=tc+273.15-sc;
    const liquidPhaseLimit=data.saturationAtTemperature(f,liquidT).bubblePressurePa;
    const series=catalog.series.find(s=>s.id===(f==='R744'?'k65-inch-120bar':'cuprofrio-metric'));
    if(!series)fail('Für diesen Kältemittelkreis fehlt ein Rohrkatalog.');
    const sizes=series.sizes.filter(s=>(s.catalogBar??120)>=ps+1.01325 && diOf(s)>0).sort((a,b)=>diOf(a)-diOf(b));
    if(!sizes.length)fail('Keine Rohrgröße erfüllt den Auslegungsdruck.');
    const parentEdge=new Map(), children=new Map(graph.nodes.map(x=>[x.id,[]]));
    for(let i=1;i<graph.order.length;i++) {const id=graph.order[i],p=graph.parent.get(id),edge=p.edge;parentEdge.set(id,edge);children.get(p.id).push(id);}
    const down=new Map();
    for(let i=graph.order.length-1;i>=0;i--){const id=graph.order[i],node=graph.byId.get(id);let q=node.type==='endpoint'?Number(node.coolingKW)*1000:0;for(const c of children.get(id))q+=down.get(c);down.set(id,q);}
    const edges=graph.edges, selected=new Map();
    for(const e of edges) for(const type of ['suction','liquid']) selected.set(`${e.id}:${type}`, e.thermal?.[type]?.mode==='manual' ? (sizes.find(s=>idOf(s)===e.thermal[type].sizeId)||fail(`${e.label||'Leitung'}: manuelle Rohrgröße ist für den Auslegungsdruck nicht verfügbar.`)) : sizes[0]);
    const h0v=data.state(f,'H','P',rootP,'T',data.saturationAtPressure(f,rootP).dewK+sh), h0l=data.state(f,'H','P',liquidP,'T',liquidT), baseLift=h0v-h0l;
    if(!(baseLift>0))fail('Verdampfer-Enthalpiedifferenz ist nicht positiv.');
    const baseGas=data.hydraulicPt(f,rootP,data.saturationAtPressure(f,rootP).dewK+sh), maxTerminalFlow=new Map();
    for(let i=graph.order.length-1;i>=0;i--){const id=graph.order[i],node=graph.byId.get(id);let flow=node.type==='endpoint'?Number(node.coolingKW)*1000/baseLift:0;for(const c of children.get(id))flow=Math.max(flow,maxTerminalFlow.get(c));maxTerminalFlow.set(id,flow);}
    for(const e of edges){const child=graph.order.find(id=>parentEdge.get(id)?.id===e.id),total=down.get(child)/baseLift,maxFlow=simultaneity*total+(1-simultaneity)*maxTerminalFlow.get(child);if(e.thermal?.suction?.mode!=='manual'){const first=sizes.find(size=>maxFlow/(baseGas.densityKgM3*Math.PI*diOf(size)**2/4)<=vmax);if(first)selected.set(`${e.id}:suction`,first);}}
    const flowsFor=target=>{const q=new Map();for(let i=graph.order.length-1;i>=0;i--){const id=graph.order[i],nd=graph.byId.get(id);let watts=nd.type==='endpoint'?Number(nd.coolingKW)*1000*(id===target?1:simultaneity):0;for(const c of children.get(id))watts+=q.get(c)*baseLift;q.set(id,watts/baseLift);}return q;};
    function fluidProps(type,p){
      try{const sat=data.saturationAtPressure(f,p);
        if(type==='suction')return data.hydraulicPt(f,p,sat.dewK+sh);
        return data.hydraulicPt(f,p,liquidT);
      }catch(error){throw new Error(`${error.message} (${type}, ${Number(p).toPrecision(5)} Pa)`);}
    }
    function segment(edge,type,flow,p,size,direction=1){
      if(flow<=0)return {drop:0,v:0,pOut:p,props:fluidProps(type,p)};
      const d=diOf(size),area=Math.PI*d*d/4,len=edge._lengthM,zeta=Number(edge.zeta)||0,steps=type==='suction'?8:4;
      let pressure=p, drop=0, vmaxSeen=0, vminSeen=Infinity, latest, phaseRisk=false;
      for(let j=0;j<steps;j++){
        latest=fluidProps(type,pressure);const rho=latest.densityKgM3,mu=latest.viscosityPaS*margin;
        if(!(rho>0&&mu>0))fail('Ungültige Stoffwerte im Rohrabschnitt.');
        const velocity=flow/(rho*area), re=rho*velocity*d/mu, ff=frictionFactor(re,rough,d), dynamic=.5*rho*velocity*velocity;
        const dz=(Number(edge.thermal?.[type]?.deltaZ)||0)/steps;
        const dp=(ff*len/steps/d*fittings+zeta/steps)*dynamic+rho*G*dz;
        drop+=dp;vmaxSeen=Math.max(vmaxSeen,velocity);vminSeen=Math.min(vminSeen,velocity);
        const nextPressure=pressure-dp;
        if(type==='liquid'&&nextPressure<liquidPhaseLimit){pressure=liquidPhaseLimit;phaseRisk=true;break;}
        if(nextPressure<=1000){pressure=1000;phaseRisk=true;break;}
        pressure=nextPressure;
      }
      return {drop,v:vmaxSeen,vMin:vminSeen,pOut:pressure,props:latest,phaseRisk};
    }
    const scenarios=[];
    function solveScenario(target, retain=false){
      let massByNode=flowsFor(target), suctionP=new Map([[graph.start.id,rootP]]), liquidPByNode=new Map([[graph.start.id,liquidP]]), lineResults=new Map(), converged=false;
      for(let iteration=0;iteration<12;iteration++){
        for(let i=graph.order.length-1;i>=0;i--){const id=graph.order[i],node=graph.byId.get(id);if(node.type!=='endpoint')massByNode.set(id,children.get(id).reduce((sum,c)=>sum+massByNode.get(c),0));}
        const liquidPByNode=new Map([[graph.start.id,liquidP]]), suc=new Map([[graph.start.id,rootP]]), line=new Map();
        for(let i=1;i<graph.order.length;i++){
          const id=graph.order[i], edge=parentEdge.get(id), pid=graph.parent.get(id).id, flow=massByNode.get(id), size=selected.get(`${edge.id}:liquid`), p=liquidPByNode.get(pid);
          const r=segment(edge,'liquid',flow,p,size,1);liquidPByNode.set(id,r.pOut);line.set(`${edge.id}:liquid`,{...r,flow,pIn:p});
        }
        for(let i=1;i<graph.order.length;i++){
          const id=graph.order[i],edge=parentEdge.get(id),pid=graph.parent.get(id).id,flow=massByNode.get(id),size=selected.get(`${edge.id}:suction`),out=suc.get(pid);
          let pin=Math.max(out+1, out*1.001),r;
          for(let j=0;j<18;j++){r=segment(edge,'suction',flow,pin,size,-1);const residual=pin-r.drop-out;if(Math.abs(residual)<Math.max(.5,pin*1e-8))break;pin=Math.max(out+1,pin-residual*.75);}
          r=segment(edge,'suction',flow,pin,size,-1);if(Math.abs(pin-r.drop-out)>Math.max(5,pin*1e-5))fail(`${edge.label||'Saugleitung'}: Druckrückrechnung konvergiert nicht.`);
          suc.set(id,pin);line.set(`${edge.id}:suction`,{...r,flow,pIn:pin,pOut:out});
        }
        let diff=0;
        for(const end of graph.terminals){const pS=suc.get(end.id),pL=liquidPByNode.get(end.id);let hs,hl;try{hs=data.state(f,'H','P',pS,'T',data.saturationAtPressure(f,pS).dewK+sh);hl=data.state(f,'H','P',pL,'T',liquidT);}catch{continue;}const lift=hs-hl;if(!(lift>0))fail(`${end.name}: Enthalpiedifferenz nicht positiv.`);const next=Number(end.coolingKW)*1000/lift*(end.id===target?1:simultaneity);diff=Math.max(diff,Math.abs(next-massByNode.get(end.id))/Math.max(next,1e-12));massByNode.set(end.id,next);}
        suctionP=suc;
        lineResults=line;
        if(diff<1e-5){converged=true; break;}
      }
      if(!converged)fail(`${graph.byId.get(target).name}: Massenstrom und Druckzustand konvergieren nicht.`);
      const liquidEnd=new Map([[graph.start.id,liquidP]]);
      for(let i=1;i<graph.order.length;i++){const id=graph.order[i],edge=parentEdge.get(id),pid=graph.parent.get(id).id,pIn=liquidEnd.get(pid),r=segment(edge,'liquid',massByNode.get(id),pIn,selected.get(`${edge.id}:liquid`),1);liquidEnd.set(id,r.pOut);lineResults.set(`${edge.id}:liquid`,{...r,flow:massByNode.get(id),pIn});}
      for(let i=1;i<graph.order.length;i++){const id=graph.order[i],edge=parentEdge.get(id),pid=graph.parent.get(id).id,out=suctionP.get(pid),flow=massByNode.get(id);let pin=out+100,r;for(let j=0;j<25;j++){r=segment(edge,'suction',flow,pin,selected.get(`${edge.id}:suction`),-1);const err=pin-r.drop-out;if(Math.abs(err)<Math.max(.5,pin*1e-8))break;pin=Math.max(out+1,pin-err*.7);}r=segment(edge,'suction',flow,pin,selected.get(`${edge.id}:suction`),-1);suctionP.set(id,pin);lineResults.set(`${edge.id}:suction`,{...r,flow,pIn:pin,pOut:out});}
      const endpoint=graph.byId.get(target), psEnd=suctionP.get(target),plEnd=liquidEnd.get(target),sK=data.saturationAtPressure(f,psEnd).dewK-data.saturationAtPressure(f,rootP).dewK,lK=data.saturationAtPressure(f,liquidP).bubbleK-data.saturationAtPressure(f,plEnd).bubbleK,remaining=data.saturationAtPressure(f,plEnd).bubbleK-liquidT;
      return {targetId:target,name:endpoint.name,evaporationC:data.saturationAtPressure(f,psEnd).dewK-273.15,coolingKW:Number(endpoint.coolingKW)||0,suctionK:sK,liquidK:lK,remainingSubcoolingK:remaining,suctionPressurePa:psEnd,liquidPressurePa:plEnd,lineResults,massByNode,suctionP,liquidEnd};
    }
    // Deterministic upgrade loop: evaluate whole-network endpoint cases, then grow the
    // pipe with the greatest weighted reduction on the currently failing path.
    const manual=new Set(edges.flatMap(e=>['suction','liquid'].filter(t=>e.thermal?.[t]?.mode==='manual').map(t=>`${e.id}:${t}`)));
    let finalScenarios=[];
    for(let pass=0;pass<Math.max(1,Math.min(8,edges.length*2));pass++){
      finalScenarios=graph.terminals.map(end=>solveScenario(end.id));
      const rowByKey=new Map();for(const e of edges)for(const t of ['suction','liquid'])rowByKey.set(`${e.id}:${t}`,[]);
      for(const s of finalScenarios)for(const [key,r] of s.lineResults)rowByKey.get(key)?.push({scenario:s,result:r});
      const issues=[];
      for(const s of finalScenarios){if(s.suctionK>limS)issues.push({type:'suction',target:s.targetId,excess:s.suctionK/limS-1,path:new Set(pathTo(s.targetId))});if(s.liquidK>limL||s.remainingSubcoolingK<=0)issues.push({type:'liquid',target:s.targetId,excess:Math.max(s.liquidK/limL-1,s.remainingSubcoolingK<=0?1:0),path:new Set(pathTo(s.targetId))});}
      for(const issue of issues){let worst=0;for(const [key,r] of rowByKey)if(key.endsWith(issue.type)&&issue.path.has(key.slice(0,key.lastIndexOf(':'))))worst=Math.max(worst,r.find(x=>x.scenario.targetId===issue.target)?.result.v||0);if(issue.type==='suction'&&worst>vmax)issue.excess=Math.max(issue.excess,worst/vmax-1);}
      // velocity limits are checked on each full-load target scenario.
      for(const s of finalScenarios)for(const [key,r] of s.lineResults)if(key.endsWith(':suction'))if(r.v>vmax)issues.push({type:'suction',target:s.targetId,excess:r.v/vmax-1,path:new Set(pathTo(s.targetId))});
      let worstIssue=issues.sort((a,b)=>b.excess-a.excess)[0];if(!worstIssue)break;
      const keys=[...rowByKey.keys()].filter(key=>key.endsWith(worstIssue.type)&&worstIssue.path.has(key.slice(0,key.lastIndexOf(':')))&&!manual.has(key));
      let best=null;
      for(const key of keys){const current=selected.get(key),ix=sizes.indexOf(current);if(ix<0||ix>=sizes.length-1)continue;const candidates=rowByKey.get(key).filter(x=>x.scenario.targetId===worstIssue.target);const drop=candidates.reduce((sum,x)=>sum+x.result.drop,0);const edgeId=key.slice(0,key.lastIndexOf(':'));const edge=edges.find(e=>e.id===edgeId);const length=edge._lengthM||1;const score=drop/Math.max(length,0.1)/(diOf(sizes[ix+1])**2/diOf(current)**2-1);if(!best||score>best.score)best={key,score,ix};}
      if(!best)break;const factor=Math.max(1.12,Math.pow(1+worstIssue.excess,.4)),currentD=diOf(sizes[best.ix]),targetD=currentD*factor;let targetIndex=best.ix+1;while(targetIndex<sizes.length-1&&diOf(sizes[targetIndex])<targetD)targetIndex++;selected.set(best.key,sizes[targetIndex]);
    }
    finalScenarios=graph.terminals.map(end=>solveScenario(end.id));
    const issues=[];
    for(const s of finalScenarios){if(s.suctionK>limS+1e-6)issues.push({targetId:s.targetId,type:'suction',message:`${s.name}: Saugverlust ${s.suctionK.toFixed(2)} K überschreitet ${limS} K.`});if(s.liquidK>limL+1e-6)issues.push({targetId:s.targetId,type:'liquid',message:`${s.name}: Flüssigkeitsverlust ${s.liquidK.toFixed(2)} K überschreitet ${limL} K.`});if(s.remainingSubcoolingK<=0)issues.push({targetId:s.targetId,type:'phase',message:`${s.name}: Flüssigkeit erreicht die Phasengrenze.`});for(const [key,r] of s.lineResults){if(key.endsWith(':suction')&&r.v>vmax+1e-6)issues.push({targetId:s.targetId,type:'velocity',message:`${s.name}: Sauggeschwindigkeit ${r.v.toFixed(1)} m/s überschreitet ${vmax} m/s.`});const edge=edges.find(e=>e.id===key.slice(0,key.lastIndexOf(':')));if(key.endsWith(':suction')&&edge&&(Number(edge.thermal?.suction?.deltaZ)||0)>0&&r.vMin<vmin-1e-6)issues.push({targetId:s.targetId,type:'oil-return',message:`${s.name}: Mindestgeschwindigkeit ${vmin} m/s in der steigenden Saugleitung wird unterschritten.`});}}
    const rows=[];for(const edge of edges)for(const type of ['suction','liquid']){const runs=finalScenarios.map(s=>({s,r:s.lineResults.get(`${edge.id}:${type}`)})).filter(x=>x.r);const r=runs.reduce((best,x)=>x.r.drop>best.drop?x.r:best,runs[0]?.r);if(!r)continue;const size=selected.get(`${edge.id}:${type}`),pUp=Math.max(1000,r.pIn),pDown=Math.max(1000,r.pOut);const dT=Math.abs(data.saturationAtPressure(f,pUp).dewK-data.saturationAtPressure(f,pDown).dewK);rows.push({edgeId:edge.id,type,sizeId:idOf(size),sizeLabel:sizeLabelOf(size),diameterMm:diOf(size)*1000,lengthM:edge._lengthM,flowKgS:r.flow,flowKgH:r.flow*3600,velocityMS:r.v,pressureDropPa:r.drop,pressureDropBar:r.drop/1e5,temperatureDropK:dT,manual:manual.has(`${edge.id}:${type}`),psBar:size.catalogBar??120,branchCount:runs.length});}
    const valid=issues.length===0;
    return {valid,issues,rows,endpoints:finalScenarios.map(s=>({id:s.targetId,name:s.name,evaporationC:s.evaporationC,coolingKW:s.coolingKW,suctionK:s.suctionK,liquidK:s.liquidK,remainingSubcoolingK:s.remainingSubcoolingK,suctionPressureBar:s.suctionPressurePa/1e5,liquidPressureBar:s.liquidPressurePa/1e5})),totalCoolingKW:graph.terminals.reduce((a,e)=>a+Number(e.coolingKW),0),fluid:f,settings:{...settings},model:{name:'RohrRunner stationär',refrigerant:f,assumptions:['Einphasige, stationäre Strömung','Nicht eingetragene Höhendifferenzen werden als 0 m angenommen','Flüssigkeitstemperatur bleibt entlang des Strangs konstant','Unterkritisches R744; keine Druckgasleitung','Gleichzeitigkeit als eigener Endpunkt-Lastfall','Automatische Rohrwahl ist eine begrenzte Heuristik, kein globales Kostenoptimum','Herstellerdaten und Einbauverantwortung separat prüfen']}};
    function pathTo(id){const out=[];while(id!==graph.start.id){const p=graph.parent.get(id);out.push(p.edge.id);id=p.id;}return out;}
  }
  root.RohrRunnerEngine={calculate,analyze,frictionFactor,diameter:diOf,sizeLabel:sizeLabelOf};
})(typeof self!=='undefined'?self:globalThis);
