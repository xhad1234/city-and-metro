// 1km traffic zones: migrate parsed copies, never touch a player file or browser storage.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const root = new URL('../', import.meta.url), c = { console, performance, atob, btoa, TextEncoder, TextDecoder, setTimeout, clearTimeout,
  navigator: { hardwareConcurrency: 4 }, matchMedia: () => ({ matches: false }), localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
c.window = c; vm.createContext(c);
for (const [, f] of (await readFile(new URL('index.html', root), 'utf8')).matchAll(/<script src="([^"]+)"/g)) {
  vm.runInContext(await readFile(new URL(f, root), 'utf8'), c, { filename: f }); if (f === 'js/save.js') break;
}
const C = c.CM;
C.useMap('sh');
const { W, H, ZONE, CELL_M } = C.CFG;
assert.equal(ZONE * CELL_M, 1000); assert.equal(C.MAPS.sh.mapVersion, 5);
const city = { W, H, car: { nA: 0, zoneConn: [], arcLen: [], arcT0: [], links: [] } };
const model = new C.Model(city, { deferDemand: true });
assert.equal(model.Z, 17920); assert.equal(model.zoneCells[10046].length, 16);
assert.equal(model.flowBlockCells, 32); assert.equal(model.B, 288);
for (const dt of ['wd', 'we']) for (const P of model.ctxs[dt].per) {
  assert.equal(P.zTrips.length, 17920); assert.equal(P.desTot.length, 82944);
}
const zoneAt = (x, y) => Math.floor(y / ZONE) * (W / ZONE) + Math.floor(x / ZONE);
assert.notEqual(zoneAt(251.8296, 315.2001), zoneAt(252.7885, 318.5361), 'Houtan and Dezhou Road get separate traffic zones');
const keys = ['pop', 'jobs', 'bh', 'taken', 'lu', 'street', 'urbanYear'];
const old = new Float32Array(W * H); old[315 * W + 251] = 4500;
const payload = { meta: { map: 'sh', mapVersion: 4 }, clock: { y: 2021, m: 11, d: 18, minute: 1171.89 },
  city: Object.fromEntries(keys.map(k => [k, C.U.packTyped(old, 'f32')])),
  net: { stations: { s314: { name: '后滩', x: 251.8296, y: 315.2001, site: [251.8296, 315.2001] } }, lines: { l303: { name: '7号线', skip: ['s314'] } }, segments: {} },
  netGone: { stations: {}, segments: {} }, fleet: { trains: [{ id: 'train1', line: 'l303' }] }, econ: { funds: 123456, debt: 600, ledger: [{ fare: 1200 }] },
  macro: { rec: [{ y: 2021, gdp: 100 }], gaps: { '24262': 1.02 } }, eraBase: { trips: 300 }, history: [{ y: 2020, metro: 90 }], traffic: { v: 7 },
  tasks: { active: [{ zone: 623, coolKey: 'cov:623', anchors: [{ x: 255.8, y: 319.6 }], parts: [{ zone: 623, anchors: [{ x: 249, y: 317 }] }] }],
    done: [{ zone: 623, coolKey: 'cong:623' }], failed: [], offers: [{ zone: 623, anchors: [{ x: 251.8, y: 315.2 }] }], cool: { 'cov:623': 25000, 'cong:623': 25003, 'hist:fixed': 25004 } },
  corp: { tenders: [{ zone: 623, area: { x: 249, y: 317 } }], contracts: [{ zone: 623, area: { x: 255, y: 319 } }], closed: [{ zone: 623 }], cool: { 'z:623': 25001, 'l:l303': 25005 } } };
const body = JSON.stringify(payload), raw = JSON.stringify({ format: C.CFG.SAVE_FORMAT, version: 2, body, checksum: C.U.fnv(body) });
const p = C.Save.parseEnvelope(raw).payload;
for (const key of ['city', 'net', 'netGone', 'fleet', 'econ', 'macro', 'clock', 'history', 'eraBase']) assert.equal(JSON.stringify(p[key]), JSON.stringify(payload[key]), key + ' must be preserved');
assert.equal(p.meta.mapVersion, 5); assert.equal(p.mapUpgrade.zoneOnly, true);
assert.equal(p.tasks.active[0].zone, zoneAt(255.8, 319.6)); assert.equal(p.tasks.active[0].coolKey, 'cov:' + zoneAt(255.8, 319.6));
assert.equal(p.tasks.active[0].parts[0].zone, zoneAt(249, 317));
assert.equal(p.tasks.done[0].zone, zoneAt(248, 312)); assert.equal(p.tasks.offers[0].zone, zoneAt(251.8, 315.2));
assert.equal(p.corp.tenders[0].zone, zoneAt(249, 317)); assert.equal(p.corp.contracts[0].zone, zoneAt(255, 319));
assert.equal(p.corp.closed[0].zone, zoneAt(248, 312));
assert.equal(Object.keys(p.tasks.cool).length, 33); assert.equal(Object.keys(p.corp.cool).length, 17);
for (let y = 304; y < 320; y += 4) for (let x = 240; x < 256; x += 4) {
  assert.equal(p.tasks.cool['cov:' + zoneAt(x, y)], 25000); assert.equal(p.tasks.cool['cong:' + zoneAt(x, y)], 25003); assert.equal(p.corp.cool['z:' + zoneAt(x, y)], 25001);
}
assert.equal(p.tasks.cool['hist:fixed'], 25004); assert.equal(p.corp.cool['l:l303'], 25005);
assert.equal(JSON.stringify(payload), body);
assert.equal(JSON.stringify(C.Save.parseEnvelope(raw).payload), JSON.stringify(p), 'Repeated imports migrate consistently without changing the original');
console.log('PASS 1km Shanghai zones, separate Houtan catchment, bounded flow matrices, nested tasks/corporate migration and unchanged city/network/economy');
