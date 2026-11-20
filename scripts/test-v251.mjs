// v2.5.1 regressions: generated fixtures and memory storage only.
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),memory=new Map();
const c={console,performance,atob,btoa,TextEncoder,TextDecoder,setTimeout,clearTimeout,navigator:{hardwareConcurrency:4,deviceMemory:4},matchMedia:()=>({matches:false}),localStorage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)}};
c.window=c;vm.createContext(c);
const load=async src=>vm.runInContext(await readFile(new URL(src,root),'utf8'),c,{filename:src});
for(const[,src]of(await readFile(new URL('index.html',root),'utf8')).matchAll(/<script src="([^"]+)"/g)){await load(src);if(src==='js/save.js')break;}
const C=c.CM,M=C.Metro,copy=x=>JSON.parse(JSON.stringify(x));
C.UI=function(){};for(const src of ['settings','corp','fleet','screens'])await load('js/'+src+'.js');
const F=C.Fleet;
assert.equal(C.CFG.GAME_VERSION,'2.7.2');assert.ok(C.CFG.RULES_REVISION>=12);
assert.equal(C.MAP_ORDER.length,12);assert.equal(F.MODELS.length,56);assert.ok(C.MAPS.ld&&C.Traits);
memory.set('cm1.newsSeen','2.7.0');assert.equal(C.UI.prototype.newsUnread(),false);
memory.set('cm1.newsSeen','2.4.0');assert.equal(C.UI.prototype.newsUnread(),true);
assert.ok(!C.NEWS.some(n=>n.v==='2.7.1'),'Patch release has no new announcement');

C.useMap('tutorial');const g=C.Game.create({mode:'free',tutorial:true,seed:20000101});F.ensure(g);
// A legacy smooth segment must keep its shape and avoid a platform adjustment charge on extension.
const off=M.empty(),lid=M.newLine(off),a=M.addStation(off,10,10,{size:'M',type:'underground'},g.city),b=M.addStation(off,18,10,{size:'M',type:'underground'},g.city);
const ab=M.addSegment(off,lid,a,b,[],'underground').id;off.segments[ab].curve='smooth';
const oldControl=JSON.stringify(M.segControl(off,off.segments[ab])),oldGeometry=JSON.stringify(M.segGeom(off,off.segments[ab],g.city).pts);
const n=M.clone(off),end=M.addStation(n,15,16,{size:'M',type:'underground'},g.city),bc=M.addSegment(n,lid,b,end,[],'underground').id;n.segments[bc].curve='arc';M.lockPlatform(n,off,b,lid);
assert.equal(JSON.stringify(M.segControl(n,n.segments[ab])),oldControl);
assert.equal(JSON.stringify(M.segGeom(n,n.segments[ab],g.city).pts),oldGeometry);
assert.equal(M.platDirChanged(off,n,b,lid),false);
assert.ok(!M.evaluate(n,off,g.city,2000).changes.mod.some(x=>x.includes('调整站台方向')));
const t0=M.stationTangent(n,n.segments[ab],b),t1=M.stationTangent(n,n.segments[bc],b);assert.ok(t0[0]*t1[0]+t0[1]*t1[1]<-.999);
const savedGeometry=copy(n);assert.equal(JSON.stringify(M.segGeom(savedGeometry,savedGeometry.segments[ab],g.city).pts),oldGeometry);
// Arc geometry must survive station insertion, shared tracks and removing the inserted station.
const arc=M.empty(),al=M.newLine(arc),as=M.addStation(arc,10,10,{size:'M',type:'underground'},g.city),bs=M.addStation(arc,26,10,{size:'M',type:'underground'},g.city),ag=M.addSegment(arc,al,as,bs,[],'underground').id;arc.segments[ag].curve='arc';
const second=M.newLine(arc),cg=M.addSegment(arc,second,as,bs,[],'underground').id;arc.segments[cg].curve='arc';
const inserted=M.splitSegment(arc,ag,18,10,{size:'M',type:'underground'},g.city).station;
assert.equal(M.validate(arc),null);assert.ok(Object.values(arc.segments).every(s=>s.curve==='arc'));assert.equal(M.stationLines(arc,inserted).length,2);
M.removeStation(arc,inserted);assert.equal(M.validate(arc),null);assert.ok(Object.values(arc.segments).every(s=>s.curve==='arc'));
const fit=M.empty(),fl=M.newLine(fit),fa=M.addStation(fit,8,8,{size:'M',type:'underground'},g.city),fb=M.addStation(fit,24,15,{size:'M',type:'underground'},g.city),fg=M.addSegment(fit,fl,fa,fb,[[8.1,8.1]],'underground').id;
const fixed=M.autoFit(fit,fg,g.city,M.empty());assert.ok(!fixed.error,fixed.error);assert.ok(M.segGeom(fit,fit.segments[fg],g.city).minRadiusM>=M.minRadius(fit.lines[fl]));
const impossible=M.empty(),il=M.newLine(impossible);impossible.lines[il].speed=120;
const ia=M.addStation(impossible,10,10,{size:'M',type:'underground'},g.city),ib=M.addStation(impossible,10.2,10.2,{size:'M',type:'underground'},g.city),ig=M.addSegment(impossible,il,ia,ib,[],'underground').id;
M.setPlatformDir(impossible,ia,il,0);M.setPlatformDir(impossible,ib,il,Math.PI/2);const beforeFit=JSON.stringify(impossible);
assert.ok(M.autoFit(impossible,ig,g.city,M.clone(impossible)).error);assert.equal(JSON.stringify(impossible),beforeFit);
console.log('PASS legacy alignment, platform billing, opposite ends, arcs, shared insertion/removal and auto-fit rollback');

// Use a real operating network to allocate idle vehicles; incompatible vehicles and manual lines stay untouched.
let sample;
for(let y=5;y<g.city.H-5&&!sample;y++)for(let x=5;x<g.city.W-22&&!sample;x++){
 if([0,4,8,12,16].some(dx=>!M.checkSite(g.city,x+dx,y,'underground').ok))continue;
 const net=M.empty(),line=M.newLine(net),ids=[0,4,8,12,16].map(dx=>M.addStation(net,x+dx,y,{size:'M',type:'underground'},g.city));
 for(let k=1;k<ids.length;k++)M.addSegment(net,line,ids[k-1],ids[k],[],'underground');
 if(!M.evaluate(net,g.net,g.city,2000).conflicts.length)sample={net,line};
}
assert.ok(sample);g.edit(net=>Object.assign(net,sample.net));assert.equal(g.confirmDraft().ok,true);g.model.solveNow(2);F.ensure(g);
const line=sample.line;g.clock.y=2010;g.econ.cur.y=2010;g.model.setYear(2010);g.net.lines[line].speed=100;g.compiled=M.compile(g.net,g.city);g.model.setNetwork(g.compiled);g.model.solveNow(2);
g.fleet.trains=[];g.fleet.ver++;g.econ.mode='challenge';g.econ.funds=1e9;
const fast=F.available(g.mapId,g.clock.y).find(m=>m.kmh>=100),slow=F.available(g.mapId,g.clock.y).find(m=>m.kmh<100);assert.ok(fast&&slow);
assert.equal(F.buy(g,null,null,fast.id,4,2).ok,true);const compatible=g.fleet.trains.map(t=>t.id);
assert.equal(F.buy(g,null,null,fast.id,8,1).ok,true);assert.equal(F.buy(g,null,null,slow.id,4,1).ok,true);
const fleetBefore=JSON.stringify(g.fleet.trains),plan=F.allocPlan(g);assert.equal(JSON.stringify(g.fleet.trains),fleetBefore);assert.equal(plan.moved,2);assert.equal(plan.left,2);
assert.deepEqual(Array.from(plan.needs.flatMap(x=>x.ids)).sort(),compatible.sort());
const cash=g.econ.funds;assert.equal(F.applyAlloc(g,plan),2);assert.equal(g.econ.funds,cash);
g.model.solveNow(2);assert.ok(g.model.trafficReady());
const order=F.allocPlan(g),fill=F.fillCost(g,order);assert.ok(fill.cost>0);const preview=fill.cost;
g.clock.m++;assert.equal(F.confirmAlloc(g,order,fill).stale,true);g.clock.m--;
const capex=g.econ.capex,beforeOrder=JSON.stringify(g.fleet.trains);g.econ.capex=0;g.econ.funds=0;
assert.ok(F.confirmAlloc(g,order,fill).error);assert.equal(JSON.stringify(g.fleet.trains),beforeOrder);assert.equal(g.econ.funds,0);
g.econ.funds=cash;g.econ.capex=capex;assert.equal(F.confirmAlloc(g,order,fill).ok,true);
assert.equal(F.confirmAlloc(g,order,fill).stale,true,'A confirmed quote may only be applied once');
assert.ok(Math.abs(cash-g.econ.funds-preview)<1e-5);assert.equal(F.allocPlan(g).unmet,0);
F.setMode(g,line,'manual');assert.equal(F.allocPlan(g).needs.length,0);F.setMode(g,line,'auto');
g.fleet.autoAlloc=true;const fleetRoundTrip=C.Game.restore(copy(g.serialize()));assert.equal(fleetRoundTrip.fleet.autoAlloc,true);assert.equal(fleetRoundTrip.econ.funds,g.econ.funds);
console.log('PASS idle allocation, platform/speed/manual exclusions, previewed purchase cost and saved fleet preference');

{
  const routes = [80, 100, 80, 80, 80].map((kmh, i) => ({ lineId: 'l' + (i + 1), baseKey: 's' + i, label: 'route ' + i,
    loop: false, kmh, cars: i === 3 ? 8 : i === 4 ? 6 : 4, cap: 1600, cycleSec: 3600, lenM: 2000, stIds: ['s1', 's2'], stIdx: [0, 1] }));
  const lines = Object.fromEntries(routes.map(r => [r.lineId, {}])), compiled = { routes };
  const net = { C: compiled, R: routes.length, rideEdge: routes.map(() => []) };
  const period = values => ({ freq: new Float32Array(values.length), needDir: Float32Array.from(values.flatMap(n => [n, n])) });
  const wd = { per: [period([1, 1, 1, 1, 1])] }, we = { per: [period([1, 1, 1, 2, 1])] };
  let ready = false, settled = false, mutations = 0;
  const train = (id, model, cars, i) => ({ id, model, cars, line: i == null ? null : routes[i].lineId, svc: i == null ? null : routes[i].baseKey });
  const spare = () => train('reserve', 'gen-auto', 6, 3);
  const stock = [train('fast', 'gen-auto', 4), train('slow', slow.id, 4), train('extra-short', slow.id, 4, 3),
    train('extra-long', slow.id, 6, 3), train('keep-a', 'gen-auto', 6, 3), train('keep-b', 'gen-auto', 6, 3), spare(), train('manual', 'gen-auto', 6, 4)];
  const game = { compiled, net: { lines }, clock: { y: 2010, m: 7 }, ym() { return 2010 * 12 + this.clock.m - 1; },
    fleet: { trains: stock, ops: { l5: { mode: 'manual', n: {} } }, autoAlloc: true, ver: 0 },
    model: { net, resultsFor: dt => dt === 'we' ? we : wd, trafficReady: () => ready, get settled() { return settled; }, applyFleet: () => mutations++ },
    logEvent() {}, touch() {}, emit() {} };
  game.fleet.autoAllocYm = game.ym();  // Export from before the allocator tracked fleet versions.
  assert.equal(F.autoAllocate(game), 0);
  const unsettled = F.allocPlan(game);
  assert.equal(F.applyAlloc(game, unsettled), 0);
  assert.equal(F.confirmAlloc(game, unsettled, null).stale, true);
  ready = true;
  assert.equal(F.autoAllocate(game), 0, 'Published interim results do not consume the allocation revision');
  settled = true;
  assert.equal(F.confirmAlloc(game, unsettled, null).stale, true, 'A preview built without current weekend results expires on completion');
  const proposal = F.allocPlan(game);
  assert.equal(proposal.unmet, 0, 'A train returning to the depot fills the gap in the same round');
  assert.equal(proposal.moved, 3);
  assert.equal(proposal.reused, 1);
  assert.equal(proposal.returnedByLine.get('l4'), 2);
  assert.equal(F.fillCost(game, proposal).rows.length, 0);
  assert.equal(F.autoAllocate(game), 4, 'Reuses an idle train after returning it and counts each affected train once');
  assert.equal(stock.find(t => t.id === 'fast').line, 'l2', 'Reserves the only fast train for the fast route');
  assert.equal(stock.find(t => t.id === 'extra-long').line, null);
  assert.equal(stock.find(t => t.id === 'extra-short').line, 'l3');
  assert.equal(stock.filter(t => t.line === 'l4').length, 3, 'Keeps the busier weekend requirement and one spare');
  assert.equal(stock.find(t => t.id === 'manual').line, 'l5');
  assert.equal(F.autoAllocate(game), 0);
  assert.equal(mutations, 1);
  assert.equal(stock.length, 8);
  assert.equal(game.fleet.autoAllocVer, game.fleet.ver);

  const beforeEdit = F.allocPlan(game);
  stock.push(train('late-extra', 'gen-auto', 6, 3));
  game.fleet.ver++;   // A stopping-pattern edit also bumps this revision.
  ready = false;
  assert.equal(F.confirmAlloc(game, beforeEdit, null).stale, true);
  assert.equal(F.autoAllocate(game), 0, 'An edit made within the month waits for recalculation');
  assert.equal(stock.find(t => t.id === 'late-extra').line, 'l4');
  ready = true;
  assert.equal(F.autoAllocate(game), 1, 'A same-month change can trigger a second allocation');
  assert.equal(stock.filter(t => t.line === 'l4').length, 3);
  assert.equal(F.autoAllocate(game), 0, 'A completed allocation consumes its own revision');
  assert.equal(mutations, 2);

  const planFor = trains => {
    game.fleet.trains = trains;
    game.fleet.ver++;
    return F.allocPlan(game);
  };
  const returnsFor = trains => Array.from(planFor(trains).returned);
  assert.deepEqual(returnsFor([train('long-old', 'gen-early', 6, 3), train('short-new', 'gen-auto', 4, 3),
    train('long-new', 'gen-auto', 6, 3), spare()]), ['short-new'], 'Shorter trains take priority even over older longer trains');
  assert.deepEqual(returnsFor([train('old-model', 'gen-a', 6, 3), train('new-model', 'gen-eco', 6, 3),
    train('large-model', 'gen-auto', 6, 3), spare()]), ['old-model'], 'Model introduction year breaks a tie in train length');
  assert.deepEqual(returnsFor([{ ...train('new-unit', 'gen-a', 6, 3), bought: 24100 },
    { ...train('old-unit', 'gen-a', 6, 3), bought: 24000 }, train('third-unit', 'gen-auto', 6, 3), spare()]), ['old-unit']);
  assert.deepEqual(returnsFor([train('high-cap-short', 'gen-auto', 4, 3), train('low-cap-long-a', 'gen-early', 6, 3),
    train('low-cap-long-b', 'gen-early', 6, 3), train('low-cap-long-c', 'gen-early', 6, 3)]), ['low-cap-long-a'], 'The return order preserves the capacity needed by the remaining trains');

  const serving = train('serving', 'gen-a', 6, 3), tooShort = train('same-model-short', 'gen-a', 4);
  const typeMatch = planFor([serving, tooShort, train('same-model-long', 'gen-a', 6), train('more-capacity', 'gen-auto', 6)]);
  assert.deepEqual(Array.from(typeMatch.needs.find(n => n.lid === 'l4').ids), ['same-model-long'], 'A matching model beats a higher-capacity substitute');
  const sameFormation = planFor([serving, train('same-six', 'gen-a', 6), train('same-eight', 'gen-a', 8)]);
  assert.deepEqual(Array.from(sameFormation.needs.find(n => n.lid === 'l4').ids), ['same-six'], 'A matching formation beats a longer train of the same model');
  const longerFallback = planFor([serving, train('same-eight', 'gen-a', 8), train('other-six', 'gen-auto', 6)]);
  assert.deepEqual(Array.from(longerFallback.needs.find(n => n.lid === 'l4').ids), ['same-eight'], 'A longer train of the same model fills the gap once the matching formation runs out');
  const fallback = planFor([serving, tooShort, train('compatible-substitute', 'gen-auto', 6)]);
  assert.deepEqual(Array.from(fallback.needs.find(n => n.lid === 'l4').ids), ['compatible-substitute'], 'A shorter matching model is ineligible');
  const purchase = planFor([serving, tooShort]);
  const quote = F.fillCost({ ...game, mapId: 'gz', econ: { costIndex: () => 1 } }, purchase);
  assert.equal(quote.rows.find(row => row.x.lid === 'l4').cars, 6);
  assert.equal(quote.rows.find(row => row.x.lid === 'l4').m.id, 'gen-a');

  we.per = [period([1, 1, 1, 3, 1])];
  const mixed = planFor([serving, train('running-eight', 'ld-59', 8, 3),
    train('matching-six', 'gen-a', 6), train('matching-eight', 'ld-59', 8)]);
  assert.deepEqual(Array.from(mixed.needs.find(n => n.lid === 'l4').ids), ['matching-eight'], 'A mixed roster prefers the longer of two exact matches even with a lower capacity');
  we.per = [period([1, 1, 1, 20, 1])];
  const many = Array.from({ length: 24 }, (_, i) => train('train-' + i, 'gen-a', 6, 3));
  assert.equal(returnsFor(many).length, 2, 'Twenty working trains require two idle spares on the route');
  const shortOnStock = planFor(many.slice(0, 19)).needs.find(n => n.lid === 'l4');
  assert.equal(shortOnStock.short, 1, 'The reserve does not enlarge the replenishment target');
  we.per = [period([1, 1, 1, 2, 1])];

  routes[2].lineId = 'l4';
  const crossBranch = planFor([serving, tooShort]);
  const branchNeed = crossBranch.needs.find(n => n.svc === routes[2].baseKey);
  assert.equal(branchNeed.minCars, 6, 'The line-wide minimum protects an empty branch');
  assert.equal(branchNeed.ids.length, 0);
  assert.equal(F.fillCost({ ...game, mapId: 'gz', econ: { costIndex: () => 1 } }, crossBranch).unavailable, true);

  routes[2].cars = 6;
  const afterReturns = planFor([serving, train('second-long', 'gen-a', 6, 3), train('third-long', 'gen-a', 6, 3), train('short-surplus', 'gen-a', 4, 3)]);
  assert.deepEqual(Array.from(afterReturns.returned), ['short-surplus']);
  const afterReturnsBranch = afterReturns.needs.find(n => n.svc === routes[2].baseKey);
  assert.equal(afterReturnsBranch.minCars, 6);
  assert.equal(afterReturnsBranch.ids.length, 0, 'The minimum is checked against the stock remaining after returns');
  assert.equal(afterReturns.reused, 1, 'The shorter train remains available for another compatible line');
}
console.log('PASS same-round reuse, return priority, matching formations, mixed-fleet priority and peak reserve');

// v2.5.0 originals get an exact backup; historical fare, accounts, assets and task data survive the upgrade.
const old=copy(g.serialize());old.rulesRevision=6;delete old.econ.fareMark;delete old.econ.fareAuto;delete old.econ.fareNote;delete old.fleet.autoAlloc;
const oldBody=JSON.stringify(old),oldRaw=JSON.stringify({format:C.CFG.SAVE_FORMAT,version:2,gameVersion:'2.5.0',savedAt:Date.now(),body:oldBody,checksum:C.U.fnv(oldBody)});
const imported=await C.Save.importText(oldRaw),payload=await C.Save.load(imported.slotId);assert.ok(payload.__backupSlot);
assert.equal(JSON.parse(memory.get(C.Save.slotInfo(payload.__backupSlot).key)).body,oldBody);
const upgraded=C.Game.restore(payload);assert.equal(upgraded.econ.funds,old.econ.funds);assert.equal(JSON.stringify(upgraded.net),JSON.stringify(old.net));assert.equal(JSON.stringify(upgraded.econ.ledger),JSON.stringify(old.econ.ledger));
assert.equal(upgraded.econ.fareAuto,null);assert.equal(upgraded.econ.fareMark,null);assert.equal(upgraded.fleet.autoAlloc,undefined);
assert.equal(JSON.stringify(upgraded.econ.fare),JSON.stringify(C.Economy.normFare(old.econ.fare)));
console.log('PASS exact v2.5.0 backup and opt-in defaults without historical charges or network changes');

C.useMap('bj');
const econ=new C.Economy('challenge',1990,1);econ.fare={mode:'flat',flat:2};const ym=C.U.ymIndex(1990,1);
assert.equal(C.Model.fareRef(1990),2);assert.ok(Math.abs(econ.fareHikeEffect({mode:'flat',flat:2.5},1990)+5.5)<1e-8);
assert.equal(econ.fareHikeEffect({mode:'flat',flat:2.5},2000),-.5);
econ.setFare({mode:'flat',flat:2.5},1990,1);assert.equal(econ.mods[0].until,ym+5);assert.equal(econ.mods[0].fareHike,true);
econ.setFare({mode:'flat',flat:4},1990,1);assert.equal(econ.mods[0].delta,-10);const md=JSON.stringify(econ.mods);econ.setFare({mode:'flat',flat:1.5},1990,2);assert.equal(JSON.stringify(econ.mods),md);
const legacyEcon=econ.serialize();delete legacyEcon.fareMark;delete legacyEcon.fareAuto;const legacyFare=C.Economy.restore(legacyEcon);assert.equal(legacyFare.fareMark,null);assert.equal(legacyFare.fareHikeEffect({mode:'flat',flat:1.8},2000),-.5);
const auto=new C.Economy('challenge',2000,1);auto.setFareAuto(true,2000);const base=auto.fare.flat;assert.equal(auto.fareYearly(2001,1).changed,true);assert.ok(auto.fare.flat>base);const fareOnce=JSON.stringify(auto.fare),modsOnce=JSON.stringify(auto.mods);assert.equal(auto.fareYearly(2001,1).changed,false);assert.equal(JSON.stringify(auto.fare),fareOnce);assert.equal(JSON.stringify(auto.mods),modsOnce);
const restoredAuto=C.Economy.restore(copy(auto.serialize()));assert.equal(restoredAuto.fareYearly(2001,1).changed,false);assert.equal(JSON.stringify(restoredAuto.fareAuto),JSON.stringify(auto.fareAuto));
for(const invalid of [{flat:2,inc:0,cap:0,idx:0},{flat:-2,inc:0,cap:0,idx:1},{flat:2,idx:1},{flat:2,inc:0,cap:0,idx:'1'}]){
 const payload=copy(auto.serialize());payload.fareAuto=invalid;payload.fareMark='invalid';payload.fareNote='invalid';
 const restored=C.Economy.restore(payload);assert.equal(restored.fareAuto,null);assert.equal(restored.fareMark,null);assert.equal(restored.fareNote,0);restored.fareYearly(2002,1);assert.ok(Number.isFinite(restored.fare.flat));
}
for(const y of [1990,2000,2020])for(const f of [{mode:'flat',flat:3},{mode:'dist',flat:2,km0:6,step:6,inc:1,cap:7}]){
 const vot=C.U.interp(C.CFG.choice.vot,y),tab=C.Model.fareTab(f,y,vot),fp=C.Model.fareParams(f);assert.ok(tab.every(Number.isFinite));
 for(let n=0;n<tab.length;n++){const km=n?fp.km0+(n-.5)*fp.step:Math.min(fp.km0,C.CFG.fareDist.km0);assert.ok(Math.abs(tab[n]-C.Model.fareMinAt(f,km,y,vot))<1e-8);}
}
const ref=C.Model.fareRef(1990),vot=C.U.interp(C.CFG.choice.vot,1990);assert.equal(C.Model.fareMinutes(ref,ref,vot),ref/vot*60);assert.ok(C.Model.fareMinutes(ref*1.25,ref,vot)<ref*1.25/vot*60);
C.useMap('hk');assert.ok(C.fareRangeNow({clock:{y:2020},econ:{costIndex:y=>C.U.priceIndex(y,C.CFG.cost.inflation,C.CFG.econBase)}}).max>5);
console.log('PASS fare elasticity, inflation allowance, six-month penalty, annual idempotence, lookup table and legacy restore');

// The same worker fault must release the request and wake the async browser loading/jump driver.
const pool=C.SkimPool;let wakes=0;C.CarPool.onReq=()=>wakes++;
const req={id:1,parts:[],left:1,done:false,failed:false};pool.done({job:{req,part:0}},{req:1});await Promise.resolve();assert.equal(req.done,true);assert.equal(wakes,1);
const bad={id:2,parts:[],left:1,done:false,failed:false};pool.done({job:{req:bad,part:0}},{req:3});await Promise.resolve();assert.equal(bad.failed,true);assert.equal(pool.off,true);assert.equal(wakes,2);C.CarPool.onReq=null;
console.log('PASS worker completion and mismatched-message fallback wake waiting requests');

// Real maps: facilities use land and viable districts; the missing Beijing terminal now gets a model.
for(const id of ['wh','bj','tk']){
 C.useMap(id);const city=new C.City();city.generate(12345,2024);city.unlockAll=true;
 const list=C.Fac.list(city);
 for(const f of list.filter(f=>f.gen)){assert.ok(!city.regions[f.gen.k].hub);assert.notEqual(city.regions[f.gen.k].open,null);assert.ok(city.landMax[city.cellAt(f.x,f.y)]>=.5);}
 if(id==='wh'){const model=new C.Model(city,{deferDemand:true});model.setYear(2024);model.buildZones();assert.equal(model.fn.reach.length,model.fn.F);assert.ok(model.fn.reach.every(d=>d>=0&&d<=1000));assert.ok(list.some(f=>f.name.includes('蔡甸')&&f.gen));}
 if(id==='bj'){await load('js/render.js');await load('js/scenery.js');const ctx=new Proxy({},{get:(o,k)=>o[k]||(()=>{})}),R=new C.Renderer({getContext:()=>ctx});assert.ok(R.hubModels(city,2024).some(x=>x.id==='hbj_pek'));}
 if(id==='tk'){const f=list.find(f=>f.id==='tk_narita');assert.ok(f?.ext);assert.equal(C.Fac.active(f,1978+3/12,city),false);assert.equal(C.Fac.active(f,1978+4/12,city),true);const p=C.Fac.portal(f);assert.ok(p.x>=0&&p.x<city.W&&p.y>=0&&p.y<city.H);}
}
console.log('PASS road-aware district facilities, airport exclusions, Beijing terminal and Narita opening month');
await load('js/locales/en.js');await load('js/i18n.js');C.I18n.apply('en');
assert.equal(C.I18n.text('中'),'Medium');
assert.equal(C.I18n.text('出售列车 · DK 系列 4 节'),'Sell Trains · DK series 4 cars');
assert.equal(C.I18n.text('已购买 DK 系列 4 节 × 7 列，停入车辆段'),'Bought DK series 4 cars × 7, kept in the depot');
assert.equal(C.I18n.text('已购买 DK 系列 4 节 × 7 列，配属1 号线'),'Bought DK series 4 cars × 7, assigned to Line 1');
assert.equal(C.I18n.text('随线配属列车 · 1 号线：2 列（DK 系列 4 节）'),'Trains for Line 1: 2 (DK series 4 cars)');
assert.equal(C.I18n.text('共 13 步 · 约 12 分钟'),'13 steps · about 12 min');
assert.equal(C.I18n.text('H 显示界面 · Esc 暂停并打开菜单'),'H shows the interface · Esc pauses and opens the menu');
assert.equal(C.I18n.text('恢复居民出行'),"Restoring residents' travel");
assert.equal(C.I18n.missing().length,0);
console.log('PASS complete English size, sale title, follow controls, load progress and tutorial duration');
console.log('PASS web v2.5.1 patch regressions');
