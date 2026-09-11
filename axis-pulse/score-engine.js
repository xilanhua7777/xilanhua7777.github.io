(function(global){
  'use strict';
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const lerp=(a,b,t)=>a+(b-a)*t;
  const stable=value=>value&&typeof value==='object'?(Array.isArray(value)?'['+value.map(stable).join(',')+']':'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}'):JSON.stringify(value);
  const hash=text=>{let h=2166136261>>>0;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16).padStart(8,'0')};
  const PHRASE_MODEL='axis-theme-v1.0';

  // One public-domain Mo Li Hua phrase is the shared eight-beat master grid.
  // Every building is a restrained heterophonic variation, never a new random tune.
  const MOTHER={contour:[2,2,3,4,5,5,4,3,3,4,3],rhythm:[1,.5,.5,.5,.5,.5,.5,1,.5,.5,2]};
  const VARIATIONS={
    N11:{offset:-2,changes:{3:-1},rests:[1,5,8]},
    N10:{offset:-1,changes:{6:1}},
    N09:{offset:0,changes:{3:-1,9:1}},
    N08:{offset:1,changes:{6:-1}},
    N07:{offset:0,changes:{4:1,9:-1}},
    N06:{offset:0,changes:{3:1,7:1}},
    N05:{offset:-1,changes:{4:-1},rests:[1,3,5,8]},
    N04:{offset:1,changes:{3:-1,6:1}},
    N03:{offset:0,changes:{6:-1,9:1}},
    N02:{offset:-1,changes:{7:1},rests:[1,5,8]},
    N01:{offset:0,changes:{}}
  };
  const PHRASES=Object.fromEntries(Object.entries(VARIATIONS).map(([id,v])=>[id,{contour:MOTHER.contour.map((d,i)=>d+v.offset+(v.changes[i]||0)),rhythm:[...MOTHER.rhythm],rests:v.rests||[]}])) ;

  function phraseFor(nodeId,motif){
    const phrase=PHRASES[nodeId]||{contour:motif.contour||[0,2,1,0],rhythm:motif.rhythm||[1,1,1,2]};
    return{...phrase,phraseBeats:phrase.rhythm.reduce((a,b)=>a+b,0)};
  }

  function buildNodeRanges(nodes){
    const byX=[...nodes].sort((a,b)=>a.x-b.x);
    return byX.map((node,i)=>({nodeId:node.id,minX:i===0?0:(byX[i-1].x+node.x)/2,maxX:i===byX.length-1?1:(node.x+byX[i+1].x)/2}));
  }

  function pentatonicMidi(degree,register,root,pent){
    const octave=Math.floor(degree/pent.length),index=((degree%pent.length)+pent.length)%pent.length;
    return root+12*(register+octave)+pent[index];
  }

  function buildArchitectureScore({nodes,features,scoreConfig,scoreVersion='0.8.1'}){
    const pent=scoreConfig.pentatonic_semitones||[0,2,4,7,9],root=scoreConfig.root_midi||48;
    const motifs=scoreConfig.node_motifs||{};
    const nodeMap=Object.fromEntries(nodes.map(n=>[n.id,n]));
    const ranges=buildNodeRanges(nodes),events=[];
    const minX=Math.min(...nodes.map(n=>n.x)),maxX=Math.max(...nodes.map(n=>n.x));
    const journeyProgress=x=>clamp((maxX-x)/(maxX-minX));
    const localIndex=Object.fromEntries(nodes.map(n=>[n.id,0]));
    const rhythmPrefix={};
    nodes.forEach(node=>{
      const motif=motifs[node.id]||{};
      const rhythm=phraseFor(node.id,motif).rhythm;
      rhythmPrefix[node.id]=rhythm.map((_,i)=>rhythm.slice(0,i).reduce((a,b)=>a+b,0));
    });
    features.forEach((f,featureIndex)=>{
      const range=ranges.find(r=>f.x>=r.minX&&f.x<=r.maxX)||ranges.reduce((best,r)=>Math.abs(nodeMap[r.nodeId].x-f.x)<Math.abs(nodeMap[best.nodeId].x-f.x)?r:best,ranges[0]);
      const node=nodeMap[range.nodeId],motif=motifs[node.id]||{},phrase=phraseFor(node.id,motif),contour=phrase.contour,rhythm=phrase.rhythm;
      const local=localIndex[node.id]++,motifStep=local%contour.length,count=1+Math.round(f.density*3),subdivision=f.density>.75?4:f.density>.45?2:1;
      const register=clamp(Math.floor(f.span*2.65)+(motif.octave_bias||0),0,2);
      const geometryTurn=(f.center>.7?1:0)+(f.density>.76&&motifStep%3===2?1:0);
      const baseDegree=contour[motifStep]+geometryTurn;
      for(let sub=0;sub<count;sub++){
        const degree=baseDegree+(sub?Math.min(2,sub):0),pitch=pentatonicMidi(degree,register,root,pent);
        const harmony=f.symmetry>=.72?[pitch,pentatonicMidi(degree+2,register,root,pent),pentatonicMidi(degree+4,register,root,pent)]:f.symmetry>=.42?[pitch,pentatonicMidi(degree+2,register,root,pent)]:[pitch,pentatonicMidi(degree+1,register,root,pent)];
        const baseTime=journeyProgress(f.x),cell=1/Math.max(1,features.length-1),timeNorm=clamp(baseTime+sub*cell/count);
        const energy=node.narrative?.energy??.6;
        events.push({
          id:`SE-${node.id}-${String(featureIndex).padStart(3,'0')}-${sub}`,
          scoreVersion,timeNorm,nodeId:node.id,pitchMidi:pitch,durationBeats:lerp(.38,2.55,f.enclosure),velocity:clamp(.24+.32*f.density+.36*energy,.18,.98),
          harmony:[...new Set(harmony)],layer:'main',timbreRole:node.kind==='门'?'threshold_transient':'ritual_resonance',reverbSend:lerp(.12,.78,f.enclosure),bassWeight:lerp(.08,.65,f.center),subdivision,
          motifStep,phraseBeat:(rhythmPrefix[node.id][motifStep]||0)+sub*(rhythm[motifStep]||1)/count,phraseBeats:phrase.phraseBeats,subIndex:sub,
          melodicPriority:false,nodeMotif:motif.name||node.cn,nodeTempo:motif.tempo||76,nodeAccent:motif.accent||'qin',
          sourceGeometry:{density:f.density,span:f.span,enclosure:f.enclosure,symmetry:f.symmetry,center:f.center},
          semanticMod:{energy, silence:0, ritual:node.zone==='外朝'?.8:.3, intimacy:node.zone==='内廷'?.82:.12, fragmentation:0}
        });
      }
    });
    events.sort((a,b)=>a.timeNorm-b.timeNorm||a.id.localeCompare(b.id));
    nodes.forEach(node=>{
      const motif=motifs[node.id]||{},phrase=phraseFor(node.id,motif),nodeEvents=events.filter(e=>e.nodeId===node.id);
      if(!nodeEvents.length)return;
      const stats=['density','span','enclosure','symmetry','center'].reduce((out,key)=>{
        out[key]=nodeEvents.reduce((sum,e)=>sum+e.sourceGeometry[key],0)/nodeEvents.length;return out;
      },{});
      const register=stats.span>.72?1:0,energy=node.narrative?.energy??.6;
      phrase.contour.forEach((turn,step)=>{
        const candidates=nodeEvents.filter(e=>e.motifStep===step&&e.subIndex===0);
        const e=candidates[Math.floor(candidates.length/2)]||nodeEvents[Math.floor(nodeEvents.length*step/phrase.contour.length)];
        if(!e)return;
        const isCadence=step===phrase.contour.length-1,isAnswer=step>=Math.ceil(phrase.contour.length/2);
        const ornamentalTurn=!isCadence&&step>1&&step%4===2&&stats.density>.82?1:0;
        const degree=turn+ornamentalTurn,pitch=pentatonicMidi(degree,register,root,pent);
        const octaveShift=node.id==='N01'?12:0;
        e.pitchMidi=clamp(pitch+octaveShift,48,84);
        e.phraseBeat=rhythmPrefix[node.id][step]||0;
        e.phraseBeats=phrase.phraseBeats;
        e.durationBeats=phrase.rhythm[step]*lerp(.72,1.02,stats.enclosure);
        e.velocity=clamp((step===0?.72:isCadence?.68:isAnswer?.56:.61)*(.72+energy*.34),.28,.92);
        e.harmony=stats.symmetry>.7?[e.pitchMidi,pentatonicMidi(degree+3,register,root,pent)]:[e.pitchMidi];
        e.bassWeight=lerp(.12,.58,stats.center);
        e.melodicPriority=!phrase.rests.includes(step);
        e.phraseRole=step===0?'opening':isCadence?'cadence':isAnswer?'answer':'question';
        e.phraseModel=PHRASE_MODEL;
        e.architectureControl={...stats,ornamentalTurn};
      });
    });
    const geometry={nodes:nodes.map(n=>({id:n.id,x:n.x,kind:n.kind})),features,motifs,phrases:PHRASES,phraseModel:PHRASE_MODEL,scoreVersion};
    return{scoreVersion,scoreHash:hash(stable(geometry)),ranges,events};
  }

  global.AxisScore={buildNodeRanges,buildArchitectureScore,stableHash:value=>hash(stable(value))};
})(window);
