// Exercise the real frame renderer and heat calculation with memory canvases.
// Terrain/vehicle drawing is omitted so the test observes the analysis overlay.
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root = new URL('../',import.meta.url), draws=[];
function canvas() {
  const cv={width:800,height:600};
  const ctx=new Proxy({canvas:cv,createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:img=>{cv.pixels=new Uint8ClampedArray(img.data);},drawImage:source=>draws.push(source),measureText:s=>({width:String(s).length*8})},{get:(o,k)=>k in o?o[k]:()=>{}});
  cv.getContext=()=>ctx;return cv;
}
const context={console,performance,atob,btoa,TextEncoder,TextDecoder,setTimeout,clearTimeout,navigator:{hardwareConcurrency:4,deviceMemory:4},matchMedia:()=>({matches:false}),localStorage:{getItem:()=>null,setItem(){},removeItem(){}}};
context.window=context;vm.createContext(context);
for(const [,src]of(await readFile(new URL('index.html',root),'utf8')).matchAll(/<script src="([^"]+)"/g)){
  vm.runInContext(await readFile(new URL(src,root),'utf8'),context,{filename:src});if(src==='js/save.js')break;
}
vm.runInContext(await readFile(new URL('js/settings.js',root),'utf8'),context,{filename:'js/settings.js'});
vm.runInContext(await readFile(new URL('js/render.js',root),'utf8'),context,{filename:'js/render.js'});
context.document={createElement:name=>{assert.equal(name,'canvas');return canvas();}};
const C=context.CM,M=C.Metro;C.useMap('tutorial');const g=C.Game.create({mode:'free',tutorial:true,seed:20000101});
let net;
for(let y=5;y<g.city.H-5&&!net;y++)for(let x=6;x<g.city.W-10&&!net;x++){
  if(!M.checkSite(g.city,x,y,'underground').ok||!M.checkSite(g.city,x+5,y,'underground').ok)continue;
  const n=M.empty(),l=M.newLine(n),a=M.addStation(n,x,y,{size:'M',type:'underground'},g.city),b=M.addStation(n,x+5,y,{size:'M',type:'underground'},g.city);
  M.addSegment(n,l,a,b,[],'underground');if(!M.evaluate(n,g.net,g.city,g.clock.y).conflicts.length)net=n;
}
assert.ok(net);g.edit(n=>Object.assign(n,net));assert.equal(g.confirmDraft().ok,true);
for(const s of Object.values(g.net.stations))s.built=[1996,1];
for(let c=0;c<g.city.N;c++)if(g.city.lu[c]!==C.LU.WATER){g.city.pop[c]+=500;g.city.jobs[c]+=400;}
for(let b=0;b<g.startBase.d.length;b++)g.startBase.d[b]=Math.max(0,g.startBase.d[b]-4);
g.eraBase=JSON.parse(JSON.stringify(g.startBase));g.city.version++;
const before=JSON.stringify(g.serialize());
const R=new C.Renderer(canvas());R.game=g;R.w=800;R.h=600;R.cam.cx=24;R.cam.cy=20;R.cam.zoom=R.cam.tz=12;R.overviewStale=false;R.agentsOn=false;
R.resize=()=>{};R.updateCamera=()=>R.computeTransform();R.syncFacModels=()=>{};R.markDirty=()=>{};R.rasterLevel=()=>0;R.prefetch=()=>{};
for(const name of Object.getOwnPropertyNames(C.Renderer.prototype))if(name.startsWith('draw'))R[name]=()=>{};
C.R=R;
let cases=0;
for(const view of [0,1])for(const basis of ['era','start'])for(const mode of ['land','pull']){
  R.cam.view=R.cam.t=view;R.layer='dev';R.layerFade=1;R.layerOpt.devB=basis;R.layerOpt.devK=mode;draws.length=0;
  R.render(1/60,null);
  assert.ok(R.heat&&draws.includes(R.heat),`${view?'2.5D':'2D'} ${basis}/${mode}: heat overlay must reach the frame canvas`);
  const coloured=R.heat.pixels?.some((v,i)=>i%4===3&&v>0);assert.ok(coloured,`${basis}/${mode}: expected non-empty development colours`);
  const cached=R.heat;R.layer='none';R.render(1/60,null);R.layer='dev';draws.length=0;R.render(1/60,null);
  assert.ok(draws.includes(cached),`${basis}/${mode}: cached overlay must draw after reopening`);
  cases++;
}
assert.equal(JSON.stringify(g.serialize()),before,'Viewing layers must not alter progress');
console.log('PASS development layer: '+cases+' 2D/2.5D, basis and metric combinations draw non-empty overlays; cached reopening and progress preservation');

R.layer = 'dev';
const H = C.DevelopmentHistory, city = g.city, cells = [];
for (let c = 0; c < city.N && cells.length < 4; c++) if (city.lu[c] !== C.LU.WATER) cells.push(c);
assert.equal(cells.length,4);
const [gain, loss, entrant, same] = cells;
city.pop[gain] = 100; city.pop[loss] = 100; city.pop[entrant] = 0; city.pop[same] = 100;
city.jobs[gain] = 100; city.jobs[loss] = 100; city.jobs[entrant] = 0; city.jobs[same] = 100;
g.populationHistory = new H(city,{y:2026,m:5,d:20});
g.jobsHistory = new H(city,{y:2026,m:6,d:20},null,'jobs');
for (const [kind, date] of [['pop','2026-05-20'],['jobs','2026-06-20']]) {
  R.layerOpt.devK = kind;
  assert.equal(H.label(R.developmentWindow().start),date);
  R.buildHeat();
  assert.ok(!R.heat.pixels.some((v,i)=>i%4===3&&v>0),'A single snapshot has no growth');
}
city.pop[gain] = 150; city.pop[loss] = 0; city.pop[entrant] = 25;
city.jobs[gain] = 225; city.jobs[loss] = 60; city.jobs[entrant] = 40;
g.populationHistory.capture(city,{y:2026,m:6,d:1});
g.jobsHistory.capture(city,{y:2026,m:7,d:1});
for (const kind of ['pop','jobs']) for (const metric of ['rate','net']) {
  R.layerOpt.devK = kind;
  R.developmentWindows[kind].metric = metric;
  R.buildHeat();
  const pixel = (c, offset = 0) => {
    const x = c%city.W, y = Math.floor(c/city.W);
    return Array.from(R.heat.pixels.slice((y*4*city.W+x*2+offset)*4,(y*4*city.W+x*2+offset)*4+4));
  };
  assert.deepEqual(pixel(gain).slice(0,3), [200,50,50], kind + ' gain is red');
  assert.deepEqual(pixel(loss).slice(0,3), [40,70,190], kind + ' loss is blue');
  assert.deepEqual(pixel(entrant).slice(0,3), [200,50,50], kind + ' growth from zero is red');
  assert.ok(pixel(entrant)[3]>pixel(entrant,1)[3],'Growth from zero has a stripe');
  assert.equal(pixel(same)[3],0);
  const heat = R.heat;
  R.buildHeat();
  assert.strictEqual(R.heat,heat);
}
assert.equal(H.label(R.developmentWindow().start),'2026-06-20');
assert.equal(H.label(R.developmentWindow().end),'2026-07-01');
R.developmentWindows.jobs.months = 1;
R.layerOpt.devK = 'pop';
assert.equal(R.developmentWindows.pop.months,3);
assert.equal(H.label(R.developmentWindow().start),'2026-05-20');
assert.equal(H.label(R.developmentWindow().end),'2026-06-01');
console.log('PASS merged population and jobs overlays, exact parcels, independent dates, red growth, blue decline and cache');
