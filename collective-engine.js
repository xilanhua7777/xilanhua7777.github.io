(function(global){
  'use strict';
  class CollectiveEngine{
    constructor(key='axisPulse.today.v1'){this.key=key}
    all(){try{return JSON.parse(localStorage.getItem(this.key)||'[]')}catch(_){return[]}}
    add(pulse){const day=new Date().toISOString().slice(0,10),all=this.all();all.push({date:day,resonantNode:pulse.resonantNode,style:pulse.performanceStyle,mainTimbre:pulse.mainTimbre,durationMs:pulse.performanceProfile.durationMs||0,historyCount:(pulse.performanceProfile.historyOpened||[]).length,nodeDwellNormalized:normalize(pulse.performanceProfile.dwellByNode),tempoProfile:pulse.performanceProfile.speedBySegment,scoreSignature:pulse.scoreHash});localStorage.setItem(this.key,JSON.stringify(all.slice(-500)));return this.summary(day)}
    summary(day=new Date().toISOString().slice(0,10)){const rows=this.all().filter(x=>x.date===day),counts={},timbres={};rows.forEach(r=>{counts[r.resonantNode]=(counts[r.resonantNode]||0)+1;timbres[r.mainTimbre]=(timbres[r.mainTimbre]||0)+1});return{date:day,count:rows.length,resonantNode:Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0]||null,styles:rows.reduce((o,r)=>(o[r.style]=(o[r.style]||0)+1,o),{}),topTimbre:Object.keys(timbres).sort((a,b)=>timbres[b]-timbres[a])[0]||null,averageDurationMs:rows.length?rows.reduce((a,r)=>a+(r.durationMs||0),0)/rows.length:0,historyOpenRate:rows.length?rows.filter(r=>r.historyCount>0).length/rows.length:0,traces:rows.map(r=>r.nodeDwellNormalized)}}
  }
  function normalize(a){const m=Math.max(1,...a);return a.map(v=>+((v||0)/m).toFixed(3))}
  global.AxisCollective=CollectiveEngine;
})(window);
