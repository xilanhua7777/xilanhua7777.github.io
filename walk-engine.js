(function(global){
  'use strict';
  const rad=d=>d*Math.PI/180;
  const distance=(a,b)=>{const R=6371000,dLat=rad(b.lat-a.lat),dLng=rad(b.lng-a.lng),x=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLng/2)**2;return 2*R*Math.asin(Math.sqrt(x))};
  class WalkEngine{
    constructor(nodes,hooks={}){this.nodes=nodes;this.hooks=hooks;this.watchId=null;this.candidate=null;this.candidateAt=0;this.arrived=[];this.routeOrder=[];this.lastPosition=null;this.motionActive=false}
    setRoute(nodeIds=[]){this.routeOrder=[...nodeIds];this.arrived=[];this.candidate=null;this.candidateAt=0}
    start(){if(!navigator.geolocation){this.hooks.onFallback?.('此浏览器不支持定位');return}this.watchId=navigator.geolocation.watchPosition(p=>this.onPosition(p),e=>this.hooks.onFallback?.(e.code===1?'定位已拒绝，已切换手动到达':'定位不稳定，请手动确认'),{enableHighAccuracy:true,maximumAge:3000,timeout:10000})}
    stop(){if(this.watchId!==null&&navigator.geolocation)navigator.geolocation.clearWatch(this.watchId);this.watchId=null;this.candidate=null;this.stopMotion()}
    onPosition(pos){const here={lat:pos.coords.latitude,lng:pos.coords.longitude,accuracy:pos.coords.accuracy,t:pos.timestamp};if(!Number.isFinite(here.accuracy)||here.accuracy>120){this.candidate=null;this.hooks.onFallback?.('定位精度不足，已切换手动到达');return}if(this.lastPosition){const dt=Math.max(1,(here.t-this.lastPosition.t)/1000),speed=distance(this.lastPosition,here)/dt;this.hooks.onRhythm?.({speed,source:'gps'})}this.lastPosition=here;const valid=this.nodes.filter(n=>n.verified&&Number.isFinite(n.lat)&&Number.isFinite(n.lng));if(!valid.length){this.hooks.onFallback?.('节点坐标尚未完成官方核验，请使用手动到达');return}const expectedId=this.routeOrder[this.arrived.length],ranked=valid.map(n=>({n,d:distance(here,n)})).filter(x=>x.d<=x.n.radiusM+Math.min(here.accuracy,80)).sort((a,b)=>{const ae=a.n.nodeId===expectedId?0:1,be=b.n.nodeId===expectedId?0:1;return ae-be||a.d-b.d});const next=ranked[0];if(!next){this.candidate=null;this.hooks.onApproach?.(null);return}if(this.candidate!==next.n.nodeId){this.candidate=next.n.nodeId;this.candidateAt=performance.now();this.hooks.onApproach?.(next.n,next.d);return}if(performance.now()-this.candidateAt>=3500)this.confirm(next.n.nodeId,'gps')}
    confirm(nodeId,source='manual'){if(this.arrived[this.arrived.length-1]===nodeId)return;this.arrived.push(nodeId);this.candidate=null;this.hooks.onArrived?.(nodeId,source);if(navigator.vibrate)navigator.vibrate(35)}
    async startMotion(){if(!global.DeviceMotionEvent)return false;if(typeof DeviceMotionEvent.requestPermission==='function'&&await DeviceMotionEvent.requestPermission()!=='granted')return false;this.motionHandler=e=>{const a=e.accelerationIncludingGravity;if(!a)return;const mag=Math.sqrt((a.x||0)**2+(a.y||0)**2+(a.z||0)**2);this.hooks.onRhythm?.({motion:Math.abs(mag-9.81),source:'motion'})};global.addEventListener('devicemotion',this.motionHandler);this.motionActive=true;return true}
    stopMotion(){if(this.motionHandler)global.removeEventListener('devicemotion',this.motionHandler);this.motionHandler=null;this.motionActive=false}
  }
  global.AxisWalk=WalkEngine;
})(window);
