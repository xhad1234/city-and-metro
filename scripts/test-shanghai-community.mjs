import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const context = {
  console, performance, atob, btoa, TextEncoder, TextDecoder, setTimeout, clearTimeout,
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  navigator: { hardwareConcurrency: 4 }, matchMedia: () => ({ matches: false }),
};
context.window = context;
vm.createContext(context);
const html = await readFile(new URL('index.html', root), 'utf8');
for (const [, file] of html.matchAll(/<script src="([^"]+)"/g)) {
  vm.runInContext(await readFile(new URL(file, root), 'utf8'), context, { filename: file });
  if (file === 'js/save.js') break;
}
const CM = context.CM;
CM.useMap('sh');
const { City, CFG, DATA, Eras, Fac, Traits } = CM;
const sh = CM.MAPS.sh;
assert.deepEqual(Array.from(Traits.validate(sh)), []);
assert.equal(new Set(sh.geo.admin.filter(a => a[0] === 6).map(a => sh.geo.names[a[1]]).filter(n => /区$/.test(n))).size, 16);
assert.equal(CFG.growth.histEnd, 2026);
assert.equal(Eras.current(2021).name, '后疫情时代');
assert.equal(Eras.current(2027).name, '喜迎奥运');
assert.equal(Eras.current(2036.92).name, '喜迎奥运');
assert.equal(Eras.current(2037).name, '模拟未来');
assert.ok(Eras.demand(2022 + 3 / 12).rate[0] < Eras.demand(2022 + 5 / 12).rate[0]);
assert.ok(Eras.demand(2036 + 7 / 12).hub > Eras.demand(2036 + 8 / 12).hub);
assert.ok(Eras.demand(2036 + 7 / 12).hub > Eras.demand(2040 + 7 / 12).hub);
assert.equal(DATA.events.find(e => e.title === '上海获得 2036 年夏季奥运会主办权').y, 2027);
assert.ok(Eras.finance(2027 + 8 / 12).grant > 1);
assert.ok(Eras.finance(2031).grant > 1);
assert.equal(Eras.finance(2042).grant, 1);

const city = new City();
const started = performance.now();
city.generate(19900101, 2020);
console.log('Shanghai terrain and road graph generated in', Math.round(performance.now() - started), 'ms');
const { lon0, lat0, kx, ky } = sh.geo.proj;
const point = (lat, lon) => [(lon - lon0) * kx, (lat0 - lat) * ky];
const mask = y => city.lockMaskFor(Uint8Array.from(city.regions, r => r.open != null && r.open <= y ? 1 : 0));
const beforeNear = mask(2014), afterNear = mask(2015), beforeFar = mask(2019), afterFar = mask(2020);
const check = (name, lat, lon, id, before, after) => {
  const p = point(lat, lon), c = city.cellAt(...p);
  assert.ok(c >= 0 && city.landFrac[c] >= 0.5, name + ' must be on land');
  assert.equal(city.regionAt(...p).id, id, name + ' region');
  assert.equal(before[c], 1, name + ' must be locked before opening');
  assert.equal(after[c], 0, name + ' must allow building after opening');
};
check('吴泾', 31.04055, 121.45085, 'wujing', beforeNear, afterNear);
check('嘉定新城', 31.3637, 121.2549, 'jiading_new', beforeNear, afterNear);
check('浦东机场', 31.1519, 121.8015, 'pvg', beforeNear, afterNear);
check('松江', 31.0073, 121.2304, 'songjiang', beforeFar, afterFar);
check('青浦', 31.1514, 121.1159, 'qingpu', beforeFar, afterFar);
check('奉贤', 30.9247, 121.4712, 'fengxian', beforeFar, afterFar);
check('金山', 30.7224, 121.3332, 'jinshan', beforeFar, afterFar);
check('临港', 30.9165, 121.9060, 'lingang', beforeFar, afterFar);
check('崇明岛', 31.6234, 121.3960, 'chongming', beforeFar, afterFar);
check('长兴岛', 31.3931, 121.7179, 'changxing', beforeFar, afterFar);
check('横沙岛', 31.3423, 121.8441, 'hengsha', beforeFar, afterFar);
const streets = city.townships.slice(1);
assert.equal(streets.length, 219);
assert.ok(streets.every(t => t.cells > 0 && city.townshipAt(t.x, t.y) === t));
assert.equal(streets.filter(t => t.mapLabel).length, 142);
for (const [lat, lon, expected] of [
  [31.0753065, 121.5445815, '浦江镇'], [31.11610, 121.04601, '朱家角镇'],
  [31.301946, 121.100839, '花桥镇'], [30.9490393, 121.6381719, '头桥街道'],
]) assert.equal(city.townshipAt(...point(lat, lon))?.name, expected);
assert.ok(streets.some(t => t.name === '古美路街道'));
const taskGame = Object.create(CM.Game.prototype);
taskGame.city = city;
const atTown = streets.find(t => t.name === '浦江镇');
const firstTownCell = city.cellAt(atTown.x, atTown.y);
taskGame.model = { zoneCells: [[firstTownCell]], zCx: [atTown.x], zCy: [atTown.y] };
assert.equal(taskGame.zoneName(0), '浦江镇');
const oldTask = { type: 'zoneCong', zone: 0, title: '减少「片区（闵行）」高峰汽车出行', deadline: [2025, 1], target: 0.4, samples: [[1, 0.45]] };
taskGame.tasks = CM.Tasks.restore({ active: [oldTask] });
const savedTasks = JSON.stringify(taskGame.tasks.serialize());
assert.equal(CM.Tasks.displayTitle(taskGame.tasks.active[0], taskGame), '减少「浦江镇」高峰汽车出行');
assert.equal(JSON.stringify(taskGame.tasks.serialize()), savedTasks, 'Display names never rewrite the stored task');
console.log('PASS township names, map anchors and existing task titles without changes to the save data');
check('昆山花桥', 31.301946, 121.100839, 'huaqiao', beforeFar, afterFar);
const outsideHuaqiao = city.cellAt(...point(31.30, 121.025));
assert.equal(afterFar[outsideHuaqiao], 1, 'Kunshan outside Huaqiao stays outside the buildable map');
assert.equal(city.pop[outsideHuaqiao], 0);
const out = city.cellAt(...point(31.51, 121.25));
assert.equal(afterFar[out], 1, 'Jiangsu remains outside the buildable area');
assert.equal(city.pop[out], 0, 'Land outside Shanghai contributes no city population');
assert.ok(city.waterDistAt(...point(31.44, 121.74)) < 0, 'Yangtze channels remain water');

const listed = Fac.list(city);
const facility = id => listed.find(f => f.id === id);
assert.equal(listed.some(f => f.t === 'uni' && f.name.includes('大学城')), false);
assert.equal(facility('sh_qibao_center').t, 'shop');
assert.equal(listed.filter(f => f.t === 'uni' && /松江/.test(f.name)).length, 6);
assert.equal(listed.some(f => f.gen), false, 'Shanghai uses named sites throughout the municipality');
const named = DATA.facilities.filter(f => f.fixedSite);
for (const s of named) {
  const f = facility(s.id), c = city.cellAt(f.x, f.y);
  if (s.ext) {
    const p = Fac.portal(f);
    assert.ok(p.x >= 0 && p.y >= 0 && p.x < city.W && p.y < city.H, s.id + ' interface within grid');
    assert.equal(p.ex, s.extEdge[0]); assert.equal(p.ey, s.extEdge[1]);
    assert.equal(f.ext.gate, false, 'Regional railway interfaces are not border-control gates');
    assert.ok(Fac.extNear(f, { x: p.x, y: p.y }) >= 0);
    assert.equal(Fac.extLink(f, { compiled: { stations: [], serviced: [] } }), null);
    const st = { id: 'interface-test', x: p.x, y: p.y, portal: f.id };
    assert.ok(Fac.extLink(f, { compiled: { stations: [st], serviced: [1], stationLines: [new Set(['line'])] } }).portal);
    continue;
  }
  assert.ok(c >= 0 && city.landFrac[c] >= 0.5 && !afterFar[c], s.id + ' must be inside real, buildable Shanghai land');
  assert.ok(s.note || s.layout?.osm?.length, s.id + ' must provide a location note or mapped source');
}
for (const [id, t, region] of [
  ['jiading_baolong', 'shop', 'jiading_new'], ['songjiang_inc', 'shop', 'songjiang'],
  ['qingpu_wanda', 'shop', 'qingpu'], ['nanqiao_bailian', 'shop', 'fengxian'],
  ['lingang_gangcheng', 'shop', 'lingang'], ['songjiang_uni', 'uni', 'songjiang'],
  ['zhangjiang_uni', 'uni', 'jinqiao'], ['minhang_uni', 'uni', 'minhang_new'],
  ['zizhu', 'industry', 'minhang_new'], ['sheshan', 'scenic', 'songjiang'],
  ['chedun_film', 'scenic', 'songjiang'],
  ['chongming_air', 'air', 'chongming'],
]) {
  const f = facility('sh_' + id);
  assert.equal(f.t, t);
  const actual = city.regionAt(f.x, f.y).id;
  assert.ok(actual === region || (region === 'minhang_new' && actual === 'wujing'), id + ': ' + actual);
}
const filmPark = facility('sh_chedun_film');
const filmPoint = point(31.01204455, 121.30837442);
assert.ok(Math.hypot(filmPark.x - filmPoint[0], filmPark.y - filmPoint[1]) < 0.02, 'Film park uses WGS-84 without double coordinate conversion');
assert.equal(filmPark.open, 1999);
assert.equal(Fac.active(filmPark, 1998.99, city), false);
const filmRegion = city.region[city.cellAt(filmPark.x, filmPark.y)];
assert.equal(city.regions[filmRegion].open, 2020, 'Film park follows the Songjiang district unlock');
const filmRegionOpen = city.regionOpen[filmRegion]; city.regionOpen[filmRegion] = 0;
assert.equal(Fac.active(filmPark, 2021, city), false); city.regionOpen[filmRegion] = filmRegionOpen;
assert.equal(Fac.active(filmPark, 2020, city), true);
assert.ok(Fac.share(filmPark, 2021) > 0); assert.equal(filmPark.p.lz, 1); assert.ok(filmPark.we > 1);
assert.ok(Fac.siteCells(filmPark, city).length > 0);
for (const [id, region, type, lat, lon, opened] of [
  ['oriental_land', 'qingpu', 'scenic', 31.1010166, 121.0142192, 2001],
  ['guangfulin_relics', 'songjiang', 'scenic', 31.0609756, 121.1933306, 2018 + 5 / 12],
  ['dongtan_wetland', 'chongming', 'park', 31.5188087, 121.9360746, 2010 + 3 / 12],
]) {
  const f = facility('sh_' + id), [x, y] = point(lat, lon), c = city.cellAt(f.x, f.y), k = city.region[c];
  assert.equal(f.t, type);
  assert.equal(city.regions[k].id, region);
  assert.ok(Math.hypot(f.x - x, f.y - y) < 0.02, id + ' WGS-84 entrance');
  assert.equal(f.open, opened);
  assert.equal(Fac.active(f, opened - 0.01, city), false);
  assert.equal(city.regions[k].open, 2020);
  const old = city.regionOpen[k]; city.regionOpen[k] = 0;
  assert.equal(Fac.active(f, 2020, city), false); city.regionOpen[k] = old;
  assert.equal(Fac.active(f, 2020, city), true);
  assert.ok(Fac.siteCells(f, city).length && Fac.share(f, 2021) > 0 && f.p.lz === 1 && f.we > 1, id + ' leisure demand');
}
const zhaojialou = facility('sh_zhaojialou');
const [entranceX, entranceY] = point(31.0755904, 121.5424567);
assert.equal(zhaojialou.name, '召稼楼古镇');
assert.equal(zhaojialou.t, 'scenic');
assert.ok(Math.hypot(zhaojialou.entrance[0] - entranceX, zhaojialou.entrance[1] - entranceY) < 0.02);
assert.ok(city.landFrac[city.cellAt(...zhaojialou.entrance)] >= 0.5);
assert.equal(zhaojialou.open, 2010 + 4 / 12);
assert.equal(Fac.active(zhaojialou, 2021, city), true);
assert.ok(Fac.share(zhaojialou, 2021) > 0 && zhaojialou.p.lz === 1 && zhaojialou.we > 1);
assert.equal(Fac.active(zhaojialou, 2023, city), true);
assert.equal(Fac.active(zhaojialou, 2023 + 1 / 12, city), false);
assert.equal(Fac.active(zhaojialou, 2029 + 11 / 12, city), false);
assert.equal(Fac.active(zhaojialou, 2030, city), true);
const renovationLabel = DATA.mapLabels.find(l => l.name === '召稼楼古镇（改造中）');
assert.equal(renovationLabel.from, zhaojialou.pause[0]);
assert.equal(renovationLabel.to, zhaojialou.pause[1]);
const ancientTownModel = new CM.Model(city, { deferDemand: true });
ancientTownModel.setYear(2021);
const ancientTownNodes = ancientTownModel.buildFacNodes();
const ancientTownIndex = ancientTownModel.facIndex(zhaojialou.id);
assert.ok(ancientTownNodes.ringFac.get(city.cellAt(...zhaojialou.entrance)).includes(ancientTownIndex));
const [junctionX, junctionY] = point(31.076064, 121.5421316);
const yuanxiang = facility('sh_yuanxiang');
const [yuanxiangX, yuanxiangY] = point(31.3510782, 121.2613713);
assert.ok(Math.hypot(yuanxiang.x - yuanxiangX, yuanxiang.y - yuanxiangY) < 0.02);
assert.deepEqual(Array.from(yuanxiang.entrance), [yuanxiang.x, yuanxiang.y]);
const yuanxiangRoad = city.roadGroups.findIndex(r => r.name === '远香湖公园南入口步道');
assert.ok(yuanxiangRoad >= 0 && city.roadsBuilt[yuanxiangRoad]);
assert.equal(city.roadGroups[yuanxiangRoad].year, 2015, 'The south entrance path opens with Jiading New City');
assert.ok(city.car.links.some(link => city.roadNames[link.name] === '天祝路'), 'Tianzhu Road is present in the vehicle network');
const [tianzhuX, tianzhuY] = point(31.3503698, 121.2597158);
assert.equal(CM.Metro.checkSite(city, tianzhuX, tianzhuY, 'underground').ok, true);
assert.equal(CM.Tasks.facServable(city, yuanxiang), true);
const changxingPark = facility('sh_changxing_park');
const [parkX, parkY] = point(31.398298, 121.7119214);
assert.ok(Math.hypot(changxingPark.x - parkX, changxingPark.y - parkY) < 0.02);
assert.deepEqual(Array.from(changxingPark.entrance), [changxingPark.x, changxingPark.y]);
assert.equal(city.regionAt(parkX, parkY).id, 'changxing');
assert.ok(Fac.active(changxingPark, 2021, city));
const [qiuganX, qiuganY] = point(31.3982353, 121.7108288);
const ancientTownAccess = ancientTownModel.computeAccess({
  stations: [{ x: junctionX, y: junctionY }, { x: qiuganX, y: qiuganY }, { x: tianzhuX, y: tianzhuY }], serviced: [1, 1, 1],
});
assert.ok(ancientTownAccess.zl[ancientTownModel.Z + ancientTownIndex]?.some(e => e.s === 0 && e.w > 0),
  'The Qinyubo Road entrance provides walking access to Zhaojialou');
assert.ok(ancientTownAccess.zl[ancientTownModel.Z + ancientTownModel.facIndex(changxingPark.id)]?.some(e => e.s === 1 && e.w < 15),
  'The south gate of Changxing Island Country Park is walkable from Qiugan Road');
assert.ok(ancientTownAccess.zl[ancientTownModel.Z + ancientTownModel.facIndex(yuanxiang.id)]?.some(e => e.s === 2 && e.w < 15),
  'The south entrance of Yuanxiang Lake Park is walkable from Tianzhu Road');
ancientTownModel.setYear(2026);
ancientTownModel.buildFacNodes();
assert.equal(ancientTownModel.facIndex(zhaojialou.id), -1, 'Renovation pauses tourist trips');
const expo = facility('sh_expo2010');
assert.ok(Fac.active(expo, 2010 + 9 / 12, city) && !Fac.active(expo, 2011, city));
for (const [id, type, region, opened] of [
  ['expo_axis_mall', 'shop', 'pdriver', 2014 + 3 / 12],
  ['expo_exhibition_hall', 'venue', 'pdriver', 2011 + 7 / 12],
  ['expo_cultural_park', 'park', 'pdriver', 2021 + 11 / 12],
  ['expo_conference_center', 'venue', 'pdriver', 2011],
  ['world_expo_museum', 'scenic', 'huangpu', 2017 + 4 / 12],
  ['power_station_of_art', 'scenic', 'huangpu', 2012 + 9 / 12],
  ['qiantan_taikoo_li', 'shop', 'beicai', 2021 + 8 / 12],
]) {
  const f = facility('sh_' + id);
  assert.equal(f.t, type, id);
  assert.equal(city.regionAt(f.x, f.y).id, region, id);
  assert.equal(f.open, opened, id);
  assert.ok(f.open >= expo.close, id + ' must start after the temporary Expo demand');
  assert.equal(Fac.active(f, opened - 0.01, city), false, id);
  assert.equal(Fac.active(f, opened, city), true, id);
  assert.ok(Fac.share(f, opened) > 0, id + ' must attract trips');
}
const expoPark = facility('sh_expo_cultural_park');
assert.equal(Fac.share(expoPark, 2024 + 7 / 12), Fac.share(expoPark, expoPark.open));
assert.ok(Fac.share(expoPark, 2024 + 8 / 12) > Fac.share(expoPark, 2024 + 7 / 12));
for (const [id, type, opened, accessible = opened] of [
  ['shanghai_museum_east', 'scenic', 2024 + 1 / 12],
  ['science_tech_museum', 'scenic', 2001 + 11 / 12],
  ['natural_history_museum', 'scenic', 2015 + 3 / 12],
  ['astronomy_museum', 'scenic', 2021 + 6 / 12],
  ['shanghai_library_east', 'library', 2022 + 8 / 12],
  ['pudong_art_museum', 'scenic', 2021 + 6 / 12],
  ['china_maritime_museum', 'scenic', 2010 + 6 / 12, 2020],
]) {
  const f = facility('sh_' + id), region = city.regionAt(f.x, f.y);
  assert.equal(f.t, type, id);
  assert.equal(f.open, opened, id);
  assert.equal(Math.max(region.open, f.open), accessible, id);
  assert.equal(Fac.active(f, opened - 0.01, city), false, id);
  assert.equal(Fac.active(f, accessible, city), true, id);
  assert.ok(Fac.share(f, accessible) > 0 && f.p.lz === 1, id + ' must attract leisure trips');
}
const museumEast = facility('sh_shanghai_museum_east'), scienceMuseum = facility('sh_science_tech_museum');
assert.notEqual(city.cellAt(museumEast.x, museumEast.y), city.cellAt(scienceMuseum.x, scienceMuseum.y));
assert.ok(Fac.share(museumEast, museumEast.open) < Fac.share(museumEast, 2024 + 5 / 12));
assert.ok(Fac.share(museumEast, 2024 + 5 / 12) < Fac.share(museumEast, 2024 + 11 / 12));
const scienceClosed = 2023 + 3 / 12, scienceReopened = 2026 + 1 / 12;
assert.equal(Fac.active(scienceMuseum, scienceClosed - 0.01, city), true);
assert.equal(Fac.active(scienceMuseum, scienceClosed, city), false);
assert.equal(Fac.active(scienceMuseum, scienceReopened - 0.01, city), false);
assert.equal(Fac.active(scienceMuseum, scienceReopened, city), true);
const maritime = facility('sh_china_maritime_museum'), lingangIndex = city.regions.findIndex(r => r.id === 'lingang');
assert.equal(city.region[city.cellAt(maritime.x, maritime.y)], lingangIndex);
const oldLingang = city.regionOpen[lingangIndex]; city.regionOpen[lingangIndex] = 0;
assert.equal(Fac.active(maritime, 2019, city), false, 'Maritime museum follows the Lingang unlock');
city.regionOpen[lingangIndex] = oldLingang;
for (const id of ['sh_pvg_terminal', 'sh_songjiang_station', 'sh_east_station', 'sh_baoshan_station',
  'sh_oly_stadium', 'sh_oly_aquatics', 'sh_oly_arena', 'sh_oly_village']) {
  const f = facility(id), c = city.cellAt(f.x, f.y);
  assert.ok(c >= 0 && city.landFrac[c] >= 0.5 && !afterFar[c], id + ' must be on buildable Shanghai land');
  if (id.startsWith('sh_oly_')) assert.ok(city.regionAt(f.x, f.y).id.startsWith('wujing'), id + ' must be in Wujing');
}
assert.equal(facility('sh_pvgair').close, 2015);
assert.equal(facility('sh_pvg_terminal').open, 2015);
assert.equal(facility('sh_east_station').open, 2027.5);
assert.ok(!Fac.active(facility('sh_chongming_air'), 2034.99, city));
assert.ok(Fac.active(facility('sh_chongming_air'), 2035, city));
assert.equal(Fac.pax(facility('sh_chongming_air'), 2035), 170_000);
assert.equal(Fac.pax(facility('sh_chongming_air'), 2040), Fac.pax(facility('sh_hqair'), 2040) + Fac.pax(facility('sh_hqair_t1'), 2040));
assert.equal(Fac.pax(facility('sh_pvg_terminal'), 2025), 200_000);
assert.equal(Fac.pax(facility('sh_hqair'), 2025) + Fac.pax(facility('sh_hqair_t1'), 2025), 133_000);
assert.equal(Fac.pax(facility('sh_hqstation'), 2024), 400_000);
assert.ok(Fac.pax(facility('sh_hqstation'), 2026) > Fac.pax(facility('sh_station'), 2026));
assert.ok(Fac.pax(facility('sh_west'), 2026) < Fac.pax(facility('sh_south'), 2026) / 5);
assert.ok(Fac.pax(facility('sh_pvg_terminal'), 2022) < Fac.pax(facility('sh_pvg_terminal'), 2023));
for (const rw of DATA.runways.filter(r => r.from === 2035)) for (let t = 0; t <= 1; t += 0.125) {
  const [x, y] = rw.a.map((v, i) => v + (rw.b[i] - v) * t);
  assert.ok(city.landFrac[city.cellAt(x, y)] >= 0.5 && city.regionAt(x, y).id === 'chongming');
}
assert.equal(DATA.runways.filter(r => r.from === 2035).length, 2);
assert.ok(DATA.events.some(e => e.y === 2035 && e.tag === '模拟' && e.title === '崇明国际机场启用'));
assert.ok(Fac.share(facility('sh_oly_stadium'), 2036 + 7 / 12) > Fac.share(facility('sh_oly_stadium'), 2035) * 5);
assert.equal(Fac.share(facility('sh_oly_stadium'), 2040 + 7 / 12), Fac.share(facility('sh_oly_stadium'), 2037));
assert.equal(Math.round(CM.U.interp(CFG.growth.popCurve, 2040)), 32_666_667);
assert.equal(CM.U.interp(CFG.growth.popCurve, 2050), 37_000_000);
assert.equal(CM.U.interp(CFG.growth.popCurve, 2080), 37_000_000);
console.log('PASS Shanghai administrative coverage, release dates, Olympic state and hub dates');

const modern = DATA.histTasks.filter(t => t.appear[0] >= 2021);
assert.equal(new Set(DATA.histTasks.map(t => t.id)).size, DATA.histTasks.length);
assert.ok(modern.some(t => t.appear[0] === 2021));
assert.equal(Math.max(...modern.map(t => t.deadline[0])), 2041);
for (const [id, appear, deadline] of [
  ['sh-newcity-lingang', [2028, 1], [2038, 12]],
  ['sh14', [2027, 9], [2036, 7]],
  ['sh-olympic-campus', [2029, 1], [2035, 6]],
  ['sh-olympic-test', [2035, 7], [2036, 8]],
  ['sh-olympic-legacy', [2037, 1], [2041, 12]],
]) {
  const task = modern.find(t => t.id === id);
  assert.deepEqual(Array.from(task.appear), appear, id);
  assert.deepEqual(Array.from(task.deadline), deadline, id);
}
for (const task of modern) {
  assert.ok(CM.U.ymIndex(...task.appear) < CM.U.ymIndex(...task.deadline), task.title);
  if (task.fac) assert.ok(facility(task.fac).open <= task.appear[0] + (task.appear[1] - 1) / 12);
  if (task.type === 'connect') assert.equal(task.maxTransfers, 1, task.title);
  for (const a of task.anchors || []) {
    const c = city.cellAt(a.x, a.y);
    assert.ok(c >= 0 && city.landFrac[c] >= 0.5 && !afterFar[c], task.id + ' / ' + a.name);
  }
}
const minhangLink = modern.find(t => t.id === 'sh-reopen-campus');
const campusStations = [{ x: 238.47, y: 384.07 }, { x: 243.92, y: 382.39 }, { x: 218.09, y: 345.38 }];
const campusGame = { compiled: { stations: campusStations, serviced: [1, 1, 1], routes: [{ stIdx: [0, 1, 2] }] }, model: {} };
const oldCampusLink = { ...minhangLink, maxTransfers: undefined, progress: { ok: true }, evaluatedYM: 24269, anchors: minhangLink.anchors.map(a => {
  const f = a.facilityEntrance && facility(a.facilityEntrance);
  return f ? { name: a.name, x: f.x, y: f.y, r: a.r, fixedSite: true } : a;
}) };
const campusTasks = CM.Tasks.restore({ active: [oldCampusLink] });
assert.equal(campusTasks.evaluate(oldCampusLink, campusGame).ok, false);
assert.equal(campusTasks.evaluate(minhangLink, campusGame).ok, true, 'Zizhu station can serve both the campus gate and the science park');
const restoredCampusLink = campusTasks.active[0];
assert.equal(restoredCampusLink.maxTransfers, 1);
assert.equal(restoredCampusLink.progress, undefined);
assert.equal(restoredCampusLink.evaluatedYM, undefined);
assert.equal(campusTasks.evaluate(restoredCampusLink, campusGame).ok, true, 'Existing active tasks pick up campus gates and the transfer limit on restore');
assert.equal(campusTasks.evaluate(minhangLink, campusGame, () => false).ok, false, 'Inactive services do not count');

const transferStations = [0, 1, 2, 3, 4].map(x => ({ x, y: 0, r: 0.25, name: String(x) }));
const transferCompiled = { stations: transferStations, serviced: [1, 1, 1, 1, 1], routes: [{ stIdx: [0, 1] }, { stIdx: [2, 3] }, { stIdx: [3, 4] }] };
const transferGame = { compiled: transferCompiled, model: { net: { C: transferCompiled, acc: { transfers: [{ a: 1, b: 2 }] } } } };
const transferGoal = (...stations) => ({ type: 'connect', maxTransfers: 1, anchors: stations.map(i => transferStations[i]) });
assert.equal(campusTasks.evaluate(transferGoal(0, 1), transferGame).ok, true, 'Direct service counts');
assert.equal(campusTasks.evaluate(transferGoal(2, 4), transferGame).ok, true, 'A shared transfer station counts');
assert.equal(campusTasks.evaluate(transferGoal(0, 2), transferGame).ok, true, 'A recognised walking transfer counts');
const transferChain = transferGoal(2, 0, 4);
const gap = campusTasks.evaluate(transferChain, transferGame);
assert.equal(gap.ok, false, 'Every pair must meet the limit');
assert.deepEqual(Array.from(gap.transferGap), ['0', '4']);
assert.equal(campusTasks.evaluate({ ...transferChain, maxTransfers: undefined }, transferGame).ok, true);
transferGame.model.fleetOf = () => [{ manual: [[1, 0, 0, 0]] }, { manual: [[0, 1, 0, 0]] }, { avail: [0, 0] }];
assert.equal(campusTasks.evaluate(transferGoal(0, 2), transferGame).ok, false, 'Transfer services must run during a shared period');
assert.equal(campusTasks.evaluate(transferGoal(2, 4), transferGame).hits[1], false, 'An unstaffed route cannot cover an anchor');
console.log('PASS 2021–2041 task dates, facility timing and map anchors');
const development = DATA.events.find(e => e.title === '开发崇明：生态岛交通建设');
assert.equal(development.y, 2025); assert.equal(development.m, 1);
assert.equal(DATA.histTasks.filter(t => t.id.startsWith('sh-chongming-') && t.appear[0] === 2025).length, 2);
for (const id of ['chongming', 'changxing', 'huaqiao']) {
  const k = city.regions.findIndex(r => r.id === id);
  assert.equal(Eras.regionFactors(city, 2024).pop[k], 1);
  assert.equal(Eras.regionFactors(city, 2025).pop[k], 1.25);
  assert.ok(Math.abs(Eras.regionFactors(city, 2025).jobs[k] - 1.35) < 1e-6);
  assert.equal(Eras.regionFactors(city, 2037).pop[k], 1);
}
assert.equal(DATA.facilities.filter(f => f.extEdge && f.t === 'rail').length, 6);
console.log('PASS 2025 development effects and connectable regional railway interfaces');

// Census controls apply throughout complete towns, independently of the old
// rectangular map extent; upgrade once and preserve totals and metro land.
const census = DATA.population, grid = CM.U.unpackTyped(census.townGrid);
assert.equal(census.groups.reduce((a, r) => a + r[2], 0), 25_056_111);
assert.equal(census.groups.filter(r => r[0] !== '昆山市').reduce((a, r) => a + r[2], 0), 24_870_895);
assert.equal(new Set(census.groups.map(r => r[0])).size, 17);
assert.equal(census.groups.find(r => r[1] === '花桥镇')[2], 185_216);
const townTotals = () => {
  const sums = new Float64Array(census.groups.length);
  for (let c = 0; c < city.N; c++) if (grid[c]) sums[grid[c] - 1] += city.pop[c];
  return sums;
};
const total = city.totals(), sums = townTotals();
for (let k = 0; k < sums.length; k++) {
  const target = total.pop * census.groups[k][2] / census.total;
  assert.ok(Math.abs(sums[k] - target) < 0.05, census.groups[k][1] + ' census share');
}
assert.ok(Math.abs(total.pop - 24_870_900) < 2);
assert.equal(city.populationRevision, census.revision);
const state = city.serialize();
assert.equal(state.populationRevision, census.revision);
assert.equal(city.applyPopulationDistribution(2021), false);
assert.deepEqual(city.totals(), total);
const qibao = census.groups.findIndex(r => r[1] === '七宝镇');
const xujing = census.groups.findIndex(r => r[1] === '徐泾镇');
assert.equal(census.groups[qibao][2], 266465);
assert.equal(census.groups[xujing][2], 198376);
const urbanCell = city.cellAt(...point(31.15648, 121.34593));
const fraction = city.groundUrbanMix(urbanCell);
city.street[urbanCell] = 1 - city.street[urbanCell];
assert.equal(city.groundUrbanMix(urbanCell), fraction, 'Colour must not depend on saved street flag');
city.street[urbanCell] = 1 - city.street[urbanCell];
const oldPop = city.pop.slice(), oldJobs = city.jobs.slice(), oldTaken = city.taken.slice();
city.populationRevision = 0;
city.applyPopulationDistribution(2021);
assert.ok(Math.abs(city.totals().pop - total.pop) < 1);
assert.ok(Math.abs(city.totals().jobs - total.jobs) < 1);
assert.deepEqual(city.taken, oldTaken);
for (let c = 0; c < city.N; c++) {
  if (city.lu[c] === CM.LU.WATER || city.lu[c] === CM.LU.PARK || city.lu[c] === CM.LU.AIRPORT)
    assert.equal(city.pop[c], 0, 'No residents on water, parks or airport runways');
}
console.log('PASS town population shares, one-time save calibration and ground-colour consistency');

const stadia = DATA.landmarks.filter(l => l.id.startsWith('sh_oly_'));
city.activateLandmarks(2033);
assert.equal(city.landmarkOn[DATA.landmarks.indexOf(stadia[0])], 1);
for (const l of stadia.slice(1)) assert.equal(city.landmarkOn[DATA.landmarks.indexOf(l)], 0);
city.activateLandmarks(2034);
for (const l of stadia) assert.equal(city.landmarkOn[DATA.landmarks.indexOf(l)], 1);
const width = 24;
const vertexWidth = width + 1;
const counts = new Int32Array(vertexWidth * 2);
const start = new Int32Array(counts.length + 1), vx = new Float32Array(counts.length), vy = new Float32Array(counts.length);
const to = [], len = [];
for (let v = 0; v < counts.length; v++) {
  vx[v] = v % vertexWidth;
  vy[v] = Math.floor(v / vertexWidth);
  if (v < vertexWidth) {
    if (v > 0) { to.push(v - 1); len.push(CFG.CELL_M); }
    if (v < width) { to.push(v + 1); len.push(CFG.CELL_M); }
  }
  counts[v] = to.length - start[v];
  start[v + 1] = to.length;
}
const block = { W: width, H: 1, N: width, VW: vertexWidth, V: counts.length, vx, vy,
  pop: new Float32Array(width).fill(1), jobs: new Float32Array(width),
  walk: { start, to, len, deg: counts }, cellAt: x => Math.floor(x), zoneOf: c => c };
const model = Object.create(CM.Model.prototype);
Object.assign(model, { city: block, Z: width, heap: new CM.U.Heap(64), zoneCells: Array.from({ length: width }, (_, c) => [c]) });
const compiled = { stations: [{ x: 0, y: 0 }, { x: 3, y: 0 }], serviced: [true, false] };
const access = model.computeAccess(compiled);
const m = c => c * CFG.CELL_M + CFG.walk.cellExtraM;
assert.equal(access.zl[1][0].w, m(1) / 75);
assert.equal(access.zl[1][0].bikeShare, 0);
assert.equal(access.zl[2][0].bikeShare, 1, 'Cycling remains faster at 560 m after the four-minute choice penalty');
assert.equal(access.zl[2][0].w, m(2) / 225 + 2);
assert.equal(access.zl[3][0].bikeShare, 1, 'Cycling remains preferable at 810 m');
assert.equal(access.zl[4][0].w, m(4) / 225 + 2);
assert.equal(access.zl[8][0].w, m(8) / 225 + 2);
assert.equal(access.zl[8][0].bikeShare, 1);
assert.equal(access.zl[8].length, 1, 'An unserved station cannot get bicycle riders');
assert.equal(access.zCov[8], 1);
assert.equal(access.zWalkCov[8], 0);
assert.equal(access.cellWalk[8], Infinity);
assert.equal(access.zl[14], null, 'Limit bicycle trips to 15 minutes of riding');
assert.equal(access.transfers.length, 0);
assert.equal(model.computeAccess(compiled).zl[8][0].w, access.zl[8][0].w, 'Cached access tree must give the same result');
console.log('PASS bicycle access time, service eligibility, ride limit and walk-only reporting');

// Coverage counts residents and jobs, with every cell assigned to exactly one access mode.
model.net = { C: compiled, acc: access };
block.jobs = Float32Array.from({ length: width }, (_, c) => c + 10);
const coverage = model.stationCoverage(0);
assert.deepEqual(Array.from(coverage.walk.limits), [5, 10, 15]);
assert.deepEqual(Array.from(coverage.bike.limits), [5, 10, 15], 'Both modes use the same total-access-time bands');
assert.deepEqual(Array.from(coverage.walk.pop), [2, 2, 2]);
assert.deepEqual(Array.from(coverage.bike.pop), [1, 5, 10], 'Cycling bands include preparation time');
assert.deepEqual(Array.from(coverage.walk.jobs), [21, 21, 21]);
assert.deepEqual(Array.from(coverage.bike.jobs), [12, 70, 165]);
assert.ok(model.stationCoverage(1).bike.pop[2] > 0, 'An unserved station can preview potential cycling coverage');
const cachedCoverage = model.stationCoverage(0);
model.net.acc = model.computeAccess(compiled);
assert.deepEqual(model.stationCoverage(0), cachedCoverage, 'Cached and freshly requested trees agree');
for (let c = 0; c < width; c++) {
  block.pop.fill(0); block.jobs.fill(0); block.pop[c] = 7; block.jobs[c] = 11;
  const r = model.stationCoverage(0), entry = access.zl[c]?.[0], reachable = !!entry && entry.w <= 15;
  assert.equal(r.walk.pop[2] + r.bike.pop[2], reachable ? 7 : 0, 'A resident must not be counted in both modes');
  assert.equal(r.walk.jobs[2] + r.bike.jobs[2], reachable ? 11 : 0, 'A job must not be counted in both modes');
  if (reachable) assert.equal((entry.bikeShare ? r.bike : r.walk).pop[2], 7, 'Coverage mode agrees with actual access choice');
}
block.pop.fill(0); block.jobs.fill(0); block.pop[2] = 7;
const oldExtra = CFG.walk.cellExtraM;
try {
  CFG.walk.cellExtraM = 6.25; // 506.25 m: walking and cycling each cost 10.8 equivalent minutes.
  assert.equal(model.stationCoverage(0).walk.pop[2], 7);
  assert.equal(model.stationCoverage(0).bike.pop[2], 0, 'Equal costs prefer walking');
} finally { CFG.walk.cellExtraM = oldExtra; }
assert.equal(model.stationCoverage(99), null, 'Missing road access must not fabricate coverage');
console.log('PASS exclusive walking/cycling residents and jobs, cumulative bands, live population, cached trees and tie handling');

const terminals = DATA.airportLayout.terminals;
const hongqiaoT2 = terminals.find(t => t.id === 'hq_t2');
assert.equal(hongqiaoT2.from, 2010 + 2 / 12);
const airportLink = DATA.histTasks.find(t => t.id === 'sh-airport-link'), [hq, pvg] = airportLink.anchors;
assert.deepEqual([hq.x, hq.y], [hongqiaoT2.x, hongqiaoT2.y]);
assert.deepEqual([facility('sh_hqair').x, facility('sh_hqair').y], [hq.x, hq.y]);
const [oldHqX, oldHqY] = point(31.1958, 121.3266);
const oldAirportTask = { ...airportLink, progress: { ok: false }, evaluatedYM: 24300,
  anchors: [{ ...hq, x: oldHqX, y: oldHqY, facilityEntrance: undefined }, pvg] };
const restoredAirportTask = CM.Tasks.restore({ active: [oldAirportTask] }).active[0];
assert.deepEqual([restoredAirportTask.anchors[0].x, restoredAirportTask.anchors[0].y], [hq.x, hq.y]);
assert.equal(restoredAirportTask.anchors[1], pvg);
assert.equal(restoredAirportTask.deadline, oldAirportTask.deadline);
assert.equal(restoredAirportTask.progress, undefined);
assert.equal(restoredAirportTask.evaluatedYM, undefined);
for (const id of ['sh_station', 'sh_south', 'sh_hqstation', 'sh_songjiang_station', 'sh_west',
  'sh_nanxiang_north', 'sh_anting_north', 'sh_anting_west', 'sh_jinshan_north', 'sh_liantang_station']) {
  assert.ok(facility(id)?.layout?.area.length, id + ' has surveyed site geometry');
}
assert.ok(!listed.some(f => f.id.startsWith('sh_jsr_')), 'The Jinshan commuter railway has no added facilities');
for (const id of ['sh_hqair', 'sh_pvg_terminal']) {
  const f = facility(id);
  assert.equal(CM.Metro.checkSite(city, f.x, f.y, 'underground').ok, true, id + ' allows a terminal metro station');
}
const songjiang = facility('sh_songjiang_station');
assert.deepEqual([songjiang.x, songjiang.y], Array.from(songjiang.entrance));
assert.ok(songjiang.layout.parts.length >= 2 && songjiang.layout.legacy.parts.length);
assert.equal(Fac.active(songjiang, 2024 + 10 / 12, city), false);
assert.equal(Fac.active(songjiang, 2024 + 11 / 12, city), true);
city.activateLandmarks(2025);
city.applyRoads(2025);
city.updateStreets();
city.buildGraphs();
const songjiangHall = DATA.landmarks[songjiang.lmK];
assert.equal(city.protectedId[city.cellAt(songjiangHall.x, songjiangHall.y)], songjiang.lmK + 1);
assert.equal(CM.Metro.checkSite(city, songjiangHall.x, songjiangHall.y, 'underground').ok, true);
const acrossHall = [[songjiangHall.x - 0.25, songjiangHall.y], [songjiangHall.x + 0.25, songjiangHall.y]];
assert.equal(CM.Metro.geomFromControl(acrossHall, 'elevated', city).protM, 0);
const protectedLandmark = DATA.landmarks.find(l => l.id === 'sh_pearl');
assert.equal(CM.Metro.checkSite(city, protectedLandmark.x, protectedLandmark.y, 'underground').ok, true);
assert.match(CM.Metro.checkSite(city, protectedLandmark.x, protectedLandmark.y, 'surface').msg, /受保护建筑/);
assert.ok(city.car.links.some(link => city.roadNames[link.name] === '松礼路'));
const songjiangModel = new CM.Model(city, { deferDemand: true });
songjiangModel.setYear(2025);
songjiangModel.buildFacNodes();
const songjiangAccess = songjiangModel.computeAccess({ stations: [{ x: 159.9045, y: 397.6846 }], serviced: [1] });
assert.ok(songjiangAccess.zl[songjiangModel.Z + songjiangModel.facIndex(songjiang.id)]?.some(e => e.s === 0 && e.w < 10),
  'The metro station north of the rail hall can walk to the real interchange entrance');
console.log('PASS Songjiang pedestrian access, surveyed rail sites, terminal construction and landmark protection');

assert.equal(terminals.find(t => t.id === 'pvg_t3').from, 2028 + 11 / 12);
assert.equal(Fac.active(facility('sh_pvg_t3'), 2028 + 10 / 12, city), false);
assert.equal(Fac.active(facility('sh_pvg_t3'), 2028 + 11 / 12, city), true);
for (const [year, total] of [[2030, 230000], [2040, 290000]]) {
  assert.ok(Math.abs(Fac.pax(facility('sh_pvg_terminal'), year) + Fac.pax(facility('sh_pvg_t3'), year) - total) < 0.01);
}
assert.equal(DATA.runways.filter(r => r.airport === 'pvg').length, 5);
const cloud = city.roadGroups.findIndex(r => r.name === '云亮路');
const ramp = city.roadGroups.findIndex(r => r.name === '南纬八路上匝道');
assert.ok(cloud >= 0 && ramp >= 0);
city.applyRoads(2026 + 5 / 12); assert.equal(city.roadsBuilt[cloud], 0);
city.applyRoads(2026 + 6 / 12); assert.equal(city.roadsBuilt[cloud], 1);
city.applyRoads(2028 + 10 / 12); assert.equal(city.roadsBuilt[ramp], 0);
city.applyRoads(2028 + 11 / 12); assert.equal(city.roadsBuilt[ramp], 1);
console.log('PASS actual terminal models, T3 opening, airport total conservation and monthly road phases');

for (const name of ['墨江路', '北大道']) {
  const road = city.roadGroups.findIndex(g => g.name === name);
  assert.ok(road >= 0 && city.roadsBuilt[road], name + ' is part of the pre-existing street network');
}
for (const [name, year] of [
  ['吴泾奥林匹克大道', 2033],
  ['吴泾奥运村进场路', 2035 + 6 / 12],
  ['吴泾奥运疏散联络路', 2036 + 7 / 12],
  ['吴泾奥运村社区路', 2037],
]) {
  const road = city.roadGroups.findIndex(g => g.name === name);
  assert.ok(road >= 0, name);
  city.applyRoads(year - 1 / 12);
  assert.equal(city.roadsBuilt[road], 0, name + ' opens on schedule');
  city.applyRoads(year);
  assert.equal(city.roadsBuilt[road], 1, name);
}
city.updateStreets();
city.buildGraphs();
const olympicModel = new CM.Model(city, { deferDemand: true });
for (const id of ['sh_pvg_t3', 'sh_chongming_air']) {
  const f = facility(id);
  assert.equal(CM.Metro.checkSite(city, f.x, f.y, 'underground').ok, true, id + ' allows a terminal metro station');
}
olympicModel.setYear(2036 + 7 / 12);
const olympicNodes = olympicModel.buildFacNodes();
const olympicSites = ['stadium', 'aquatics', 'arena', 'village'].map(key => facility('sh_oly_' + key));
const entranceStations = olympicSites.map(f => ({ x: f.entrance[0], y: f.entrance[1] }));
const olympicAccess = olympicModel.computeAccess({ stations: entranceStations, serviced: [1, 1, 1, 1] });
for (const [s, f] of olympicSites.entries()) {
  const c = city.cellAt(f.entrance[0], f.entrance[1]), k = olympicNodes.ids.indexOf(f.id), z = olympicModel.Z + k;
  assert.ok(city.landFrac[c] >= 0.5 && city.regionAt(...f.entrance).id.startsWith('wujing'), f.id + ' pedestrian entrance');
  assert.ok(olympicNodes.ringFac.get(c).includes(k), f.id + ' access must go through the gate');
  assert.ok(olympicNodes.cells[k].every(cell => !olympicNodes.cellFac.get(cell)?.includes(k)), f.id + ' no footprint shortcut');
  assert.ok(olympicAccess.zl[z]?.some(entry => entry.s === s && entry.w >= olympicNodes.inner[k] / CFG.walk.mPerMin), f.id + ' has walk access from Longwu Road');
}
const olympicConnections = DATA.histTasks.find(t => t.id === 'sh14');
const mojiang = DATA.simRoads.find(r => r.n === '墨江路').p;
const mainAvenue = DATA.simRoads.find(r => r.n === '吴泾奥林匹克大道').p;
const poolAvenue = DATA.simRoads.find(r => r.n === '北大道').p.slice(-2);
const connector = DATA.simRoads.find(r => r.n === '吴泾奥运疏散联络路').p;
const roadAngle = ([a, b]) => Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
assert.equal(mainAvenue.length, 2);
assert.equal(connector.length, 2);
assert.deepEqual(mainAvenue[0], mojiang.at(-1), 'Olympic Avenue starts at the existing junction');
assert.deepEqual(mainAvenue[1], connector[0], 'The eastern end joins the dispersal street');
assert.ok(Math.abs(roadAngle(mainAvenue) - roadAngle(mojiang.slice(-2))) < 1);
assert.ok(Math.abs(roadAngle(connector) - roadAngle(mainAvenue) - 90) < 2);
assert.ok(CM.U.distToSeg(...connector[1], ...poolAvenue[0], ...poolAvenue[1]) * CFG.CELL_M < 2);
for (const [i, f] of olympicSites.slice(0, 3).entries()) {
  assert.ok(Math.hypot(f.x - mainAvenue[0][0], f.y - mainAvenue[0][1]) * CFG.CELL_M < 650, f.id + ' is near Mojiang Road');
  assert.ok(Math.hypot(f.x - f.entrance[0], f.y - f.entrance[1]) * CFG.CELL_M < 230, f.id + ' is close to its entrance');
  const accessRoad = i === 1 ? poolAvenue : mainAvenue;
  assert.ok(CM.U.distToSeg(...f.entrance, ...accessRoad[0], ...accessRoad[1]) * CFG.CELL_M < 2);
  const lm = DATA.landmarks.find(l => l.id === f.id);
  assert.ok(Math.abs(lm.rot - roadAngle(accessRoad)) < 1.5, f.id + ' follows its road alignment');
  const angle = lm.rot * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
  for (const dx of [-lm.w / 2, lm.w / 2]) for (const dy of [-lm.d / 2, lm.d / 2]) {
    const x = lm.x + (dx * cos - dy * sin) / CFG.CELL_M;
    const y = lm.y + (dx * sin + dy * cos) / CFG.CELL_M;
    assert.ok(city.waterDistAt(x, y) > 0, f.id + ' footprint is on land');
  }
  const anchor = olympicConnections.anchors.find(a => a.facilityEntrance === f.id);
  assert.deepEqual([anchor.x, anchor.y], Array.from(f.entrance), f.id + ' task targets the new gate');
}
const legacy = DATA.histTasks.find(t => t.id === 'sh-olympic-legacy'), village = olympicSites[3];
const oldLegacy = { ...legacy, deadline: [2045, 12], anchors: [{ ...legacy.anchors[0], x: village.x, y: village.y }, ...legacy.anchors.slice(1)] };
const restoredLegacy = CM.Tasks.restore({ active: [oldLegacy] }, { y: 2041, m: 1 }).active[0];
assert.deepEqual(restoredLegacy.anchors[0], legacy.anchors[0]);
assert.deepEqual(Array.from(restoredLegacy.deadline), [2041, 12]);
assert.equal(oldLegacy.anchors[0].x, village.x, 'Original save data is unchanged');
assert.deepEqual(CM.Tasks.restore({ active: [oldLegacy] }, { y: 2042, m: 1 }).active[0].deadline, [2045, 12]);
assert.ok(!Fac.active(village, 2037, city));
assert.ok(olympicSites.slice(0, 3).every(f => Fac.active(f, 2037, city)));
const villageCell = city.cellAt(village.x, village.y);
city.plan[villageCell] = CM.LU.IND;
city.applyReplan(2037, true, 4);
assert.equal(city.regionAt(village.x, village.y).plan, 'res');
assert.equal(city.plan[villageCell], city.planFor(villageCell));
assert.equal(DATA.mapLabels.find(l => l.name === '吴泾奥运村居住区').from, 2037);
console.log('PASS Wujing venue access, Olympic and legacy roads, and restored task entrances');

// Neither having street vertices beside the entrance nor having a legal site
// beside the destination is enough if their parts of the walking graph are disconnected.
const disconnectedWalk = Object.assign(Object.create(City.prototype), { W: 4, H: 1, VW: 5,
  vx: [0, 1, 2, 3, 4], vy: [0, 0, 0, 0, 0], waterDistAt: () => 1 });
disconnectedWalk.walk = { deg: [1, 1, 0, 1, 1], start: [0, 1, 2, 2, 3, 4],
  to: [1, 0, 4, 3], len: [250, 250, 250, 250] };
assert.equal(disconnectedWalk.walkCanReach([0.1, 0.1], [[3.9, 0.1]], 1125), false);
disconnectedWalk.walk = { deg: [1, 2, 2, 2, 1], start: [0, 1, 3, 5, 7, 8],
  to: [1, 0, 2, 1, 3, 2, 4, 3], len: Array(8).fill(250) };
assert.equal(disconnectedWalk.walkCanReach([0.1, 0.1], [[3.9, 0.1]], 1125), true);
assert.equal(disconnectedWalk.walkCanReach([0.1, 0.1], [[3.9, 0.1]], 700), false);

const walkways = city.roadGroups.filter(g => g.walkOnly);
assert.ok(walkways.some(g => g.year === 2015) && walkways.some(g => g.year === 2020),
  'Existing walking streets follow the opening phases of both suburban belts');
assert.ok(city.roadWays.some(w => w.walkSource !== undefined && city.roadsBuilt[w.g]));
const newlyMapped = (u, v) => city.edgeBetween(u % city.VW, Math.floor(u / city.VW), v % city.VW, Math.floor(v / city.VW));
let parkPaths = 0;
for (let u = 0; u < city.V; u++) for (let q = city.walk.start[u]; q < city.walk.start[u + 1]; q++) {
  const v = city.walk.to[q];
  if (v <= u) continue;
  const e = newlyMapped(u, v);
  assert.notEqual(city.eBlock[e], 2, 'No pedestrian link crosses future reclamation');
  if (city.eCls[e] || !city.eWalkRoad[e]) continue;
  const c = city.cellAt((city.vx[u] + city.vx[v]) / 2, (city.vy[u] + city.vy[v]) / 2);
  if (c >= 0 && city.lu[c] === CM.LU.PARK) parkPaths++;
}
assert.ok(parkPaths > 0, 'Documented footpaths serve parks without developed city blocks');
assert.ok(CM.Tasks.facServable(city, songjiang) && CM.Tasks.facServable(city, yuanxiang));
console.log('PASS public walking routes, opening phases, barriers and connected facility approaches');

// Use station coordinates from the affected areas to test normal land use
// without relying on a facility, a saved game, or a geographic snap marker.
const stationSites = [{ x: 175.8886, y: 209.5286 }, { x: 248.6010, y: 212.2111 }, { x: 311.7538, y: 285.5951 }];
const residential = [[173.5, 206.5], [245.5, 209.5], [314.5, 282.5]].map(p => city.cellAt(...p));
const regularModel = new CM.Model(city, { deferDemand: true });
const regularNetwork = { stations: stationSites, serviced: [1, 1, 1] };
const withLocalPaths = regularModel.computeAccess(regularNetwork);
const carsBefore = city.car;
city.eArt.fill(0); city.eName.fill(0); city.eWalkRoad.fill(0); city.roadsBuilt.fill(0);
city.roadGroups.forEach((g, k) => { if (g.walkOnly) city.roadsBuilt[k] = 1; });
city.applyRoads(2037);
city.updateStreets();
city.buildGraphs();
const withoutLocalPaths = regularModel.computeAccess(regularNetwork);
assert.equal(city.car, carsBefore, 'The pedestrian update leaves motorized road access unchanged');
const recovered = residential.filter(c => withLocalPaths.cellWalk[c] <= CFG.walk.maxAccessM && withoutLocalPaths.cellWalk[c] > CFG.walk.maxAccessM);
assert.ok(recovered.length > 0 && recovered.some(c => city.pop[c] + city.jobs[c] > 0),
  'Documented branch roads reconnect ordinary residents or jobs to the operating network');
console.log('PASS regular neighbourhoods regain 15-minute station access');
