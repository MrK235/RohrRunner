/* RohrRunner calculation core. SI units internally; graph traversal is iterative. */
(function (root) {
  'use strict';
  const G = 9.80665;
  const fluids = new Set(['R513A', 'R448A', 'R744', 'R134A', 'R404A', 'R407C', 'R449A', 'R452A']);
  const idOf = size => `${size.odMm}x${size.wallMm}`;
  const sizeLabelOf = size => size.dn ? 'DN ' + size.dn + ' · ' + size.inch.trim().replace(/\s+/g, '-') + '"' : size.inch ? size.inch.trim().replace(/\s+/g, '-') + '"' : size.odMm + ' × ' + size.wallMm + ' mm';
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
      const terminal=byId.get(e.to)?.type==='endpoint'?byId.get(e.to):byId.get(e.from)?.type==='endpoint'?byId.get(e.from):null;
      const terminalExtra=Number(terminal?.extraLengthM)||0;
      if(terminalExtra<0)fail(`${terminal.name||'Kühlstelle'}: zusätzliche Rohrleitung darf nicht negativ sein.`);
      e._drawnLengthM = units * calibration;
      if(e.suctionRiser&&e.riserLengthM!==undefined&&(!Number.isFinite(Number(e.riserLengthM))||Number(e.riserLengthM)<0))fail(`${e.label||'Steigleitung'}: Steigleitungslänge muss eine nichtnegative Zahl sein.`);
      e._lengthM = e._drawnLengthM + Math.max(0, Number(e.extraLengthM)||0) + terminalExtra;
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
  function calculateSecondary(project, calibration, settings, data, catalog) {
    const graph=analyze(project,calibration),n=(key,label,min,max=Infinity)=>{const value=Number(settings[key]);if(!Number.isFinite(value)||value<min||value>max)fail(`${label} ist außerhalb des zulässigen Bereichs.`);return value;};
    const fluid=String(settings.secondaryFluid||'WATER').toUpperCase(),fluidInfo=data.secondaryInfo(fluid);
    const concentration=fluid==='WATER'?0:n('glycolConcentrationMassPercent',`Konzentration (${fluidInfo.basis})`,fluidInfo.min,fluidInfo.max),supplyC=n('supplyTemperatureC','Vorlauftemperatur',-60,100),returnC=n('returnTemperatureC','Rücklauftemperatur',-60,100);
    if(!(returnC>supplyC))fail('Die Rücklauftemperatur muss bei Kühlbetrieb über der Vorlauftemperatur liegen.');
    const deltaT=returnC-supplyC,simultaneity=n('simultaneity','Gleichzeitigkeit',0,1),maxVelocity=n('secondaryMaxVelocityMS','Maximalgeschwindigkeit',0.1,10),pressureLimit=n('secondaryPressureLimitKPa','Druckverlustgrenze Kältekreis',0.1,10000)*1000;
    const series=catalog.series.find(item=>item.id===settings.secondaryPipeSeries);if(!series||!series.sizes?.length)fail('Für dieses Rohrsystem fehlt ein gültiger Rohrkatalog.');
    const sizes=series.sizes.filter(size=>diOf(size)>0).sort((a,b)=>diOf(a)-diOf(b));if(!sizes.length)fail('Das gewählte Rohrsystem enthält keine gültigen Rohrgrößen.');
    const concentrationForData=fluid==='WATER'?0:concentration;
    const supplyProps=data.secondaryPt(fluid,supplyC,concentrationForData),returnProps=data.secondaryPt(fluid,returnC,concentrationForData),freezeC=Math.max(supplyProps.freezeTemperatureC,returnProps.freezeTemperatureC);
    if(supplyC<=freezeC||returnC<=freezeC)fail(`Betriebstemperatur erreicht den Stoffdaten-Gefrierpunkt (${freezeC.toFixed(1)} °C).`);
    const meanCp=(supplyProps.specificHeatJKgK+returnProps.specificHeatJKgK)/2,parentEdge=new Map(),children=new Map(graph.nodes.map(node=>[node.id,[]]));
    for(let i=1;i<graph.order.length;i++){const id=graph.order[i],parent=graph.parent.get(id);parentEdge.set(id,parent.edge);children.get(parent.id).push(id)}
    const downKW=new Map(),maxTerminalKW=new Map();for(let i=graph.order.length-1;i>=0;i--){const id=graph.order[i],node=graph.byId.get(id);let total=node.type==='endpoint'?Number(node.coolingKW):0,largest=total;for(const child of children.get(id)){total+=downKW.get(child);largest=Math.max(largest,maxTerminalKW.get(child))}downKW.set(id,total);maxTerminalKW.set(id,largest)}
    const flowByEdge=new Map();for(const edge of graph.edges){const child=graph.order.find(id=>parentEdge.get(id)?.id===edge.id),effectiveKW=simultaneity*downKW.get(child)+(1-simultaneity)*maxTerminalKW.get(child);flowByEdge.set(edge.id,effectiveKW*1000/(meanCp*deltaT))}
    const selected=new Map(),manual=new Map();for(const edge of graph.edges)for(const type of ['suction','liquid']){const setting=edge.thermal?.[type],index=sizes.findIndex(size=>`${size.odMm}x${size.wallMm}`===setting?.sizeId);if(setting?.mode==='manual'&&index<0)fail(`${edge.label||'Leitung'}: manuelle Rohrgröße ist für dieses Rohrsystem nicht verfügbar.`);manual.set(`${edge.id}:${type}`,setting?.mode==='manual');selected.set(`${edge.id}:${type}`,index>=0&&setting?.mode==='manual'?index:0)}
    const roughnessMicroM=settings.secondaryRoughnessMicroM===undefined?(Number(series.roughnessMicroM)||1.5):n('secondaryRoughnessMicroM','Rohrrauheit Kälteträger',0,100),roughness=roughnessMicroM*1e-6,fittings=n('fittingsFactor','Einbautenzuschlag',1,10),viscosityMargin=1+n('viscosityMarginPercent','Viskositätszuschlag',0,99)/100;
    const pipeState=(edge,type)=>{const size=sizes[selected.get(`${edge.id}:${type}`)],flow=flowByEdge.get(edge.id),props=type==='suction'?supplyProps:returnProps,d=diOf(size),area=Math.PI*d*d/4,velocity=flow/(props.densityKgM3*area),re=props.densityKgM3*velocity*d/(props.viscosityPaS*viscosityMargin),ff=frictionFactor(re,roughness,d),dynamic=.5*props.densityKgM3*velocity*velocity,zeta=Math.max(0,Number(edge.zeta)||0),drop=(ff*edge._lengthM/d*fittings+zeta)*dynamic,child=graph.order.find(id=>parentEdge.get(id)?.id===edge.id);return {edgeId:edge.id,type,sizeId:idOf(size),sizeLabel:sizeLabelOf(size),diameterMm:size.odMm,wallMm:size.wallMm,lengthM:edge._lengthM,flowKgS:flow,flowM3H:flow/props.densityKgM3*3600,velocityMS:velocity,reynolds:re,pressureDropPa:drop,pressureDropKPa:drop/1000,pressureGradientPaM:edge._lengthM>0?drop/edge._lengthM:0,powerKW:downKW.get(child),manual:manual.get(`${edge.id}:${type}`),fluidTemperatureC:type==='suction'?supplyC:returnC,densityKgM3:props.densityKgM3,viscosityPaS:props.viscosityPaS}};
    const routeTo=id=>{const edges=[];let current=id;while(current!==graph.start.id){const parent=graph.parent.get(current);if(!parent)break;edges.push(parent.edge);current=parent.id}return edges};let rows=[];const refresh=()=>{rows=graph.edges.flatMap(edge=>['suction','liquid'].map(type=>pipeState(edge,type)))};refresh();
    for(let iteration=0;iteration<400;iteration++){let changed=false;for(const row of rows)if(row.velocityMS>maxVelocity*(1+1e-9)){const key=`${row.edgeId}:${row.type}`,next=selected.get(key)+1;if(!manual.get(key)&&next<sizes.length){selected.set(key,next);changed=true}}if(changed){refresh();continue}
      const circuits=graph.terminals.map(node=>({node,edges:routeTo(node.id)})).map(circuit=>({...circuit,drop:circuit.edges.reduce((sum,edge)=>sum+rows.filter(row=>row.edgeId===edge.id).reduce((subtotal,row)=>subtotal+row.pressureDropPa,0),0)})).sort((a,b)=>b.drop-a.drop),critical=circuits[0];if(!critical||critical.drop<=pressureLimit*(1+1e-9))break;
      const candidates=critical.edges.flatMap(edge=>['suction','liquid'].map(type=>({edge,type,row:rows.find(item=>item.edgeId===edge.id&&item.type===type)}))).filter(item=>!manual.get(`${item.edge.id}:${item.type}`)&&selected.get(`${item.edge.id}:${item.type}`)<sizes.length-1).sort((a,b)=>b.row.pressureDropPa-a.row.pressureDropPa);if(!candidates.length)break;const item=candidates[0],key=`${item.edge.id}:${item.type}`;selected.set(key,selected.get(key)+1);refresh()}
    const totalCoolingKW=graph.terminals.reduce((sum,node)=>sum+Number(node.coolingKW),0),designCoolingKW=simultaneity*totalCoolingKW+(1-simultaneity)*Math.max(...graph.terminals.map(node=>Number(node.coolingKW))),endpoints=graph.terminals.map(node=>{const edges=routeTo(node.id),drop=edges.reduce((sum,edge)=>sum+rows.filter(row=>row.edgeId===edge.id).reduce((subtotal,row)=>subtotal+row.pressureDropPa,0),0),massFlow=Number(node.coolingKW)*1000/(meanCp*deltaT);return {id:node.id,name:node.name,coolingKW:Number(node.coolingKW),flowKgS:massFlow,flowM3H:massFlow/supplyProps.densityKgM3*3600,pressureDropKPa:drop/1000,edgeIds:edges.map(edge=>edge.id)}});
    const issues=[];for(const row of rows)if(row.velocityMS>maxVelocity*(1+1e-9))issues.push({type:'velocity',severity:'critical',edgeId:row.edgeId,targetId:graph.order.find(id=>parentEdge.get(id)?.id===row.edgeId),message:`${row.type==='suction'?'Vorlauf':'Rücklauf'}: Geschwindigkeit ${row.velocityMS.toFixed(2)} m/s überschreitet ${maxVelocity.toFixed(2)} m/s.`});
    const worst=endpoints.reduce((a,b)=>b.pressureDropKPa>a.pressureDropKPa?b:a,endpoints[0]);if(worst&&worst.pressureDropKPa>pressureLimit/1000*(1+1e-9))issues.push({type:'secondary-pressure',severity:'critical',targetId:worst.id,edgeIds:worst.edgeIds,message:`Ungünstigster Kreis ${worst.name}: ${worst.pressureDropKPa.toFixed(1)} kPa überschreiten die Druckverlustgrenze von ${(pressureLimit/1000).toFixed(1)} kPa.`});
    const totalPipeVolumeM3=rows.reduce((sum,row)=>{const size=sizes.find(item=>idOf(item)===row.sizeId),diameter=diOf(size);return sum+Math.PI*diameter*diameter/4*row.lengthM},0);
    const meanDensity=(supplyProps.densityKgM3+returnProps.densityKgM3)/2;
    const productMassInPipesKg=fluidInfo.manufacturer?totalPipeVolumeM3*concentration/100*fluidInfo.concentrateDensityKgM3:0;
    const glycolMassInPipesKg=fluidInfo.manufacturer?0:totalPipeVolumeM3*meanDensity*concentration/100;
    return {valid:issues.length===0,issues,rows,endpoints,fluid:fluidInfo.name,mode:'secondary',totalCoolingKW,settings:{...settings},secondary:{fluid,productName:fluidInfo.name,concentrationPercent:concentration,concentrationBasis:fluidInfo.basis,concentrationMassPercent:fluidInfo.manufacturer?null:concentration,deltaT,supplyC,returnC,meanCpJKgK:meanCp,designCoolingKW,totalMassFlowKgS:designCoolingKW*1000/(meanCp*deltaT),totalVolumeFlowM3H:designCoolingKW*1000/(meanCp*deltaT)/supplyProps.densityKgM3*3600,totalPipeVolumeL:totalPipeVolumeM3*1000,glycolMassInPipesKg,productMassInPipesKg,freezeTemperatureC:freezeC,pressureDropLimitKPa:pressureLimit/1000,worstCircuitPressureDropKPa:worst?.pressureDropKPa||0,pipeSeries:series.label,fluidSource:supplyProps.source}};
  }
  function calculate(project, calibration, settings, data, catalog) {
    if(settings?.mode==='secondary')return calculateSecondary(project,calibration,settings,data,catalog);
    const graph=analyze(project,calibration), f=settings.fluid;
    if(!fluids.has(f)) fail('Kältemittel nicht unterstützt.');
    const n=(key,label,min,max=Infinity)=>{const v=Number(settings[key]);if(!Number.isFinite(v)||v<min||v>max)fail(`${label} ist außerhalb des zulässigen Bereichs.`);return v;};
    const simultaneity=n('simultaneity','Gleichzeitigkeit',0,1), te=n('evaporationC','Verdampfung',-60,30), tc=n('condensationC','Verflüssigung',-60,70), sh=n('superheatK','Überhitzung',0.1,40), sc=n('subcoolingK','Unterkühlung',0.1,40);
    const limS=n('suctionLimitK','Druckverlustgrenze SL',0.01,30), limL=n('liquidLimitK','Druckverlustgrenze FL',0.01,30), vmax=n('maxVelocityMS','Sauggasgeschwindigkeit max.',0.1,40), vmin=n('minVelocityMS','Mindestgeschwindigkeit',0,30), ps=n('designPressureBar','Auslegungsdruck',1,200), rough=n('roughnessMicroM','Rauheit',0,100)*1e-6, fittings=n('fittingsFactor','Einbautenzuschlag',1,10), margin=1+n('viscosityMarginPercent','Viskositätszuschlag',0,99)/100;
    if(f==='R744' && tc+273.15>=304.1282) fail('Transkritisches R744 wird in dieser Version nicht ausgelegt.');
    data=root.RohrnetzFastData?.create(data,settings)||data;
    const rootP=data.saturationAtTemperature(f,te+273.15).dewPressurePa, liquidP=data.saturationAtTemperature(f,tc+273.15).bubblePressurePa, liquidT=tc+273.15-sc;
    const liquidPhaseLimit=data.saturationAtTemperature(f,liquidT).bubblePressurePa;
    // PT-Stoffwerte sind am exakten Sättigungsdruck nicht eindeutig (Flüssigkeit/Dampf).
    const liquidPhaseGuard=liquidPhaseLimit*(1+1e-5);
    const series=catalog.series.find(s=>s.id===(f==='R744'?'k65-inch-120bar':'cuprofrio-metric'));
    if(!series)fail('Für diesen Kältemittelkreis fehlt ein Rohrkatalog.');
    const sizes=series.sizes.filter(s=>(s.catalogBar??120)>=ps+1.01325 && diOf(s)>0).sort((a,b)=>diOf(a)-diOf(b));
    if(!sizes.length)fail('Keine Rohrgröße erfüllt den Auslegungsdruck.');
    const parentEdge=new Map(), children=new Map(graph.nodes.map(x=>[x.id,[]]));
    for(let i=1;i<graph.order.length;i++) {const id=graph.order[i],p=graph.parent.get(id),edge=p.edge;parentEdge.set(id,edge);children.get(p.id).push(id);}
    const down=new Map();
    for(let i=graph.order.length-1;i>=0;i--){const id=graph.order[i],node=graph.byId.get(id);let q=node.type==='endpoint'?Number(node.coolingKW)*1000:0;for(const c of children.get(id))q+=down.get(c);down.set(id,q);}
    const edges=graph.edges, selected=new Map(), terminalsByEdge=new Map(edges.map(e=>[e.id,[]]));
    for(const end of graph.terminals)for(const edgeId of pathTo(end.id))terminalsByEdge.get(edgeId).push(end.id);
    for(const e of edges) for(const type of ['suction','liquid']) selected.set(`${e.id}:${type}`, e.thermal?.[type]?.mode==='manual' ? (sizes.find(s=>idOf(s)===e.thermal[type].sizeId)||fail(`${e.label||'Leitung'}: manuelle Rohrgröße ist für den Auslegungsdruck nicht verfügbar.`)) : sizes[0]);
    const h0v=data.state(f,'H','P',rootP,'T',data.saturationAtPressure(f,rootP).dewK+sh), h0l=data.state(f,'H','P',liquidP,'T',liquidT), baseLift=h0v-h0l;
    if(!(baseLift>0))fail('Verdampfer-Enthalpiedifferenz ist nicht positiv.');
    const baseGas=data.hydraulicPt(f,rootP,data.saturationAtPressure(f,rootP).dewK+sh), maxTerminalFlow=new Map();
    for(let i=graph.order.length-1;i>=0;i--){const id=graph.order[i],node=graph.byId.get(id);let flow=node.type==='endpoint'?Number(node.coolingKW)*1000/baseLift:0;for(const c of children.get(id))flow=Math.max(flow,maxTerminalFlow.get(c));maxTerminalFlow.set(id,flow);}
    for(const e of edges){const child=graph.order.find(id=>parentEdge.get(id)?.id===e.id),total=down.get(child)/baseLift,maxFlow=simultaneity*total+(1-simultaneity)*maxTerminalFlow.get(child);if(e.thermal?.suction?.mode!=='manual'){const first=sizes.find(size=>maxFlow/(baseGas.densityKgM3*Math.PI*diOf(size)**2/4)<=vmax);if(first)selected.set(`${e.id}:suction`,first);}}
    for(const edge of edges)if(edge.suctionRiser&&Number(edge.riserLengthM)>0&&edge.riserSizeId){const riser=sizes.find(size=>idOf(size)===edge.riserSizeId);if(!riser)fail(`${edge.label||'Steigleitung'}: Rohrgröße der Steigleitung ist für den Auslegungsdruck nicht verfügbar.`);const key=`${edge.id}:suction`;if(diOf(selected.get(key))<diOf(riser)){if(edge.thermal?.suction?.mode==='manual')fail(`${edge.label||'Steigleitung'}: Steigleitung darf nicht größer als das Saugrohr sein.`);selected.set(key,riser)}}
    const flowsFor=target=>{const q=new Map();for(let i=graph.order.length-1;i>=0;i--){const id=graph.order[i],nd=graph.byId.get(id);let watts=nd.type==='endpoint'?Number(nd.coolingKW)*1000*(id===target?1:simultaneity):0;for(const c of children.get(id))watts+=q.get(c)*baseLift;q.set(id,watts/baseLift);}return q;};
    function fluidProps(type,p){
      try{const sat=data.saturationAtPressure(f,p);
        if(type==='suction')return data.hydraulicPt(f,p,sat.dewK+sh);
        return data.hydraulicPt(f,p,liquidT);
      }catch(error){throw new Error(`${error.message} (${type}, ${Number(p).toPrecision(5)} Pa)`);}
    }
    function segment(edge,type,flow,p,size){
      if(flow<=0)return {drop:0,v:0,vMin:0,pOut:p,props:fluidProps(type,p)};
      const riserLength=type==='suction'&&edge.suctionRiser?(Number(edge.riserLengthM)||0):0,len=edge._lengthM+riserLength,zeta=Number(edge.zeta)||0;
      const riserSize=edge.riserSizeId?sizes.find(candidate=>idOf(candidate)===edge.riserSizeId):size;
      if(riserLength>0&&!riserSize)fail(`${edge.label||'Steigleitung'}: Rohrgröße der Steigleitung ist für den Auslegungsdruck nicht verfügbar.`);
      const parts=riserLength>0?[{length:riserLength,size:riserSize,riser:true},...(edge._lengthM>0?[{length:edge._lengthM,size,riser:false}]:[])]:[{length:len,size,riser:false}];
      let pressure=p,drop=0,vmaxSeen=0,vminSeen=Infinity,mainVMax=0,riserVMin=Infinity,riserVMax=0,latest,phaseRisk=false;
      for(const part of parts){
        const d=diOf(part.size),area=Math.PI*d*d/4,steps=type==='suction'?8:4,share=len>0?part.length/len:1;
        for(let j=0;j<steps;j++){
          latest=fluidProps(type,pressure);const rho=latest.densityKgM3,mu=latest.viscosityPaS*margin;
          if(!(rho>0&&mu>0))fail('Ungültige Stoffwerte im Rohrabschnitt.');
          const velocity=flow/(rho*area),re=rho*velocity*d/mu,ff=frictionFactor(re,rough,d),dynamic=.5*rho*velocity*velocity;
          const dz=(Number(edge.thermal?.[type]?.deltaZ)||0)*share/steps;
          const dp=(ff*part.length/steps/d*fittings+zeta*share/steps)*dynamic+rho*G*dz;
          drop+=dp;vmaxSeen=Math.max(vmaxSeen,velocity);vminSeen=Math.min(vminSeen,velocity);
          if(part.riser){riserVMin=Math.min(riserVMin,velocity);riserVMax=Math.max(riserVMax,velocity)}else mainVMax=Math.max(mainVMax,velocity);
          const nextPressure=pressure-dp;
          if(type==='liquid'&&nextPressure<=liquidPhaseGuard){pressure=liquidPhaseGuard;phaseRisk=true;break;}
          if(nextPressure<=1000){pressure=1000;phaseRisk=true;break;}
          pressure=nextPressure;
        }
        if(phaseRisk)break;
      }
      return {drop,v:vmaxSeen,vMin:vminSeen,mainVMax,riserVMin,riserVMax,pOut:pressure,props:latest,phaseRisk};
    }
    const scenarios=[];
    function solveScenario(target, retain=false){
      let massByNode=flowsFor(target), suctionP=new Map([[graph.start.id,rootP]]), liquidPByNode=new Map([[graph.start.id,liquidP]]), lineResults=new Map(), converged=false;
      for(let iteration=0;iteration<12;iteration++){
        for(let i=graph.order.length-1;i>=0;i--){const id=graph.order[i],node=graph.byId.get(id);if(node.type!=='endpoint')massByNode.set(id,children.get(id).reduce((sum,c)=>sum+massByNode.get(c),0));}
        const liquidPByNode=new Map([[graph.start.id,liquidP]]), suc=new Map([[graph.start.id,rootP]]), line=new Map();
        for(let i=1;i<graph.order.length;i++){
          const id=graph.order[i], edge=parentEdge.get(id), pid=graph.parent.get(id).id, flow=massByNode.get(id), size=selected.get(`${edge.id}:liquid`), p=liquidPByNode.get(pid);
          const r=segment(edge,'liquid',flow,p,size);liquidPByNode.set(id,r.pOut);line.set(`${edge.id}:liquid`,{...r,flow,pIn:p});
        }
        for(let i=1;i<graph.order.length;i++){
          const id=graph.order[i],edge=parentEdge.get(id),pid=graph.parent.get(id).id,flow=massByNode.get(id),size=selected.get(`${edge.id}:suction`),out=suc.get(pid);
          let pin=Math.max(1001, out*1.001),r;
          for(let j=0;j<18;j++){r=segment(edge,'suction',flow,pin,size);const residual=pin-r.drop-out;if(Math.abs(residual)<Math.max(.5,pin*1e-8))break;pin=Math.max(1001,pin-residual*.75);}
          r=segment(edge,'suction',flow,pin,size);if(Math.abs(pin-r.drop-out)>Math.max(5,pin*1e-5))fail(`${edge.label||'Saugleitung'}: Druckrückrechnung konvergiert nicht.`);
          suc.set(id,pin);line.set(`${edge.id}:suction`,{...r,flow,pIn:pin,pOut:out});
        }
        let diff=0;
        for(const end of graph.terminals){const pS=suc.get(end.id),pL=liquidPByNode.get(end.id);let hs,hl;try{hs=data.state(f,'H','P',pS,'T',data.saturationAtPressure(f,pS).dewK+sh);hl=data.state(f,'H','P',pL,'T',liquidT);}catch(error){fail(`${end.name}: Stoffwerte am Endpunkt konnten nicht bestimmt werden: ${error.message}`)}const lift=hs-hl;if(!(lift>0))fail(`${end.name}: Enthalpiedifferenz nicht positiv.`);const next=Number(end.coolingKW)*1000/lift*(end.id===target?1:simultaneity);diff=Math.max(diff,Math.abs(next-massByNode.get(end.id))/Math.max(next,1e-12));massByNode.set(end.id,next);}
        suctionP=suc;
        lineResults=line;
        if(diff<1e-5){converged=true; break;}
      }
      if(!converged)fail(`${graph.byId.get(target).name}: Massenstrom und Druckzustand konvergieren nicht.`);
      const liquidEnd=new Map([[graph.start.id,liquidP]]);
      for(let i=1;i<graph.order.length;i++){const id=graph.order[i],edge=parentEdge.get(id),pid=graph.parent.get(id).id,pIn=liquidEnd.get(pid),r=segment(edge,'liquid',massByNode.get(id),pIn,selected.get(`${edge.id}:liquid`));liquidEnd.set(id,r.pOut);lineResults.set(`${edge.id}:liquid`,{...r,flow:massByNode.get(id),pIn});}
      for(let i=1;i<graph.order.length;i++){const id=graph.order[i],edge=parentEdge.get(id),pid=graph.parent.get(id).id,out=suctionP.get(pid),flow=massByNode.get(id);let pin=Math.max(1001,out+100),r;for(let j=0;j<25;j++){r=segment(edge,'suction',flow,pin,selected.get(`${edge.id}:suction`));const err=pin-r.drop-out;if(Math.abs(err)<Math.max(.5,pin*1e-8))break;pin=Math.max(1001,pin-err*.7);}r=segment(edge,'suction',flow,pin,selected.get(`${edge.id}:suction`));if(Math.abs(pin-r.drop-out)>Math.max(5,pin*1e-5))fail(`${edge.label||'Saugleitung'}: Druckrückrechnung konvergiert nicht.`);suctionP.set(id,pin);lineResults.set(`${edge.id}:suction`,{...r,flow,pIn:pin,pOut:out});}
      const endpoint=graph.byId.get(target), psEnd=suctionP.get(target),plEnd=liquidEnd.get(target),sK=data.saturationAtPressure(f,psEnd).dewK-data.saturationAtPressure(f,rootP).dewK,lK=data.saturationAtPressure(f,liquidP).bubbleK-data.saturationAtPressure(f,plEnd).bubbleK;
      const phaseRisk=pathTo(target).some(id=>lineResults.get(`${id}:liquid`)?.phaseRisk);
      const remaining=phaseRisk?0:data.saturationAtPressure(f,plEnd).bubbleK-liquidT;
      return {targetId:target,name:endpoint.name,evaporationC:data.saturationAtPressure(f,psEnd).dewK-273.15,coolingKW:Number(endpoint.coolingKW)||0,suctionK:sK,liquidK:lK,remainingSubcoolingK:remaining,suctionPressurePa:psEnd,liquidPressurePa:plEnd,lineResults,massByNode,suctionP,liquidEnd};
    }
    // Deterministic upgrade loop: evaluate whole-network endpoint cases, then grow the
    // pipe with the greatest weighted reduction on the currently failing path.
    const manual=new Set(edges.flatMap(e=>['suction','liquid'].filter(t=>e.thermal?.[t]?.mode==='manual').map(t=>`${e.id}:${t}`)));
    let finalScenarios=[], needsRecompute=false;
    // Bound the upgrade search by all possible catalog transitions in the network.
    const maxUpgradePasses=Math.max(1,edges.length*2*(sizes.length-1));
    for(let pass=0;pass<maxUpgradePasses;pass++){
      finalScenarios=graph.terminals.map(end=>solveScenario(end.id));
      needsRecompute=false;
      const rowByKey=new Map();for(const e of edges)for(const t of ['suction','liquid'])rowByKey.set(`${e.id}:${t}`,[]);
      for(const s of finalScenarios)for(const [key,r] of s.lineResults)rowByKey.get(key)?.push({scenario:s,result:r});
      const issues=[];
      for(const s of finalScenarios){if(s.suctionK>limS)issues.push({type:'suction',target:s.targetId,excess:s.suctionK/limS-1,path:new Set(pathTo(s.targetId))});if(s.liquidK>limL||s.remainingSubcoolingK<=0)issues.push({type:'liquid',target:s.targetId,excess:Math.max(s.liquidK/limL-1,s.remainingSubcoolingK<=0?1:0),path:new Set(pathTo(s.targetId))});}
      for(const issue of issues){let worst=0;for(const [key,r] of rowByKey)if(key.endsWith(issue.type)&&issue.path.has(key.slice(0,key.lastIndexOf(':'))))worst=Math.max(worst,r.find(x=>x.scenario.targetId===(issue.scenarioTarget??issue.target))?.result.v||0);if(issue.type==='suction'&&worst>vmax)issue.excess=Math.max(issue.excess,worst/vmax-1);}
      // velocity limits are checked on each full-load target scenario.
      for(const s of finalScenarios)for(const [key,r] of s.lineResults)if(key.endsWith(':suction')&&(edges.find(e=>e.id===key.slice(0,key.lastIndexOf(':')))?.riserSizeId?r.mainVMax:r.v)>vmax){const edgeId=key.slice(0,key.lastIndexOf(':')),affected=terminalsByEdge.get(edgeId)?.filter(id=>s.massByNode.get(id)>0)||[];if(affected.length)issues.push({type:'suction',target:affected[0],scenarioTarget:s.targetId,excess:(edges.find(e=>e.id===edgeId)?.riserSizeId?r.mainVMax:r.v)/vmax-1,path:new Set([edgeId])});}
      let worstIssue=issues.sort((a,b)=>b.excess-a.excess)[0];if(!worstIssue)break;
      const keys=[...rowByKey.keys()].filter(key=>key.endsWith(worstIssue.type)&&worstIssue.path.has(key.slice(0,key.lastIndexOf(':')))&&!manual.has(key));
      let best=null;
      for(const key of keys){const current=selected.get(key),ix=sizes.indexOf(current);if(ix<0||ix>=sizes.length-1)continue;const candidates=rowByKey.get(key).filter(x=>x.scenario.targetId===(worstIssue.scenarioTarget??worstIssue.target));const drop=candidates.reduce((sum,x)=>sum+x.result.drop,0);const edgeId=key.slice(0,key.lastIndexOf(':'));const edge=edges.find(e=>e.id===edgeId);const length=edge._lengthM||1;const score=drop/Math.max(length,0.1)/(diOf(sizes[ix+1])**2/diOf(current)**2-1);if(!best||score>best.score)best={key,score,ix};}
      if(!best)break;
      const factor=Math.max(1.05,Math.pow(1+worstIssue.excess,.2)),targetDiameter=diOf(sizes[best.ix])*factor;
      let targetIndex=best.ix+1;while(targetIndex<sizes.length-1&&diOf(sizes[targetIndex])<targetDiameter)targetIndex++;
      selected.set(best.key,sizes[targetIndex]);
      needsRecompute=true;
    }
    if(needsRecompute)finalScenarios=graph.terminals.map(end=>solveScenario(end.id));
    const issues=[], velocityByEdge=new Map();
    const directEdgeIds=(s,type,limit)=>pathTo(s.targetId).filter(id=>{const r=s.lineResults.get(`${id}:${type}`);return r&&Math.abs(data.saturationAtPressure(f,r.pIn).dewK-data.saturationAtPressure(f,r.pOut).dewK)>limit+1e-6});
    for(const s of finalScenarios){const targetPath=new Set(pathTo(s.targetId));if(s.suctionK>limS+1e-6)issues.push({targetId:s.targetId,type:'suction',edgeIds:directEdgeIds(s,'suction',limS),message:`${s.name}: Druckverlust SL ${s.suctionK.toFixed(2)} K überschreitet ${limS} K.`});if(s.liquidK>limL+1e-6)issues.push({targetId:s.targetId,type:'liquid',edgeIds:directEdgeIds(s,'liquid',limL),message:`${s.name}: Druckverlust FL ${s.liquidK.toFixed(2)} K überschreitet ${limL} K.`});if(s.remainingSubcoolingK<=0)issues.push({targetId:s.targetId,type:'phase',edgeIds:pathTo(s.targetId).filter(id=>s.lineResults.get(`${id}:liquid`)?.phaseRisk),message:`${s.name}: Flüssigkeit erreicht die Phasengrenze.`});for(const [key,r] of s.lineResults){if(key.endsWith(':suction')&&r.v>vmax+1e-6){const edgeId=key.slice(0,key.lastIndexOf(':')),current=velocityByEdge.get(edgeId)||{velocity:0,targetIds:new Set()};current.velocity=Math.max(current.velocity,r.v);if(targetPath.has(edgeId))current.targetIds.add(s.targetId);velocityByEdge.set(edgeId,current)}const edge=edges.find(e=>e.id===key.slice(0,key.lastIndexOf(':'))),riserVelocity=r.riserVMin;if(key.endsWith(':suction')&&targetPath.has(edge?.id)&&edge?.suctionRiser&&Number(edge.riserLengthM)>0&&riserVelocity<vmin-1e-6){const critical=riserVelocity<5-1e-6;issues.push({targetId:s.targetId,edgeId:edge.id,type:'oil-return',severity:critical?'critical':'check',message:`${s.name} · ${edge.label||'Rohrstrecke '+(graph.byId.get(edge.from)?.name||edge.from)+' ↔ '+(graph.byId.get(edge.to)?.name||edge.to)}: Steigleitung ${riserVelocity.toFixed(1)} m/s – ${critical?'kritisch (unter 5 m/s)':'prüfen (unter '+vmin+' m/s)'}.`});}}}
    for(const [edgeId,{velocity,targetIds}] of velocityByEdge){const edge=edges.find(e=>e.id===edgeId),label=edge.label||`Leitung ${graph.byId.get(edge.from)?.name||edge.from} ↔ ${graph.byId.get(edge.to)?.name||edge.to}`;issues.push({edgeId,targetIds:[...targetIds],type:'velocity',message:`${label}: Sauggasgeschwindigkeit ${velocity.toFixed(1)} m/s überschreitet ${vmax} m/s.`})}
    const rows=[];for(const edge of edges)for(const type of ['suction','liquid']){const runs=finalScenarios.map(s=>({s,r:s.lineResults.get(`${edge.id}:${type}`)})).filter(x=>x.r);const r=runs.reduce((best,x)=>x.r.drop>best.drop?x.r:best,runs[0]?.r);if(!r)continue;const size=selected.get(`${edge.id}:${type}`),pUp=Math.max(1000,r.pIn),pDown=Math.max(1000,r.pOut);const dT=Math.abs(data.saturationAtPressure(f,pUp).dewK-data.saturationAtPressure(f,pDown).dewK);rows.push({edgeId:edge.id,type,sizeId:idOf(size),sizeLabel:sizeLabelOf(size),diameterMm:diOf(size)*1000,lengthM:edge._lengthM+(edge.suctionRiser&&type==='suction'?(Number(edge.riserLengthM)||0):0),riserLengthM:edge.suctionRiser&&type==='suction'?(Number(edge.riserLengthM)||0):0,riserSizeId:edge.suctionRiser&&type==='suction'?(edge.riserSizeId||idOf(size)):null,riserVelocityMinMS:type==='suction'&&edge.suctionRiser?Math.min(...runs.filter(x=>pathTo(x.s.targetId).includes(edge.id)).map(x=>x.r.riserVMin??Infinity)):null,flowKgS:r.flow,flowKgH:r.flow*3600,powerKW:r.flow*baseLift/1000,evaporationTemperatureC:data.saturationAtPressure(f,r.pIn).dewK-273.15,liquidTemperatureC:liquidT-273.15,velocityMS:r.v,pressureDropPa:r.drop,pressureDropBar:r.drop/1e5,temperatureDropK:dT,manual:manual.has(`${edge.id}:${type}`),psBar:size.catalogBar??120,branchCount:runs.length});}
    const valid=issues.length===0;
    return {valid,issues,rows,endpoints:finalScenarios.map(s=>({id:s.targetId,name:s.name,evaporationC:s.evaporationC,coolingKW:s.coolingKW,suctionK:s.suctionK,liquidK:s.liquidK,remainingSubcoolingK:s.remainingSubcoolingK,suctionPressureBar:s.suctionPressurePa/1e5,liquidPressureBar:s.liquidPressurePa/1e5})),totalCoolingKW:graph.terminals.reduce((a,e)=>a+Number(e.coolingKW),0),fluid:f,settings:{...settings},model:{name:'RohrRunner stationär',refrigerant:f,assumptions:['Einphasige, stationäre Strömung',...(['R134A','R404A','R407C','R449A','R452A'].includes(f)?['CoolProp 8.0.0 Modellwerte ohne produktbezogene Viskositätsvalidierung']:[]),'Nicht eingetragene Höhendifferenzen werden als 0 m angenommen','Flüssigkeitstemperatur bleibt entlang des Strangs konstant','Unterkritisches R744; keine Druckgasleitung','Gleichzeitigkeit als eigener Endpunkt-Lastfall','Automatische Rohrwahl ist eine begrenzte Heuristik, kein globales Kostenoptimum','Herstellerdaten und Einbauverantwortung separat prüfen']}};
    function pathTo(id){const out=[];while(id!==graph.start.id){const p=graph.parent.get(id);out.push(p.edge.id);id=p.id;}return out;}
  }
  root.RohrRunnerEngine={calculate,analyze,frictionFactor,diameter:diOf,sizeLabel:sizeLabelOf};
})(typeof self!=='undefined'?self:globalThis);
