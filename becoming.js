(()=>{'use strict';const app=document.querySelector('#becoming-app');const canvas=app.querySelector('#view'),ctx=canvas.getContext('2d');const W=1120,H=760,CX=560,CY=380,N=120,TAU=Math.PI*2;const $=id=>id==='timeLabel'?document.querySelector('#timeLabel'):app.querySelector('#'+id);let seed=43129,random,tick=0,agents=[],walls=[],resources=[],zones=[],interior=[],events=[],snapshots=[],playing=true,acc=0,selected=null,viewState=null;const IX=28,IY=19,CELLW=W/IX,CELLH=H/IY;const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));function rng(s){return()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296}}function norm(a){return (a%N+N)%N}function angleIdx(x,y){return norm(Math.round(((Math.atan2(y-CY,x-CX)+TAU)%TAU)/TAU*N))}function wallRadius(i,ws=walls){let w=ws[norm(i)];return 320+w.shift-12*w.layer+8*w.wave*Math.sin(i*.43)+8*w.branch*Math.sin(i*.28)}function pos(i,ws=walls){let a=norm(i)/N*TAU,r=wallRadius(i,ws);return [CX+Math.cos(a)*r*1.48,CY+Math.sin(a)*r]}// Every region has a stable, irregular footprint. Geometry, exposure and rendering
// all use the same boundary function, so the visible region matches its effects.
function regionRadius(z,theta){
 const irregular=(.14*Math.sin(theta*3+z.phase)+.085*Math.sin(theta*5-z.phase*1.7)+.055*Math.sin(theta*8+z.phase*.7));
 return z.radius*(1+irregular*z.irregularity);
}
function regionDistance(z,x,y){
 const dx=(x-z.x)/1.48,dy=y-z.y,theta=Math.atan2(dy,dx);
 return Math.hypot(dx,dy)/Math.max(8,regionRadius(z,theta));
}
function regionPath(z,scale=1){ctx.beginPath();for(let j=0;j<=72;j++){
 const a=j/72*TAU,r=regionRadius(z,a)*scale;
 const x=z.x+Math.cos(a)*r*1.48,y=z.y+Math.sin(a)*r;
 if(j===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
 }ctx.closePath();}
function distanceToWall(a,ws=walls){let i=angleIdx(a.x,a.y),r=Math.hypot((a.x-CX)/1.48,a.y-CY);return wallRadius(i,ws)-r}
function stateCopy(){
 return {
  tick,
  agents:agents.map(a=>({...a})),
  walls:walls.map(w=>({...w})),
  resources:resources.slice(),
  interior:interior.map(c=>({...c,imprints:c.imprints.slice(),forms:c.forms.slice()})),
  zones:zones.map(z=>({...z,reprogram:z.reprogram?{...z.reprogram}:undefined})),
  events:events.slice(0,5).map(event=>({...event}))
 };
}
function init(newSeed=false){
 if(newSeed)seed+=10007;
 random=rng(seed);tick=0;nextId=1;agents=[];events=[];
 walls=Array.from({length:N},()=>({shift:0,branch:0,layer:0,wave:0,wear:0,contacts:0,shelter:0,corner:0}));
 resources=Array.from({length:24},()=>.78);zones=[];
 interior=Array.from({length:IX*IY},()=>({rest:0,social:0,exchange:0,wear:0,imprints:[0,0,0],forms:[0,0,0],lastType:-1}));
 for(let k=0;k<3;k++)for(let i=0;i<8;i++)spawn(k);
 snapshots=[stateCopy()];selected=null;viewState=null;playing=true;$('play').textContent='Pause';updateUI();
}
let nextId=1;
function spawn(type,parent=null){let a=random()*TAU,r=Math.sqrt(random())*210;let entity={id:nextId++,type,x:CX+Math.cos(a)*r*1.48,y:CY+Math.sin(a)*r,energy:parent?Math.max(.45,parent.energy*.5):.7+random()*.25,age:0,heading:random()*TAU,branch:parent?clamp(parent.branch+(random()-.5)*.10,.1,1):.19+random()*.20,coil:parent?clamp(parent.coil+(random()-.5)*.10,.1,1):.17+random()*.20,wave:parent?clamp(parent.wave+(random()-.5)*.10,.1,1):.17+random()*.20,compact:parent?parent.compact:.25,exposure:0,children:0,stress:0,nearShelter:0,adapt:0,rest:0,social:0,exchange:0,restMemory:0,socialMemory:0,exchangeMemory:0,trailX:0,trailY:0};agents.push(entity);return entity}
function addEvent(message){events.unshift({tick,message});events=events.slice(0,7)}
function step(){
 // Traces are temporary, local, and rewritten by subsequent inhabitants.
 for(const c of interior){
   if(!c.imprints)continue;
   for(let k=0;k<3;k++)c.imprints[k]*=.9991;
 }

 tick++;
 const bureaucracy=+$('bureaucracy').value/100,innovation=+$('innovation').value/100,abundance=+$('abundance').value/100,solidarity=+$('solidarity').value/100,adaptability=+$('adaptability').value/100,impermanence=+$('impermanence').value/100;
 const pressures=Array.from({length:N},()=>({push:0,branch:0,layer:0,wave:0,wear:0,contacts:0}));
 const births=[];
 const counts=[0,0,0];
 const occupancy=Array.from({length:24},()=>0);
 for(const a of agents){
  const sector=Math.floor(angleIdx(a.x,a.y)/N*24)%24;
  counts[a.type]++;
  occupancy[sector]++;
 }
 // Shared regenerative resources use the occupancy counts already needed
 // for movement, avoiding a second full population scan for each sector.
 resources=resources.map((r,i)=>clamp(r+.004+abundance*.013+Math.min(.006,occupancy[i]*.0006),0,1));
 const population=counts.slice();
 for(const a of agents){
  a.age++;
  let idx=angleIdx(a.x,a.y),dist=distanceToWall(a),sector=Math.floor(idx/N*24)%24;
  let w=walls[idx];
  let complexity=clamp(.45*w.branch+.55*w.layer+.6*w.wave+.55*w.corner,0,1.5);
  let shelter=clamp(w.shelter*.65+w.corner*.32+w.layer*.18,0,1);
  let near=dist<92,contact=clamp((92-dist)/92,0,1);
  let crowd=Math.max(0,occupancy[sector]-2)/7;
  let field={rest:0,social:0,exchange:0};for(const z of zones){let f=Math.max(0,1-regionDistance(z,a.x,a.y));field[z.kind]=Math.max(field[z.kind],f*z.strength)}
  a.rest=field.rest;a.social=field.social;a.exchange=field.exchange;
  // The avatar remembers time spent in a territory; time away slowly unlearns its influence. Immediate glow, vibration and neighbour attraction end on departure.
  // Memory is causal, bounded and reversible, not a clock-driven decorative animation.
  for(const kind of ['rest','social','exchange']){
    const key=kind+'Memory',old=a[key]||0,exposure=field[kind];
    a[key]=clamp(old+exposure*(.008+.020*adaptability)-(1-exposure)*(.00035+.00115*adaptability),0,1);
    if(old<.60&&a[key]>=.60)addEvent(`${['Grower','Builder','Mover'][a.type]} #${a.id} has spent enough time in ${kind} to develop a visible ${({social:['branching','satellite coils','parallel strands'],rest:['compact branches','spiral turns','gentle waves'],exchange:['dotted branch tips','open coils','fine wave rhythms']})[kind][a.type]} adaptation.`);
  }
  // An entity's memories now have consequences after leaving a region.
  // Rest is recuperative: a lasting movement bonus, even when the immediate slow/glow stops.
  // Exchange strengthens the entity's capacity to reshape both wall and interior.
  // Gather fosters lasting kin affinity, but exploration remains possible.
  const restGift=a.restMemory||0,exchangeGift=a.exchangeMemory||0,gatherGift=a.socialMemory||0;
  // Exchange memory is an architectural agency: sustained experience increases
  // both the strength and spatial reach of species-specific wall actions.
  const wallAgency=1+4.2*Math.pow(exchangeGift/.60,1.25);
  let avail=resources[sector];
  let taken=Math.min(avail,.010+.005*(a.type===0?a.branch:a.type===1?a.coil:a.wave));
  resources[sector]-=taken;
  // Shelter and shared resources affect comfort and form, but never survival or exclusion.
  let protection=near?shelter*contact:0;
  a.energy=clamp(a.energy+taken*(.7+protection*.75+field.exchange*.7)-(.0052-protection*.002),.35,1.6);
  a.nearShelter=protection;
  // Each territory is remembered by every species, but only its native geometry changes.
  // Memories remain independent, reversible and spatially earned.
  const density=clamp(crowd,0,1);
  const targetBranch=clamp(.10+.72*(a.type===0?a.socialMemory:(a.socialMemory*.25))+.05*complexity+.03*density,.06,.99);
  const targetCoil=clamp(.10+.72*(a.type===1?a.restMemory:(a.restMemory*.25))+.06*w.layer+.03*w.corner,.06,.99);
  const targetWave=clamp(.10+.72*(a.type===2?a.exchangeMemory:(a.exchangeMemory*.25))+.05*w.wave+.03*w.wear,.06,.99);
  a.branch+=clamp(targetBranch-a.branch,-(.007+.029*adaptability),.007+.029*adaptability);
  a.coil+=clamp(targetCoil-a.coil,-(.007+.029*adaptability),.007+.029*adaptability);
  a.wave+=clamp(targetWave-a.wave,-(.007+.029*adaptability),.007+.029*adaptability);
  const targetCompact=clamp(.18+.56*a.restMemory+.18*w.corner+.10*density,.1,.95);
  a.compact+=clamp(targetCompact-a.compact,-.008,.008);
  a.adapt+=Math.abs(targetBranch-a.branch)+Math.abs(targetCoil-a.coil)+Math.abs(targetWave-a.wave);
  if(near){
    a.exposure+=contact;
    for(let d=-2;d<=2;d++){
      let p=pressures[norm(idx+d)],factor=contact*(1-Math.abs(d)*.22)*wallAgency;
      p.contacts+=factor;
      if(a.type===0){p.push+=factor*(.13+a.branch*.35);p.branch+=factor*(.24+a.branch)}
      else if(a.type===1){p.layer+=factor*(.28+a.coil*.7);p.push-=factor*.13}
      else{p.wave+=factor*(.3+a.wave*.8);p.wear+=factor*(.25+a.wave*.5);p.push+=factor*.055}
    }
  }
  // Movement chooses among candidate headings based on local architecture, crowding and food.
  // Shelter attracts; density and local resources gently redistribute inhabitants without excluding them.
  let bestAngle=a.heading,bestScore=-1e10;
  for(let k=-2;k<=2;k++){
    let h=a.heading+k*.42+(random()-.5)*.19;
    let nx=a.x+Math.cos(h)*22*1.48,ny=a.y+Math.sin(h)*22;
    let ni=angleIdx(nx,ny),nd=distanceToWall({x:nx,y:ny}),ns=Math.floor(ni/N*24)%24;
    if(nd<12)continue;
    let nw=walls[ni],sh=clamp(nw.shelter*.65+nw.corner*.32+nw.layer*.18,0,1);
    let desirability=resources[ns]*1.3+sh*clamp((90-nd)/90,0,1)*(.45+a.compact*.5)-occupancy[ns]*.12;
    for(const z of zones){let f=Math.max(0,1-regionDistance(z,nx,ny))*z.strength;if(z.kind==='social')desirability+=f*(.10+.56*solidarity);if(z.kind==='exchange')desirability+=f*.19;if(z.kind==='rest')desirability+=f*.34;}desirability-=Math.abs(k)*.04;
    if(a.type===2)desirability+=Math.sin(h*3+tick*.06+a.id)*.06;
    if(desirability>bestScore){bestScore=desirability;bestAngle=h}
  }
  // Gathering: temporary sociability, never a trap. Each inhabitant has an
  // independent wandering impulse and a short-lived desire to explore away.
  // Close neighbours repel gently, preventing an immobile pile-up.
  a.socialStay=field.social>.10?(a.socialStay||0)+1:0;
  a.explore=a.explore||0;
  if(a.socialStay>90 && a.explore<=0){
    a.explore=80+Math.floor(random()*85);
    a.socialStay=0;
    a.escapeHeading=a.heading+Math.PI*(.55+random()*.9);
  }
  if((field.social>.03 || gatherGift>.08) && a.explore<=0){
    let sx=0,sy=0,sw=0,rx=0,ry=0;
    for(const other of agents){
      if(other.id===a.id)continue;
      const dx=(other.x-a.x)/1.48,dy=other.y-a.y,d=Math.hypot(dx,dy);
      if(d<115&&d>0.1){
        if(d<32){rx-=dx/d*(32-d)/32;ry-=dy/d*(32-d)/32;}
        else if(d>43){const kin=other.type===a.type?1+2.5*gatherGift:.28;const weight=(1-d/115)*Math.max(.12,other.social||0,gatherGift*.6)*kin;sx+=dx/d*weight;sy+=dy/d*weight;sw+=weight;}
      }
    }
    if(sw>.08){
      const socialHeading=Math.atan2(sy+ry*1.8,sx+rx*1.8);
      const turn=Math.atan2(Math.sin(socialHeading-bestAngle),Math.cos(socialHeading-bestAngle));
      bestAngle+=turn*clamp((field.social*.65+gatherGift*.33)*(.12+.60*solidarity),0,.34);
    }else if(Math.hypot(rx,ry)>.05){bestAngle=Math.atan2(ry,rx);}
  }
  if(a.explore>0){
    a.explore--;
    // Move toward a changing destination, not back toward the gathering center.
    const turn=Math.atan2(Math.sin(a.escapeHeading-bestAngle),Math.cos(a.escapeHeading-bestAngle));
    bestAngle+=turn*.82;
    if(a.explore%30===0)a.escapeHeading+=(random()-.5)*.45;
  }
  // Persistent personal wandering means gatherings remain porous.
  if(tick%55===a.id%55)a.wanderBias=(random()-.5)*1.2;
  bestAngle+=(a.wanderBias||0)*.11;
  a.heading+=Math.atan2(Math.sin(bestAngle-a.heading),Math.cos(bestAngle-a.heading))*.24;
  if(a.type===1)a.heading+=.014+a.coil*.016;
  if(a.type===2)a.heading+=Math.sin(tick*.11+a.id)*(.018+a.wave*.04);
  let speed=(a.type===2?2.5:a.type===1?1.65:1.5)*(1-a.compact*.15)*(1-field.rest*.78)*(1+restGift*.75)*(1+field.social*.05);
  speed=clamp(speed,.15,3.7);a.x+=Math.cos(a.heading)*speed*1.48;a.y+=Math.sin(a.heading)*speed;
  // Each inhabitant leaves a species-shaped imprint in the interior.
  // Exchange experience increases imprint probability and persistence, but
  // all three species retain their own grammar (branches, coils, waves).
  const gx=clamp(Math.floor(a.x/CELLW),0,IX-1),gy=clamp(Math.floor(a.y/CELLH),0,IY-1);
  const imprintChance=.025+.19*exchangeGift+.035*field.exchange;
  if(random()<imprintChance){
    const c=interior[gy*IX+gx],t=a.type;
    const influence=.07+.12*exchangeGift;
    c.imprints[t]=clamp(c.imprints[t]+influence,0,1);
    // Record the body's actual current geometry; repeated encounters
    // overwrite older marks instead of generating unrelated grid patterns.
    const form=t===0?a.branch:t===1?a.coil:a.wave;
    c.forms[t]+=(form-c.forms[t])*.24;
    c.lastType=t;
    c.wear=clamp(c.wear+.006*(1+exchangeGift),0,1);
  }
  // Continuous collision response: preserve the tangential movement component.
  // Never teleport to a discrete wall vertex or rotate by a fixed 135 degrees.
  // Sample the boundary at the entity's exact polar angle using interpolation.
  const localAngle=Math.atan2(a.y-CY,(a.x-CX)/1.48);
  const continuousIndex=((localAngle+TAU)%TAU)/TAU*N;
  const lo=Math.floor(continuousIndex),frac=continuousIndex-lo;
  const radius=wallRadius(lo)*(1-frac)+wallRadius(lo+1)*frac;
  const radialDistance=Math.hypot((a.x-CX)/1.48,a.y-CY);
  const clearance=radius-radialDistance;
  if(clearance<14){
    // A soft steering force anticipates contact, avoiding repeated boundary impacts.
    const outward=Math.cos(a.heading)*Math.cos(localAngle)+Math.sin(a.heading)*Math.sin(localAngle);
    if(outward>0){
      const tangent=localAngle+(Math.sin(a.heading-localAngle)>=0?Math.PI/2:-Math.PI/2);
      const blend=clamp((14-clearance)/18,0,.55);
      a.heading+=Math.atan2(Math.sin(tangent-a.heading),Math.cos(tangent-a.heading))*blend;
    }
    if(clearance<5){
      // Correct only the overlap, in small increments. This also handles a wall
      // that advances toward an entity between successive simulation ticks.
      const correction=Math.min(2.5,5-clearance);
      a.x-=Math.cos(localAngle)*correction*1.48;
      a.y-=Math.sin(localAngle)*correction;
    }
  }
  if(tick%240===a.id%240 && (restGift>.55||exchangeGift>.55||gatherGift>.55)){
    const key=restGift>=exchangeGift&&restGift>=gatherGift?'rest':exchangeGift>=gatherGift?'exchange':'gather';
    addEvent(`${['Grower','Builder','Mover'][a.type]} #${a.id} carries ${key} experience beyond its region: ${key==='rest'?'faster exploration':key==='exchange'?'stronger environmental imprints':'closer kin connections'}.`);
  }
  if(a.energy>1.10&&a.age>34&&population[a.type]<20){
    a.energy*=.51;a.children++;
    let child={...a,id:nextId++,x:a.x+(random()-.5)*21,y:a.y+(random()-.5)*21,energy:a.energy,age:0,heading:random()*TAU,branch:clamp(a.branch+(random()-.5)*.12,.1,1),coil:clamp(a.coil+(random()-.5)*.12,.1,1),wave:clamp(a.wave+(random()-.5)*.12,.1,1),children:0,exposure:0,nearShelter:0,adapt:0,rest:0,social:0,exchange:0,restMemory:a.restMemory*.65,socialMemory:a.socialMemory*.65,exchangeMemory:a.exchangeMemory*.65};
    births.push(child);
    population[a.type]++;
    if(tick%13===0)addEvent(['Grower','Builder','Mover'][a.type]+' offspring inherited its parent’s adapted geometry.');
  }
 }
 // Cohabitation rule: nobody dies, disappears, attacks, or is culled.
 agents.push(...births);
 // Territories emerge from sustained, distinct local practices, not a single crowded tick.
 // Candidate evidence is spatially accumulated; each territory needs a long, continuous history.
 if(tick%12===0 && zones.length<5){
   // Discover candidate sites where inhabitants ACTUALLY are, rather than
   // sampling six fixed points that can remain empty in a large enclosure.
   const candidates=[];
   for(const a of agents){
     const local=agents.filter(b=>Math.hypot((a.x-b.x)/1.48,a.y-b.y)<94);
     if(local.length<2)continue;
     const cx=local.reduce((sum,b)=>sum+b.x,0)/local.length;
     const cy=local.reduce((sum,b)=>sum+b.y,0)/local.length;
     if(zones.some(z=>Math.hypot((z.x-cx)/1.48,z.y-cy)<120))continue;
     candidates.push({cx,cy,count:local.length});
   }
   // Prefer sustained encounters over empty positions, but retain variation.
   candidates.sort((a,b)=>b.count-a.count);
   for(const c of candidates.slice(0,3)){
     if(zones.length>=5)break;
     if(zones.some(z=>Math.hypot((z.x-c.cx)/1.48,z.y-c.cy)<120))continue;
     const chance=clamp(.72-.40*bureaucracy+.16*solidarity+.04*Math.min(c.count,5),.20,.98);
     if(random()>chance)continue;
     const kind=['rest','social','exchange'][Math.floor(random()*3)];
     zones.push({x:c.cx,y:c.cy,kind,strength:.18,radius:38+random()*34,targetRadius:42+random()*37,phase:random()*TAU,irregularity:.65+random()*.65,age:0,occupantTicks:0,established:false,emptyTicks:0,establishedAt:0,protection:0,stability:0,activity:0});
     addEvent(`A tentative ${kind} territory emerges where ${c.count} inhabitants have gathered.`);
   }
 }
 for(const z of zones){
   z.age++;
   const local=agents.filter(a=>regionDistance(z,a.x,a.y)<1);
   const count=local.length;
   if(!z.established){
     // Only continuous collective occupation contributes. Absence erases tentative memory.
     z.occupantTicks=clamp((z.occupantTicks||0)+(count>=4?1.35:count>=2?.85:count===1?.20:-.35),0,650);
     z.strength=clamp(.15+z.occupantTicks/480*.60,.10,.75);
     // Tentative regions breathe and slowly change footprint before becoming established.
     // Different initial target sizes produce a diversity of small and large regions.
     z.radius=clamp(z.radius+(z.targetRadius-z.radius)*.0025+Math.sin(z.age*.017+z.phase)*.022,30,88);
     if(z.age%160===0)z.targetRadius=38+random()*48;
     if(z.occupantTicks>=Math.round(75+115*bureaucracy-25*solidarity) && z.age>=Math.round(90+100*bureaucracy-20*solidarity)){
       z.established=true;z.establishedAt=tick;z.protection=0;z.strength=.80;z.stability=1;
       addEvent(`A ${z.kind} place became established after prolonged shared occupation. Its invisible protected area eases into place and then prevents the outer wall from moving inward across the region; inhabitants still pass freely.`);
     }
   }else{
     // A short, eased transition prevents the boundary snapping when a room
     // first becomes permanent (~170 ms at the default 2x speed).
     z.protection=clamp((z.protection||0)+.25,0,1);
     z.stability=1;
     z.strength=clamp(z.strength+(count>=4?.00018:-.00012),.64,.91);
     // Reprogramming requires a different practice sustained over many checks.
     if(tick%Math.round(65+125*(1-impermanence))===0 && count>=5){
       const votes=[0,0,0];
       for(const a of local){votes[0]+=(a.type===1?1:.2)+a.restMemory;votes[1]+=(a.type===0?1:.2)+a.socialMemory;votes[2]+=(a.type===2?1:.2)+a.exchangeMemory}
       const candidate=['rest','social','exchange'][votes.indexOf(Math.max(...votes))];
       z.reprogram=z.reprogram||{kind:null,steps:0};
       if(candidate!==z.kind && Math.max(...votes)>count*.78){
         if(z.reprogram.kind!==candidate)z.reprogram={kind:candidate,steps:0};
         z.reprogram.steps++;
         if(z.reprogram.steps>=Math.round(3+8*(1-impermanence))){const old=z.kind;z.kind=candidate;z.reprogram={kind:null,steps:0};addEvent(`Established ${old} place gradually became ${candidate} through a sustained change in collective use.`)}
       }else z.reprogram={kind:null,steps:0};
     }
   }
 }
 // Unestablished regions fade if sustained use stops; permanent rooms retain their place.
 zones=zones.filter(z=>z.established||z.age<260||z.occupantTicks>20);
 // Wall traits are reversible. New interactions overwrite old traces; unused traces fade.
 // A finite 'material budget' prevents all three grammars saturating a wall simultaneously.
 for(let i=0;i<N;i++){
   let w=walls[i],p=pressures[i],activity=p.branch+p.layer+p.wave;
   let targetBranch=activity?p.branch/activity:0,targetLayer=activity?p.layer/activity:0,targetWave=activity?p.wave/activity:0;
   let learn=activity>0?.035*Math.min(1,activity):0;
   w.branch=clamp(w.branch+(targetBranch-w.branch)*learn-w.branch*.003,0,.95);
   w.layer=clamp(w.layer+(targetLayer-w.layer)*learn-w.layer*.003,0,.95);
   w.wave=clamp(w.wave+(targetWave-w.wave)*learn-w.wave*.003,0,.95);
   w.wear=clamp(w.wear+p.wear*.009-w.wear*.004,0,.95);
   w.contacts+=p.contacts;
   // Architecture requires repeated collective effort; no single touch immediately reshapes it.
   // Established interior places anchor adjacent architecture without blocking movement.
   const wallPos=pos(i),resistance=zones.reduce((max,z)=>{
     if(!z.established)return max;
     const d=Math.hypot((wallPos[0]-z.x)/1.48,wallPos[1]-z.y);
     return Math.max(max,clamp(1-d/(z.radius+95),0,1)*(.55+.40*bureaucracy));
   },0);
   // Innovation is calibrated so 55% matches the previous 100% wall response.
   // The convex upper range leaves room for increasingly dramatic deformation.
   const innovationGain=innovation<=.55
     ? innovation/.55
     : 1+1.45*Math.pow((innovation-.55)/.45,1.45);
   const desired=innovationGain*(1-resistance)*(p.push*.92-p.layer*.51+p.wear*.19);
   // Continuous, gentle centripetal pressure: inhabitation must counteract
   // the environment's tendency to contract. Established regions resist this
   // pressure and retain their existing non-encroachment geometry constraint.
   const inwardPressure=.038*(1-resistance);
   w.shift=clamp(w.shift+desired-inwardPressure-w.shift*(.002*(1-resistance*.85)),-100,105);
   w.corner=clamp(w.corner+(Math.abs(p.push-p.layer)*.006)-w.corner*.004,0,.95);
   w.shelter=clamp(w.shelter+(p.branch*.005+p.layer*.008)-w.shelter*.004,0,.95);
 }
 // Smooth gently but preserve pronounced pockets and corners from sustained local pressure.
 let old=walls.map(w=>w.shift);
 for(let i=0;i<N;i++){
   let w=walls[i];w.shift=.90*old[i]+.05*old[norm(i-1)]+.05*old[norm(i+1)];
 }
 // Established rooms reserve a true exclusion buffer for the outer boundary.
 // Work in ellipse-normalized coordinates, matching wallRadius() and pos().
 // For each radial wall vertex, find the farthest intersection with each protected
 // region disk. Clamp the vertex OUTSIDE it after all deformation and smoothing.
 // This is a hard geometric constraint, not merely a softer wall response.
 for(let i=0;i<N;i++){
   const ang=i/N*TAU,ux=Math.cos(ang),uy=Math.sin(ang);
   let minRadius=0;
   for(const z of zones){
     if(!z.established)continue;
     const zx=(z.x-CX)/1.48,zy=z.y-CY;
     const along=zx*ux+zy*uy;
     const perp2=zx*zx+zy*zy-along*along;
     const t=clamp(z.protection||0,0,1);
     const eased=t*t*(3-2*t);
     const protectedRadius=(z.radius*1.30+24)*eased;
     const discriminant=protectedRadius*protectedRadius-perp2;
     if(discriminant<0 || along<0)continue;
     minRadius=Math.max(minRadius,along+Math.sqrt(discriminant)+2);
   }
   if(minRadius>0){
     const w=walls[i];
     const shapeOffset=-12*w.layer+8*w.wave*Math.sin(i*.43)+8*w.branch*Math.sin(i*.28);
     // Limit how far the protection can push the wall in a single tick.
     // The established region becomes fully non-encroachable after the easing.
     const target=minRadius-320-shapeOffset;
     w.shift=Math.max(w.shift,Math.min(target,w.shift+9));
   }
 }
 // The enclosure must remain fully visible inside the canvas, even at maximum
 // Innovation and Exchange memory. Clamp the ACTUAL rendered radius (including
 // species-specific offsets), rather than just shift, so no wall vertex escapes.
 // This runs after protected-region constraints: the canvas is the absolute limit.
 const canvasInset=15;
 for(let i=0;i<N;i++){
   const a=i/N*TAU,ux=Math.cos(a)*1.48,uy=Math.sin(a);
   const maxX=Math.abs(ux)>1e-8?((ux>0?W-canvasInset-CX:CX-canvasInset)/Math.abs(ux)):Infinity;
   const maxY=Math.abs(uy)>1e-8?((uy>0?H-canvasInset-CY:CY-canvasInset)/Math.abs(uy)):Infinity;
   const w=walls[i],shapeOffset=-12*w.layer+8*w.wave*Math.sin(i*.43)+8*w.branch*Math.sin(i*.28);
   w.shift=Math.min(w.shift,Math.min(maxX,maxY)-320-shapeOffset);
 }
 // Interior territories can also modify nearby architectural structure and resource flow.
 for(const z of zones){
   let zi=angleIdx(z.x,z.y),wi=walls[zi];
   if(z.kind==='exchange'){resources[Math.floor(zi/N*24)%24]=clamp(resources[Math.floor(zi/N*24)%24]+z.strength*.0025,0,1)}
   if(z.kind==='rest')wi.layer=clamp(wi.layer+z.strength*.0008,0,.95);
 }
 if(tick%90===0){
  let top=walls.reduce((best,w,i)=>w.shelter>walls[best].shelter?i:best,0);
  addEvent(`A sheltered niche is forming at wall ${top+1} (${Math.round(walls[top].shelter*100)}% shelter). Residents adapt and share the space.`);
 }
 if(tick%8===0){snapshots.push(stateCopy());if(snapshots.length>400)snapshots.shift()}
 updateUI();
}
function drawAvatar(a){
 ctx.save();
 // Immediate embodied behaviours depend on current exposure, not accumulated memory.
 // Rest creates a glow; exchange creates an oscillation that disappears on leaving.
 const rest=clamp(a.rest||0,0,1),exchange=clamp(a.exchange||0,0,1),social=clamp(a.social||0,0,1);
 if(rest>.025){
   const halo=ctx.createRadialGradient(a.x,a.y,3,a.x,a.y,24+rest*19);
   halo.addColorStop(0,`rgba(120,140,218,${.22*rest})`);
   halo.addColorStop(.5,`rgba(142,159,226,${.15*rest})`);
   halo.addColorStop(1,'rgba(142,159,226,0)');
   ctx.fillStyle=halo;ctx.beginPath();ctx.arc(a.x,a.y,24+rest*19,0,TAU);ctx.fill();
 }
 const shake=exchange*2.75;
 // High-frequency exchange motion is a visual vibration, not positional drift.
 const phase=(tick*3.85+a.id*1.73);
 ctx.translate(a.x+Math.sin(phase)*shake,a.y+Math.cos(phase*1.41)*shake);
 ctx.rotate(a.heading);ctx.lineCap='round';
 if(social>.08){ctx.beginPath();ctx.arc(0,0,18+social*8,0,TAU);ctx.strokeStyle=`rgba(179,120,147,${social*.20})`;ctx.lineWidth=1;ctx.stroke();}
 ctx.strokeStyle=['#36825b','#c17859','#4b86af'][a.type];ctx.lineWidth=1.35;
 ctx.beginPath();
 if(a.type===0){
  const gather=a.socialMemory||0,restMem=a.restMemory||0,exchangeMem=a.exchangeMemory||0;
  let n=3+Math.floor(a.branch*28+gather*8),len=(6+(1-a.compact)*9+a.branch*13)*(1-.48*restMem);
  for(let j=0;j<n;j++){
   let ang=j/n*TAU,ex=Math.cos(ang)*len,ey=Math.sin(ang)*len;
   ctx.moveTo(0,0);ctx.lineTo(ex,ey);
   for(let b=0;b<1+Math.floor(a.branch*5+restMem*3);b++){
    let t=.43+b*.17,side=(b%2?1:-1),sub=4+a.branch*8;
    ctx.moveTo(ex*t,ey*t);
    ctx.lineTo(ex*t+Math.cos(ang+side*.68)*sub,ey*t+Math.sin(ang+side*.68)*sub);
   }
  }
  if(exchangeMem>.08){for(let k=0;k<Math.floor(3+exchangeMem*18);k++){let ang=k/Math.max(1,Math.floor(3+exchangeMem*18))*TAU,r=len*(.55+.35*((k%3)/3));ctx.moveTo(Math.cos(ang)*r+1.1,Math.sin(ang)*r);ctx.arc(Math.cos(ang)*r,Math.sin(ang)*r,1.1,0,TAU)}}
 }else if(a.type===1){
  const gather=a.socialMemory||0,restMem=a.restMemory||0,exchangeMem=a.exchangeMemory||0;
  let turns=.5+a.coil*9+restMem*7;
  for(let j=0;j<=210;j++){
   let t=j/210*turns*TAU,r=1+j/210*(7+a.coil*13+exchangeMem*13),x=Math.cos(t)*r,y=Math.sin(t)*r;
   if(j===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  }
  for(let k=0;k<Math.floor(gather*7);k++){
   let ang=k/Math.max(1,Math.floor(gather*7))*TAU+a.age*.006,r=10+a.coil*11;
   const x=Math.cos(ang)*r,y=Math.sin(ang)*r;
   ctx.moveTo(0,0);ctx.lineTo(x,y);ctx.moveTo(x+3,y);
   for(let j=0;j<=24;j++){let t=j/24*TAU*(.65+gather*1.5),rr=j/24*(2+gather*4),xx=x+Math.cos(t)*rr,yy=y+Math.sin(t)*rr;if(j===0)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy)}
  }
 }else{
  const gather=a.socialMemory||0,restMem=a.restMemory||0,exchangeMem=a.exchangeMemory||0;
  let lines=1+Math.floor(a.wave*7+gather*12),freq=1+a.wave*3+exchangeMem*9,amp=(2+a.wave*6)*(1-.72*restMem);
  for(let k=0;k<lines;k++){
   for(let j=0;j<=40;j++){
    let x=-15+j/40*30,y=(k-(lines-1)/2)*3.2+Math.sin(j/40*TAU*freq+a.id)*amp;
    if(j===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
   }
  }
  if(exchangeMem>.08)for(let k=0;k<Math.floor(exchangeMem*17);k++){
   let x=-14+k*3.4,y=13+Math.sin(k*1.3+a.id)*3;
   ctx.moveTo(x+1,y);ctx.arc(x,y,1,0,TAU);
  }
 }
 ctx.stroke();ctx.restore();
}
function draw(s){
 ctx.clearRect(0,0,W,H);ctx.fillStyle='#fafbf8';ctx.fillRect(0,0,W,H);
 const ws=s.walls;
 // Room outline follows actual accumulated structural changes.
 ctx.save();ctx.beginPath();for(let i=0;i<=N;i++){let [x,y]=pos(i%N,ws);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}
 ctx.closePath();ctx.fillStyle='#eaf0e7';ctx.fill();ctx.strokeStyle='#64866e';ctx.lineWidth=2.6;ctx.stroke();ctx.clip();
 // Architectural niches are visible as inward shaded pockets and corner zones.
 for(let i=0;i<N;i++){
  let w=ws[i];if(w.shelter<.09&&w.corner<.10)continue;
  let [x,y]=pos(i,ws),ang=i/N*TAU;
  let depth=12+35*w.shelter;
  ctx.beginPath();ctx.moveTo(x,y);
  ctx.lineTo(x-Math.cos(ang)*depth*1.48-Math.sin(ang)*9*w.corner,y-Math.sin(ang)*depth+Math.cos(ang)*9*w.corner);
  ctx.lineTo(x-Math.cos(ang)*depth*1.48+Math.sin(ang)*9*w.corner,y-Math.sin(ang)*depth-Math.cos(ang)*9*w.corner);
  ctx.closePath();ctx.fillStyle=`rgba(90,143,101,${.04+.26*w.shelter})`;ctx.fill();
 }
 // Regions have organic footprints, rather than circular badges. Their irregular
 // geometry is shared by exposure, occupancy, and this rendering.
 for(const z of (s.zones||[])){
  const alpha=z.strength;
  const color=z.kind==='rest'?'102,119,160':z.kind==='social'?'179,120,138':'186,150,69';
  ctx.save();regionPath(z);ctx.clip();
  const radius=z.radius*1.8;
  const grad=ctx.createRadialGradient(z.x,z.y,0,z.x,z.y,radius);
  grad.addColorStop(0,`rgba(${color},${.24*alpha})`);
  grad.addColorStop(.65,`rgba(${color},${.13*alpha})`);
  grad.addColorStop(1,`rgba(${color},${.045*alpha})`);
  ctx.fillStyle=grad;ctx.fillRect(z.x-radius*1.5,z.y-radius,radius*3,radius*2);
  ctx.restore();
  ctx.save();ctx.strokeStyle=`rgba(${color},${z.established?.68:.42})`;
  ctx.lineWidth=z.established?2.5:1.2;
  ctx.setLineDash(z.established?[]:[5,6]);regionPath(z);ctx.stroke();ctx.setLineDash([]);
  // Region names are drawn after interior marks for legibility.
  ctx.restore();
 }
 // Interior imprints reproduce the three native body grammars, not
 // generic symbols. They accumulate with repeated occupation and fade away.
 const cells=s.interior||[];
 for(let gy=0;gy<IY;gy++)for(let gx=0;gx<IX;gx++){
   const c=cells[gy*IX+gx];if(!c||!c.imprints)continue;
   const x=(gx+.5)*CELLW,y=(gy+.5)*CELLH;
   for(let k=0;k<3;k++){
     const v=c.imprints[k];if(v<.065)continue;
     const f=c.forms[k]||.2;
     ctx.save();ctx.translate(x,y);
     ctx.rotate(((gx*17+gy*31+k*7)%29)*.15);
     ctx.strokeStyle=['rgba(54,130,91,','rgba(193,120,89,','rgba(75,134,175,'][k]+Math.min(.53,v*.50)+')';
     ctx.lineWidth=.75+v*.9;ctx.lineCap='round';ctx.beginPath();
     if(k===0){
       const n=3+Math.floor(f*9),len=3+f*12;
       for(let j=0;j<n;j++){
         const a=j/n*TAU,ex=Math.cos(a)*len,ey=Math.sin(a)*len;
         ctx.moveTo(0,0);ctx.lineTo(ex,ey);
         const t=.55,sub=2+f*5;
         ctx.moveTo(ex*t,ey*t);ctx.lineTo(ex*t+Math.cos(a+.7)*sub,ey*t+Math.sin(a+.7)*sub);
       }
     }else if(k===1){
       const turns=1.2+f*4.8;
       for(let j=0;j<=72;j++){
         const t=j/72*turns*TAU,r=1+j/72*(4+f*11);
         if(j===0)ctx.moveTo(Math.cos(t)*r,Math.sin(t)*r);
         else ctx.lineTo(Math.cos(t)*r,Math.sin(t)*r);
       }
     }else{
       const lines=1+Math.floor(f*3),freq=1+f*5;
       for(let line=0;line<lines;line++)for(let j=0;j<=30;j++){
         const xx=-13+j/30*26,yy=(line-(lines-1)/2)*4+Math.sin(j/30*TAU*freq)* (2+f*4);
         if(j===0)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy);
       }
     }
     ctx.stroke();ctx.restore();
   }
 }
 // Established regions have high-contrast titles that remain readable
 // above imprints and overlapping architectural textures.
 for(const z of (s.zones||[])){
   const label=z.kind==='rest'?'REST':z.kind==='social'?'GATHER':'EXCHANGE';
   const alpha=z.established?1:Math.max(.48,z.strength*.85);
   ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';
   ctx.font=z.established?'700 17px system-ui':'600 12px system-ui';
   const width=ctx.measureText(label).width+ (z.established?29:18);
   const h=z.established?32:24;
   ctx.fillStyle=z.established?'rgba(255,255,252,.94)':'rgba(255,255,252,.75)';
   ctx.strokeStyle=z.established?'rgba(65,82,73,.45)':'rgba(65,82,73,.15)';
   ctx.lineWidth=z.established?1.5:1;
   ctx.beginPath();ctx.roundRect(z.x-width/2,z.y-h/2,width,h,h/2);ctx.fill();ctx.stroke();
   ctx.fillStyle=z.kind==='rest'?'#53658e':z.kind==='social'?'#96566f':'#917025';
   ctx.globalAlpha=alpha;ctx.fillText(label,z.x,z.y+.5);
   ctx.restore();
 }
 // Resource indicators: pale dots are depleted; large dots are well supplied.
 for(let k=0;k<24;k++){
  let ang=(k+.5)/24*TAU,r=118;
  ctx.beginPath();ctx.arc(CX+Math.cos(ang)*r*1.48,CY+Math.sin(ang)*r,2+s.resources[k]*5,0,TAU);
  ctx.fillStyle=`rgba(145,169,120,${.08+s.resources[k]*.30})`;ctx.fill();
 }
 ctx.restore();
 // Thick and unmistakable architectural traces, with different shapes per entity type.
 for(let i=0;i<N;i++){
  let w=ws[i],p=pos(i,ws),q=pos(i+1,ws),dx=q[0]-p[0],dy=q[1]-p[1],angle=i/N*TAU,ox=Math.cos(angle)*1.48,oy=Math.sin(angle);
  if(w.layer>.055){
   ctx.strokeStyle=`rgba(191,115,83,${.35+.5*w.layer})`;ctx.lineWidth=1.5+w.layer*3;
   for(let j=1;j<=Math.ceil(w.layer*4);j++){
    let off=3+j*3.5;ctx.beginPath();ctx.moveTo(p[0]-ox*off,p[1]-oy*off);ctx.lineTo(q[0]-ox*off,q[1]-oy*off);ctx.stroke();
   }
  }
  if(w.branch>.055){
   ctx.strokeStyle='#3e8963';ctx.lineWidth=1.2+w.branch*1.2;
   let n=1+Math.floor(w.branch*2);
   for(let j=0;j<n;j++){
    let t=(j+.5)/n,x=p[0]+dx*t,y=p[1]+dy*t,l=4+w.branch*21;
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+ox*l,y+oy*l);
    if(w.branch>.28){ctx.moveTo(x+ox*l*.62,y+oy*l*.62);ctx.lineTo(x+ox*l+Math.cos(angle+.65)*l*.5,y+oy*l+Math.sin(angle+.65)*l*.5)}
    ctx.stroke();
   }
  }
  if(w.wave>.055){
   ctx.strokeStyle='#4b86af';ctx.lineWidth=1.3+w.wave*2;
   ctx.beginPath();for(let j=0;j<=10;j++){
    let t=j/10,offset=Math.sin(t*TAU*(1+w.wave*2))*w.wave*12;
    let x=p[0]+dx*t+ox*offset,y=p[1]+dy*t+oy*offset;
    if(j===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)
   }ctx.stroke();
  }
  if(w.corner>.2){
   ctx.strokeStyle=`rgba(65,101,72,${.25+w.corner*.5})`;ctx.lineWidth=1+w.corner*2;
   let d=7+w.corner*18;ctx.beginPath();ctx.moveTo(p[0]-ox*d,p[1]-oy*d);
   ctx.lineTo(p[0]-ox*d+Math.sin(angle)*d*.5,p[1]-oy*d-Math.cos(angle)*d*.5);ctx.stroke();
  }
 }
 for(const a of s.agents)drawAvatar(a);
 if(selected&&selected.kind==='agent'){
  let a=s.agents.find(x=>x.id===selected.id);if(a){ctx.strokeStyle='#293f33';ctx.lineWidth=1;ctx.setLineDash([3,4]);ctx.beginPath();ctx.arc(a.x,a.y,31,0,TAU);ctx.stroke();ctx.setLineDash([])}
 }else if(selected&&selected.kind==='wall'){
  let p=pos(selected.index,ws);ctx.beginPath();ctx.arc(p[0],p[1],8,0,TAU);ctx.strokeStyle='#243e2f';ctx.lineWidth=2;ctx.stroke();
 }
 ctx.fillStyle='#748779';ctx.font='12px system-ui';ctx.fillText('LIVING ARCHITECTURE  /  COHABITATION  ·  TEMPORARY TERRITORIES',20,28);
}
function renderEvents(state){
 const list=$('events');
 list.replaceChildren();
 const recent=state.events.slice(0,4);
 if(recent.length===0){
  const empty=document.createElement('div');
  empty.className='becoming-event';
  empty.textContent='Interactions are beginning.';
  list.append(empty);
  return;
 }
 for(const event of recent){
  const item=document.createElement('div');
  const tickLabel=document.createElement('strong');
  const message=document.createElement('span');
  item.className='becoming-event';
  tickLabel.textContent='Tick '+event.tick+' \u00b7 ';
  message.textContent=event.message;
  item.append(tickLabel,message);
  list.append(item);
 }
}
function renderSelection(state){
 if(!selected)return;
 const panel=$('inspect');
 if(selected.kind==='agent'){
  const agent=state.agents.find(candidate=>candidate.id===selected.id);
  if(!agent){panel.textContent='This inhabitant was not present in the selected historical state.';return;}
  const names=['Grower','Builder','Mover'];
  const gather=['more branches','satellite coils','parallel strands'];
  const rest=['denser branches','more spiral turns','gentler waves'];
  const exchange=['dotted tips','open coils','fine fast waves'];
  panel.innerHTML='<b>'+names[agent.type]+' #'+agent.id+'</b><br>'+ 'Age: '+agent.age+' ticks \u00b7 Wellbeing: '+agent.energy.toFixed(2)+'<br>'+ 'Branching: '+Math.round(agent.branch*100)+'% \u00b7 Coils: '+Math.round(agent.coil*100)+'% \u00b7 Waves: '+Math.round(agent.wave*100)+'%<br>'+ 'Compactness: '+Math.round(agent.compact*100)+'% \u00b7 Wall exposure: '+agent.exposure.toFixed(1)+'<br>'+ 'Spatial memory \u2014 Rest: '+Math.round((agent.restMemory||0)*100)+'% \u00b7 Gather: '+Math.round((agent.socialMemory||0)*100)+'% \u00b7 Exchange: '+Math.round((agent.exchangeMemory||0)*100)+'%<br>'+ 'Exploration / escape: '+(agent.explore>0?'exploring outside cluster':'free movement')+' \u00b7 Current shelter benefit: '+Math.round(agent.nearShelter*100)+'% \u00b7 Rest: '+Math.round((agent.rest||0)*100)+'% \u00b7 Gather: '+Math.round((agent.social||0)*100)+'% \u00b7 Exchange: '+Math.round((agent.exchange||0)*100)+'%<br>'+ '<span class="key">Each territory changes this species in its own way. Gather: '+gather[agent.type]+'; Rest: '+rest[agent.type]+'; Exchange: '+exchange[agent.type]+'. Rest memory increases travel speed; Exchange memory strongly increases wall deformation and species-shaped imprints; Gather memory increases kin affinity. All fade slowly after leaving. Offspring inherit some spatial memory.</span>';
  return;
 }
 const wall=state.walls[selected.index];
 if(!wall){panel.textContent='This boundary segment was not present in the selected historical state.';return;}
 panel.innerHTML='<b>Boundary segment '+(selected.index+1)+'</b><br>'+ 'Contact: '+Math.round(wall.contacts)+' \u00b7 Outward shift: '+wall.shift.toFixed(1)+' units<br>'+ 'Branches: '+Math.round(wall.branch*100)+'% \u00b7 Layers: '+Math.round(wall.layer*100)+'% \u00b7 Waves: '+Math.round(wall.wave*100)+'%<br>'+ 'Shelter: '+Math.round(wall.shelter*100)+'% \u00b7 Corners: '+Math.round(wall.corner*100)+'%<br>'+ '<span class="key">Wall grammars fade and overwrite one another as new inhabitants interact; sustained contact is needed to reshape the boundary.</span>';
}
function updateUI(){
 const state=viewState||stateCopy();
 const population=[0,0,0];
 for(const agent of state.agents)population[agent.type]++;
 $('timeLabel').textContent='Tick '+state.tick;
 $('zoneCount').textContent=String(state.zones.length);
 $('permanentCount').textContent=String(state.zones.filter(zone=>zone.established).length);
 $('nGrow').textContent=String(population[0]);
 $('nSpiral').textContent=String(population[1]);
 $('nWave').textContent=String(population[2]);
 $('timeline').max=String(Math.max(0,snapshots.length-1));
 if(!viewState)$('timeline').value=String(snapshots.length-1);
 $('historyHint').textContent=viewState?'Viewing recorded tick '+state.tick+'. Press Play to resume live simulation.':'Click an entity or wall to inspect the feedback. Scrub backward to review history.';
 renderEvents(state);
 renderSelection(state);
 draw(state);
}
function frame(timestamp){
 if(!frame.previous)frame.previous=timestamp;
 const elapsed=Math.min(100,timestamp-frame.previous);
 frame.previous=timestamp;
 if(playing&&!viewState){
  acc+=elapsed;
  let steps=0;
  const threshold=85/Number($('rate').value);
  while(acc>=threshold&&steps<90){step();acc-=threshold;steps++;}
 }
 requestAnimationFrame(frame);
}
$('play').addEventListener('click',()=>{
 if(viewState){viewState=null;$('timeline').value=String(snapshots.length-1);}
 playing=!playing;
 $('play').textContent=playing?'Pause':'Play';
 updateUI();
});
$('step').addEventListener('click',()=>{
 viewState=null;
 playing=false;
 $('play').textContent='Play';
 step();
});
$('reset').addEventListener('click',()=>init());
$('restart').addEventListener('click',()=>init(true));
$('timeline').addEventListener('input',event=>{
 const index=Number(event.currentTarget.value);
 viewState=index===snapshots.length-1?null:snapshots[index];
 playing=false;
 $('play').textContent='Play';
 updateUI();
});
for(const id of ['bureaucracy','innovation','abundance','solidarity','adaptability','impermanence','rate']){
 $(id).addEventListener('input',()=>{
  $(id+'Value').textContent=id==='rate'?$(id).value+'\u00d7':$(id).value+'%';
 });
}
canvas.addEventListener('click',event=>{
 const bounds=canvas.getBoundingClientRect();
 const x=(event.clientX-bounds.left)/bounds.width*W;
 const y=(event.clientY-bounds.top)/bounds.height*H;
 const state=viewState||stateCopy();
 let nearest=null,distance=27;
 for(const agent of state.agents){
  const candidateDistance=Math.hypot(agent.x-x,agent.y-y);
  if(candidateDistance<distance){nearest=agent;distance=candidateDistance;}
 }
 if(nearest)selected={kind:'agent',id:nearest.id};
 else{
  const index=angleIdx(x,y),point=pos(index,state.walls);
  selected=Math.hypot(x-point[0],y-point[1])<34?{kind:'wall',index}:null;
 }
 updateUI();
});
init();
requestAnimationFrame(frame);
})();
