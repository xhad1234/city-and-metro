import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url), c = { console, performance, atob, btoa, TextEncoder, TextDecoder, setTimeout, clearTimeout,
  navigator: { hardwareConcurrency: 4 }, matchMedia: () => ({ matches: false }), localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
c.window = c; vm.createContext(c);
const load = async f => vm.runInContext(await readFile(new URL(f, root), 'utf8'), c, { filename: f });
for (const [, f] of (await readFile(new URL('index.html', root), 'utf8')).matchAll(/<script src="([^"]+)"/g)) { await load(f); if (f === 'js/save.js') break; }
await load('js/tools.js');
const C = c.CM, M = C.Metro, D = C.DATA;
C.useMap('sh');
assert.ok(D.stationNames.length > 333, 'Include station footprints missing from the old node-only data');
for (const name of ['闵行开发区', '东川路', '江川路', '金平路']) assert.ok(D.stationNames.some(p => p[0] === name), name);
assert.ok(!D.stationNames.some(p => /在建|规划|construction|proposed/i.test(p[0])));
console.log('PASS real Shanghai station catalog includes line 5 footprints and excludes construction names');

const source = { places: D.places, stationNames: D.stationNames, landmarks: D.landmarks, list: C.Fac.list, active: C.Fac.active, byId: C.Fac.byId, parks: C.Geo.parks, ready: C.Geo.ready };
let facilities = [];
D.places = []; D.stationNames = []; D.landmarks = [];
C.Fac.list = () => facilities; C.Fac.active = (f, y) => (f.open ?? 0) <= y && !f.closed;
C.Geo.ready = true; C.Geo.parks = [];
const city = { terrainYear: 2021, landmarkOn: [], regionAt: () => ({ name: '测试区' }), roadGroups: [], roadWays: [], roadsBuilt: [] };
const road = (name, p, built = 1, flags = 0, cls = 2) => {
  const g = city.roadGroups.length;
  city.roadGroups.push({ name, flags, cls }); city.roadsBuilt.push(built);
  city.roadWays.push({ g, p, bbox: C.Geo.bbox(p) });
  city.roadWayBk = C.Geo.buckets(city.roadWays, 4, 100, 100);
};
road('测试路', [0, 10, 90, 10]);
const f = (name, t, x = 10, y = 10, extra = {}) => ({ id: name, name, t, x, y, ...extra });
try {
  const net = M.empty(), suggest = () => M.suggestName(net, 10, 10, city);
  D.stationNames = [['真实站', 12, 10, 0]];
  facilities = [f('大学', 'uni')];
  assert.equal(suggest(), '真实站', 'Existing stations outrank nearer permanent landmarks and roads');
  D.stationNames = [['肿瘤医院', 10, 10, 0]];
  assert.equal(suggest(), '肿瘤医院', 'A real station name is valid even if historically named after a hospital');
  D.stationNames = [];
  assert.equal(suggest(), '大学');
  for (const type of ['shop', 'hosp', 'cbd', 'venue']) {
    facilities = [f('商场医院商务中心', type)]; assert.equal(suggest(), '测试路');
  }
  facilities = [f('真实科学园区', 'cbd')]; assert.equal(suggest(), '真实科学园区');
  facilities = [f('测试区文体公园', 'park', 10, 10, { gen: {} })]; assert.equal(suggest(), '测试路');
  facilities = [f('未来大学', 'uni', 10, 10, { open: 2027 }), f('停用大学', 'uni', 10, 10, { closed: true })];
  assert.equal(suggest(), '测试路', 'Closed and future facilities cannot supply a landmark name');
  facilities = [f('真实公园', 'park', 11, 10), f('真实大学', 'uni', 12, 10)];
  assert.equal(suggest(), '真实公园');
  net.stations.existing = { name: '真实公园' };
  assert.equal(suggest(), '真实大学', 'Skip names already used in this network');
  facilities = []; net.stations = {};
  D.places = [['不明商业地名', 10, 10, 2]];
  assert.equal(suggest(), '测试路', 'Unclassified place names must not bypass the type policy');
  road('未通车路', [10, 9, 10, 11], 0);
  road('高速匝道', [10, 9, 10, 11], 1, 4, 4);
  assert.equal(suggest(), '测试路', 'Use actual road geometry, excluding unopened roads and expressway ramps');
  net.stations.existing = { name: '测试路' };
  assert.equal(suggest(), '测试路2');
  net.stations.second = { name: '测试路2' }; assert.equal(suggest(), '测试路3');
  net.stations = {};
  C.Geo.parks = [{ name: '大公园', bbox: [5, 5, 50, 50], rings: [{ p: [5, 5, 50, 5, 50, 50, 5, 50, 5, 5] }] }];
  assert.equal(suggest(), '大公园', 'Inside a large park, use its footprint rather than a distant center');
  C.Geo.parks[0].name = '城市动力广场';
  assert.equal(suggest(), '测试路', 'A landscaped commercial plaza tagged as park is not a verified public landmark');
  C.Geo.parks = [];
  const id = M.addStation(net, 10, 10, {}, city); assert.equal(net.stations[id].name, '测试路');
  const existingName = net.stations[id].name; M.suggestName(net, 20, 20, city); assert.equal(net.stations[id].name, existingName);
  const portal = f('铁路接口', 'rail', 200, 200, { ext: {}, closed: true }); facilities = [portal];
  const tools = Object.create(C.Tools.prototype);
  const game = { city, netVersion: 0, rev: 0 };
  Object.assign(tools, { game: () => game, net: () => net, portalHover: portal.id });
  C.Fac.byId = key => key === portal.id ? portal : null;
  const preview = tools.previewName(10, 10), added = M.addStation(net, 10, 10, { portal: portal.id }, city);
  assert.equal(net.stations[added].name, preview); assert.equal(net.stations[added].portal, portal.id);
  assert.equal(preview, '铁路接口');
  D.stationNames = [['真实站', 10, 10, 0]];
  assert.equal(M.suggestName(net, 10, 10, city, portal.id), '真实站', 'Real station names also take priority at a portal');
  const crowded = M.empty();
  for (let k = 1; k <= 120; k++) crowded.stations['s' + k] = { name: '测试区' + k + '站' };
  assert.equal(M.suggestName(crowded, 95, 95, city), '测试区121站', 'Fallback remains unique after more than 99 names');
  console.log('PASS naming priorities, facility exclusions, dates, road geometry, uniqueness, park footprints and portal preview parity');
} finally {
  D.places = source.places; D.stationNames = source.stationNames; D.landmarks = source.landmarks;
  C.Fac.list = source.list; C.Fac.active = source.active; C.Fac.byId = source.byId; C.Geo.parks = source.parks; C.Geo.ready = source.ready;
}

C.useMap('gz'); assert.equal(C.DATA.stationNames, undefined, 'The Shanghai catalog must not leak into another city');
console.log('PASS map switching clears city-specific station names');
