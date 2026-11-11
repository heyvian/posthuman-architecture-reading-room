(()=>{'use strict';const app=document.querySelector('#becoming-app');const canvas=app.querySelector('#view'),ctx=canvas.getContext('2d');const W=1120,H=760,CX=560,CY=380,N=120,TAU=Math.PI*2,INITIAL_RADIUS=Math.min(W/1.48,H)*.3;const $=id=>id==='timeLabel'?document.querySelector('#timeLabel'):app.querySelector('#'+id);let seed=window.crypto.getRandomValues(new Uint32Array(1))[0],random,tick=0,agents=[],walls=[],resources=[],zones=[],interior=[],events=[],snapshots=[],playing=true,acc=0,viewState=null;const IX=20,CELLW=W/IX,CELLH=CELLW*Math.sqrt(3)/2,IY=Math.ceil(H/CELLH),IMPRINT_Y=(H-(IY-1)*CELLH)/2;const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));function rng(s){return()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296}}function norm(a){return (a%N+N)%N}function angleIdx(x,y){return norm(Math.round(((Math.atan2(y-CY,x-CX)+TAU)%TAU)/TAU*N))}function wallRadius(i,ws=walls){let w=ws[norm(i)];return INITIAL_RADIUS+w.shift-12*w.layer+8*w.wave*Math.sin(i*.43)+8*w.branch*Math.sin(i*.28)}function pos(i,ws=walls){let a=norm(i)/N*TAU,r=wallRadius(i,ws);return [CX+Math.cos(a)*r*1.48,CY+Math.sin(a)*r]}// Every region has a stable, irregular footprint. Geometry, exposure and rendering
// all use the same boundary function, so the visible region matches its effects.
const regionGeometry=window.BecomingRegions;
const MAX_REGIONS=36;
const ROOM_PLACEMENT_ORDER=['exchange','social','rest'];
let placementStep=0,placementPreview=null,placementPointer=null,placementPreviewValid=false,placementSpotInvalid=false;
const BUILDER_EROSION_RADIUS=12*Math.sqrt(3);
function imprintPosition(gx,gy){
 return [(gx+.5+(gy%2?.25:-.25))*CELLW,IMPRINT_Y+gy*CELLH];
}
function imprintIndex(x,y){
 const row=clamp(Math.round((y-IMPRINT_Y)/CELLH),0,IY-1);
 let best=0,bestDistance=Infinity;
 for(let gy=Math.max(0,row-1);gy<=Math.min(IY-1,row+1);gy++){
   const gx=clamp(Math.round(x/CELLW-.5-(gy%2?.25:-.25)),0,IX-1);
   const [px,py]=imprintPosition(gx,gy),distance=(px-x)**2+(py-y)**2;
   if(distance<bestDistance){bestDistance=distance;best=gy*IX+gx}
 }
 return best;
}
const CANVAS_INSET=15,WALL_GAP=4;
function regionBoundFactor(z){return 1+.28*z.irregularity+Math.hypot(z.biasX||0,z.biasY||0)}
function canvasRadiusLimit(z){
 const available=Math.min((z.x-CANVAS_INSET)/1.48,(W-CANVAS_INSET-z.x)/1.48,z.y-CANVAS_INSET,H-CANVAS_INSET-z.y);
 return Math.max(0,(available-WALL_GAP)/regionBoundFactor(z));
}
function polygonPath(points){
 if(!points.length)return;
 ctx.moveTo(points[0][0],points[0][1]);
 for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);
 ctx.closePath();
}
function regionPath(z){
 polygonPath(regionGeometry.polygon(z));
 for(const cut of z.cuts||[])polygonPath(regionGeometry.cutPolygon(z,cut));
}
function strokeRegion(z){
 const cuts=z.cuts||[];
 ctx.save();
 for(const cut of cuts){
  ctx.beginPath();ctx.rect(0,0,W,H);
  polygonPath(regionGeometry.cutShape(cut));
  ctx.clip('evenodd');
 }
 ctx.beginPath();polygonPath(regionGeometry.polygon(z));ctx.stroke();
 ctx.restore();
 if(cuts.length){
  ctx.save();
  ctx.beginPath();polygonPath(regionGeometry.polygon(z));ctx.clip();
  for(const cut of cuts){
   ctx.beginPath();polygonPath(regionGeometry.cutShape(cut));ctx.stroke();
  }
  ctx.restore();
 }
}
function clipEarlierRegions(regions,index){
 for(let i=0;i<index;i++){
  if(!regionGeometry.mayOverlap(regions[index],regions[i]))continue;
  ctx.beginPath();
  ctx.rect(0,0,W,H);
  regionPath(regions[i]);
  ctx.clip('evenodd');
 }
}
function clipMergedNeighbors(regions,index){
 const current=regions[index];
 for(let i=index+1;i<regions.length;i++){
  if(regions[i].groupId!==current.groupId||!regionGeometry.mayOverlap(current,regions[i]))continue;
  ctx.beginPath();
  ctx.rect(0,0,W,H);
  regionPath(regions[i]);
  ctx.clip('evenodd');
 }
}
function distanceToWall(a,ws=walls){let i=angleIdx(a.x,a.y),r=Math.hypot((a.x-CX)/1.48,a.y-CY);return wallRadius(i,ws)-r}
function packInterior(){
 const packed=new Float64Array(interior.length*11);
 for(let i=0;i<interior.length;i++){
  const c=interior[i],offset=i*11;
  packed[offset]=c.rest;packed[offset+1]=c.social;packed[offset+2]=c.exchange;packed[offset+3]=c.wear;
  for(let k=0;k<3;k++){packed[offset+4+k]=c.imprints[k];packed[offset+7+k]=c.forms[k]}
  packed[offset+10]=c.lastType;
 }
 return packed;
}
function unpackInterior(packed){
 return Array.from({length:packed.length/11},(_,i)=>{
  const offset=i*11;
  return {rest:packed[offset],social:packed[offset+1],exchange:packed[offset+2],wear:packed[offset+3],
   imprints:[packed[offset+4],packed[offset+5],packed[offset+6]],
   forms:[packed[offset+7],packed[offset+8],packed[offset+9]],lastType:packed[offset+10]};
 });
}
function stateCopy(compact=false){
 return {
  tick,
  agents:agents.map(a=>({...a})),
  walls:walls.map(w=>({...w})),
  resources:resources.slice(),
  speciesBaseline:speciesBaseline.slice(),
  interior:compact?packInterior():interior.map(c=>({...c,imprints:c.imprints.slice(),forms:c.forms.slice()})),
  zones:zones.map(z=>({...z,links:z.links.slice(),cuts:(z.cuts||[]).map(cut=>({...cut})),builderContact:z.builderContact?{...z.builderContact}:null,growerContact:z.growerContact?{...z.growerContact}:null,reprogram:z.reprogram?{...z.reprogram}:undefined})),
  events:events.slice(0,5).map(event=>({...event}))
 };
}
function liveState(){
 return {tick,agents,walls,resources,speciesBaseline,interior,zones,events};
}
function init(newSeed=false){
 if(newSeed){
  let next;
  do{next=window.crypto.getRandomValues(new Uint32Array(1))[0]}while(next===seed);
  seed=next;
 }
 random=rng(seed);tick=0;acc=0;nextId=1;nextRegionId=1;lastRegionTick=-72;agents=[];events=[];pendingEvent=null;candidateEvidence.clear();speciesBaseline=[.10,.10,.10];lastGuideTick=-1;placementStep=0;placementPreview=null;placementPointer=null;placementPreviewValid=false;placementSpotInvalid=false;
 walls=Array.from({length:N},()=>({shift:0,branch:0,layer:0,builderLayer:0,wave:0,wear:0,contacts:0,shelter:0,corner:0}));
 resources=Array.from({length:24},()=>.78);zones=[];
 interior=Array.from({length:IX*IY},()=>({rest:0,social:0,exchange:0,wear:0,imprints:[0,0,0],forms:[0,0,0],lastType:-1}));
 for(let k=0;k<3;k++)for(let i=0;i<8;i++)spawn(k);
 initialSpecies=Array.from({length:3},(_,type)=>averageAvatar(agents,type));
 placementPreview=createPlacementRoom(ROOM_PLACEMENT_ORDER[placementStep]);
 snapshots=[stateCopy(true)];viewState=null;playing=false;$('play').textContent='Place rooms first';updateUI();
}
let nextId=1;
let nextRegionId=1;
let lastRegionTick=-72;
let speciesBaseline=[.10,.10,.10],initialSpecies=[],lastGuideTick=-1,pendingEvent=null;
const candidateEvidence=new Map();
function spawn(type,parent=null){let a=random()*TAU,r=Math.sqrt(random())*INITIAL_RADIUS*210/320;let entity={id:nextId++,type,x:CX+Math.cos(a)*r*1.48,y:CY+Math.sin(a)*r,energy:parent?Math.max(.45,parent.energy*.5):.7+random()*.25,age:0,heading:random()*TAU,branch:parent?clamp(parent.branch+(random()-.5)*.10,.1,1):.19+random()*.20,coil:parent?clamp(parent.coil+(random()-.5)*.10,.1,1):.17+random()*.20,wave:parent?clamp(parent.wave+(random()-.5)*.10,.1,1):.17+random()*.20,compact:parent?parent.compact:.25,exposure:0,children:0,stress:0,nearShelter:0,adapt:0,rest:0,social:0,exchange:0,restMemory:0,socialMemory:0,exchangeMemory:0,trailX:0,trailY:0};agents.push(entity);return entity}
function addEvent(message){
 pendingEvent={tick,message};
}
function regionName(kind){return kind==='social'?'Gather':kind==='rest'?'Rest':'Exchange'}
function regionPhrase(kind){return (kind==='exchange'?'an ':'a ')+regionName(kind)+' region'}
function regionCount(){return new Set(zones.map(z=>z.groupId)).size}
function createPlacementRoom(kind){
 const radius=38+random()*34;
 return {id:nextRegionId,groupId:nextRegionId,links:[],x:CX,y:CY,kind,strength:.35,radius,baseRadius:radius,phase:random()*TAU,irregularity:.65+random()*.65,biasX:0,biasY:0,age:0,occupantTicks:0,established:false,emptyTicks:0,establishedAt:0,protection:0,stability:0,activity:0};
}
function canPlaceRoom(room){
 if(room.radius<18||zones.length>=MAX_REGIONS||!regionGeometry.canCreate(zones,room.x,room.y))return false;
 return regionGeometry.polygon(room).every(([x,y])=>distanceToWall({x,y})>=WALL_GAP);
}
function movePlacementPreview(x,y){
 placementPointer={x,y};
 placementPreview.x=x;placementPreview.y=y;
 placementPreview.radius=Math.min(placementPreview.baseRadius,regionGeometry.limitRadius(placementPreview,zones),canvasRadiusLimit(placementPreview));
 placementPreviewValid=canPlaceRoom(placementPreview);
 placementSpotInvalid=!placementPreviewValid;
}
function canvasPoint(event){
 const rect=canvas.getBoundingClientRect();
 if(!rect.width||!rect.height)return null;
 return {x:(event.clientX-rect.left)*W/rect.width,y:(event.clientY-rect.top)*H/rect.height};
}
function moveRoomPreview(event){
 const point=canvasPoint(event);
 if(!point)return false;
 movePlacementPreview(point.x,point.y);
 return true;
}
function placeRoom(event){
 if(placementStep>=ROOM_PLACEMENT_ORDER.length||(event.button!==0&&event.pointerType!=='touch'))return;
 event.preventDefault();
 if(!moveRoomPreview(event)||!placementPreviewValid){updateUI();return;}
 const point={...placementPointer};
 const {baseRadius,...room}=placementPreview;
 zones.push(room);nextRegionId++;
 placementStep++;
 placementSpotInvalid=false;
 if(placementStep<ROOM_PLACEMENT_ORDER.length){
  placementPreview=createPlacementRoom(ROOM_PLACEMENT_ORDER[placementStep]);
  movePlacementPreview(point.x,point.y);
 }else{
  placementPreview=null;placementPointer=null;placementPreviewValid=false;playing=true;
 }
 snapshots[0]=stateCopy(true);viewState=null;acc=0;updateUI();
}
function steerAtWall(agent,clearance,angle,randomValue){
 if(clearance>=18){agent.wallMode=null;return}
 if(clearance>=14)return;
 const outward=Math.cos(agent.heading-angle);
 if(outward<=0)return;
 if(!agent.wallMode)agent.wallMode=randomValue()<.5?'glide':'deflect';
 if(agent.wallMode==='deflect'){
   agent.heading=2*angle+Math.PI-agent.heading;
   return;
 }
 const tangent=angle+(Math.sin(agent.heading-angle)>=0?Math.PI/2:-Math.PI/2);
 const blend=clamp((14-clearance)/18,0,.55);
 agent.heading+=Math.atan2(Math.sin(tangent-agent.heading),Math.cos(tangent-agent.heading))*blend;
}
function steerTowardInterior(agent,clearance){
 agent.edgeTicks=clearance<50?(agent.edgeTicks||0)+1:0;
 if(agent.edgeTicks<=40)return;
 const inward=Math.atan2(CY-agent.y,(CX-agent.x)/1.48);
 const turn=Math.atan2(Math.sin(inward-agent.heading),Math.cos(inward-agent.heading));
 agent.heading+=turn*Math.min(.18,.04+(agent.edgeTicks-40)*.003);
}
function eraseRegionsFromBuilderEffects(){
 if(!zones.length)return;
 const index=regionGeometry.spatialIndex(zones);
 const touched=new Map();
 const groups=new Map();
 for(const zone of zones){
   if(!groups.has(zone.groupId))groups.set(zone.groupId,[]);
   groups.get(zone.groupId).push(zone);
 }
 function availableRadius(members,x,y){
   let radius=BUILDER_EROSION_RADIUS;
   for(const zone of members)for(const cut of zone.cuts||[]){
     const distance=Math.hypot((x-cut.x)/1.48,y-cut.y);
     radius=Math.min(radius,distance/1.06-cut.radius-.01);
   }
   return radius;
 }
 function mark(x,y,weight){
   const key=regionGeometry.cellKey(x,y);
   const place=index.at(x,y);
   if(!place)return;
   const id=place.region.groupId;
   const cells=touched.get(id),previous=cells&&cells.get(key);
   if(previous&&weight<=previous.weight)return;
   const radius=availableRadius(groups.get(id),x,y);
   if(radius<2||!regionGeometry.reachesGroupEdge(zones,id,{x,y,radius},index))return;
   if(!cells)touched.set(id,new Map());
   touched.get(id).set(key,{weight,x,y});
 }
 for(let i=0;i<interior.length;i++){
   if(interior[i].imprints[1]<.70)continue;
   const gx=i%IX,gy=Math.floor(i/IX),[x,y]=imprintPosition(gx,gy);
   const form=interior[i].forms[1]||.2,rotation=((gx*17+gy*31+7)%29)*.15;
   mark(x,y,1);
   for(let j=3;j<=72;j+=3){
     const angle=j/72*(1.2+form*4.8)*TAU+rotation;
     const radius=1+j/72*(4+form*11);
     mark(x+Math.cos(angle)*radius,y+Math.sin(angle)*radius,1);
   }
 }
 for(let i=0;i<N;i++){
   const wall=walls[i];
   if(wall.layer<.65||wall.builderLayer<.55)continue;
   const p=pos(i),q=pos(i+1),angle=i/N*TAU;
   const ox=Math.cos(angle)*1.48,oy=Math.sin(angle);
   for(let j=1;j<=Math.ceil(wall.layer*4);j++){
     const offset=3+j*3.5;
     for(let k=0;k<=4;k++){
       const t=k/4;
       mark(p[0]+(q[0]-p[0])*t-ox*offset,p[1]+(q[1]-p[1])*t-oy*offset,1.25);
     }
   }
 }
 const removed=new Set();
 for(const [id,members] of groups){
   const cells=touched.get(id);
   const previous=members[0].builderContact;
   const strongest=cells?Math.max(...Array.from(cells.values(),contact=>contact.weight)):0;
   const cell=cells&&(previous&&cells.get(previous.cell)?.weight===strongest
     ?previous.cell:[...cells].find(([,contact])=>contact.weight===strongest)[0]);
   const contact=cell&&cells.get(cell);
   const count=contact?(previous&&previous.cell===cell?previous.ticks:0)+contact.weight:0;
   for(const zone of members)zone.builderContact=cell?{cell,ticks:count}:null;
   if(count<480)continue;
   const radius=availableRadius(members,contact.x,contact.y);
   for(const zone of members)zone.builderContact=null;
   if(radius<2)continue;
   const cut={x:contact.x,y:contact.y,radius};
   for(const zone of members){
     zone.cuts=zone.cuts||[];
     zone.cuts.push(cut);
     if(regionGeometry.isEmpty(zone))removed.add(zone.id);
   }
   addEvent(`Sustained Builder traces eroded part of ${regionPhrase(members[0].kind)}.`);
 }
 if(removed.size){
   zones=zones.filter(zone=>!removed.has(zone.id));
   for(const zone of zones)zone.links=zone.links.filter(id=>!removed.has(id));
 }
}
function healEnclosedCuts(){
 const checked=new Set(),enclosed=new Set();
 for(const zone of zones)for(const cut of zone.cuts||[]){
   if(checked.has(cut))continue;
   checked.add(cut);
   if(!regionGeometry.reachesGroupEdge(zones,zone.groupId,cut))enclosed.add(cut);
 }
 if(enclosed.size)for(const zone of zones)zone.cuts=(zone.cuts||[]).filter(cut=>!enclosed.has(cut));
}
function growRegionsFromGrowerEffects(){
 if(!zones.length)return;
 const index=regionGeometry.spatialIndex(zones);
 const touched=new Map();
 function mark(x,y,weight){
   const place=index.at(x,y);
   if(!place||place.distance<.7)return;
   const id=place.region.groupId,key=regionGeometry.cellKey(x,y);
   if(!touched.has(id))touched.set(id,new Map());
   const cells=touched.get(id),previous=cells.get(key);
   if(!previous||weight>previous.weight)cells.set(key,{x,y,weight,region:place.region});
 }
 for(let i=0;i<interior.length;i++){
   if(interior[i].imprints[0]<.65)continue;
   const gx=i%IX,gy=Math.floor(i/IX),[x,y]=imprintPosition(gx,gy);
   const form=interior[i].forms[0]||.2,rotation=((gx*17+gy*31)%29)*.15;
   const branches=3+Math.floor(form*9),length=3+form*12;
   mark(x,y,1);
   for(let j=0;j<branches;j++){
     const angle=j/branches*TAU+rotation;
     for(const distance of [.5,1])mark(x+Math.cos(angle)*length*distance,y+Math.sin(angle)*length*distance,1);
   }
 }
 for(let i=0;i<N;i++){
   const wall=walls[i];
   if(wall.branch<.45)continue;
   const p=pos(i),q=pos(i+1),angle=i/N*TAU,ox=Math.cos(angle)*1.48,oy=Math.sin(angle);
   const branches=1+Math.floor(wall.branch*2),length=4+wall.branch*21;
   for(let j=0;j<branches;j++){
     const t=(j+.5)/branches,x=p[0]+(q[0]-p[0])*t,y=p[1]+(q[1]-p[1])*t;
     const inward=Math.min(12,4+wall.branch*10);
     for(const distance of [-inward,0,length*.5,length])mark(x+ox*distance,y+oy*distance,1.25);
   }
 }
 const groups=new Map();
 for(const zone of zones){
   if(!groups.has(zone.groupId))groups.set(zone.groupId,[]);
   groups.get(zone.groupId).push(zone);
 }
 for(const [id,members] of groups){
   const cells=touched.get(id),previous=members[0].growerContact;
   const strongest=cells?Math.max(...Array.from(cells.values(),contact=>contact.weight)):0;
   const key=cells&&(previous&&cells.get(previous.cell)?.weight===strongest
     ?previous.cell:[...cells].find(([,contact])=>contact.weight===strongest)[0]);
   const contact=key&&cells.get(key);
   const count=contact?(previous&&previous.cell===key?previous.ticks:0)+contact.weight:0;
   for(const zone of members)zone.growerContact=contact?{cell:key,ticks:count}:null;
   if(count<360)continue;
   for(const zone of members)zone.growerContact=null;
   const parent=contact.region;
   let addition=null;
   for(let direction=0;direction<16&&!addition;direction++){
     const angle=direction/16*TAU;
     const x=contact.x+Math.cos(angle)*8*1.48,y=contact.y+Math.sin(angle)*8;
     if(x<0||x>W||y<0||y>H||distanceToWall({x,y})<=0||regionGeometry.at(zones,x,y))continue;
     const candidate={id:nextRegionId,groupId:id,links:[parent.id],x,y,kind:parent.kind,strength:parent.strength,radius:10,phase:0,irregularity:.35,biasX:0,biasY:0,age:parent.age,occupantTicks:0,established:parent.established,emptyTicks:0,establishedAt:parent.establishedAt,protection:parent.protection,stability:parent.stability,activity:0,growerAddition:true};
     candidate.radius=Math.min(candidate.radius,regionGeometry.limitRadius(candidate,zones),canvasRadiusLimit(candidate));
     if(candidate.radius<10)continue;
     addition=candidate;
   }
   if(addition){
     nextRegionId++;
     parent.links.push(addition.id);
     zones.push(addition);
     addEvent(`Grower traces formed a small addition to ${regionPhrase(parent.kind)}.`);
   }
 }
}
function step(){
 // Traces are temporary, local, and rewritten by subsequent inhabitants.
 for(const c of interior){
   if(!c.imprints)continue;
   for(let k=0;k<3;k++){
     const strength=c.imprints[k];
     c.imprints[k]*=.9989-.0004*(1-strength);
   }
 }

 tick++;
 const bureaucracy=+$('bureaucracy').value/100,innovation=+$('innovation').value/100,abundance=+$('abundance').value/100,solidarity=+$('solidarity').value/100,adaptability=+$('adaptability').value/100,impermanence=+$('impermanence').value/100;
 const reprogramFlexibility=clamp((impermanence-.45)/.55,0,1);
 const pressures=Array.from({length:N},()=>({push:0,branch:0,layer:0,wave:0,wear:0,contacts:0}));
 const births=[];
 const counts=[0,0,0];
 const speciesPressure=[0,0,0];
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
  let field={rest:0,social:0,exchange:0};
  const place=regionGeometry.at(zones,a.x,a.y);
  if(place)field[place.region.kind]=(1-place.distance)*place.region.strength;
  a.rest=field.rest;a.social=field.social;a.exchange=field.exchange;
  // The avatar remembers time spent in a territory; time away slowly unlearns its influence. Immediate glow, vibration and neighbour attraction end on departure.
  // Memory is causal, bounded and reversible, not a clock-driven decorative animation.
  for(const kind of ['rest','social','exchange']){
    const key=kind+'Memory',old=a[key]||0,exposure=field[kind];
    a[key]=clamp(old+exposure*(.008+.020*adaptability)-(1-exposure)*(.00035+.00115*adaptability),0,1);
    if(old<.60&&a[key]>=.60)addEvent(`${['Grower','Builder','Mover'][a.type]} #${a.id} developed visible ${({social:['branching','satellite coils','parallel strands'],rest:['compact branches','spiral turns','gentle waves'],exchange:['dotted branch tips','open coils','fine wave rhythms']})[kind][a.type]} after time in ${regionName(kind)}.`);
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
  const nativeField=[field.social,field.rest,field.exchange][a.type];
  speciesPressure[a.type]+=clamp(nativeField*.7+(field.rest+field.social+field.exchange)*.3+contact*complexity*.4,0,1);
  const targetBranch=clamp((a.type===0?speciesBaseline[0]:.10)+.72*(a.type===0?a.socialMemory:(a.socialMemory*.25))+.05*complexity+.03*density,.06,.99);
  const targetCoil=clamp((a.type===1?speciesBaseline[1]:.10)+.72*(a.type===1?a.restMemory:(a.restMemory*.25))+.06*w.layer+.03*w.corner,.06,.99);
  const targetWave=clamp((a.type===2?speciesBaseline[2]:.10)+.72*(a.type===2?a.exchangeMemory:(a.exchangeMemory*.25))+.05*w.wave+.03*w.wear,.06,.99);
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
    const destination=regionGeometry.at(zones,nx,ny);
    if(destination){
      const z=destination.region,f=(1-destination.distance)*z.strength;
      if(z.kind==='social')desirability+=f*(.10+.56*solidarity);
      if(z.kind==='exchange')desirability+=f*.19;
      if(z.kind==='rest')desirability+=f*.34;
    }
    desirability-=Math.abs(k)*.04;
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
  steerTowardInterior(a,dist);
  let speed=(a.type===2?2.5:a.type===1?1.65:1.5)*(1-a.compact*.15)*(1-field.rest*.78)*(1+restGift*.75)*(1+field.social*.05);
  speed=clamp(speed,.15,3.7);a.x+=Math.cos(a.heading)*speed*1.48;a.y+=Math.sin(a.heading)*speed;
  // Each inhabitant leaves a species-shaped imprint in the interior.
  // Exchange experience increases imprint probability and persistence, but
  // all three species retain their own grammar (branches, coils, waves).
  const imprintChance=.025+.19*exchangeGift+.035*field.exchange;
  if(random()<imprintChance){
    const c=interior[imprintIndex(a.x,a.y)],t=a.type;
    const influence=.07+.12*exchangeGift;
    c.imprints[t]=clamp(c.imprints[t]+influence,0,1);
    // Record the body's actual current geometry; repeated encounters
    // overwrite older marks instead of generating unrelated grid patterns.
    const form=t===0?a.branch:t===1?a.coil:a.wave;
    c.forms[t]+=(form-c.forms[t])*.24;
    c.lastType=t;
    c.wear=clamp(c.wear+.006*(1+exchangeGift),0,1);
  }
  // Sample the boundary at the entity's exact polar angle using interpolation.
  const localAngle=Math.atan2(a.y-CY,(a.x-CX)/1.48);
  const continuousIndex=((localAngle+TAU)%TAU)/TAU*N;
  const lo=Math.floor(continuousIndex),frac=continuousIndex-lo;
  const radius=wallRadius(lo)*(1-frac)+wallRadius(lo+1)*frac;
  const radialDistance=Math.hypot((a.x-CX)/1.48,a.y-CY);
  const clearance=radius-radialDistance;
  steerAtWall(a,clearance,localAngle,random);
  if(clearance<14){
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
    addEvent(`${['Grower','Builder','Mover'][a.type]} #${a.id} carries ${regionName(key==='gather'?'social':key)} experience beyond its region: ${key==='rest'?'faster exploration':key==='exchange'?'stronger environmental imprints':'closer kin connections'}.`);
  }
  if(a.energy>1.10&&a.age>34&&population[a.type]<20){
    a.energy*=.51;a.children++;
    let child={...a,id:nextId++,x:a.x+(random()-.5)*21,y:a.y+(random()-.5)*21,energy:a.energy,age:0,heading:random()*TAU,wallMode:null,edgeTicks:0,branch:clamp(a.branch+(random()-.5)*.12,a.type===0?speciesBaseline[0]:.1,1),coil:clamp(a.coil+(random()-.5)*.12,a.type===1?speciesBaseline[1]:.1,1),wave:clamp(a.wave+(random()-.5)*.12,a.type===2?speciesBaseline[2]:.1,1),children:0,exposure:0,nearShelter:0,adapt:0,rest:0,social:0,exchange:0,restMemory:a.restMemory*.65,socialMemory:a.socialMemory*.65,exchangeMemory:a.exchangeMemory*.65};
    births.push(child);
    population[a.type]++;
    if(tick%13===0)addEvent(['Grower','Builder','Mover'][a.type]+' offspring inherited its parent’s adapted geometry.');
  }
 }
 // Cohabitation rule: nobody dies, disappears, attacks, or is culled.
 agents.push(...births);
 for(let type=0;type<3;type++){
   if(counts[type])speciesBaseline[type]=Math.min(.6,speciesBaseline[type]+speciesPressure[type]/counts[type]*.00015);
 }
 // Territories emerge from sustained, distinct local practices, not a single crowded tick.
 // Candidate evidence is spatially accumulated; each territory needs a long, continuous history.
 if(tick%12===0 && regionCount()<MAX_REGIONS){
   // Discover candidate sites where inhabitants ACTUALLY are, rather than
   // sampling six fixed points that can remain empty in a large enclosure.
   const candidates=new Map();
   const freeAgents=agents.filter(a=>!regionGeometry.at(zones,a.x,a.y));
   for(const a of freeAgents){
     const local=freeAgents.filter(b=>Math.hypot((a.x-b.x)/1.48,a.y-b.y)<94);
     if(local.length<2)continue;
     const cx=local.reduce((sum,b)=>sum+b.x,0)/local.length;
     const cy=local.reduce((sum,b)=>sum+b.y,0)/local.length;
     if(!regionGeometry.canCreate(zones,cx,cy))continue;
     const key=Math.floor(cx/(60*1.48))+':'+Math.floor(cy/60);
     const candidate=candidates.get(key);
     if(!candidate||local.length>candidate.count)candidates.set(key,{cx,cy,count:local.length,key});
   }
   for(const [key,evidence] of candidateEvidence){
     if(!candidates.has(key)){
       if(evidence<=1)candidateEvidence.delete(key);
       else candidateEvidence.set(key,evidence-1);
     }
   }
   for(const c of candidates.values())candidateEvidence.set(c.key,(candidateEvidence.get(c.key)||0)+1);
   const mature=[...candidates.values()].filter(c=>candidateEvidence.get(c.key)>=4+Math.round(bureaucracy*4));
   mature.sort((a,b)=>b.count-a.count);
   for(const c of tick-lastRegionTick>=72?mature:[]){
     if(!regionGeometry.canCreate(zones,c.cx,c.cy))continue;
     const chance=clamp(.72-.40*bureaucracy+.16*solidarity+.04*Math.min(c.count,5),.20,.98);
     if(random()>chance)continue;
     const kind=['rest','social','exchange'][Math.floor(random()*3)];
     const id=nextRegionId;
     const zone={id,groupId:id,links:[],x:c.cx,y:c.cy,kind,strength:.18,radius:38+random()*34,phase:random()*TAU,irregularity:.65+random()*.65,biasX:0,biasY:0,age:0,occupantTicks:0,established:false,emptyTicks:0,establishedAt:0,protection:0,stability:0,activity:0};
     zone.radius=Math.min(zone.radius,regionGeometry.limitRadius(zone,zones),canvasRadiusLimit(zone));
     if(zone.radius<18)continue;
     nextRegionId++;
     zones.push(zone);
     lastRegionTick=tick;
     candidateEvidence.delete(c.key);
     addEvent(`A tentative ${regionName(kind)} region emerges where ${c.count} inhabitants have gathered.`);
     break;
   }
 }
 const occupants=new Map(zones.map(z=>[z,[]]));
 for(const agent of agents){
   const place=regionGeometry.at(zones,agent.x,agent.y);
   if(place)occupants.get(place.region).push(agent);
 }
 for(const z of zones){
   z.age++;
   const local=occupants.get(z);
   const count=local.length;
   const targetRadius=25+Math.min(count,9)*9;
   const radiusLimit=regionGeometry.limitRadius(z,zones);
   const connectedRadius=regionGeometry.connectedRadius(z,zones);
   z.radius=Math.min(radiusLimit,Math.max(z.growerAddition?10:18,connectedRadius,z.radius+(targetRadius-z.radius)*.0025));
   let targetX=0,targetY=0;
   for(const agent of local){
     targetX+=(agent.x-z.x)/1.48;
     targetY+=agent.y-z.y;
   }
   if(count){
     targetX=clamp(targetX/count/Math.max(18,z.radius)*.25,-.16,.16);
     targetY=clamp(targetY/count/Math.max(18,z.radius)*.25,-.16,.16);
   }
   z.biasX+=(targetX-z.biasX)*.005;
   z.biasY+=(targetY-z.biasY)*.005;
   z.radius=Math.min(z.radius,canvasRadiusLimit(z));
   if(!z.established){
     // Only continuous collective occupation contributes. Absence erases tentative memory.
     z.occupantTicks=clamp((z.occupantTicks||0)+(count>=4?1.35:count>=2?.85:count===1?.20:-.35),0,650);
     z.strength=clamp(.15+z.occupantTicks/480*.60,.10,.75);
     if(z.occupantTicks>=Math.round(75+115*bureaucracy-25*solidarity) && z.age>=Math.round(90+100*bureaucracy-20*solidarity)){
       for(const member of zones)if(member.groupId===z.groupId&&!member.established){
         member.established=true;member.establishedAt=tick;member.protection=0;member.strength=.80;member.stability=1;
       }
       addEvent(`A region for ${regionName(z.kind)} became established after prolonged shared occupation, strengthening its resistance to wall deformation.`);
     }
   }else{
     z.protection=clamp((z.protection||0)+.25,0,1);
     z.stability=1;
     z.strength=clamp(z.strength+(count>=4?.00018:-.00012),.64,.91);
     // Reprogramming requires a different practice sustained over many checks.
     const reprogramInterval=Math.round(65+125*(1-impermanence)-35*reprogramFlexibility);
     const minimumOccupants=5-Math.round(3*reprogramFlexibility);
     if(tick%reprogramInterval===0 && count>=minimumOccupants){
       const votes=[0,0,0];
       const memoryWeight=1-.8*reprogramFlexibility;
       for(const a of local){votes[0]+=(a.type===1?1:.2)+a.restMemory*memoryWeight;votes[1]+=(a.type===0?1:.2)+a.socialMemory*memoryWeight;votes[2]+=(a.type===2?1:.2)+a.exchangeMemory*memoryWeight}
       const candidate=['rest','social','exchange'][votes.indexOf(Math.max(...votes))];
       z.reprogram=z.reprogram||{kind:null,steps:0};
       if(candidate!==z.kind && Math.max(...votes)>count*.78){
         if(z.reprogram.kind!==candidate)z.reprogram={kind:candidate,steps:0};
         z.reprogram.steps++;
         if(z.reprogram.steps>=Math.max(2,Math.round(3+8*(1-impermanence)-reprogramFlexibility))){
           const old=z.kind;
           for(const member of zones)if(member.groupId===z.groupId){member.kind=candidate;member.reprogram={kind:null,steps:0}}
           addEvent(`An established ${regionName(old)} region gradually became ${regionName(candidate)} through a sustained change in collective use.`);
         }
       }else z.reprogram={kind:null,steps:0};
     }
   }
 }
 if(tick%12===0){
   for(let i=0;i<zones.length;i++)for(let j=i+1;j<zones.length;j++){
     const first=zones[i],second=zones[j];
     if(first.groupId===second.groupId||first.kind!==second.kind)continue;
     if(regionGeometry.touching(first,second,zones)){
       regionGeometry.merge(zones,first,second,tick);
       addEvent(`Neighboring ${regionName(first.kind)} regions merged through shared use.`);
     }
   }
 }
 // Wall traits are reversible. New interactions overwrite old traces; unused traces fade.
 // A finite 'material budget' prevents all three grammars saturating a wall simultaneously.
 for(let i=0;i<N;i++){
   let w=walls[i],p=pressures[i],activity=p.branch+p.layer+p.wave;
   let targetBranch=activity?p.branch/activity:0,targetLayer=activity?p.layer/activity:0,targetWave=activity?p.wave/activity:0;
   let learn=activity>0?.035*Math.min(1,activity):0;
   w.branch=clamp(w.branch+(targetBranch-w.branch)*learn-w.branch*.003,0,.95);
   w.layer=clamp(w.layer+(targetLayer-w.layer)*learn-w.layer*.003,0,.95);
   w.builderLayer=clamp(w.builderLayer+(targetLayer-w.builderLayer)*learn-w.builderLayer*.003,0,.95);
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
   w.shift=clamp(w.shift+desired-inwardPressure-w.shift*(.002*(1-resistance*.85)),-100,425-INITIAL_RADIUS);
   w.corner=clamp(w.corner+(Math.abs(p.push-p.layer)*.006)-w.corner*.004,0,.95);
   w.shelter=clamp(w.shelter+(p.branch*.005+p.layer*.008)-w.shelter*.004,0,.95);
 }
 // Smooth gently but preserve pronounced pockets and corners from sustained local pressure.
 let old=walls.map(w=>w.shift);
 for(let i=0;i<N;i++){
   let w=walls[i];w.shift=.90*old[i]+.05*old[norm(i-1)]+.05*old[norm(i+1)];
 }
 growRegionsFromGrowerEffects();
 // Keep the entire footprint of every region inside the outer boundary.
 for(let i=0;i<N;i++){
   const ang=i/N*TAU,ux=Math.cos(ang),uy=Math.sin(ang);
   let minRadius=0;
   for(const z of zones){
     if(z.radius<=0)continue;
     const zx=(z.x-CX)/1.48,zy=z.y-CY;
     const along=zx*ux+zy*uy;
     const perp2=zx*zx+zy*zy-along*along;
     const protectedRadius=z.radius*regionBoundFactor(z)+WALL_GAP;
     const discriminant=protectedRadius*protectedRadius-perp2;
     if(discriminant<0)continue;
     minRadius=Math.max(minRadius,along+Math.sqrt(discriminant));
   }
   if(minRadius>0){
     const w=walls[i];
     const shapeOffset=-12*w.layer+8*w.wave*Math.sin(i*.43)+8*w.branch*Math.sin(i*.28);
     const target=minRadius-INITIAL_RADIUS-shapeOffset;
     w.shift=Math.max(w.shift,target);
   }
 }
 // The enclosure must remain fully visible inside the canvas, even at maximum
 // Innovation and Exchange memory. Clamp the ACTUAL rendered radius (including
 // species-specific offsets), rather than just shift, so no wall vertex escapes.
 // This runs after protected-region constraints: the canvas is the absolute limit.
 for(let i=0;i<N;i++){
   const a=i/N*TAU,ux=Math.cos(a)*1.48,uy=Math.sin(a);
   const maxX=Math.abs(ux)>1e-8?((ux>0?W-CANVAS_INSET-CX:CX-CANVAS_INSET)/Math.abs(ux)):Infinity;
   const maxY=Math.abs(uy)>1e-8?((uy>0?H-CANVAS_INSET-CY:CY-CANVAS_INSET)/Math.abs(uy)):Infinity;
   const w=walls[i],shapeOffset=-12*w.layer+8*w.wave*Math.sin(i*.43)+8*w.branch*Math.sin(i*.28);
   w.shift=Math.min(w.shift,Math.min(maxX,maxY)-INITIAL_RADIUS-shapeOffset);
 }
 eraseRegionsFromBuilderEffects();
 healEnclosedCuts();
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
 if(tick%50===0&&pendingEvent){
  events.unshift(pendingEvent);events=events.slice(0,5);pendingEvent=null;
 }
 if(tick%8===0){snapshots.push(stateCopy(true));if(snapshots.length>400)snapshots.shift()}
}
function drawAvatar(a,context=ctx,time=tick){
 const ctx=context;
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
 const phase=(time*3.85+a.id*1.73);
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
function averageAvatar(avatars,type){
 const members=avatars.filter(avatar=>avatar.type===type);
 if(!members.length)return null;
 const average={...members[0]};
 for(const key of ['branch','coil','wave','compact','age','rest','social','exchange','restMemory','socialMemory','exchangeMemory']){
   average[key]=members.reduce((sum,avatar)=>sum+(avatar[key]||0),0)/members.length;
 }
 return average;
}
function drawAvatarPreview(id,avatar,time){
 const canvas=$(id),surface=canvas.getContext('2d');
 surface.clearRect(0,0,canvas.width,canvas.height);
 if(!avatar)return;
 surface.save();
 surface.translate(canvas.width/2,canvas.height/2);
 surface.scale(1.2,1.2);
 drawAvatar({...avatar,x:0,y:0,heading:0},surface,time);
 surface.restore();
}
function renderSpeciesGuide(state){
 const names=['Grower','Builder','Mover'];
 for(let type=0;type<3;type++){
   const name=names[type];
   drawAvatarPreview('initial'+name,initialSpecies[type],0);
   drawAvatarPreview('current'+name,averageAvatar(state.agents,type),state.tick);
   $('baseline'+name).textContent='Inherited shift: +'+((state.speciesBaseline[type]-.10)*100).toFixed(1)+' points';
 }
}
const imprintPaths=Array.from({length:IX*IY},()=>[null,null,null]);
function imprintPath(index,type,form){
 const cached=imprintPaths[index][type];
 if(cached&&cached.form===form)return cached.path;
 const path=new Path2D();
 if(type===0){
   const n=3+Math.floor(form*9),len=3+form*12;
   for(let j=0;j<n;j++){
     const a=j/n*TAU,ex=Math.cos(a)*len,ey=Math.sin(a)*len;
     path.moveTo(0,0);path.lineTo(ex,ey);
     const t=.55,sub=2+form*5;
     path.moveTo(ex*t,ey*t);path.lineTo(ex*t+Math.cos(a+.7)*sub,ey*t+Math.sin(a+.7)*sub);
   }
 }else if(type===1){
   const turns=1.2+form*4.8;
   for(let j=0;j<=72;j++){
     const t=j/72*turns*TAU,r=1+j/72*(4+form*11);
     if(j===0)path.moveTo(Math.cos(t)*r,Math.sin(t)*r);
     else path.lineTo(Math.cos(t)*r,Math.sin(t)*r);
   }
 }else{
   const lines=1+Math.floor(form*3),freq=1+form*5;
   for(let line=0;line<lines;line++)for(let j=0;j<=30;j++){
     const x=-13+j/30*26,y=(line-(lines-1)/2)*4+Math.sin(j/30*TAU*freq)*(2+form*4);
     if(j===0)path.moveTo(x,y);else path.lineTo(x,y);
   }
 }
 imprintPaths[index][type]={form,path};
 return path;
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
 const visibleZones=s.zones||[];
 for(let zoneIndex=0;zoneIndex<visibleZones.length;zoneIndex++){
  const z=visibleZones[zoneIndex];
  const alpha=z.strength;
  const color=z.kind==='rest'?'102,119,160':z.kind==='social'?'179,120,138':'186,150,69';
  ctx.save();
  clipEarlierRegions(visibleZones,zoneIndex);
  ctx.beginPath();regionPath(z);ctx.clip('evenodd');
  const radius=z.radius*1.8;
  const grad=ctx.createRadialGradient(z.x,z.y,0,z.x,z.y,radius);
  grad.addColorStop(0,`rgba(${color},${.24*alpha})`);
  grad.addColorStop(.65,`rgba(${color},${.13*alpha})`);
  grad.addColorStop(1,`rgba(${color},${.045*alpha})`);
  ctx.fillStyle=grad;ctx.fillRect(z.x-radius*1.5,z.y-radius,radius*3,radius*2);
  ctx.restore();
  ctx.save();
  clipEarlierRegions(visibleZones,zoneIndex);
  clipMergedNeighbors(visibleZones,zoneIndex);
  ctx.strokeStyle=`rgba(${color},${z.established?.68:.42})`;
  ctx.lineWidth=z.established?2.5:1.2;
  ctx.setLineDash(z.established?[]:[5,6]);strokeRegion(z);ctx.setLineDash([]);
  // Region names are drawn after interior marks for legibility.
  ctx.restore();
 }
 // Interior imprints reproduce the three native body grammars, not
 // generic symbols. They accumulate with repeated occupation and fade away.
 const cells=s.interior||[];
 for(let gy=0;gy<IY;gy++)for(let gx=0;gx<IX;gx++){
   const index=gy*IX+gx,c=cells[index];if(!c||!c.imprints)continue;
   const [x,y]=imprintPosition(gx,gy);
   for(let k=0;k<3;k++){
     const v=c.imprints[k];if(v<.065)continue;
     const f=c.forms[k]||.2;
     ctx.save();ctx.translate(x,y);
     ctx.rotate(((gx*17+gy*31+k*7)%29)*.15);
     ctx.strokeStyle=['rgba(54,130,91,','rgba(193,120,89,','rgba(75,134,175,'][k]+Math.min(.53,v*.50)+')';
     ctx.lineWidth=.75+v*.9;ctx.lineCap='round';
     ctx.stroke(imprintPath(index,k,f));ctx.restore();
   }
 }
 // Established regions have high-contrast titles that remain readable
 // above imprints and overlapping architectural textures.
 const labeledGroups=new Set();
 for(const z of (s.zones||[])){
   if(labeledGroups.has(z.groupId))continue;
   let labelX=z.x,labelY=z.y;
   const center=regionGeometry.at(visibleZones,labelX,labelY);
   if(!center||center.region.groupId!==z.groupId){
     let found=false;
     for(let dy=-z.radius*1.5;dy<=z.radius*1.5&&!found;dy+=12){
       for(let dx=-z.radius*2.2;dx<=z.radius*2.2;dx+=12){
         const place=regionGeometry.at(visibleZones,z.x+dx,z.y+dy);
         if(place&&place.region.groupId===z.groupId){labelX=z.x+dx;labelY=z.y+dy;found=true;break}
       }
     }
     if(!found)continue;
   }
   labeledGroups.add(z.groupId);
   const label=z.kind==='rest'?'REST':z.kind==='social'?'GATHER':'EXCHANGE';
   const alpha=z.established?1:Math.max(.48,z.strength*.85);
   ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';
   ctx.font=z.established?'700 17px system-ui':'600 12px system-ui';
   const width=ctx.measureText(label).width+ (z.established?29:18);
   const h=z.established?32:24;
   ctx.fillStyle=z.established?'rgba(255,255,252,.94)':'rgba(255,255,252,.75)';
   ctx.strokeStyle=z.established?'rgba(65,82,73,.45)':'rgba(65,82,73,.15)';
   ctx.lineWidth=z.established?1.5:1;
   ctx.beginPath();ctx.roundRect(labelX-width/2,labelY-h/2,width,h,h/2);ctx.fill();ctx.stroke();
   ctx.fillStyle=z.kind==='rest'?'#53658e':z.kind==='social'?'#96566f':'#917025';
   ctx.globalAlpha=alpha;ctx.fillText(label,labelX,labelY+.5);
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
    const inward=Math.min(12,4+w.branch*10);
    ctx.beginPath();ctx.moveTo(x-ox*inward,y-oy*inward);ctx.lineTo(x+ox*l,y+oy*l);
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
 for(const a of s.agents)drawAvatar(a,ctx,s.tick);
 ctx.fillStyle='#748779';ctx.font='12px system-ui';ctx.fillText('LIVING ARCHITECTURE  /  COHABITATION  ·  LIVING REGIONS',20,28);
 if(placementStep<ROOM_PLACEMENT_ORDER.length&&placementPointer&&placementPreview){
  const kind=placementPreview.kind,color=kind==='rest'?'83,101,142':kind==='social'?'150,86,111':'145,112,37';
  ctx.save();ctx.beginPath();polygonPath(regionGeometry.polygon(placementPreview));
  ctx.fillStyle=placementPreviewValid?`rgba(${color},.22)`:'rgba(166,78,67,.18)';
  ctx.strokeStyle=placementPreviewValid?`rgba(${color},.92)`:'#a64e43';
  ctx.lineWidth=2;ctx.setLineDash([6,5]);ctx.fill();ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle=placementPreviewValid?`rgb(${color})`:'#8c3c34';ctx.font='600 12px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(placementPreviewValid?'PLACE '+regionName(kind).toUpperCase():'MOVE TO CLEAR SPACE',placementPreview.x,placementPreview.y);
  ctx.restore();
 }
}
let lastRenderedEvents=null;
function renderEvents(state){
 const signature=JSON.stringify(state.events);
 if(signature===lastRenderedEvents)return;
 lastRenderedEvents=signature;
 const list=$('events');
 list.replaceChildren();
 const recent=state.events.slice(0,5);
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
function updateUI(){
 const state=viewState||liveState();
 const population=[0,0,0];
 for(const agent of state.agents)population[agent.type]++;
 $('timeLabel').textContent='Tick '+state.tick;
 const totalRegions=new Set(state.zones.map(zone=>zone.groupId)).size;
 const establishedRegions=new Set(state.zones.filter(zone=>zone.established).map(zone=>zone.groupId)).size;
 $('zoneCount').textContent=String(totalRegions-establishedRegions);
 $('permanentCount').textContent=String(establishedRegions);
 $('nGrow').textContent=String(population[0]);
 $('nSpiral').textContent=String(population[1]);
 $('nWave').textContent=String(population[2]);
 $('timeline').max=String(Math.max(0,snapshots.length-1));
 if(!viewState)$('timeline').value=String(snapshots.length-1);
 const placing=placementStep<ROOM_PLACEMENT_ORDER.length;
 $('play').disabled=placing;$('step').disabled=placing;$('timeline').disabled=placing;
 $('play').textContent=placing?'Place rooms first':playing?'Pause':'Play';
 $('placementStatus').textContent=placing
  ?placementSpotInvalid?'That spot is unavailable. Move the '+regionName(ROOM_PLACEMENT_ORDER[placementStep])+' preview inside the enclosure and away from other rooms.':'Place room '+(placementStep+1)+' of 3: '+regionName(ROOM_PLACEMENT_ORDER[placementStep])+'. Move the preview blob inside the enclosure and click. Then place the remaining rooms; the simulation starts after all three are placed.'
  :playing?'All three rooms are placed. The simulation is running.':'All three rooms are placed. Press Play to resume.';
 $('placementStatus').dataset.invalid=placementSpotInvalid?'true':'false';
 canvas.style.cursor=placing?'crosshair':'default';
 $('historyHint').textContent=placing?'The simulation is paused until all three rooms are placed.':viewState?'Viewing tick '+state.tick+'. Press Play to return to the live simulation.':'Drag the timeline to view recent history; playback pauses.';
 renderEvents(state);
 if(state.tick!==lastGuideTick&&(lastGuideTick<0||viewState||!playing||Math.abs(state.tick-lastGuideTick)>=8)){
   renderSpeciesGuide(state);
   lastGuideTick=state.tick;
 }
 draw(state);
}
function frame(timestamp){
 if(!frame.previous)frame.previous=timestamp;
 const elapsed=Math.min(100,timestamp-frame.previous);
 frame.previous=timestamp;
 if(playing&&!viewState){
  let steps=0;
  const threshold=85/Number($('rate').value);
  acc=Math.min(acc+elapsed,threshold*90);
  const start=performance.now();
  while(acc>=threshold&&steps<90&&(steps===0||performance.now()-start<8)){step();acc-=threshold;steps++;}
  if(steps)updateUI();
 }
 requestAnimationFrame(frame);
}
canvas.addEventListener('pointermove',event=>{
 if(placementStep<ROOM_PLACEMENT_ORDER.length&&moveRoomPreview(event))updateUI();
});
canvas.addEventListener('pointerleave',()=>{
 if(placementStep>=ROOM_PLACEMENT_ORDER.length)return;
 placementPointer=null;placementSpotInvalid=false;updateUI();
});
canvas.addEventListener('pointerdown',placeRoom);
$('play').addEventListener('click',()=>{
 if(placementStep<ROOM_PLACEMENT_ORDER.length)return;
 if(viewState){viewState=null;$('timeline').value=String(snapshots.length-1);}
 playing=!playing;
 acc=0;
 $('play').textContent=playing?'Pause':'Play';
 updateUI();
});
$('step').addEventListener('click',()=>{
 if(placementStep<ROOM_PLACEMENT_ORDER.length)return;
 viewState=null;
 playing=false;
 acc=0;
 $('play').textContent='Play';
 step();
 updateUI();
});
$('reset').addEventListener('click',()=>init());
$('restart').addEventListener('click',()=>init(true));
$('timeline').addEventListener('input',event=>{
 if(placementStep<ROOM_PLACEMENT_ORDER.length)return;
 const index=Number(event.currentTarget.value);
 const snapshot=snapshots[index];
 viewState=index===snapshots.length-1?null:{...snapshot,interior:unpackInterior(snapshot.interior)};
 playing=false;
 acc=0;
 $('play').textContent='Play';
 updateUI();
});
for(const id of ['bureaucracy','innovation','abundance','solidarity','adaptability','impermanence','rate']){
 $(id).addEventListener('input',()=>{
  if(id==='rate')acc=0;
  $(id+'Value').textContent=id==='rate'?$(id).value+'\u00d7':$(id).value+'%';
 });
}
init();
requestAnimationFrame(frame);
})();
