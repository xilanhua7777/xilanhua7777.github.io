(function(global){
  'use strict';
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const median=a=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.floor(s.length/2)]:0};
  class PerformanceEngine{
    constructor(nodes){this.nodes=nodes;this.reset()}
    reset(){this.startedAt=performance.now();this.current=-1;this.enteredAt=0;this.lastPos=null;this.samples=[];this.dwellByNode=Array(11).fill(0);this.visitCountByNode=Array(11).fill(0);this.slowdownByNode=Array(11).fill(0);this.speedSamples=[];this.speedBySegment=Array(11).fill(0);this.reversalCount=0;this.reversalSegments=[];this.echoMotifs=[];this.routeOrder=[];this.historyOpened=[];this.historyDepthByNode={}}
    enterNode(index,position,source='screen'){
      const now=performance.now(),from=this.current;this.leaveNode(now);
      if(from>=0&&index<from){this.reversalCount++;this.reversalSegments.push({from,to:index,atMs:Math.round(now-this.startedAt)})}
      if(this.visitCountByNode[index]>0)this.echoMotifs.push({nodeIndex:index,visit:this.visitCountByNode[index]+1,strength:+Math.min(.6,.4+this.visitCountByNode[index]*.08).toFixed(2)});
      this.current=index;this.enteredAt=now;this.visitCountByNode[index]++;this.routeOrder.push(index);this.record(position,now,source);
    }
    leaveNode(now=performance.now()){if(this.current>=0&&this.enteredAt){this.dwellByNode[this.current]+=Math.max(0,now-this.enteredAt);this.enteredAt=now}}
    record(position,t=performance.now(),source='screen'){
      if(this.lastPos){const dt=Math.max(16,t-this.lastPos.t),speed=Math.abs(position-this.lastPos.p)/(dt/1000);this.samples.push({t,p:position,speed,source});this.speedSamples.push(speed);const recent=this.speedSamples.slice(-5),smooth=clamp(median(recent),0,2);if(this.current>=0){this.speedBySegment[this.current]=smooth;this.slowdownByNode[this.current]=Math.max(this.slowdownByNode[this.current],1-clamp(smooth/.65))}}
      this.lastPos={t,p:position};
    }
    markHistory(nodeId,depth){if(!this.historyOpened.includes(nodeId))this.historyOpened.push(nodeId);this.historyDepthByNode[nodeId]=Math.max(this.historyDepthByNode[nodeId]||0,depth)}
    snapshot(){this.leaveNode();const unique=new Set(this.routeOrder),completionRate=unique.size/this.nodes.length,avg=this.speedSamples.length?this.speedSamples.reduce((a,b)=>a+b,0)/this.speedSamples.length:0;const p={startedAt:this.startedAt,durationMs:performance.now()-this.startedAt,dwellByNode:this.dwellByNode.map(Math.round),visitCountByNode:[...this.visitCountByNode],slowdownByNode:[...this.slowdownByNode],speedSamples:this.speedSamples.map(v=>+v.toFixed(3)),speedBySegment:this.speedBySegment.map(v=>+v.toFixed(3)),reversalCount:this.reversalCount,reversalSegments:this.reversalSegments.map(x=>({...x})),echoMotifs:this.echoMotifs.map(x=>({...x})),routeOrder:[...this.routeOrder],completionRate:+completionRate.toFixed(3),historyOpened:[...this.historyOpened],historyDepthByNode:{...this.historyDepthByNode}};p.resonantNode=this.resonantNode(p);p.performanceStyle=this.style(p,avg);return p}
    resonantNode(p){const maxD=Math.max(1,...p.dwellByNode),maxV=Math.max(1,...p.visitCountByNode);let best=0,score=-1;p.dwellByNode.forEach((d,i)=>{const s=.55*d/maxD+.25*p.visitCountByNode[i]/maxV+.2*p.slowdownByNode[i];if(s>score){score=s;best=i}});return this.nodes[best].id}
    style(p,avg){const maxD=Math.max(...p.dwellByNode),sum=p.dwellByNode.reduce((a,b)=>a+b,0)||1;if(p.reversalCount>=2||Math.max(...p.visitCountByNode)>=3)return'游弋';if(p.completionRate>.82&&p.reversalCount<=1)return'循礼';if(maxD/sum>.42&&maxD>3000)return'凝听';if(avg>.48)return'急行';return'徐行'}
  }
  global.AxisPerformance=PerformanceEngine;
})(window);
