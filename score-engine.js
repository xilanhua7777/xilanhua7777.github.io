(function(global){
  'use strict';
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const lerp=(a,b,t)=>a+(b-a)*t;
  const stable=value=>value&&typeof value==='object'?(Array.isArray(value)?'['+value.map(stable).join(',')+']':'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}'):JSON.stringify(value);
  const hash=text=>{let h=2166136261>>>0;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16).padStart(8,'0')};
  const PHRASE_MODEL='molihua-through-composed-v2.0';

  // Public-domain Jiangsu folk-song contour. The six eight-beat lines form one
  // continuous 48-beat tune. Buildings never transpose or restart this lead;
  // architecture changes orchestration, dynamics, sustain and a quiet shadow.
  const MOLIHUA_LINES=[
    {id:'A',label:'好一朵美丽的茉莉花',degrees:[2,2,3,4,5,5,4,3,3],rhythm:[.5,.5,1,1,.5,.5,1,1,2]},
    {id:"A'",label:'好一朵美丽的茉莉花',degrees:[2,2,3,4,5,5,4,3,3],rhythm:[.5,.5,1,1,.5,.5,1,1,2]},
    {id:'B',label:'芬芳美丽满枝桠',degrees:[3,3,3,2,3,4,4,4,3],rhythm:[.5,.5,.5,.5,.5,.5,.5,.5,4]},
    {id:'C',label:'又香又白人人夸',degrees:[2,1,2,3,2,1,0,0],rhythm:[1,.5,.5,1,1,1,1,2]},
    {id:'D',label:'让我来将你摘下',degrees:[2,2,1,2,3,4,3,2,1],rhythm:[.5,.5,1,.5,.5,1,1,1,2]},
    {id:'E',label:'茉莉花呀茉莉花',degrees:[3,4,5,4,3,2,1,2,1,0],rhythm:[.5,.5,1,.5,.5,1,1,1,1,1]}
  ];
  const MOLIHUA_THEME=[];
  let themeBeat=0,themeStep=0;
  MOLIHUA_LINES.forEach((line,phraseIndex)=>line.degrees.forEach((degree,lineStep)=>{
    MOLIHUA_THEME.push({degree,duration:line.rhythm[lineStep],beat:themeBeat,step:themeStep++,lineStep,phraseIndex,phraseId:line.id,phraseLabel:line.label});
    themeBeat+=line.rhythm[lineStep];
  }));
  const THEME_BEATS=themeBeat;

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
    features.forEach((f,featureIndex)=>{
      const range=ranges.find(r=>f.x>=r.minX&&f.x<=r.maxX)||ranges.reduce((best,r)=>Math.abs(nodeMap[r.nodeId].x-f.x)<Math.abs(nodeMap[best.nodeId].x-f.x)?r:best,ranges[0]);
      const node=nodeMap[range.nodeId],motif=motifs[node.id]||{},local=localIndex[node.id]++,motifStep=local%MOLIHUA_THEME.length,count=1+Math.round(f.density*3),subdivision=f.density>.75?4:f.density>.45?2:1;
      const register=clamp(Math.floor(f.span*2.65)+(motif.octave_bias||0),0,2);
      const geometryTurn=(f.center>.7?1:0)+(f.density>.76&&motifStep%3===2?1:0);
      const baseDegree=MOLIHUA_THEME[motifStep].degree+geometryTurn;
      for(let sub=0;sub<count;sub++){
        const degree=baseDegree+(sub?Math.min(2,sub):0),pitch=pentatonicMidi(degree,register,root,pent);
        const harmony=f.symmetry>=.72?[pitch,pentatonicMidi(degree+2,register,root,pent),pentatonicMidi(degree+4,register,root,pent)]:f.symmetry>=.42?[pitch,pentatonicMidi(degree+2,register,root,pent)]:[pitch,pentatonicMidi(degree+1,register,root,pent)];
        const baseTime=journeyProgress(f.x),cell=1/Math.max(1,features.length-1),timeNorm=clamp(baseTime+sub*cell/count);
        const energy=node.narrative?.energy??.6;
        events.push({
          id:`SE-${node.id}-${String(featureIndex).padStart(3,'0')}-${sub}`,
          scoreVersion,timeNorm,nodeId:node.id,pitchMidi:pitch,durationBeats:lerp(.3,1.65,f.enclosure),velocity:clamp(.18+.24*f.density+.25*energy,.16,.72),
          harmony:[...new Set(harmony)],layer:'geometry',timbreRole:node.kind==='门'?'threshold_transient':'ritual_resonance',reverbSend:lerp(.1,.58,f.enclosure),bassWeight:lerp(.08,.65,f.center),subdivision,
          motifStep,phraseBeat:MOLIHUA_THEME[motifStep].beat+sub*MOLIHUA_THEME[motifStep].duration/count,phraseBeats:THEME_BEATS,subIndex:sub,
          melodicPriority:false,nodeMotif:motif.name||node.cn,nodeTempo:scoreConfig.theme_bpm||84,nodeAccent:motif.accent||'qin',
          sourceGeometry:{density:f.density,span:f.span,enclosure:f.enclosure,symmetry:f.symmetry,center:f.center},
          semanticMod:{energy, silence:0, ritual:node.zone==='外朝'?.8:.3, intimacy:node.zone==='内廷'?.82:.12, fragmentation:0}
        });
      }
    });
    events.sort((a,b)=>a.timeNorm-b.timeNorm||a.id.localeCompare(b.id));
    const journeyNodes=[...nodes].sort((a,b)=>b.x-a.x);
    const nodeStats={};
    nodes.forEach(node=>{
      const motif=motifs[node.id]||{},nodeEvents=events.filter(e=>e.nodeId===node.id);
      if(!nodeEvents.length)return;
      const stats=['density','span','enclosure','symmetry','center'].reduce((out,key)=>{
        out[key]=nodeEvents.reduce((sum,e)=>sum+e.sourceGeometry[key],0)/nodeEvents.length;return out;
      },{});
      nodeStats[node.id]=stats;
    });
    const themeEvents=MOLIHUA_THEME.map((note,step)=>{
      const progress=note.beat/THEME_BEATS,nodeIndex=Math.min(journeyNodes.length-1,Math.floor(progress*journeyNodes.length)),node=journeyNodes[nodeIndex],motif=motifs[node.id]||{},stats=nodeStats[node.id]||{density:.5,span:.5,enclosure:.5,symmetry:.5,center:.5},energy=node.narrative?.energy??.6;
      const pitch=pentatonicMidi(note.degree,1,root,pent),isOpening=note.lineStep===0,isCadence=note.lineStep===MOLIHUA_LINES[note.phraseIndex].degrees.length-1;
      const harmony=isCadence&&stats.symmetry>.58?[pitch,pentatonicMidi(note.degree+3,1,root,pent)]:[pitch];
      return{
        id:`TM-${String(step).padStart(3,'0')}`,scoreVersion,timeNorm:note.beat/THEME_BEATS,nodeId:node.id,pitchMidi:pitch,durationBeats:note.duration,velocity:clamp((isOpening?.72:isCadence?.7:.64)*(.78+energy*.24),.42,.88),
        harmony,layer:'theme',timbreRole:node.kind==='门'?'threshold_transient':'ritual_resonance',reverbSend:lerp(.12,.5,stats.enclosure),bassWeight:lerp(.12,.5,stats.center),subdivision:note.duration<1?2:1,
        motifStep:step,phraseBeat:note.beat,phraseBeats:THEME_BEATS,subIndex:0,melodicPriority:true,pureStep:true,nodeMotif:motif.name||node.cn,nodeTempo:scoreConfig.theme_bpm||84,nodeAccent:motif.accent||'qin',
        phraseIndex:note.phraseIndex,phraseId:note.phraseId,phraseLabel:note.phraseLabel,lineStep:note.lineStep,phraseRole:isOpening?'opening':isCadence?'cadence':note.phraseIndex<3?'question':'answer',phraseModel:PHRASE_MODEL,
        sourceGeometry:{...stats},semanticMod:{energy,silence:0,ritual:node.zone==='外朝'?.8:.3,intimacy:node.zone==='内廷'?.82:.12,fragmentation:0},architectureControl:{...stats,ornamentDensity:stats.density,shadowRegister:stats.span>.72?1:stats.span<.28?-1:0}
      };
    });
    events.push(...themeEvents);
    events.sort((a,b)=>a.timeNorm-b.timeNorm||a.id.localeCompare(b.id));
    const geometry={nodes:nodes.map(n=>({id:n.id,x:n.x,kind:n.kind})),features,motifs,theme:MOLIHUA_THEME,phraseModel:PHRASE_MODEL,scoreVersion};
    return{scoreVersion,scoreHash:hash(stable(geometry)),ranges,events,themeBeats:THEME_BEATS,themeLines:MOLIHUA_LINES.map(x=>({id:x.id,label:x.label,beats:x.rhythm.reduce((a,b)=>a+b,0)}))};
  }

  global.AxisScore={buildNodeRanges,buildArchitectureScore,stableHash:value=>hash(stable(value)),MOLIHUA_THEME,MOLIHUA_LINES,THEME_BEATS,PHRASE_MODEL};
})(window);
