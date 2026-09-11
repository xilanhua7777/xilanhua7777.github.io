(function(global){
  'use strict';
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  class HistoryEngine{
    constructor(nodes,sources,routes){this.nodes=Object.fromEntries(nodes.map(n=>[n.nodeId,n]));this.sources=Object.fromEntries(sources.map(s=>[s.id,s]));this.routes=routes;this.enteredAt=0;this.current=null}
    enter(nodeId){this.current=nodeId;this.enteredAt=performance.now();return this.view(nodeId,0)}
    depth(elapsedMs=performance.now()-this.enteredAt){return elapsedMs>=8000?3:elapsedMs>=3000?2:1}
    view(nodeId=this.current,elapsedMs=performance.now()-this.enteredAt){const n=this.nodes[nodeId];if(!n)return null;const valid=n.truthLevel!=='DOCUMENTED'||(n.sourceIds||[]).some(id=>this.sources[id]);if(!valid){console.warn('DOCUMENTED history hidden: missing source',nodeId);return null}const depth=this.depth(elapsedMs);return{...n,depth,text:depth===1?n.oneLook:depth===2?n.story:n.historyEcho||n.story,sources:(n.sourceIds||[]).map(id=>this.sources[id]).filter(Boolean)}}
    semantic(nodeId){const s=this.nodes[nodeId]?.semanticLayer||{};return{energyFactor:clamp(s.energy||1,.85,1.15),reverbAdd:clamp(s.reverb||0,-.15,.25),densityFactor:clamp(s.density||1,.75,1.25),silenceLeadMs:clamp(s.silenceLeadMs||0,0,1200),fragmentation:clamp(s.fragmentation||0),crowd:clamp(s.crowd||0),timePulse:clamp(s.timePulse||0),ritual:clamp(s.ritual||0),intimacy:clamp(s.intimacy||0)}}
    match(profile){
      const order=profile.routeOrder.map(i=>'N'+String(11-i).padStart(2,'0')),seen=new Set(order),res=profile.resonantNode;
      let best=null;
      this.routes.filter(r=>r.type.includes('route')).forEach(r=>{const mapped=r.nodes.filter(n=>!n.gap).map(n=>typeof n==='string'?n:n.id),hit=mapped.filter(n=>seen.has(n));if(hit.length<2)return;const overlap=hit.length/mapped.length;let pairs=0;for(let i=1;i<hit.length;i++)if(order.indexOf(hit[i])>order.indexOf(hit[i-1]))pairs++;const orderSimilarity=hit.length<2?0:pairs/(hit.length-1),dwellAffinity=hit.reduce((a,id)=>a+(profile.dwellByNode[11-Number(id.slice(1))]||0),0)/Math.max(1,profile.dwellByNode.reduce((a,b)=>a+b,0)),bonus=mapped.includes(res)?1:0,score=.5*overlap+.25*orderSimilarity+.15*Math.min(1,dwellAffinity*3)+.1*bonus;if(score>=.55&&(!best||score>best.score))best={type:'route',id:r.id,score:+score.toFixed(3),label:r.label,truthLevel:r.truthLevel,sourceIds:r.sourceIds,nodes:r.nodes,matchedNodes:hit,explanation:`你经过的 ${hit.map(id=>this.nodes[id]?.oneLook?.split('｜')[0]||id).join('、')} 与这条历史礼序重合。`}});
      if(best)return best;let sceneBest=null;this.routes.filter(r=>!r.type.includes('route')).forEach(r=>{const mapped=r.nodes.map(n=>typeof n==='string'?n:n.id),hit=mapped.filter(n=>seen.has(n)),resonant=mapped.includes(res);if(!resonant)return;const dwell=hit.reduce((a,id)=>a+(profile.dwellByNode[11-Number(id.slice(1))]||0),0),score=.7+.2*Math.min(1,hit.length/mapped.length)+.1*Math.min(1,dwell/8000);if(!sceneBest||score>sceneBest.score)sceneBest={type:'scene',id:r.id,score:+score.toFixed(3),label:r.label,truthLevel:r.truthLevel,sourceIds:r.sourceIds,nodes:r.nodes,matchedNodes:hit,explanation:`你的共鸣建筑落在“${r.label}”发生的空间。`}});return sceneBest||{type:'none',id:null,score:0,label:'自由演奏',nodes:[],matchedNodes:[],explanation:'你的路线更接近一次自由演奏。'}
    }
  }
  global.AxisHistory=HistoryEngine;
})(window);
