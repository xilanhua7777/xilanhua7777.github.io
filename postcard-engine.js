(function(global){
  'use strict';
  const hash=s=>{let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0};
  class PostcardCollection{
    constructor(config){this.config=config;this.key=config.storage_key;this.state=this.load()}
    load(){try{const s=JSON.parse(localStorage.getItem(this.key));if(s&&Array.isArray(s.unlocked)&&s.draws)return s}catch(_){}return{unlocked:[],draws:{},completedAt:null}}
    save(){try{localStorage.setItem(this.key,JSON.stringify(this.state));return true}catch(_){return false}}
    draw(pulseId){if(this.state.draws[pulseId])return{item:this.item(this.state.draws[pulseId]),isNew:false,complete:this.complete()};const locked=this.config.items.filter(x=>!this.state.unlocked.includes(x.id)),pool=locked.length?locked:this.config.items,item=pool[hash(pulseId+'|POSTCARD-09')%pool.length],isNew=!this.state.unlocked.includes(item.id);this.state.draws[pulseId]=item.id;if(isNew)this.state.unlocked.push(item.id);if(this.complete()&&!this.state.completedAt)this.state.completedAt=new Date().toISOString();this.save();return{item,isNew,complete:this.complete()}}
    item(id){return this.config.items.find(x=>x.id===id)}
    getForPulse(pulseId){return this.item(this.state.draws[pulseId])||null}
    complete(){return this.state.unlocked.length>=this.config.items.length}
    summary(){return{unlocked:[...this.state.unlocked],count:this.state.unlocked.length,total:this.config.items.length,complete:this.complete(),completedAt:this.state.completedAt,reward:this.config.reward}}
  }
  global.AxisPostcards=PostcardCollection;
})(window);
