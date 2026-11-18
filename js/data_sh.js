'use strict';
// 上海 · 1990 场景。地理来自 OpenStreetMap（geo_sh.js，现代数据），本文件补充 1990 年起的区域开放（按街道与区划分）、越江桥隧与高架道路通车年份、
// 人口就业中心、地标、重要设施、历史事件、本地任务与人民币经营参数。坐标单位为格（250 m），用 ll(纬度, 经度) 换算。
// 2026 年前的城市事件参考历史，地面与交通按游戏规则推演。2027 年起进入模拟未来。
(function (CM) {
  const G = CM.GEOS && CM.GEOS.sh; if (!G) return;
  // 本文件的经纬度按国内地图常用的 GCJ-02 坐标填写，换算为 OSM 使用的 WGS-84 后再投影
  const P = G.proj, ll = function (lat, lon) { const w = CM.U.gcj2wgs(lat, lon); return [+((w[1] - P.lon0) * P.kx).toFixed(2), +((P.lat0 - w[0]) * P.ky).toFixed(2)]; };
  // 取自 OpenStreetMap 的地标位置（WGS-84，不再换算）
  const llW = function (lat, lon) { return [+((lon - P.lon0) * P.kx).toFixed(2), +((P.lat0 - lat) * P.ky).toFixed(2)]; };
  const atW = function (lat, lon, o) { const p = llW(lat, lon); return Object.assign({ x: p[0], y: p[1] }, o); };
  const poly = function (pts) { return pts.map(function (p) { return ll(p[0], p[1]); }); };
  const at = function (lat, lon, o) { const p = ll(lat, lon); return Object.assign({ x: p[0], y: p[1] }, o); };
  const anchor = function (name, lat, lon, r) { const p = ll(lat, lon); return { name: name, x: p[0], y: p[1], r: r }; };
  const anchorW = function (name, lat, lon, r) { const p = llW(lat, lon); return { name: name, x: p[0], y: p[1], r: r }; };   // OSM 坐标（WGS-84）
  const oldOffset = [192, 208], oldSize = 152, oldEdge = ll(31.1900, 121.7000);
  const wujing = {
    stadium: [31.0566, 121.4705],
    aquatics: [31.0638, 121.4671],
    arena: [31.0518, 121.4620],
    village: [31.0484, 121.4709],
  };
  const suburbanNote = '游戏扩图时间，按片区开放。';
  // 市内到发接驳量，万人次/日。崇明机场在游戏中沿用同年的虹桥机场客流曲线。
  const hongqiaoPax = [[2010.17, 8.4], [2015, 10.3], [2019, 12.2], [2020, 8.5], [2021, 8.9], [2022, 3.9],
    [2023, 11.2], [2024, 12.7], [2025, 13.3], [2030, 15.5], [2035, 17], [2040, 18], [2050, 19]];
  const chongmingAir = {
    at: llW(31.5490, 121.6940),
    runways: [[llW(31.5540, 121.6760), llW(31.5540, 121.7130)], [llW(31.5435, 121.6760), llW(31.5435, 121.7130)]],
  };
  const site = (id, n, t, lat, lon, y0, w, note, extra) => {
    const s = Object.assign({ id: 'sh_' + id, n, t, at: llW(lat, lon), fixedSite: true, regionGate: true, y0, w, note }, extra);
    if (typeof s.src === 'string') s.src = { url: s.src };
    return s;
  };
  const localRail = (id, n, lat, lon, y0, pax, note) =>
    site(id, n, 'rail', lat, lon, y0, null, note, { pax });
  const railInterface = (id, n, lat, lon, dir, km, y0, pax, src, note, planned = true) =>
    site(id, n, 'rail', lat, lon, y0, null, note, {
      ext: [dir, km], extEdge: llW(lat, lon), pax,
      src: { pos: '位置：走廊省界接口', year: planned ? '启用：游戏情景' : '年份：史实参考', sim: planned, url: src },
      interfacePlan: planned, regionGate: false,
    });

  // 虹桥机场飞行区（近似）、陆家嘴金融贸易区核心（近似）、虹桥商务区（近似，机场以西）
  const hongqiao = poly([[31.2160, 121.3285], [31.2160, 121.3500], [31.1790, 121.3500], [31.1790, 121.3285]]);
  const lujiazui = poly([[31.2455, 121.4960], [31.2455, 121.5130], [31.2330, 121.5200], [31.2275, 121.5110], [31.2300, 121.4990]]);
  const hqcbd = poly([[31.2100, 121.3100], [31.2100, 121.3280], [31.1830, 121.3280], [31.1830, 121.3100]]);

  const data = {
    // 城市特色（traits.js，规则见《地图设计与城市特色机制.md》）。新条目加在末尾，已触发事件按序号记录
    traits: [
      { use: 'crossing', star: true, icon: 'bridge', label: '黄浦江与浦东', text: '1990 年江上还没有桥，越江线路造价最高，却连着全城发展最快的地方', why: '1990 年 4 月浦东开发开放，南浦大桥 1991 年底才通车。' },
      { use: 'megaEvent', level: 'mid', star: true, icon: 'flag', label: '2010 世博会', text: '获得主办权后拨款增加，园区一带可以提前布局',
        bid: { y: 2002, m: 12 }, open: [2010, 5],
        foresight: { id: 'sh-expo', level: 'mid', at: 'sh_cnpav', ym: [2002, 12], before: 2000, r: 7, region: 'pdriver', title: '世博园区选址浦江两岸',
          hit: '世博园区选在黄浦江两岸的老工业带，早已通车的{st}站让这里抢先有了依托。', miss: '世博园区选在黄浦江两岸的老工业带，这里的地铁还不够，几年内要补上。' },
        why: '2002 年 12 月上海获得 2010 年世博会主办权，世博前上海地铁进入大规模建设期。' },
      { use: 'carLimit', level: 'mid', icon: 'car', label: '车牌拍卖', text: '1994 年起私车牌照要靠拍卖取得，开车更贵，地铁更有吸引力', on: { y: 1994, m: 1, title: '私车牌照开始拍卖', desc: '上海从 1994 年起对新增私车牌照实行拍卖，控制中心城区的汽车增长。' }, why: '上海 1994 年起实行新增机动车额度拍卖。' },
      { use: 'guard', level: 'mid', label: '外滩与老城古建', guards: ['sh_bund', 'sh_yuyuan', 'sh_xjh', 'sh_longhua', 'sh_jingan'], why: '外滩建筑群、豫园、徐家汇天主堂、龙华寺和静安寺都是上海的历史名胜，地铁要小心避让。' },
      { use: 'transition', level: 'light', label: '世博园区工厂搬迁', region: 'pdriver', close: { y: 2004, m: 1, title: '世博园区工厂开始搬迁', desc: '为建设世博园区，上钢三厂、江南造船厂等沿江工厂陆续搬迁。' }, replan: [{ year: 2005, region: 'pdriver', plan: 'mix' }], why: '世博园区选址在浦江两岸的老工业带，沿江工厂在 2000 年代中期陆续搬迁。' },
      { use: 'transition', level: 'light', label: '杨浦转型', region: 'yangpu', close: { y: 1995, m: 1, title: '杨浦老工厂陆续关停', desc: '1990 年代起，杨浦的纺织、机械和钢铁企业陆续转移、关停，大批工人下岗。' }, renew: { y: 2003, m: 1, title: '杨浦知识创新区', desc: '上海决定建设杨浦知识创新区，推动大学校区、科技园区和公共社区融合发展。' }, replan: [{ year: 2004, region: 'yangpu', plan: 'mix' }], why: '杨浦 1990 年代起转移、关停传统工业，2003 年上海决定建设杨浦知识创新区。' },
      { use: 'accident', level: 'light', label: '2003 年 4 号线事故', on: { y: 2003, m: 7, title: '轨道交通 4 号线董家渡事故', desc: '7 月 1 日，在建的 4 号线联络通道发生涌水塌陷，地面沉降，黄浦江防汛墙受损，软土中施工的风险引起全国关注。' }, why: '2003 年 7 月 1 日，上海轨道交通 4 号线隧道事故。' },
      { use: 'finance', flavor: 'cn' },
      { use: 'megaEvent', level: 'mid', star: true, icon: 'flag', label: '2040 上海奥运会', region: 'wujing',
        text: '吴泾滨江建设奥林匹克公园。场馆连通后，地铁可在赛时承担游客交通。',
        bid: { y: 2030, m: 9, title: '上海获得 2040 年夏季奥运会主办权', tag: '模拟',
          desc: '游戏设定：主场馆选址闵行吴泾，城市获得奥运轨道交通专项拨款。' },
        open: [2040, 8],
        why: '游戏设定参考吴泾工业区的滨江更新与战略预留用地。' },
      { use: 'portal', label: '长三角铁路接口', why: '参考沪苏嘉城际铁路、嘉闵线北延伸及金山至平湖线等规划，在模拟范围边界预留接驳口；未来启用时间与客流为游戏情景。' },
    ],
    city: '上海', riverName: '黄浦江', seaName: '长江口', hsrYear: 2010, terrainRevision: 3,
    population: CM.SH_POPULATION,
    airportLayout: CM.SH_AIRPORT_LAYOUT,
    populationStyle: { from: 2020 }, smoothFacilityHeat: true,
    stages: [[1993, '无地铁时代'], [2000, '浦东开发初期'], [2010, '迎世博建设期']], stageLast: '超大城市网络化时期',
    // 历史发展阶段（v2.2，eras.js）：summary 中「史实」可查证，「估算」为模型设定的发展倾向；grow 只改变人口与岗位增长的去向（总量仍按人口曲线），
    // relocate 为每月疏解比例，corridors 为片区间通勤与购物去向倍数，demand 为出行强度与距离倍数，goals 为阶段目标（本城任务）
    eras: [
      { id: 'sh-e1', from: 1990, name: '无地铁时代', tag: '史实',
        summary: '史实：1990 年 4 月宣布开发开放浦东；浦西老城区十分拥挤，过黄浦江主要依靠轮渡与打浦路隧道，1991 年南浦大桥通车。估算：旧区改造把居民迁往普陀、徐汇、长宁的新村，就业仍集中在黄浦与静安。',
        grow: { pop: { huangpu: 0.5, jingan: 0.6, hongkou: 0.8, putuo: 1.2, xuhui: 1.2, changning: 1.2, pdriver: 1.3 }, jobs: { huangpu: 1.3, jingan: 1.2, xuhui: 1.1, pdriver: 1.2 } },
        relocate: { pop: { huangpu: 0.0006, jingan: 0.0004 } },
        demand: { decayHW: 0.85 }, corridors: [{ a: 'pdriver', b: 'huangpu', f: 1.15 }] },
      { id: 'sh-e2', from: 1993, name: '浦东开发初期', tag: '史实',
        summary: '史实：1993 年陆家嘴、金桥与张江开始建设，杨浦大桥通车，地铁 1 号线南段试运营（史实背景，不会自动建成）；1999 年浦东国际机场启用。估算：陆家嘴与浦东沿江的岗位快速增长，浦西旧区居民大量迁往外围新村，跨江通勤成为主要的新增出行。',
        grow: { pop: { huangpu: 0.5, jingan: 0.6, pdriver: 1.5, jinqiao: 1.4, putuo: 1.3, xinzhuang: 1.4, wusong: 1.1, changning: 1.2 }, jobs: { lujiazui: 2.4, jinqiao: 1.8, waigaoqiao: 1.6, xuhui: 1.3, changning: 1.3 } },
        relocate: { pop: { huangpu: 0.0008, jingan: 0.0005 } },
        demand: { decayHW: 1.05 },
        corridors: [{ a: 'pdriver', b: 'huangpu', f: 1.2 }, { a: 'lujiazui', b: 'huangpu', f: 1.2 }, { a: 'jinqiao', b: 'yangpu', f: 1.1 }, { a: 'xinzhuang', b: 'xuhui', f: 1.15 }],
        goals: [{ id: 'sh-g1', from: 1996, type: 'connect', months: 48, reward: 45000, title: '张江高科技园区', desc: '张江高科技园区招商引资，科研人员需要往返陆家嘴与浦西。用地铁连接张江与陆家嘴。', anchors: [anchor('张江', 31.2030, 121.5870, 4), anchor('陆家嘴', 31.2380, 121.5000, 3)] }] },
      { id: 'sh-e3', from: 2000, name: '迎世博建设期', tag: '史实',
        summary: '史实：2002 年上海获得 2010 年世博会主办权，卢浦大桥（2003 年）、上海南站（2006 年）建成，2008 年上海环球金融中心落成。估算：陆家嘴成为金融中心，宝山、闵行、嘉定与浦东外围出现大型居住区，平均通勤距离明显变长。',
        grow: { pop: { dachang: 1.5, minhang: 1.4, xinzhuang: 1.3, beicai: 1.5, jiading: 1.3, chuansha: 1.2, pudong: 1.3, huangpu: 0.5, jingan: 0.6 }, jobs: { lujiazui: 2.0, jinqiao: 1.5, xuhui: 1.3, jingan: 1.2, huangpu: 0.9 } },
        relocate: { pop: { huangpu: 0.0006 } },
        demand: { sh: 1.05, decayHW: 1.15 },
        corridors: [{ a: 'lujiazui', b: 'jingan', f: 1.15 }, { a: 'dachang', b: 'jingan', f: 1.15 }, { a: 'minhang', b: 'xuhui', f: 1.15 }, { a: 'beicai', b: 'lujiazui', f: 1.15 }],
        goals: [{ id: 'sh-g2', from: 2005, type: 'connect', months: 48, reward: 45000, title: '莘庄与上海南站', desc: '上海南站启用后，莘庄、梅陇的居民经南站换乘进城。用地铁连接莘庄与上海南站。', anchors: [anchor('莘庄', 31.1110, 121.3850, 3), anchor('上海南站', 31.1540, 121.4300, 3)] }] },
      { id: 'sh-e4', from: 2010, name: '超大城市网络化时期', tag: '史实',
        summary: '史实：2010 年 3 月虹桥综合交通枢纽启用、5 月世博会开幕；2015 年上海中心大厦落成，2018 年起每年举办进口博览会。估算：虹桥商务区成长为西部中心，就业向陆家嘴、虹桥、张江等多个中心扩散，郊区与中心城之间的长距离通勤增加。',
        grow: { pop: { pudong: 1.4, jiading: 1.3, minhang: 1.3, dachang: 1.2, chuansha: 1.2, huangpu: 0.5, jingan: 0.6 }, jobs: { hqcbd: 2.2, lujiazui: 1.5, jinqiao: 1.5, xuhui: 1.3, huangpu: 0.85 } },
        relocate: { jobs: { huangpu: 0.0004 } },
        demand: { sh: 1.08, lz: 1.1, decayHW: 1.2, hub: 1.15 },
        corridors: [{ a: 'hqcbd', b: 'jingan', f: 1.15 }, { a: 'jinqiao', b: 'lujiazui', f: 1.15 }, { a: 'pudong', b: 'lujiazui', f: 1.15 }, { a: 'jiading', b: 'putuo', f: 1.15 }],
        goals: [{ id: 'sh-g3', from: 2013, type: 'connect', months: 48, reward: 45000, title: '前滩商务区', desc: '世博会后，黄浦江南段的前滩发展为新的商务区。用地铁连接前滩与陆家嘴。', anchors: [anchor('前滩', 31.1500, 121.4700, 4), anchor('陆家嘴', 31.2380, 121.5000, 3)] },
          { id: 'sh-g4', type: 'connect', months: 48, reward: 45000, title: '张江与金桥', desc: '张江与金桥的产业园区之间缺少直达交通。用地铁连接张江与金桥。', anchors: [anchor('张江', 31.2030, 121.5870, 4), anchor('金桥', 31.2650, 121.5900, 4)] }] },
      { id: 'sh-e5', from: 2021, through: 2026, name: '后疫情时代', tag: '史实',
        summary: '上海推进五个新城建设。2022 年春季疫情冲击出行，6 月起恢复，2023 年客流加速回升。机场联络线与沪苏湖高铁服务新的通勤和枢纽走廊，崇明线进入调试。',
        grow: { pop: { jiading_new: 1.6, qingpu: 1.6, songjiang: 1.7, fengxian: 1.6, lingang: 1.8 }, jobs: { jiading_new: 1.5, qingpu: 1.6, songjiang: 1.7, fengxian: 1.5, lingang: 1.9 } },
        demand: { decayHW: 1.22, decayHO: 1.1 },
        corridors: [{ a: 'songjiang', b: 'hqcbd', f: 1.2 }, { a: 'qingpu', b: 'hqcbd', f: 1.2 }, { a: 'lingang', b: 'jinqiao', f: 1.15 }] },
      { id: 'sh-e6', from: 2027, through: 2040, name: '喜迎奥运', tag: '模拟',
        summary: '模拟：上海东站与宝山站按规划情景启用，2035 年增加崇明国际机场。吴泾滨江由工业区转向赛事、居住和文体服务。五个新城继续承接人口与岗位，全市人口在 2040 年前后达到约 3500 万。',
        grow: { pop: { songjiang: 1.6, qingpu: 1.4, fengxian: 1.6, lingang: 1.7, wujing: 1.3 }, jobs: { pvg: 1.6, baoshan_new: 1.4, wujing: 1.7, lingang: 1.6 } },
        demand: { hub: 1.1, decayHW: 1.3 },
        corridors: [{ a: 'wujing', b: 'xinzhuang', f: 1.25 }, { a: 'wujing', b: 'fengxian', f: 1.2 }, { a: 'lingang', b: 'pvg', f: 1.2 }] },
      { id: 'sh-e7', from: 2041, name: '模拟未来', tag: '模拟',
        summary: '赛后奥运村转为居住社区，场馆继续用于体育赛事与公众活动。机场、高铁枢纽和五个新城继续产生跨区出行。',
        grow: { pop: { wujing: 1.4, fengxian: 1.35, songjiang: 1.4, lingang: 1.45 }, jobs: { pvg: 1.4, wujing: 1.3, jiading_new: 1.3 } },
        demand: { decayHW: 1.3 } },
    ],
    briefing: {
      lead: '1990 年的上海还没有地铁。黄浦江西岸的老城区里，公交车厢塞得满满当当；对岸的浦东还是农田与码头，黄浦江上一座大桥也没有。4 月，浦东开发开放的消息就要宣布。',
      modes: [['metro', '地铁', '尚无地铁。真实的地铁 1 号线 1993 年开始试运营，本局由你规划，真实线路不会自动出现。'], ['bus', '公交与自行车', '公交线路严重超载，自行车是通勤主力，高峰时市中心道路拥堵。'], ['bridge', '越江', '黄浦江上没有桥，过江只能走打浦路隧道、延安东路隧道或乘轮渡；南浦大桥 1991 年底才通车。'], ['rail', '铁路', '1987 年启用的上海站是主要铁路枢纽。列车本身不参与模拟，车站与虹桥机场会产生市内接驳出行，地面铁路会阻隔步行。']],
    },
    // 虹桥机场照常运营：用地不开发，范围内只能地下设站与地下穿越（同台北松山机场的规则）
    airport: { name: '虹桥机场', closeYear: 9999, buildable: 'underground', runway: [llW(31.2131, 121.3355), llW(31.1826, 121.3371)] },   // v2.2：跑道按 OSM 坐标（原数据走向偏斜）
    // 虹桥机场第二跑道（v2.2，OSM 坐标）：在原跑道以西约 365 m，2010 年 3 月启用（史实）
    runways: [{ a: llW(31.1834, 121.3332), b: llW(31.2130, 121.3316), from: 2010.2 },
      ...chongmingAir.runways.map(([a, b]) => ({ a, b, from: 2035 }))],
    regions: [
      { id: 'airport', name: '虹桥机场', poly: hongqiao, open: 1990, plan: 'res', note: '民用机场照常运营，用地不开发；范围内可以地下设站与地下穿越' },
      { id: 'lujiazui', name: '陆家嘴金融贸易区', poly: lujiazui, open: 1993, plan: 'cbd', note: '1990 年浦东开发开放，1993 年起陆家嘴金融贸易区大规模建设（史实）' },
      { id: 'hqcbd', name: '虹桥商务区', poly: hqcbd, open: 2009, plan: 'cbd', note: '2010 年虹桥综合交通枢纽启用，周边建设虹桥商务区（史实）' },
      { id: 'huangpu', name: '黄浦（外滩·人民广场·老城厢）', district: ['黄浦区'], open: 1990, plan: 'oldmix' },
      { id: 'jingan', name: '静安（南京西路·闸北）', district: ['静安区'], open: 1990, plan: 'mix' },
      { id: 'xuhui', name: '徐汇（徐家汇·漕河泾）', district: ['徐汇区'], open: 1990, plan: 'mix' },
      { id: 'changning', name: '长宁（中山公园·古北）', district: ['长宁区'], open: 1990, plan: 'res' },
      { id: 'putuo', name: '普陀（长寿路·曹杨）', district: ['普陀区'], open: 1992, plan: 'resind' },
      { id: 'hongkou', name: '虹口（四川北路·北外滩）', district: ['虹口区'], open: 1990, plan: 'oldmix' },
      { id: 'yangpu', name: '杨浦（工业区·五角场）', district: ['杨浦区'], open: 1992, plan: 'resind' },
      { id: 'pdriver', name: '浦东沿江（塘桥·洋泾·上钢）', streets: ['潍坊新村街道', '陆家嘴街道', '塘桥街道', '洋泾街道', '南码头路街道', '周家渡街道', '上钢新村街道', '东明路街道', '浦兴路街道', '沪东新村街道', '金杨新村街道'], open: 1992, plan: 'resind' },
      { id: 'jinqiao', name: '金桥·张江', streets: ['金桥镇', '张江镇', '唐镇', '花木街道'], open: 1994, plan: 'ind', pop: 8.7e6, note: '金桥出口加工区与张江高科技园区（史实）' },
      { id: 'waigaoqiao', name: '高桥·外高桥', streets: ['高桥镇', '高行镇', '高东镇', '曹路镇'], open: 1996, plan: 'ind', pop: 9.0e6, note: '1990 年设立外高桥保税区（史实）' },
      { id: 'beicai', name: '北蔡·三林', streets: ['北蔡镇', '三林镇', '康桥镇'], open: 2000, plan: 'res', pop: 10.5e6 },
      { id: 'pudong', name: '浦东其他地区', district: ['浦东新区'], open: 2005, plan: 'res', pop: 12.35e6 },
      { id: 'wusong', name: '吴淞·张庙', streets: ['吴淞街道', '张庙街道', '友谊路街道', '淞南镇', '高境镇', '庙行镇'], open: 1995, plan: 'resind' },
      { id: 'dachang', name: '大场·顾村', streets: ['大场镇', '顾村镇', '杨行镇', '罗店镇', '月浦镇'], open: 2000, plan: 'res', pop: 10.5e6 },
      { id: 'xinzhuang', name: '莘庄·七宝·梅陇', streets: ['莘庄镇', '七宝镇', '梅陇镇', '古美街道', '新虹街道', '虹桥镇', '华漕镇', '浦锦街道'], open: 1996, plan: 'res', pop: 9e6, note: '1992 年上海县与闵行区合并，莘庄、七宝一带大规模建设住宅（史实）' },
      { id: 'minhang', name: '闵行其他地区', district: ['闵行区'], open: 2002, plan: 'res', pop: 11.5e6 },
      { id: 'chuansha', name: '川沙·合庆', streets: ['川沙新镇', '合庆镇'], open: 2000, plan: 'res', pop: 10.3e6, note: '1993 年川沙县并入浦东新区；1999 年浦东国际机场在其东侧建成（史实）' },
      // 上海迪士尼度假区（v2.2，OSM 坐标）：乐园、迪士尼小镇与星愿公园；2016 年 6 月开园，之前为预留用地（乐园用地不分配普通住宅与就业）
      { id: 'disney', name: '上海迪士尼度假区', park: true, open: 2016, plan: 'res', poly: [[31.1506, 121.6497], [31.1506, 121.6626], [31.1455, 121.6697], [31.1375, 121.6697], [31.1375, 121.6557], [31.1411, 121.6497]].map(function (p) { return llW(p[0], p[1]); }), note: '2016 年 6 月上海迪士尼乐园开园（史实）；同年 4 月地铁 11 号线迪士尼站启用（史实）' },
      { id: 'jiading', name: '嘉定（江桥·真新）', district: ['嘉定区'], open: 2005, plan: 'res', pop: 12.35e6 },
    ],
    defaultRegion: { id: 'outside_sh', name: '上海及花桥范围外', open: null, empty: true, plan: 'res', lockNote: '不属于本图上海及花桥镇的建设范围' },
    replan: [{ year: 2033, region: 'wujing', plan: 'mix' }, { year: 2041, region: 'wujing_village', plan: 'res' }],
    plans: CM.DATA.plans,
    // 1990 年人口与就业中心（估算，人/km²；r 约为影响半径 km）
    centers: [
      at(31.2360, 121.4800, { pop: 45000, jobs: 90000, r: 1.2 }),   // 外滩、南京东路、人民广场
      at(31.2260, 121.4900, { pop: 70000, jobs: 30000, r: 0.9 }),   // 老城厢、豫园
      at(31.2250, 121.4500, { pop: 40000, jobs: 40000, r: 1.0 }),   // 静安寺、南京西路
      at(31.2180, 121.4700, { pop: 55000, jobs: 35000, r: 1.1 }),   // 淮海路、卢湾
      at(31.1950, 121.4370, { pop: 30000, jobs: 25000, r: 1.2 }),   // 徐家汇
      at(31.2220, 121.4200, { pop: 35000, jobs: 15000, r: 1.1 }),   // 曹家渡、中山公园
      at(31.2500, 121.4600, { pop: 45000, jobs: 25000, r: 1.2 }),   // 闸北、上海站
      at(31.2600, 121.4850, { pop: 50000, jobs: 20000, r: 1.2 }),   // 四川北路、虹口
      at(31.2650, 121.5200, { pop: 30000, jobs: 30000, r: 1.5 }),   // 杨浦工业区
      at(31.3000, 121.5100, { pop: 12000, jobs: 12000, r: 1.2 }),   // 五角场
      at(31.2400, 121.4200, { pop: 30000, jobs: 15000, r: 1.4 }),   // 长寿路、曹杨
      at(31.2100, 121.4000, { pop: 20000, jobs: 10000, r: 1.4 }),   // 长宁、古北
      at(31.2350, 121.5100, { pop: 25000, jobs: 15000, r: 1.4 }),   // 浦东沿江
      at(31.1800, 121.5000, { pop: 15000, jobs: 20000, r: 1.3 }),   // 上钢、周家渡
      at(31.3800, 121.4900, { pop: 8000, jobs: 15000, r: 1.8 }),    // 吴淞、宝钢
      at(31.1700, 121.4300, { pop: 15000, jobs: 10000, r: 1.3 }),   // 漕河泾、田林
      // v2.1 扩大范围（1990 年估算）
      at(31.1900, 121.7000, { pop: 8000, jobs: 5000, r: 0.9 }),     // 川沙镇
      atW(31.3822, 121.2387, { pop: 9600, jobs: 7500, r: 2.0 }), // 嘉定
      atW(31.2925, 121.1648, { pop: 4800, jobs: 6500, r: 1.8 }), // 安亭
      atW(31.1514, 121.1159, { pop: 9000, jobs: 5600, r: 1.9 }), // 青浦
      atW(31.0073, 121.2304, { pop: 12000, jobs: 7200, r: 2.1 }), // 松江
      atW(30.9247, 121.4712, { pop: 9500, jobs: 5600, r: 1.9 }), // 南桥
      atW(30.7224, 121.3332, { pop: 8000, jobs: 6200, r: 1.6 }), // 金山卫
      atW(30.8855, 121.1648, { pop: 5000, jobs: 4000, r: 1.8 }), // 朱泾
      atW(31.0513, 121.7543, { pop: 8800, jobs: 5300, r: 1.7 }), // 惠南
      atW(30.9015, 121.9089, { pop: 3900, jobs: 4200, r: 2.2 }), // 南汇新城
      atW(31.0260, 121.4217, { pop: 8900, jobs: 12500, r: 1.8 }), // 老闵行
      atW(31.0405, 121.4509, { pop: 6000, jobs: 11500, r: 1.7 }), // 吴泾
      atW(31.4191, 121.4151, { pop: 6200, jobs: 7100, r: 1.6 }), // 宝山北部
      atW(31.6234, 121.3960, { pop: 5400, jobs: 3600, r: 1.7 }), // 崇明城桥
      atW(31.5284, 121.8284, { pop: 3800, jobs: 1400, r: 1.6 }), // 崇明陈家镇
      atW(31.3790, 121.7340, { pop: 4200, jobs: 4100, r: 1.3 }), // 长兴岛
      atW(31.3423, 121.8441, { pop: 2400, jobs: 1000, r: 1.3 }), // 横沙岛
    ],
    rural: { pop: 800, jobs: 150 },
    // 越江桥隧与高架道路通车年份（名称前缀匹配；1990 年已有的道路按所在区域开放年份出现）。1990 年黄浦江上还没有桥；
    // OSM 中杨浦、徐浦大桥分别并入「内环高架路」「外环高速」。越江桥隧、内环与南北高架为史实，部分高架与快速路为近似年份
    roadYears: {
      '南浦大桥': 1991, '杨浦大桥': 1993, '徐浦大桥': 1997, '卢浦大桥': 2003, '打浦路隧道': 1971, '延安东路隧道': 1988, '外环隧道': 2003, '复兴东路隧道': 2004,
      '大连路隧道': 2003, '翔殷路隧道': 2005, '新建路隧道': 2009, '人民路隧道': 2009, '西藏南路隧道': 2010, '龙耀路隧道': 2010, '上中路隧道': 2009, '军工路隧道': 2011,
      '长江路隧道': 2016, '周家嘴路隧道': 2019, '江浦路隧道': 2021, '北横通道': 2021, '外滩隧道': 2010, '郊环隧道': 2009,
      '内环高架路': 1994, '南北高架': 1995, '延安高架路': 1999, '逸仙高架路': 1999, '中环路': 2006, '外环高速': 2003, '上海绕城高速': 2009,
      '沪嘉高速': 1988, '京沪高速': 1996, '沪昆高速': 1998, '沪渝高速': 2002, '沪金高速': 2000, '沪崇高速': 2009, '沪翔高速': 2011,
      '杨高路': 1992, '世纪大道': 2000, '罗山路': 1997, '龙东大道': 1998, '龙东高架路': 2008, '罗山高架路': 2005, '华夏高架路': 2009, '军工高架路': 2007,
      '北翟高架路': 2015, '嘉闵高架路': 2014, '虹梅高架路': 2014, '崧泽高架路': 2015, '度假区高架路': 2016, '五洲大道': 2011, '世博大道': 2010,
      '云亮路': 2026.5, '云亭东路': 2026.5, '通航二路': 2026.5, '凯宇路': 2026.5,
      '南纬八路上匝道': 2028 + 11 / 12, '南纬八路下匝道': 2028 + 11 / 12,
    },
    bridgeYears: {}, bridgeDefaultYear: 1990,
    simRoads: (CM.SH_AIRPORT_LAYOUT.roads || []).map(r => Object.assign({}, r, { y: r.y === 2026 ? 2026.5 : r.y })),
    landmarks: [
      Object.assign(atW(31.2395, 121.4850), { id: 'sh_bund', name: '外滩建筑群', w: 1200, d: 50, rot: -96, year: 1937, kind: 'bund' }),
      Object.assign(atW(31.2356, 121.4670), { id: 'sh_park', name: '国际饭店', w: 40, d: 40, year: 1934, kind: 'skyscraper', h: 83 }),
      Object.assign(atW(31.2261, 121.4485), { id: 'sh_expoctr', name: '上海展览中心', w: 200, d: 150, year: 1955, kind: 'palace', style: 'spire', h: 110 }),
      Object.assign(atW(31.2289, 121.4878), { id: 'sh_yuyuan', name: '豫园·城隍庙', w: 300, d: 250, year: 1577, kind: 'traditional' }),
      Object.assign(atW(31.2254, 121.4407), { id: 'sh_jingan', name: '静安寺', w: 150, d: 120, year: 1900, kind: 'temple' }),
      Object.assign(atW(31.2436, 121.4399), { id: 'sh_jade', name: '玉佛寺', w: 150, d: 180, year: 1918, kind: 'temple' }),
      Object.assign(atW(31.1771, 121.4471), { id: 'sh_longhua', name: '龙华寺', w: 160, d: 220, year: 977, kind: 'pagoda', h: 41 }),
      Object.assign(at(31.1932, 121.4370), { id: 'sh_xjh', name: '徐家汇天主堂', w: 90, d: 40, year: 1910, kind: 'church' }),
      atW(31.2515, 121.4511, { id: 'sh_station', name: '上海站', w: 300, d: 120, year: 1987, kind: 'rail', fixedSite: true }),
      Object.assign(atW(31.2981, 121.4979), { id: 'sh_fudan', name: '复旦大学', w: 900, d: 700, year: 1905, kind: 'campus' }),
      Object.assign(atW(31.2847, 121.4974), { id: 'sh_tongji', name: '同济大学', w: 900, d: 800, year: 1952, kind: 'campus' }),
      Object.assign(at(31.2005, 121.4370), { id: 'sh_sjtu', name: '上海交通大学（徐汇）', w: 600, d: 500, year: 1896, kind: 'campus', style: 'palace' }),
      Object.assign(atW(31.2286, 121.4018), { id: 'sh_ecnu', name: '华东师范大学', w: 800, d: 600, year: 1951, kind: 'campus' }),
      Object.assign(atW(31.2415, 121.4968), { id: 'sh_pearl', name: '东方明珠广播电视塔', w: 100, d: 100, year: 1994, kind: 'tvtower', style: 'pearl', h: 468 }),
      Object.assign(atW(31.2302, 121.4710), { id: 'sh_museum', name: '上海博物馆', w: 120, d: 120, year: 1996, kind: 'museum', style: 'ding' }),
      Object.assign(atW(31.1833, 121.4374), { id: 'sh_stadium', name: '上海体育场', w: 300, d: 270, year: 1997, kind: 'stadium' }),
      Object.assign(atW(31.2315, 121.4673), { id: 'sh_gt', name: '上海大剧院', w: 120, d: 100, year: 1998, kind: 'concert' }),
      Object.assign(atW(31.2373, 121.5014), { id: 'sh_jinmao', name: '金茂大厦', w: 70, d: 70, year: 1999, kind: 'skyscraper', style: 'jinmao', h: 420.5 }),
      Object.assign(atW(31.2733, 121.4763), { id: 'sh_hongkou', name: '虹口足球场', w: 220, d: 180, year: 1999, kind: 'stadium' }),
      Object.assign(atW(31.2119, 121.5634), { id: 'sh_sniec', name: '上海新国际博览中心', w: 600, d: 500, year: 2001, kind: 'expo' }),
      atW(31.1551, 121.4248, { id: 'sh_south', name: '上海南站', w: 300, d: 300, year: 2006, kind: 'rail', style: 'round', fixedSite: true }),
      Object.assign(atW(31.2366, 121.5030), { id: 'sh_swfc', name: '上海环球金融中心', w: 60, d: 60, year: 2008, kind: 'skyscraper', style: 'swfc', h: 492 }),
      atW(31.1960, 121.3162, { id: 'sh_hqstation', name: '虹桥站', w: 600, d: 400, rot: 90, year: 2010, kind: 'rail', fixedSite: true }),
      Object.assign(atW(31.1865, 121.4899), { id: 'sh_cnpav', name: '中国馆', w: 140, d: 140, year: 2010, kind: 'museum', style: 'crown' }),
      Object.assign(atW(31.2356, 121.5013), { id: 'sh_tower', name: '上海中心大厦', w: 80, d: 80, year: 2015, kind: 'skyscraper', style: 'shtower', h: 632 }),
      Object.assign(atW(31.1463, 121.6560), { id: 'sh_disney', name: '上海迪士尼乐园', w: 1150, d: 900, h: 60, year: 2016, kind: 'themepark', style: 'castle' }),   // 约 91 公顷，奇幻童话城堡约 60 m
      atW(30.9871, 121.2244, { id: 'sh_songjiang_station', name: '上海松江站', w: 520, d: 220, year: 2024, month: 12, kind: 'rail', fixedSite: true }),
      atW(31.1227, 121.7725, { id: 'sh_east_station', name: '上海东站', w: 390, d: 720, year: 2027, month: 7, kind: 'rail', fixedSite: true }),
      atW(31.4046, 121.4413, { id: 'sh_baoshan_station', name: '上海宝山站', w: 480, d: 260, year: 2027, month: 7, kind: 'rail', fixedSite: true }),
      atW(...wujing.stadium, { id: 'sh_oly_stadium', name: '吴泾奥林匹克体育场', w: 370, d: 310, year: 2037, kind: 'stadium' }),
      atW(...wujing.aquatics, { id: 'sh_oly_aquatics', name: '吴泾奥林匹克游泳馆', w: 220, d: 160, year: 2038, kind: 'stadium' }),
      atW(...wujing.arena, { id: 'sh_oly_arena', name: '吴泾奥林匹克体育馆', w: 270, d: 220, year: 2038, kind: 'stadium' }),
    ],
    // 上海的外围设施按实际地址列出。枢纽 pax 为游戏内工作日市内接驳到发合计（万人次/日），换乘不出站的客流不计。
    generateDistrictFacilities: false,
    facilities: [
      { id: 'sh_station', n: '上海站', t: 'rail', lm: 'sh_station', pax: [[1990, 7], [2000, 11], [2010, 16], [2019, 18], [2020, 12], [2021, 15], [2022, 8], [2023, 17], [2026, 20], [2040, 23]], note: '静安区秣陵路303号，上海铁路客运主站之一。' },
      { id: 'sh_south', n: '上海南站', t: 'rail', lm: 'sh_south', y0: [2006, 7], pax: [[2006.5, 2.5], [2010, 4], [2019, 5], [2022, 3], [2023, 4.5], [2025, 5.5], [2026, 6.5], [2040, 9]], note: '徐汇区沪闵路9001号。2025 年调图后增加高铁客运能力。' },
      { id: 'sh_west', n: '上海西站', t: 'rail', at: llW(31.2654, 121.3957), fixedSite: true,
        pax: [[1990, 0.5], [2005, 0.65], [2010.5, 0.25], [2019, 0.45], [2022, 0.2], [2026, 0.55], [2040, 0.75]], note: '普陀区桃浦路22号，按国铁小站估算，不包含同名地铁站的进出闸客流。' },
      { id: 'sh_hqstation', n: '虹桥站', t: 'rail', lm: 'sh_hqstation', y0: [2010, 7], pax: [[2010.5, 6], [2015, 22], [2019, 32], [2020, 23], [2021, 27], [2022, 14], [2023, 34], [2024, 40], [2026, 42], [2040, 48]],
        note: '虹桥枢纽铁路站房。2024 年铁路客流约 1.55 亿人次，游戏按日均到发及市内接驳估算；不叠加机场或枢纽其他方式客流。' },
      { id: 'sh_disney', n: '上海迪士尼乐园', t: 'scenic', lm: 'sh_disney', y0: [2016, 6], w: [[2016.5, 0.045], [2019, 0.05], [2020, 0.025], [2021, 0.04], [2023, 0.05]], we: 1.9, note: '主题乐园：周末与假日客流明显高于工作日（估算）；位于浦东川沙，2016 年 6 月开园。' },
      { id: 'sh_pvgair', n: '浦东机场（川沙接驳）', t: 'air', ext: ['E', 9], extEdge: [oldOffset[0] + 152, oldEdge[1]], at: oldEdge, y0: [1999, 9], y1: [2015, 1], pax: [[1999.67, 0.9], [2005, 5.8], [2010, 9.2], [2015, 14]], note: '1999 年 9 月浦东机场通航。游戏在机场片区开放前保留川沙接驳。' },
      { id: 'sh_pvg_terminal', n: '上海浦东国际机场（T1·T2）', t: 'air', at: llW(31.1519, 121.8015), fixedSite: true, noModel: true, r: 3, y0: [2015, 1],
        rw: [llW(31.1721, 121.7963), llW(31.1360, 121.7986)], pax: [[2015, 14], [2019, 18], [2020, 7.5], [2021, 8], [2022, 3.5], [2023, 13], [2024, 18.2], [2025, 20], [2030, 23], [2040, 29]],
        note: '航站区以两楼之间的到达交通中心代表。根据民航及上海机场年报扣除纯空空中转等，估算市内接驳量。' },
      { id: 'sh_hqair_t1', n: '虹桥机场（1号航站楼时期）', t: 'air', at: llW(31.1965, 121.3425), fixedSite: true, noModel: true, y1: [2010, 3],
        pax: [[1990, 1.4], [1999.67, 3.5], [2000, 2.5], [2005, 4.8], [2010.17, 8.4]], note: '2010 年 3 月以前，虹桥民航客运集中在机场东侧的 1 号航站楼。' },
      { id: 'sh_hqair', n: '上海虹桥国际机场（T2接驳）', t: 'air', at: llW(31.1958, 121.3266), fixedSite: true, noModel: true, y0: [2010, 3], r: 1.7,
        rw: [llW(31.2130, 121.3316), llW(31.1834, 121.3332)], pax: hongqiaoPax, note: '2010 年 3 月起以 2 号航站楼代表虹桥机场两座航站楼的市内接驳。' },
      { id: 'sh_chongming_air', n: '崇明国际机场', t: 'air', at: chongmingAir.at, rw: chongmingAir.runways[1], fixedSite: true,
        regionGate: true, y0: [2035, 1], r: 2, pax: hongqiaoPax,
        note: '游戏设定：航站楼位于崇明岛中东部、港沿镇与向化镇之间，2035 年投运，市内接驳量与同年的虹桥机场相同。',
        src: { pos: '位置：虚构选址', year: '年份：模拟', sim: true } },
      { id: 'sh_songjiang_station', n: '上海松江站', t: 'rail', lm: 'sh_songjiang_station', y0: [2024, 12], pax: [[2024 + 11 / 12, 3], [2026, 4.8], [2030, 6.5], [2040, 7.5]], note: '松江区盐仓路附近，2024 年 12 月随沪苏湖高铁开通，远期参考规划年客流约 2500 万人次。' },
      { id: 'sh_east_station', n: '上海东站', t: 'rail', lm: 'sh_east_station', y0: [2027, 7], pax: [[2027.5, 7], [2035, 13], [2040, 16]], note: '浦东祝桥镇站场建设范围内，祝钦路以南、金亭公路以北。按 2027 年投运计划设置，客流为模拟。', src: { pos: '位置：公开站场方案', year: '年份：规划情景', sim: true } },
      { id: 'sh_baoshan_station', n: '上海宝山站', t: 'rail', lm: 'sh_baoshan_station', y0: [2027, 7], pax: [[2027.5, 4.5], [2035, 9.5], [2040, 13]], note: '宝山湄浦路北侧，江杨北路与铁力路之间。远期参考规划年到发 5400 万人次，客流为模拟。', src: { pos: '位置：公开站场方案', year: '年份：规划情景', sim: true } },
      localRail('anting_north', '安亭北站', 31.31638, 121.15373, [2010, 7], [[2010.5, 0.1], [2025, 0.17], [2040, 0.25]], '嘉定区安亭镇，沪宁城际铁路车站。'),
      localRail('anting_west', '安亭西站', 31.31312, 121.15246, [2020, 7], [[2020.5, 0.08], [2025, 0.11], [2040, 0.19]], '嘉定区安亭镇，沪苏通铁路车站；与安亭北站的合计量参考安亭枢纽统计。'),
      localRail('nanxiang_north', '南翔北站', 31.28338, 121.30422, [2010, 7], [[2010.5, 0.05], [2025, 0.12], [2040, 0.18]], '嘉定区南翔镇，沪宁城际铁路车站。'),
      localRail('jinshan_north', '金山北站', 30.89627, 121.08488, [2010, 10], [[2010.75, 0.06], [2025, 0.19], [2040, 0.3]], '金山区枫泾镇，沪杭高铁车站。'),
      localRail('liantang_station', '练塘站', 30.99733, 121.02659, [2024, 12], [[2024 + 11 / 12, 0.06], [2026, 0.1], [2040, 0.21]], '青浦区练塘镇东侧，随沪苏湖高铁开通。'),
      { id: 'sh_oly_stadium', n: '吴泾奥林匹克体育场', t: 'stadium', lm: 'sh_oly_stadium',
        w: [[2037, 0.009], [2040 + 6 / 12, 0.014], [2040 + 7 / 12, 0.15], [2040 + 8 / 12, 0.022]], note: '模拟：2040 年夏季奥运会开闭幕式与田径比赛主场馆。' },
      { id: 'sh_oly_aquatics', n: '吴泾奥林匹克游泳馆', t: 'stadium', lm: 'sh_oly_aquatics',
        w: [[2038, 0.009], [2040 + 6 / 12, 0.012], [2040 + 7 / 12, 0.065], [2040 + 8 / 12, 0.013]], note: '模拟：游泳与跳水比赛场馆。' },
      { id: 'sh_oly_arena', n: '吴泾奥林匹克体育馆', t: 'stadium', lm: 'sh_oly_arena',
        w: [[2038, 0.009], [2040 + 6 / 12, 0.013], [2040 + 7 / 12, 0.08], [2040 + 8 / 12, 0.014]], note: '模拟：室内球类比赛场馆。' },
      { id: 'sh_oly_village', n: '吴泾奥运村', t: 'venue', at: llW(...wujing.village), r: 2.5, y0: [2039, 7], y1: [2041, 1], w: 0.015, note: '模拟：赛后转为居住社区。' },
      { id: 'sh_fudan', n: '复旦大学', t: 'uni', lm: 'sh_fudan', w: 0.035 },
      { id: 'sh_tongji', n: '同济大学', t: 'uni', lm: 'sh_tongji', w: 0.03 },
      { id: 'sh_sjtu', n: '上海交通大学（徐汇）', t: 'uni', lm: 'sh_sjtu', w: 0.02 },
      { id: 'sh_ecnu', n: '华东师范大学', t: 'uni', lm: 'sh_ecnu', w: 0.025 },
      { id: 'sh_sufe', n: '上海财经大学', t: 'uni', at: ll(31.3075, 121.4985), w: 0.012 },
      { id: 'sh_shu', n: '上海大学（宝山）', t: 'uni', at: ll(31.3160, 121.3920), y0: 1999, w: 0.02 },
      { id: 'sh_ecust', n: '华东理工大学', t: 'uni', at: ll(31.1440, 121.4235), w: 0.015 },
      { id: 'sh_dhu', n: '东华大学（延安路）', t: 'uni', at: llW(31.20622, 121.41055), w: 0.01 },
      { id: 'sh_ruijin', n: '瑞金医院', t: 'hosp', at: ll(31.2115, 121.4680), w: 0.06 },
      { id: 'sh_huashan', n: '华山医院', t: 'hosp', at: ll(31.2155, 121.4425), w: 0.05 },
      { id: 'sh_zhongshan', n: '中山医院', t: 'hosp', at: ll(31.1990, 121.4535), w: 0.06 },
      { id: 'sh_renji', n: '仁济医院', t: 'hosp', at: llW(31.23559, 121.47956), w: 0.04 },
      { id: 'sh_changhai', n: '长海医院', t: 'hosp', at: ll(31.3070, 121.5260), w: 0.04 },
      { id: 'sh_xinhua', n: '新华医院', t: 'hosp', at: ll(31.2720, 121.5205), w: 0.04 },
      { id: 'sh_six', n: '第六人民医院', t: 'hosp', at: llW(31.18040, 121.41788), w: 0.04 },
      { id: 'sh_dongfang', n: '东方医院', t: 'hosp', at: llW(31.23954, 121.50792), w: 0.03 },
      { id: 'sh_njd', n: '南京东路', t: 'shop', at: ll(31.2365, 121.4790), w: [[1990, 0.08], [2010, 0.06]] },
      { id: 'sh_njx', n: '南京西路', t: 'shop', at: ll(31.2290, 121.4560), w: [[1990, 0.03], [2000, 0.05]] },
      { id: 'sh_hh', n: '淮海中路', t: 'shop', at: ll(31.2185, 121.4630), w: 0.05 },
      { id: 'sh_xjh', n: '徐家汇商圈', t: 'shop', at: ll(31.1950, 121.4365), w: [[1990, 0.02], [2000, 0.05]] },
      { id: 'sh_yuyuan', n: '豫园商城', t: 'shop', at: ll(31.2275, 121.4920), p: { sh: 0.5, lz: 0.5 }, w: 0.03 },
      { id: 'sh_scb', n: '四川北路', t: 'shop', at: ll(31.2620, 121.4830), w: 0.025 },
      { id: 'sh_zsgy', n: '中山公园商圈', t: 'shop', at: ll(31.2210, 121.4170), y0: 1999, w: 0.025 },
      { id: 'sh_wjc', n: '五角场', t: 'shop', at: ll(31.3000, 121.5145), w: [[1990, 0.008], [2006, 0.035]] },
      { id: 'sh_zd', n: '陆家嘴商圈', t: 'shop', at: ll(31.2365, 121.5020), y0: 2002, w: 0.03 },
      { id: 'sh_xtd', n: '新天地', t: 'shop', at: ll(31.2190, 121.4750), y0: 2001, p: { sh: 0.5, lz: 0.5 }, w: 0.02 },
      { id: 'sh_bund', n: '外滩金融区', t: 'cbd', at: ll(31.2385, 121.4870), w: 0.02 },
      { id: 'sh_ljz', n: '陆家嘴金融贸易区', t: 'cbd', at: ll(31.2380, 121.5050), y0: 1993, w: [[1993, 0.003], [2000, 0.02], [2010, 0.045], [2020, 0.055]] },
      { id: 'sh_njxc', n: '南京西路商务区', t: 'cbd', at: ll(31.2295, 121.4560), w: [[1990, 0.005], [2000, 0.02]] },
      { id: 'sh_gubei', n: '虹桥开发区（古北）', t: 'cbd', at: ll(31.2050, 121.3990), w: 0.01 },
      { id: 'sh_chj', n: '漕河泾开发区', t: 'cbd', at: ll(31.1700, 121.4000), w: 0.012 },
      { id: 'sh_zj', n: '张江高科技园区', t: 'cbd', at: llW(31.2076, 121.5840), fixedSite: true, y0: 1992,
        w: [[1992, 0.002], [2010, 0.025]], note: '浦东新区郭守敬路一带，位于张江科学城北部的早期研发园区。' },
      { id: 'sh_hqcbd', n: '虹桥商务区', t: 'cbd', at: llW(31.19319, 121.31114), y0: 2010, w: [[2010, 0.003], [2020, 0.02]] },
      { id: 'sh_bundv', n: '外滩', t: 'scenic', lm: 'sh_bund', w: 0.06 },
      { id: 'sh_pearl', n: '东方明珠', t: 'scenic', lm: 'sh_pearl', w: 0.03 },
      { id: 'sh_yy', n: '豫园', t: 'scenic', lm: 'sh_yuyuan', w: 0.03 },
      { id: 'sh_museum', n: '人民广场与上海博物馆', t: 'scenic', lm: 'sh_museum', w: 0.02 },
      { id: 'sh_jingan', n: '静安寺', t: 'scenic', lm: 'sh_jingan', w: 0.01 },
      { id: 'sh_jade', n: '玉佛寺', t: 'scenic', lm: 'sh_jade', w: 0.01 },
      { id: 'sh_longhua', n: '龙华寺', t: 'scenic', lm: 'sh_longhua', w: 0.008 },
      { id: 'sh_tzf', n: '田子坊', t: 'scenic', at: ll(31.2090, 121.4680), y0: 2006, w: 0.008 },
      { id: 'sh_zoo', n: '上海动物园', t: 'scenic', at: ll(31.1920, 121.3600), w: 0.012 },
      { id: 'sh_cnpav', n: '中国馆（中华艺术宫）', t: 'scenic', lm: 'sh_cnpav', y0: [2010, 11], w: 0.008 },
      { id: 'sh_rmgy', n: '人民公园', t: 'park', at: ll(31.2320, 121.4725), w: 0.012 },
      { id: 'sh_zsp', n: '中山公园', t: 'park', at: llW(31.22332, 121.41562), w: 0.01 },
      { id: 'sh_century', n: '世纪公园', t: 'park', at: llW(31.21880, 121.54863), y0: 2000, w: 0.012 },
      { id: 'sh_luxun', n: '鲁迅公园', t: 'park', at: ll(31.2710, 121.4815), w: 0.01 },
      { id: 'sh_gq', n: '共青森林公园', t: 'park', at: llW(31.32082, 121.54799), w: 0.008 },
      { id: 'sh_cf', n: '长风公园', t: 'park', at: ll(31.2280, 121.3920), w: 0.008 },
      { id: 'sh_stadium', n: '上海体育场', t: 'stadium', lm: 'sh_stadium', w: 0.015 },
      { id: 'sh_gym', n: '上海体育馆', t: 'stadium', at: llW(31.18328, 121.43371), w: 0.008 },
      { id: 'sh_hongkou', n: '虹口足球场', t: 'stadium', lm: 'sh_hongkou', w: 0.01 },
      { id: 'sh_yuanshen', n: '源深体育中心', t: 'stadium', at: ll(31.2290, 121.5260), w: 0.005 },
      { id: 'sh_expo2010', n: '2010 年上海世博会', t: 'venue', at: ll(31.1860, 121.4900), r: 2.4, y0: [2010, 5], y1: [2010, 11], w: 0.12, note: '2010 年 5 月 1 日至 10 月 31 日，参观人次约 7300 万。' },
      { id: 'sh_expoctr', n: '上海展览中心', t: 'venue', lm: 'sh_expoctr', w: 0.008 },
      { id: 'sh_sniec', n: '上海新国际博览中心', t: 'venue', lm: 'sh_sniec', w: 0.02 },
      { id: 'sh_icc', n: '上海国际会议中心', t: 'venue', at: llW(31.24145, 121.49245), y0: 1999, w: 0.005 },
      { id: 'sh_gt', n: '上海大剧院', t: 'venue', lm: 'sh_gt', w: 0.006 },
      { id: 'sh_mbcc', n: '世博文化中心', t: 'venue', at: ll(31.1890, 121.4970), y0: [2010, 5], w: 0.008 },
      // 五个新城：用实际商场或街区代表商圈，标注到已营业的地块。
      site('jiading_baolong', '嘉定新城·宝龙广场', 'shop', 31.34768, 121.25612, 2016, 0.020, '嘉定区阿克苏路1099号。'),
      site('songjiang_inc', '松江新城·松江印象城', 'shop', 31.06342, 121.21834, [2021, 11], 0.023, '广富林路与人民北路交叉口东北侧，是松江新城广富林商业轴的一部分。'),
      site('songjiang_wanda', '松江新城·松江万达广场', 'shop', 31.05996, 121.23885, 2014, 0.018, '松江区广富林路658号，广富林商业轴东段。'),
      site('qingpu_wuyue', '青浦新城·吾悦广场', 'shop', 31.14536, 121.09004, 2017, 0.015, '青浦区盈浦街道淀山湖大道152弄。'),
      site('qingpu_wanda', '青浦新城·青浦万达茂', 'shop', 31.13551, 121.07827, [2019, 6], 0.019, '青浦区淀山湖大道851号。'),
      site('nanqiao_bailian', '奉贤新城·百联南桥', 'shop', 30.91685, 121.48068, 2008, 0.019, '奉贤区南奉公路8500号，南桥商圈。'),
      site('lingang_gangcheng', '南汇新城·港城新天地', 'shop', 30.89803, 121.90200, 2019, 0.014, '临港新片区茉莉路225弄，滴水湖西南侧。'),
      // 近郊、远郊商圈与会展。
      site('hongqiao_hub_shop', '虹桥天地', 'shop', 31.19464, 121.31102, 2015, 0.019, '闵行区申长路688号，虹桥火车站西侧。'),
      site('necc', '国家会展中心（上海）', 'venue', 31.19172, 121.29751, 2015, 0.024, '青浦区徐泾镇盈港东路168号，进博会举办地。', { r: 2.5 }),
      site('zhaoxiang_outlets', '赵巷·百联奥特莱斯', 'shop', 31.15830, 121.22483, 2006, [[2006, 0.014], [2026.67, 0.022]], '青浦区沪青平公路2888号；2026 年二期扩大商业规模。'),
      site('jiangqiao_wanda', '江桥万达广场', 'shop', 31.24177, 121.31906, 2011, 0.015, '嘉定区金沙江西路1051弄。'),
      site('xinzhuang_zhongsheng', '莘庄·仲盛世界商城', 'shop', 31.10919, 121.38216, 2009, 0.02, '闵行区都市路5001号，莘庄站南侧。'),
      site('qibao_center', '七宝商业副中心·七宝领展广场', 'shop', 31.15648, 121.34593, [2016, 9], 0.027, '闵行区漕宝路3366号；原七宝万科广场，2024 年更名。'),
      site('qibao_oldtown', '七宝古镇', 'scenic', 31.15364, 121.35014, 2000, 0.010, '闵行区七宝镇南大街、北大街与蒲汇塘沿岸。'),
      site('nanxiang_inc', '南翔印象城MEGA', 'shop', 31.30685, 121.30144, [2020, 8], 0.022, '嘉定区陈翔公路2299号。'),
      site('baoshan_wanda', '庙行·宝山万达广场', 'shop', 31.32574, 121.44253, 2011, 0.019, '宝山区一二八纪念路968号。'),
      site('wusong_seaworld', '吴淞口·上海海上世界', 'shop', 31.40716, 121.49769, [2024, 9], 0.015, '宝山吴淞口国际邮轮港，邮轮主题滨江商业区。'),
      site('jinshan_wanda', '金山万达广场', 'shop', 30.75638, 121.33057, 2015, 0.015, '金山区山阳镇龙皓路1088号。'),
      site('jinqiao_shop', '金桥国际商业广场', 'shop', 31.25812, 121.57523, 2009, 0.018, '浦东新区张杨路3611号。'),
      site('zhangjiang_chamtime', '张江·长泰广场', 'shop', 31.20828, 121.59789, 2014, 0.020, '浦东新区金科路2889号。'),
      site('zhoupu_wanda', '周浦万达广场', 'shop', 31.11676, 121.56530, 2009, 0.017, '浦东新区沪南公路3449弄。'),
      site('chuansha_bailian', '百联川沙购物中心', 'shop', 31.18722, 121.69347, 2020, 0.014, '浦东新区翔川路638号。'),
      site('chongming_wanda', '城桥·崇明万达广场', 'shop', 31.6291, 121.4094, 2020, 0.014, '崇明区城桥镇崇明大道8388号。'),
      site('huaqiao_sce', '花桥·中骏世界城', 'shop', 31.301946, 121.100839, [2024, 10], 0.019, '江苏昆山市花桥镇沿沪大道西侧、花桥站北侧；按实际商场地块定位。', { src: 'https://www.ks.gov.cn/kss/qzkx/202507/9a9856f869014de1846f7a000086c9e3.shtml' }),
      site('huaqiao_innovation', '花桥国际创新港', 'cbd', 31.287537, 121.048526, 2020, 0.012, '江苏昆山市花桥镇绿地大道西段的国际创新港实际园区；2020 年起随花桥片区在游戏内开放。'),
      site('huaqiao_greenland_hospital', '花桥·东方绿地医院', 'hosp', 31.293443, 121.094211, 2020, 0.009, '江苏昆山市花桥镇绿地大道，按医院地块定位；2020 年起随花桥片区在游戏内开放。'),
      // 每个校区是独立目的地；旧组团 id 保留给一所学校以兼容旧设施任务。
      site('songjiang_uni', '东华大学（松江校区）', 'uni', 31.05833, 121.20759, 2001, 0.010, '松江区人民北路2999号，定位于校园教学区，避开镜月湖。', { r: 1.7 }),
      site('sisu_songjiang', '上海外国语大学（松江校区）', 'uni', 31.04911, 121.22050, 2001, 0.008, '松江区文翔路1550号。', { r: 1.5 }),
      site('suibe_songjiang', '上海对外经贸大学（松江校区）', 'uni', 31.04751, 121.21292, 2001, 0.008, '松江区文翔路1900号。'),
      site('sues_songjiang', '上海工程技术大学（松江校区）', 'uni', 31.05726, 121.20087, 2004, 0.010, '松江区龙腾路333号，2004 年首批学生入驻。', { r: 1.6 }),
      site('ecupl_songjiang', '华东政法大学（松江校区）', 'uni', 31.05761, 121.19218, 2003, 0.009, '松江区龙源路555号。', { r: 1.6 }),
      site('lixin_songjiang', '上海立信会计金融学院（松江校区）', 'uni', 31.04979, 121.19368, 2003, 0.005, '松江区文翔路2800号。'),
      site('siva_songjiang', '上海视觉艺术学院', 'uni', 31.04852, 121.20150, 2005, 0.004, '松江区文翔路2200号。'),
      site('zhangjiang_uni', '上海中医药大学（张江校区）', 'uni', 31.19633, 121.59152, 2003, 0.018, '浦东新区蔡伦路1200号。', { r: 1.4 }),
      site('fudan_zhangjiang', '复旦大学（张江校区）', 'uni', 31.19121, 121.59395, 2003, 0.014, '浦东新区张衡路825号。', { r: 1.3 }),
      site('shanghaitech', '上海科技大学（张江校区）', 'uni', 31.17943, 121.59023, 2016, 0.014, '浦东新区华夏中路393号。'),
      site('minhang_uni', '上海交大（闵行校区）', 'uni', 31.02756, 121.43231, 1987, [[1990, 0.023], [2006, 0.029]], '闵行区东川路800号。', { r: 2 }),
      site('ecnu_minhang', '华东师范大学（闵行校区）', 'uni', 31.03213, 121.44737, 2004, [[2004, 0.008], [2006, 0.019]], '闵行区东川路500号，2006 年完成主体搬迁。', { r: 1.8 }),
      site('tongji_jiading', '同济大学（嘉定校区）', 'uni', 31.28652, 121.20932, 2004, 0.018, '嘉定区曹安公路4800号。', { r: 1.8 }),
      site('lingang_uni', '上海海洋大学（临港校区）', 'uni', 30.88475, 121.89311, 2008, 0.013, '浦东新区沪城环路999号。', { r: 1.6 }),
      site('maritime_lingang', '上海海事大学（临港校区）', 'uni', 30.87698, 121.90022, 2008, 0.013, '浦东新区海港大道1550号。', { r: 1.7 }),
      site('dianji_lingang', '上海电机学院（临港校区）', 'uni', 30.89053, 121.88071, 2011, 0.008, '浦东新区水华路300号。'),
      site('jianqiao_lingang', '上海建桥学院（临港校区）', 'uni', 30.89319, 121.88848, 2015, 0.009, '浦东新区沪城环路1111号。'),
      site('haiwan_uni', '上海师范大学（奉贤校区）', 'uni', 30.83974, 121.51285, 1987, 0.013, '奉贤区海思路100号。', { r: 1.6 }),
      site('sit_fengxian', '上海应用技术大学（奉贤校区）', 'uni', 30.84455, 121.50612, 2010, 0.009, '奉贤区海泉路100号。', { r: 1.5 }),
      site('ecust_fengxian', '华东理工大学（奉贤校区）', 'uni', 30.83319, 121.49966, [2007, 9], 0.014, '奉贤区海思路999号。', { r: 1.8 }),
      site('silicon_lake', '硅湖职业技术学院（花桥）', 'uni', 31.288111, 121.135214, 1998, 0.008, '江苏昆山市花桥镇曹安开发区1号，按实际校园地块定位。', { r: 1.5, src: 'https://www.usl.edu.cn/index.php?PageSpeed=noscript&c=show&id=1172' }),
      // 科创园区与公共服务。
      site('zizhu', '紫竹科学园区', 'cbd', 31.02450, 121.44778, 2002, [[2015, 0.012], [2025, 0.022]], '闵行区吴泾镇东川路555号，紫竹国家高新技术产业开发区。'),
      site('g60', '松江·G60科创云廊', 'cbd', 31.09148, 121.32104, 2021, 0.014, '松江区莘砖公路239号，长三角G60科创走廊的松江园区。'),
      site('caohejing_oasis', '漕河泾科技绿洲（浦西园区）', 'cbd', 31.16763, 121.38410, 2009, 0.014, '漕河泾开发区田林路1016号一带。'),
      site('ruijin_north', '瑞金医院嘉定院区', 'hosp', 31.33741, 121.25453, 2012, 0.025, '嘉定区希望路999号，原瑞金医院北院。'),
      site('first_songjiang', '上海市第一人民医院（松江院区）', 'hosp', 31.04283, 121.22176, 2006, 0.026, '松江区新松江路650号。'),
      site('fengxian_hosp', '奉贤区中心医院', 'hosp', 30.92377, 121.50243, 2012, 0.021, '奉贤区南奉公路6600号。'),
      // 有明确入口或实际范围的旅游目的地。
      site('sheshan', '佘山国家森林公园', 'scenic', 31.09628, 121.18449, 1993, 0.014, '松江区佘山镇；定位于外青松公路附近的西佘山主片区。', { r: 2 }),
      site('happy_valley', '上海欢乐谷', 'scenic', 31.09854, 121.20988, 2009, 0.021, '松江区佘山旅游度假区林湖路888号。', { r: 2.4, we: 1.75 }),
      site('chenshan', '上海辰山植物园', 'park', 31.07182, 121.17480, 2010, 0.015, '松江区辰花公路3888号，定位于园区南门。', { we: 1.55 }),
      site('zhujiajiao', '朱家角古镇', 'scenic', 31.11610, 121.04601, 2000, 0.018, '青浦区课植园路555号游客中心，服务淀浦河两岸古镇。', { r: 1.4 }),
      site('guyiyuan', '南翔古猗园', 'park', 31.29383, 121.31186, 1959, 0.008, '嘉定区南翔镇沪宜公路218号。'),
      site('gucun', '顾村公园', 'park', 31.34292, 121.37051, 2010, 0.015, '宝山区沪太路4788号一带，樱花季主要游览地。', { r: 2 }),
      site('wildlife', '上海野生动物园', 'scenic', 31.05738, 121.71664, 1995, 0.024, '浦东新区南六公路178号。', { r: 2.4, we: 1.6 }),
      site('haichang', '上海海昌海洋公园', 'scenic', 30.91578, 121.90047, 2018, 0.020, '临港新片区银飞路166号，滴水湖旅游度假区。', { we: 1.7 }),
      site('haiwan_park', '上海海湾国家森林公园', 'park', 30.86371, 121.68621, 2010, 0.013, '奉贤区随塘河路1677号。', { r: 2.8 }),
      site('fengjing', '枫泾古镇', 'scenic', 30.88954, 121.01312, 2004, 0.011, '金山区枫泾镇亭枫公路8588弄附近。'),
      site('legoland', '上海乐高乐园度假区', 'scenic', 30.88636, 121.09387, [2025, 7], 0.011, '金山区枫泾镇，乐缤路与申高路一带。2025 年 7 月 5 日开园。', { r: 1.6, we: 1.8 }),
      site('jinshan_beach', '金山城市沙滩', 'scenic', 30.71090, 121.34560, 2006, 0.014, '金山区沪杭公路7555号，杭州湾北岸。', { we: 1.7 }),
      site('dongping_park', '东平国家森林公园', 'park', 31.68044, 121.47683, 1993, 0.012, '崇明区北沿公路2188号。', { r: 2.8 }),
      site('changxing_park', '长兴岛郊野公园', 'park', 31.40657, 121.70447, 2016, 0.008, '崇明区长兴岛秋柑路199号。', { r: 2 }),
      site('yuanxiang', '远香湖公园', 'park', 31.3518, 121.2601, 2010, 0.008, '嘉定新城白银路一带，定位于远香湖西侧陆地。'),
      site('auto_museum', '上海汽车博物馆', 'scenic', 31.28053, 121.16578, 2007, 0.008, '嘉定区安亭镇博园路7565号。'),
      site('tianfu_wetland', '天福国家湿地公园（天福庵片区）', 'park', 31.328163, 121.104446, 2020, 0.008, '昆山花桥镇北部湿地公园南侧的天福庵片区，按实际地名定位游览接驳点；2020 年起随花桥片区在游戏内开放。', { r: 2, src: 'https://water.suzhou.gov.cn/slj/kss/202512/b5f928e1fc2b495784f391b5106980c5.shtml' }),
    ],
    districtLabels: [['黄浦', ['黄浦区']], ['静安', ['静安区']], ['徐汇', ['徐汇区']], ['长宁', ['长宁区']], ['普陀', ['普陀区']], ['虹口', ['虹口区']], ['杨浦', ['杨浦区']], ['浦东', ['浦东新区']], ['宝山', ['宝山区']], ['闵行', ['闵行区']], ['嘉定', ['嘉定区']]],
    // 纪事（只能在末尾追加：已发生记录按序号保存）
    events: [
      { y: 1990, m: 1, tag: '史实', title: '1990 年的上海', desc: '市区人口约 740 万，城市集中在黄浦江西岸；浦东大多是农田、工厂与码头，黄浦江上没有一座大桥；没有地铁，公交车厢严重超载。' },
      { y: 1990, m: 4, tag: '史实', title: '浦东开发开放', desc: '中央宣布开发开放浦东，陆家嘴、金桥、外高桥与张江陆续设立开发区。', fx: { grow: { region: ['pdriver', 'lujiazui'], jobs: 1.4, years: 6 } } },
      { y: 1991, m: 12, tag: '史实', title: '南浦大桥通车', desc: '黄浦江上的第一座大桥，浦西与浦东之间不再只靠隧道与轮渡。' },
      { y: 1993, m: 5, tag: '史实', title: '史实背景：地铁 1 号线南段试运营', desc: '锦江乐园至徐家汇段试运营，1995 年全线通车。本局的地铁由你规划，真实线路不会自动出现。' },
      { y: 1993, m: 10, tag: '史实', title: '杨浦大桥通车', desc: '当时世界跨度最大的斜拉桥，连接杨浦与浦东。' },
      { y: 1994, m: 10, tag: '史实', title: '东方明珠落成', desc: '高 468 m 的广播电视塔成为浦东开发的标志。' },
      { y: 1994, m: 12, tag: '史实', title: '内环高架路贯通', desc: '城市快速路开始成网，1995 年南北高架通车。' },
      { y: 1996, m: 10, tag: '史实', title: '上海博物馆新馆开放', desc: '人民广场改造为市民广场，周边陆续建成大剧院与城市规划展示馆。' },
      { y: 1997, m: 10, tag: '史实', title: '上海体育场启用', desc: '为第八届全国运动会建成的 8 万座体育场。' },
      { y: 1999, m: 8, tag: '史实', title: '金茂大厦落成', desc: '高 420.5 m，当时中国最高的建筑。' },
      { y: 1999, m: 9, tag: '史实', title: '浦东国际机场启用', desc: '国际航线逐步从虹桥机场迁出。游戏先通过川沙接驳，机场片区于 2015 年开放。' },
      { y: 2002, m: 12, tag: '史实', title: '获得 2010 年世博会主办权', desc: '黄浦江两岸的工厂与码头开始动迁，规划建设世博园区。' },
      { y: 2003, m: 6, tag: '史实', title: '卢浦大桥通车', desc: '连接卢湾与浦东的钢拱桥。' },
      { y: 2006, m: 7, tag: '史实', title: '上海南站启用', desc: '圆形屋顶的新站房成为城市南部的交通枢纽。' },
      { y: 2008, m: 8, tag: '史实', title: '上海环球金融中心落成', desc: '高 492 m，顶部的梯形开口成为陆家嘴天际线的标志。' },
      { y: 2010, m: 3, tag: '史实', title: '虹桥综合交通枢纽启用', desc: '机场、高铁、地铁与长途客运集于一处，城市西部出现新的交通中心。', fx: { grow: { region: 'hqcbd', jobs: 1.5, years: 6 } } },
      { y: 2010, m: 5, tag: '史实', title: '2010 年上海世博会开幕', desc: '184 天里参观人次约 7300 万，园区横跨黄浦江两岸。', fx: { demand: { hub: 1.1, months: 6 }, sat: { v: 2, months: 6 } } },
      { y: 2015, m: 12, tag: '史实', title: '上海中心大厦落成', desc: '高 632 m，中国最高的建筑。' },
      { y: 2016, m: 6, tag: '史实', title: '上海迪士尼乐园开园', desc: '浦东川沙的主题乐园与度假区开园，带来大量周末与假日的休闲出行；地铁 11 号线迪士尼站同年 4 月启用。' },
      { y: 2018, m: 11, tag: '史实', title: '首届中国国际进口博览会', desc: '在虹桥的国家会展中心（上海）举行。', fx: { demand: { hub: 1.1, months: 1 } } },
      { y: 2020, m: 1, tag: '史实', title: '新冠肺炎疫情', desc: '春节后城市活动大幅减少，客流骤降，之后逐步恢复。', fx: { demand: { sc: 0.7, sh: 0.75, lz: 0.6, hub: 0.5, months: 3, fade: 1 } } },
      { y: 2021, m: 3, tag: '史实', title: '上海推进五个新城建设', desc: '嘉定、青浦、松江、奉贤、南汇加快建设，游戏提高这些片区的人口和岗位增长权重。' },
    ],
    laterEvents: [
      { y: 2022, m: 4, tag: '史实', title: '春季疫情冲击上海出行', desc: '通勤、购物和文旅客流短暂下降。',
        fx: { demand: { hw: 0.5, sc: 0.28, sh: 0.46, lz: 0.24, hub: 0.4, months: 2, fade: 0 } } },
      { y: 2022, m: 6, tag: '史实', title: '上海恢复正常生产生活秩序', desc: '6 月 1 日起地铁全网络恢复基本运行，出行需求随复工复产逐步回升。',
        fx: { demand: { hw: 0.85, sh: 0.8, lz: 0.75, hub: 0.85, months: 5, fade: 1 } } },
      { y: 2023, m: 1, tag: '史实', title: '铁路、机场和市内客流回升', desc: '跨城客运加速恢复，商业与文旅重新带来接驳需求。',
        fx: { demand: { sh: 1.1, lz: 1.18, months: 12, fade: 1 } } },
      { y: 2024, m: 12, tag: '史实', title: '沪苏湖高铁与机场联络线开通', desc: '上海松江站投入使用，虹桥与浦东机场进入市域铁路直连时代。两场与松江站接驳需求上升。' },
      { y: 2025, m: 11, tag: '史实', title: '2 号线西延伸至蟠祥路', desc: '虹桥枢纽西侧新增轨道服务。游戏内可接任务改善青浦东部与虹桥的联系。' },
      { y: 2025, m: 12, tag: '史实', title: '18 号线二期开始运营', desc: '宝山南部增加东西向轨道交通走廊，游戏内开放相应的接驳任务。' },
      { y: 2026, m: 4, tag: '史实', title: '崇明线全线轨道贯通', desc: '轨道经长兴岛跨越两段长江航道，连接浦东与崇明岛。' },
      { y: 2026, m: 9, tag: '史实', title: '崇明线启动列车调试', desc: '游戏开放浦东—长兴岛—崇明岛连接任务。' },
      { y: 2027, m: 1, tag: '模拟', title: '进入「喜迎奥运」阶段', desc: '进入模拟未来。吴泾滨江工业更新与体育设施选址开始筹备。' },
      { y: 2027, m: 7, tag: '模拟', title: '上海东站与上海宝山站投运', desc: '按已公布的投运计划设置。两座新枢纽产生铁路旅客接驳需求。' },
      { y: 2033, m: 1, tag: '模拟', title: '吴泾滨江启动奥运场馆建设', desc: '整治老工业用地，建设主体育场、游泳馆、室内体育馆和奥运村。',
        fx: { grow: { region: ['wujing', 'wujing_village'], jobs: 1.45, years: 8 } } },
      { y: 2037, m: 1, tag: '模拟', title: '吴泾奥林匹克体育场启用', desc: '主体育场开始承办活动，游泳馆与室内体育馆次年启用。' },
      { y: 2039, m: 7, tag: '模拟', title: '奥运村启用，吴泾举办测试赛', desc: '训练、赛事和观众交通集中到吴泾。检查场馆步行接驳和轨道运力。',
        fx: { demand: { lz: 1.13, hub: 1.08, months: 2 } } },
      { y: 2040, m: 8, tag: '模拟', title: '2040 上海夏季奥运会开幕', desc: '开幕式在吴泾奥林匹克体育场举行。赛事带来场馆周边以及机场、铁路枢纽的客流高峰。',
        fx: { demand: { lz: 1.3, hub: 1.2, months: 1 }, sat: { v: 2, months: 3 } } },
      { y: 2041, m: 1, tag: '模拟', title: '奥运村转为居住社区', desc: '吴泾奥运村改作居住与社区服务用地，场馆继续开放。',
        fx: { grow: { region: 'wujing_village', pop: 2, years: 4 } } },
      { y: 2035, m: 1, tag: '模拟', title: '崇明国际机场启用', desc: '游戏设定：崇明岛中东部新增国际机场，市内接驳客流达到与虹桥机场相同的规模。' },
      // 只在末尾追加，保留旧存档按序号记录的已发生事件。
      { y: 2025, m: 1, tag: '模拟', title: '开发崇明：生态岛交通建设',
        desc: '参考崇明生态岛规划，游戏从 2025 年起推进城镇联通与生态文旅接驳。未来十年提高崇明岛和长兴岛的人口、岗位增长权重，发布城桥—陈家镇联通及东平森林公园接驳任务。',
        fx: { grow: { region: ['chongming', 'changxing'], pop: 1.25, jobs: 1.35, years: 10, fade: 2 } } },
      { y: 2025, m: 1, tag: '模拟', title: '花桥联动开发与长三角铁路接口预留',
        desc: '花桥沿用崇明的 2020 年开放规则；2025 年起提高花桥片区的增长权重，并发布沪苏通勤、科教商务接驳任务。沪苏浙边界按规划走廊预留铁路接口，未建成线路的启用年与客流均为游戏情景。',
        fx: { grow: { region: 'huaqiao', pop: 1.25, jobs: 1.35, years: 10, fade: 2 } } },
      { y: 2022, m: 1, tag: '史实', title: '浦东机场四期扩建开工', desc: '在现有 T1、T2 和卫星厅南侧建设 T3 航站区。游戏显示实际建筑规划轮廓的施工场地，按阶段加入配套道路。' },
      { y: 2026, m: 7, tag: '史实', title: '浦东机场南侧交通改线与配套道路启用', desc: '南进出场路地道东线及云亮路、云亭东路、通航二路、凯宇路等配套道路投入使用，服务机场四期建设和南侧交通组织。' },
      { y: 2028, m: 12, tag: '模拟', title: '浦东机场 T3 航站楼启用', desc: '依据四期工程预计 2028 年底具备投运条件的公开计划，在游戏中启用南侧 T3 航站楼及配套道路。机场客流在 T1/T2 与 T3 之间分配，启用日期及分配比例为规划情景。' },
    ],
    // 本地历史主题任务：参考上海的发展需求，不要求复刻真实线路走向（奖励单位：万元，1990 年价格）
    histTasks: [
      { id: 'sh1', appear: [1990, 3], deadline: [1995, 12], type: 'connect', reward: 250000, title: '南北主轴', desc: '连接上海站、人民广场、徐家汇与锦江乐园，为最拥挤的南北走廊建设第一条地铁。', anchors: [anchor('上海站', 31.2495, 121.4560, 3), anchor('人民广场', 31.2330, 121.4750, 3), anchor('徐家汇', 31.1940, 121.4370, 3), anchor('锦江乐园', 31.1420, 121.4140, 3)] },
      { id: 'sh2', appear: [1993, 1], deadline: [2000, 12], type: 'connect', reward: 300000, title: '越过黄浦江：东西主轴', desc: '连接中山公园、静安寺、人民广场、陆家嘴与龙阳路。过黄浦江需要建设越江隧道。', anchors: [anchor('中山公园', 31.2190, 121.4180, 3), anchor('静安寺', 31.2230, 121.4460, 3), anchor('人民广场', 31.2330, 121.4750, 3), anchor('陆家嘴', 31.2380, 121.5020, 3), anchor('龙阳路', 31.2030, 121.5570, 3)] },
      { id: 'sh3', appear: [1995, 1], deadline: [2001, 12], type: 'connect', reward: 250000, title: '西部高架环线', desc: '沿铁路线建设一条高架线路，连接漕溪路、宜山路、中山公园、上海站与江湾镇。', anchors: [anchor('漕溪路', 31.1730, 121.4330, 3), anchor('宜山路', 31.1860, 121.4230, 3), anchor('中山公园', 31.2190, 121.4180, 3), anchor('上海站', 31.2495, 121.4560, 3), anchor('江湾镇', 31.2930, 121.4800, 3)] },
      { id: 'sh4', appear: [2000, 1], deadline: [2007, 12], type: 'coverage', target: 0.3, reward: 300000, title: '地铁覆盖三成人口', desc: '2007 年底前，步行 15 分钟可到达地铁站的人口不低于全市人口的 30%。' },
      { id: 'sh5', appear: [2003, 1], deadline: [2010, 4], type: 'connect', reward: 300000, title: '世博会', desc: '世博会开幕前，连接世博园区、陆家嘴与人民广场。', anchors: [anchor('世博园', 31.1865, 121.4925, 3), anchor('陆家嘴', 31.2380, 121.5020, 3), anchor('人民广场', 31.2330, 121.4750, 3)] },
      { id: 'sh6', appear: [2005, 1], deadline: [2010, 12], type: 'connect', reward: 250000, title: '五角场与江湾', desc: '连接五角场、同济大学、四川北路与人民广场。', anchors: [anchor('五角场', 31.3000, 121.5145, 3), anchor('同济大学', 31.2830, 121.5025, 3), anchor('四川北路', 31.2610, 121.4840, 3), anchor('人民广场', 31.2330, 121.4750, 3)] },
      { id: 'sh7', appear: [2007, 1], deadline: [2010, 3], type: 'connect', reward: 250000, title: '虹桥综合交通枢纽', desc: '枢纽启用前，连接虹桥站、中山公园与人民广场。', anchors: [anchor('虹桥站', 31.1945, 121.3215, 3), anchor('中山公园', 31.2190, 121.4180, 3), anchor('人民广场', 31.2330, 121.4750, 3)] },
      { id: 'sh8', appear: [2010, 1], deadline: [2016, 12], type: 'coverage', target: 0.6, reward: 300000, title: '地铁覆盖六成人口', desc: '2016 年底前，步行 15 分钟可到达地铁站的人口不低于全市人口的 60%。' },
      { id: 'sh9', appear: [2012, 1], deadline: [2020, 12], type: 'connect', reward: 200000, title: '浦东腹地', desc: '不经陆家嘴，连接金桥、张江与世纪公园。', anchors: [anchor('金桥', 31.2620, 121.5850, 3), anchor('张江', 31.2030, 121.5900, 3), anchor('世纪公园', 31.2170, 121.5485, 3)] },
      { id: 'sh10', appear: [2013, 1], deadline: [2016, 12], type: 'connect', reward: 200000, title: '迪士尼接驳', desc: '乐园开园前，连接上海迪士尼乐园、秀沿路与龙阳路，让游客从市区直达度假区。', anchors: [anchorW('上海迪士尼乐园', 31.1434, 121.6637, 3), anchorW('秀沿路', 31.1403, 121.5942, 3), anchor('龙阳路', 31.2030, 121.5570, 3)] },
      { id: 'sh11', appear: [2025, 11], deadline: [2029, 12], type: 'connect', reward: 90000, title: '虹桥西侧接驳', desc: '把青浦东部的蟠祥路与国家会展中心、虹桥站接入同一个线网。',
        anchors: [anchorW('蟠祥路', 31.1915, 121.2700, 3), anchorW('国家会展中心', 31.1916, 121.2935, 3), anchorW('虹桥站', 31.1960, 121.3162, 4)] },
      { id: 'sh12', appear: [2025, 12], deadline: [2030, 12], type: 'connect', reward: 90000, title: '宝山南部东西走廊', desc: '连接长江南路、爱辉路和呼兰路。',
        anchors: [anchorW('长江南路', 31.3322, 121.4892, 3), anchorW('爱辉路', 31.3426, 121.4476, 3), anchorW('呼兰路', 31.3415, 121.4313, 3)] },
      { id: 'sh13', appear: [2026, 9], deadline: [2034, 12], type: 'connect', reward: 220000, title: '跨江连接崇明', desc: '连接浦东金吉路、长兴岛与崇明陈家镇。',
        anchors: [anchorW('金吉路', 31.2667, 121.6247, 4), anchorW('长兴岛', 31.3931, 121.7179, 5), anchorW('陈家镇', 31.4927, 121.7882, 5)] },
      { id: 'sh14', appear: [2030, 9], deadline: [2040, 7], type: 'connect', reward: 320000, title: '吴泾奥运轨道接驳', desc: '奥运会开幕前，把吴泾三个比赛场馆和莘庄、上海南站接入同一个运营线网。',
        anchors: [anchorW('吴泾奥林匹克体育场', ...wujing.stadium, 2), anchorW('吴泾奥林匹克游泳馆', ...wujing.aquatics, 2),
          anchorW('吴泾奥林匹克体育馆', ...wujing.arena, 2), anchor('莘庄', 31.1125, 121.3852, 4), anchorW('上海南站', 31.1553, 121.4266, 4)] },
    ],
    dynTasks: [
      { id: 'shd1', from: [1993, 1], to: [2003, 12], type: 'connect', months: 36, reward: 40000, title: '浦东沿江过江通勤', desc: '浦东沿江的居民每天过江上班。连接塘桥、东昌路与外滩。', anchors: [anchor('塘桥', 31.2190, 121.5190, 3), anchor('东昌路', 31.2330, 121.5100, 3), anchor('外滩', 31.2385, 121.4870, 3)] },
      { id: 'shd2', from: [1998, 1], to: [2010, 12], type: 'connect', months: 36, reward: 35000, title: '古北与虹桥开发区', desc: '连接古北、虹桥路与徐家汇。', anchors: [anchor('古北', 31.2010, 121.3980, 3), anchor('虹桥路', 31.1980, 121.4210, 3), anchor('徐家汇', 31.1940, 121.4370, 3)] },
      { id: 'shd3', from: [2005, 1], to: [2018, 12], type: 'connect', months: 36, reward: 40000, title: '宝山大型居住区', desc: '连接大场、上海大学与上海站。', anchors: [anchor('大场', 31.2950, 121.4100, 3), anchor('上海大学', 31.3160, 121.3920, 3), anchor('上海站', 31.2495, 121.4560, 3)] },
    ],
    taskNote: '历史任务参考城市发展和交通规划；2025 年崇明、花桥开发任务，以及未来铁路接口、新枢纽、崇明机场和奥运任务为游戏情景。无须照搬真实线路，只需完成目标。',
    // 城市策略难题（v2.3，可选挑战）
    scenarios: [
      { id: 'sh-sc1', theme: '上海：浦东开发与越江', title: '把浦西接进浦东腹地', type: 'budgetConnect', from: [1993, 1], to: [2004, 12], months: 60, rewardMonths: 3, budgetX: 1.2,
        anchors: [['静安寺', 3], ['陆家嘴', 3], ['龙阳路', 3]],
        desc: '黄浦江把上海分成浦西与浦东，越江隧道造价高；浦东腹地还是一片待开发的土地。用有限预算从浦西中心穿江，直达浦东的龙阳路。',
        tips: ['黄浦江只过一次，选江面较窄处', '浦东未开发的路段可以用地面或高架', '陆家嘴设大站，留好以后的换乘'] },
      { id: 'sh-sc2', theme: '上海：超大客流', title: '为「{line}」减压', type: 'lineCrowd', line: 'busiest', from: [2005, 1], to: [2035, 12], months: 24, rewardMonths: 3, minLF: 1.0, target: 1.0,
        desc: '线网越大，换乘越多，客流越往几条骨干线上挤。不靠新线也能做到：把这条线最拥挤区段的早高峰满载率降到 100% 以下并保持 3 个月。',
        tips: ['升级沿线车站，列车加长到 8 节', '在拥挤区段两端设换乘，引导乘客走平行线', '贯通或拆分线路，减少乘客在拥挤站换乘'] },
    ],
    dataNote: [
      ['真实地理', 'hist', '黄浦江、苏州河与长江口、道路与桥隧、铁路、公园、街道边界与地名来自 OpenStreetMap（© OpenStreetMap 贡献者，ODbL），为现代数据，按 250 m 网格投影。'],
      ['史实参考', 'hist', '浦东开发开放（1990 年）、陆家嘴与各开发区设立年份、越江桥隧与高架道路通车年份、地标落成年份、世博会与虹桥综合交通枢纽。'],
      ['估算', 'est', '1990 年人口与就业分布、人口增长曲线、出行率、时间价值、造价、票价、运营费用与拨款、地图范围 GDP。'],
      ['模拟', 'sim', '近郊与远郊分批开放，昆山花桥镇随崇明于 2020 年开放，2025 年联动开发。规划铁路接口的启用年与客流是游戏情景。2027 年起进入模拟未来，2040 年举办吴泾奥运会，地图人口达到约 3500 万。普通铁路、高速铁路与机场只产生接驳需求；真实地铁不会自动出现。'],
      ['', '', '模拟结果不得作为真实上海交通规划预测。'],
    ],
    // 线路配色参考上海地铁
    lineColorsNice: ['#e3002b', '#8cc220', '#fcd600', '#461d84', '#944d9a', '#d40068', '#ed6f00', '#0094d8', '#87caed', '#c6afd4', '#871c2b', '#007a60', '#e999c0', '#626020', '#bca886', '#98d1c0', '#bc796f', '#c4984f'],
    places: (G.places || []).map(function (p) { return [p[0], p[1], p[2], p[3]]; }),
    stationNames: CM.SH_STATION_NAMES,
    industryFacilities: true,
    flowBlockCells: 32, // 出行方向图继续按较大范围汇总；不降低实际出行分区精度。
  };
  // 产业园区仅汇总范围内已有岗位的通勤，不额外生成“购物型”园区客流。
  for (const item of CM.SH_INDUSTRY) {
    const existing = data.facilities.find(f => f.id === item.id);
    if (existing) {
      const open = existing.y0; Object.assign(existing, item); existing.y0 = open; existing.gameYear = false;
    } else data.facilities.push(item);
  }
  // 第一批是紧邻原图的主城区外围，第二批是其余新城、岛屿和滨海地区。
  const oldRegionIds = data.regions.map(r => r.id).concat('outer');
  const oldLandmarkIds = data.landmarks.slice(0, data.landmarks.findIndex(l => l.id === 'sh_songjiang_station')).map(l => l.id);
  for (const r of data.regions) {
    if (r.district) r.district = r.district.map(n => n + '（原图）');
    if (r.streets) r.streets = r.streets.map(n => n + '（原图）');
  }
  const near = (id, name, scope, plan = 'res') => Object.assign({ id, name, plan, open: 2015, independent: true, note: suburbanNote, tag: '模拟' }, scope);
  const far = (id, name, scope, plan = 'res') => Object.assign(near(id, name, scope, plan), { open: 2020 });
  const towns = (...names) => ({ streets: names.map(name => name + '（扩图）') });
  data.regions.push(
    { id: 'outer', name: '原外围地区', district: ['原图市内补全'], open: 2008, plan: 'res', pop: 13.95e6 },
    near('wujing_village', '吴泾滨江南部', { poly: [[31.0532, 121.4645], [31.0532, 121.4735], [31.0442, 121.4760], [31.0442, 121.4645]].map(p => llW(...p)) }, 'ind'),
    near('wujing', '吴泾', towns('吴泾镇'), 'resind'),
    near('minhang_new', '闵行外围', { district: ['闵行区'] }),
    near('baoshan_new', '宝山外围', { district: ['宝山区'] }, 'resind'),
    near('jiading_new', '嘉定新城·安亭', { district: ['嘉定区'] }, 'resind'),
    near('songjiang_east', '松江东北（九亭·泗泾·新桥）', towns('九亭镇', '九里亭街道', '泗泾镇', '新桥镇')),
    near('qingpu_east', '青浦东部（徐泾·华新·赵巷）', towns('徐泾镇', '华新镇', '赵巷镇')),
    near('pvg', '浦东机场·祝桥', towns('祝桥镇'), 'resind'),
    near('pudong_near', '浦东近郊（周浦·航头·川沙）', towns('周浦镇', '康桥镇', '航头镇', '川沙新镇', '合庆镇', '唐镇', '曹路镇')),
    far('lingang', '南汇新城·临港', towns('南汇新城镇'), 'mix'),
    far('pudong_south', '浦东远郊（惠南·新场·老港）', { district: ['浦东新区'] }),
    far('songjiang', '松江新城及西南部', { district: ['松江区'] }, 'mix'),
    far('qingpu', '青浦新城·淀山湖', { district: ['青浦区'] }, 'mix'),
    far('fengxian', '奉贤（南桥·奉城·海湾）', { district: ['奉贤区'] }, 'mix'),
    far('jinshan', '金山（朱泾·枫泾·金山卫）', { district: ['金山区'] }, 'resind'),
    far('changxing', '长兴岛', towns('长兴镇'), 'resind'),
    far('hengsha', '横沙岛', towns('横沙乡')),
    far('chongming', '崇明岛', { district: ['崇明区'] }),
    far('huaqiao', '昆山花桥（江苏）', { streets: ['花桥镇'] }, 'mix'),
  );
  data.districtLabels = ['黄浦区', '徐汇区', '长宁区', '静安区', '普陀区', '虹口区', '杨浦区', '闵行区',
    '宝山区', '嘉定区', '浦东新区', '金山区', '松江区', '青浦区', '奉贤区', '崇明区'].map(n => [n, [n]]);
  data.districtLabels.push(['昆山花桥（江苏）', ['花桥镇']]);
  data.runways.push(...CM.SH_AIRPORT_LAYOUT.runways.filter(r => r.airport === 'pvg'));
  const hongqiaoRunway = CM.SH_AIRPORT_LAYOUT.runways.find(r => r.ref === '18L/36R');
  data.airport.runway = [hongqiaoRunway.a, hongqiaoRunway.b];
  // T3 takes a share of the same airport total, rather than duplicating it.
  const pvg = data.facilities.find(f => f.id === 'sh_pvg_terminal'), pvgTotal = pvg.pax;
  const t3 = CM.SH_AIRPORT_LAYOUT.terminals.find(t => t.id === 'pvg_t3'), t3Year = t3.from;
  const pvgRunway = CM.SH_AIRPORT_LAYOUT.runways.find(r => r.ref === '17L/35R');
  pvg.rw = [pvgRunway.a, pvgRunway.b];
  pvg.pax = pvgTotal.filter(p => p[0] < t3Year).concat(
    [[t3Year - 1e-6, CM.U.interp(pvgTotal, t3Year)], [t3Year, CM.U.interp(pvgTotal, t3Year) * 0.65]],
    pvgTotal.filter(p => p[0] > t3Year).map(p => [p[0], p[1] * 0.65]));
  pvg.note += ' T3 启用后本设施保留机场总接驳量的 65%，另 35% 分配给 T3，分配比例为模拟估算。';
  data.facilities.push({ id: 'sh_pvg_t3', n: '浦东机场 T3 航站楼', t: 'air', at: [t3.x, t3.y],
    fixedSite: true, regionGate: true, noModel: true, r: 3, y0: [2028, 12],
    pax: pvgTotal.map(p => [p[0], p[1] * 0.35]),
    note: '位于 T1、T2 和 S1/S2 卫星厅南侧，按实际建设轮廓定位。依据预计 2028 年底具备投运条件的计划，在游戏中于 2028 年 12 月启用；承担机场总接驳量的 35%（模拟），不与 T1/T2 重复统计。',
    src: { pos: '位置：实际建设地块', year: '启用：规划情景', sim: true, url: 'https://www.shanghai.gov.cn/nw4411/20261015/854b367701174a589bab06b21ebd529e.html' } });
  for (const terminal of CM.SH_AIRPORT_LAYOUT.terminals) data.places.push([terminal.name, terminal.x, terminal.y, 2]);
  // 接口是规划走廊与模拟建设边界的接驳点，不冒充真实客运站。
  // 已有沪苏双 11 号线按通车年份，其余日期和到发量明确作为未来情景。
  data.facilities.push(
    railInterface('huaqiao_suzhou_portal', '花桥西界·苏州轨交11号线接口', 31.301525, 121.049215, 'W', 25, [2023, 6], [[2023.42, 1.2], [2025, 1.8], [2040, 3.2]],
      'https://www.ks.gov.cn/kss/qzkx/202507/9a9856f869014de1846f7a000086c9e3.shtml', '沿花桥博览中心以西的苏州轨交11号线走廊，在花桥镇西界预留接口，通往昆山城区、苏州。到发客流为游戏估算，图外线路不自动建成。', false),
    railInterface('taicang_portal', '沪苏界·嘉闵北延伸接口', 31.452939, 121.173784, 'NW', 14, [2030, 1], [[2030, 1.8], [2040, 3.6]],
      'https://jtw.sh.gov.cn/zdgc/20260104/6a44693fd0d54dfe90c78eb35b052472.html', '嘉定北和公路以北、沥江一带的沪苏省界，衔接太仓先导段方向。按规划走廊预留，非真实车站；2030 年启用及客流均为游戏情景。'),
    railInterface('water_wujiang_portal', '沪苏界·水乡旅游线接口', 31.062189, 120.891210, 'NW', 22, [2030, 1], [[2030, 1.4], [2040, 2.8]],
      'https://www.shanghai.gov.cn/nw12344/20230822/0f10c4e3ffee47f48aa8185c4649452c.html', '从青浦金泽水乡客厅向西北进入吴江的规划走廊，在沪苏省界预留接驳点。非真实车站；2030 年启用及客流均为游戏情景。'),
    railInterface('water_jiashan_portal', '沪浙界·嘉善至西塘线接口', 31.019838, 120.897252, 'SW', 18, [2030, 1], [[2030, 1.2], [2040, 2.4]],
      'https://www.gzw.sh.gov.cn/shgzw_zxzx_gqdt/20251112/be2dd0233993438596acb78728dbd701.html', '从青浦金泽水乡客厅向西南进入嘉善、西塘的规划走廊，在沪浙省界预留接驳点。非真实车站；2030 年启用及客流均为游戏情景。'),
    railInterface('fengnan_portal', '沪浙界·嘉兴至枫南线接口', 30.884870, 121.005828, 'W', 22, [2030, 1], [[2030, 1], [2040, 2]],
      'https://ghzyj.sh.gov.cn/nw2268/20251024/4547c6e32c134509a803228dedcdcf2e.html', '金山区枫泾镇西侧沪浙省界，预留南枫线与嘉兴至枫南线衔接方向。按规划走廊定位，非真实车站；2030 年启用及客流均为游戏情景。'),
    railInterface('pinghu_portal', '沪浙界·金山至平湖线接口', 30.741079, 121.256444, 'W', 20, [2035, 1], [[2035, 0.8], [2040, 1.6]],
      'https://jtw.sh.gov.cn/ghjh1/20230316/68bd91feee9649849089fa40b265fca4.html', '金山石化西侧、金山卫与独山港之间的沪浙省界，按已批选线走廊预留平湖方向接口。非真实车站；2035 年启用及客流均为游戏情景。'),
  );
  data.places.push(['吴泾奥林匹克公园', ...llW(...wujing.stadium), 2]);
  // 以设施地块为任务锚点，避免任务位置和详情页不同。
  const facilityAnchor = (id, r) => {
    const f = data.facilities.find(s => s.id === 'sh_' + id);
    const lm = f.lm && data.landmarks.find(l => l.id === f.lm);
    const [x, y] = f.at || [lm.x, lm.y];
    return { name: f.n, x, y, r, fixedSite: true };
  };
  const connection = (id, appear, deadline, reward, title, desc, anchors) =>
    ({ id, appear, deadline, type: 'connect', reward, title, desc, anchors });
  const f = facilityAnchor;
  data.histTasks.push(
    connection('sh-newcity-academic', [2021, 3], [2028, 12], 120000, '五个新城：松江科教与商业', '将东华大学松江校区、上海外国语大学松江校区、松江印象城和松江院区接入同一个线网。', [f('songjiang_uni', 2), f('sisu_songjiang', 2), f('songjiang_inc', 3), f('first_songjiang', 3)]),
    connection('sh-newcity-west', [2021, 6], [2031, 12], 150000, '五个新城：虹桥向西', '经徐泾国家会展中心把青浦新城的吾悦广场和虹桥站接入同一个线网。', [f('qingpu_wuyue', 3), f('necc', 4), f('hqstation', 4)]),
    connection('sh-reopen-campus', [2022, 6], [2028, 12], 120000, '复工复学：闵行大学城和紫竹', '连接交大闵行校区、华东师大闵行校区、紫竹科学园区与莘庄商圈。', [f('minhang_uni', 2), f('ecnu_minhang', 2), f('zizhu', 3), f('xinzhuang_zhongsheng', 4)]),
    { id: 'sh-tourism-rebound', appear: [2023, 1], deadline: [2030, 12], type: 'facShare', fac: 'sh_happy_valley', basis: 'we', target: 0.12, reward: 100000,
      title: '文旅复苏：周末去佘山', desc: '让上海欢乐谷周末至少 12% 的到访出行乘地铁。' },
    connection('sh-airport-link', [2024, 12], [2034, 12], 280000, '机场联络：虹桥到浦东', '把虹桥和浦东两座机场接入同一个线网，服务机场联络线通车带来的接驳需求。', [f('hqair', 3), f('pvg_terminal', 4)]),
    connection('sh-songjiang-hub', [2024, 12], [2032, 12], 145000, '沪苏湖高铁：松江枢纽', '把上海松江站、东华大学松江校区和松江印象城接入同一个线网。', [f('songjiang_station', 3), f('songjiang_uni', 3), f('songjiang_inc', 3)]),
    connection('sh-chongming-development', [2025, 1], [2034, 12], 180000, '开发崇明：城桥与陈家镇', '生态岛建设情景：将城桥镇的崇明万达广场与陈家镇接入同一个运营线网，改善岛内东西向交通。可用自己的线路和换乘方案完成。', [f('chongming_wanda', 3), Object.assign(anchorW('陈家镇', 31.4927, 121.7882, 5), { fixedSite: true })]),
    { id: 'sh-chongming-ecotourism', appear: [2025, 1], deadline: [2035, 12], type: 'facShare', fac: 'sh_dongping_park', basis: 'we', target: 0.12, reward: 100000,
      title: '开发崇明：东平森林公园接驳', desc: '生态文旅情景：让东平国家森林公园周末至少 12% 的到访出行乘地铁，车站可设在公园出入口附近。' },
    connection('sh-huaqiao-development', [2025, 1], [2034, 12], 130000, '开发花桥：沪苏通勤与商业', '联动开发情景：将花桥中骏世界城、硅湖职业技术学院与安亭上海汽车博物馆接入同一个运营线网。', [f('huaqiao_sce', 2), f('silicon_lake', 2), f('auto_museum', 3)]),
    connection('sh-huaqiao-business', [2025, 1], [2035, 12], 110000, '开发花桥：创新港与社区服务', '联动开发情景：连接花桥国际创新港、东方绿地医院与中骏世界城，服务产业园区和居民的日常出行。', [f('huaqiao_innovation', 3), f('huaqiao_greenland_hospital', 2), f('huaqiao_sce', 2)]),
    connection('sh-legoland-link', [2025, 7], [2034, 12], 125000, '金山文旅：乐高乐园和枫泾', '乐高乐园开园后，把园区、金山北站和枫泾古镇接入同一个线网。', [f('legoland', 3), f('jinshan_north', 3), f('fengjing', 3)]),
    connection('sh-eastern-hub', [2027, 7], [2035, 12], 180000, '东方枢纽换乘', '模拟：把上海东站、浦东国际机场和上海中医药大学张江校区接入同一个线网。', [f('east_station', 3), f('pvg_terminal', 4), f('zhangjiang_uni', 3)]),
    connection('sh-baoshan-hub', [2027, 7], [2035, 12], 155000, '宝山枢纽接驳', '模拟：把上海宝山站、顾村公园和宝山万达接入同一个线网。', [f('baoshan_station', 3), f('gucun', 4), f('baoshan_wanda', 3)]),
    connection('sh-newcity-lingang', [2029, 1], [2038, 12], 190000, '南汇新城：校园、商圈与海昌', '规划情景：连接上海海洋大学、上海海事大学的临港校区、港城新天地和海昌海洋公园，并接入浦东国际机场。', [f('lingang_uni', 2), f('maritime_lingang', 2), f('lingang_gangcheng', 3), f('haichang', 3), f('pvg_terminal', 4)]),
    connection('sh-olympic-campus', [2033, 1], [2039, 6], 170000, '吴泾：场馆与大学城', '模拟：吴泾场馆建设期间，先连通交大闵行校区、紫竹科学园区及吴泾奥运村址。', [f('minhang_uni', 3), f('zizhu', 3), f('oly_village', 3)]),
    connection('sh-chongming-airport', [2035, 1], [2041, 12], 260000, '崇明国际机场接入全市线网', '模拟：把崇明国际机场、城桥万达、长兴岛和浦东国际机场接入同一个线网。', [f('chongming_air', 4), f('chongming_wanda', 3), anchorW('长兴岛', 31.3931, 121.7179, 5), f('pvg_terminal', 4)]),
    { id: 'sh-olympic-test', appear: [2039, 7], deadline: [2040, 8], type: 'facShare', fac: 'sh_oly_stadium', basis: 'we', target: 0.25, reward: 170000,
      title: '奥运测试赛：用地铁疏散观众', desc: '模拟：让吴泾主体育场周末至少 25% 的到访出行乘地铁。' },
    connection('sh-olympic-legacy', [2041, 1], [2045, 12], 220000, '赛后遗产：吴泾和奉贤新城', '模拟：把转作居住区的奥运村、奉贤新城南桥商圈和上海师范大学奉贤校区接入同一个线网。', [f('oly_village', 3), f('nanqiao_bailian', 3), f('haiwan_uni', 3)]),
  );
  // 位置校正：与 OSM 地铁站同名的设施与任务锚点，改用车站位置（相距 3 km 以内时；手填坐标的误差可达数百米）
  const ST = {}; for (const p of G.places || []) if (p[3] === 0 && !ST[p[0]]) ST[p[0]] = p;
  const nearSt = function (name, x, y) { const p = ST[name.replace(/（.*?）/g, '')]; return p && Math.hypot(p[1] - x, p[2] - y) < 12 ? p : null; };
  for (const f of data.facilities) if (f.at && !f.fixedSite) { const p = nearSt(f.n, f.at[0], f.at[1]); if (p) f.at = [p[1], p[2]]; }
  for (const t of data.histTasks.concat(data.dynTasks)) for (const a of t.anchors || []) if (!a.fixedSite) { const p = nearSt(a.name, a.x, a.y); if (p) { a.x = p[1]; a.y = p[2]; } }

  (CM.MAP_LIST = CM.MAP_LIST || []).push({
    id: 'sh', name: '上海', title: '上海 · 1990', sub: '真实地理 · 1990 年起 · 人民币',
    desc: '从 1990 年尚无地铁的上海开始：七百多万人挤在浦西，黄浦江上没有一座桥，浦东开发开放即将宣布。陆家嘴、虹桥枢纽与世博会将陆续到来，地铁要追上中国最大城市的扩张。',
    facts: [['范围', '128 km × 140 km，上海 16 区及昆山花桥镇'], ['起始', '1990 年'], ['人口', '开局约 1360 万，2040 年约 3500 万'], ['货币', '人民币（元）'], ['模式', '经营挑战 / 自由建造']],
    modes: ['challenge', 'free'], kind: 'real', mapVersion: 5, scenario: 'sh-1990',
    extent: [
      { from: 1, dx: 0, dy: 0, oldW: 124, oldH: 136, newW: 152, newH: 152, note: '地图向东扩大到川沙、曹路，向南扩大到梅陇、康桥一带',
        oldRegionIds: oldRegionIds.filter(id => id !== 'chuansha' && id !== 'disney'), oldLandmarkIds: oldLandmarkIds.filter(id => id !== 'sh_disney') },
      { from: 2, dx: oldOffset[0], dy: oldOffset[1], oldW: oldSize, oldH: oldSize, newZone: 16, oldRegionIds, oldLandmarkIds,
        note: '上海扩展至全市 16 区，新增近郊和远郊分别于 2015、2020 年开放' },
      { from: 3, dx: 0, dy: 0, oldW: 512, oldH: 560, newW: 512, newH: 560, oldZone: 16, newZone: 16,
        oldRegionIds: data.regions.filter(r => r.id !== 'huaqiao').map(r => r.id).concat(data.defaultRegion.id), oldLandmarkIds: data.landmarks.map(l => l.id),
        note: '新增昆山花桥镇及长三角铁路接口，格网与现有站线坐标保持原位' },
      { from: 4, dx: 0, dy: 0, oldW: 512, oldH: 560, newW: 512, newH: 560, oldZone: 16, newZone: 4, zoneOnly: true,
        note: '交通小区恢复为1×1公里，任务与招标分区迁移，城市地块及现有站线保持原位' },
    ],
    region: '中国内地', tagline: '浦江两岸，从零开始的超大网络', difficulty: 3, tags: ['无地铁开局', '越江', '超大城市'],
    intro: '从 1990 年的浦西老城区修出第一条线，经黄浦江连接浦东。2015 年开放新增近郊，2020 年开放远郊、崇明三岛及昆山花桥镇。2025 年联动开发崇明与花桥，2027 年进入「喜迎奥运」，2040 年赛事在吴泾滨江举行。',
    features: [['building', '陆家嘴天际线', '东方明珠、金茂、环球金融中心与上海中心按年份出现'],
      ['map', '分批开放全市 16 区', '从市区扩展到嘉定、松江、青浦、奉贤、金山和崇明三岛'],
      ['flag', '2040 吴泾奥运会', '提前规划吴泾场馆的轨道接驳，承担赛时客流']],
    highlights: [[1990, '浦东开发开放'], [1991, '南浦大桥通车'], [2010, '虹桥枢纽启用、世博会开幕'], [2015, '新增近郊开放'], [2020, '远郊、崇明及花桥开放'], [2025, '崇明、花桥联动开发（模拟）'], [2027, '喜迎奥运'], [2040, '吴泾奥运会（模拟）']],
    geo: G, data: data,
    econ: { devOffset: 2, money: 1 },   // 出行选择参数：上海 1990 年约对应广州样本 1992 年的发展阶段
    cfg: {
      W: 512, H: 560, ZONE: 4, START: { y: 1990, m: 1, d: 1, minute: 360 },
      growth: Object.assign({}, CM.CFG.growth, { popCurve: [[1990, 13.6e6], [1995, 14.5e6], [2000, 16.41e6], [2005, 17.78e6], [2010, 23.0192e6],
        [2015, 24.15e6], [2020, 24.8709e6], [2021, 24.8943e6], [2022, 24.7589e6], [2023, 24.8745e6], [2024, 24.8026e6], [2027, 24.9e6],
        [2030, 26.6e6], [2035, 30.5e6], [2040, 35e6], [2050, 36.6e6], [2080, 38.0e6], [2300, 38.0e6]],
        histEnd: 2026, metroBoostMax: 0.02, jobsRatio: [[1990, 0.56], [2000, 0.55], [2010, 0.58], [2020, 0.6]] }),
      money: { code: 'CNY', unit: '元', wan: '万元', yi: '亿元', sym: '¥' },
      econBase: 1990,
      // 造价（万元，1990 年价格；估算，参考地铁 1 号线约 16 km、总投资约 54 亿元的量级）：软土地基，越江隧道附加较高
      cost: Object.assign({}, CM.CFG.cost, {
        trackPerKm: { underground: 25000, surface: 5000, elevated: 11000 },
        riverPerKm: { underground: 30000, surface: 20000, elevated: 20000 },
        station: { underground: { S: 12000, M: 20000, L: 32000 }, elevated: { S: 7000, M: 11000, L: 17000 }, surface: { S: 4000, M: 7000, L: 10000 } },
        demolishPerCell: 40000,
      }),
      economy: Object.assign({}, CM.CFG.economy, { startFunds: 450000, grantBase: [[1990, 22000], [1995, 40000], [2000, 60000], [2005, 120000], [2010, 180000], [2015, 220000], [2020, 250000], [2050, 350000]], debtLimit: -300000, rewardScale: 1.5 }),
      // 城市经济（macro.js）：1990 年地图范围 GDP 约 650 亿元（估算：上海全市约 780 亿元，地图覆盖中心城区与浦东主要开发区）；
      // 1994 年分税制改革前地方财政收入占比很高；浦东开发与金融、贸易中心建设带动 1990 年代起的高速增长
      macro: {
        area: '地图范围（上海全市）', region: '中国内地',
        gdp0: 7290000, revRatio: [[1990, 0.25], [1994, 0.15], [2003, 0.18], [2010, 0.2], [2020, 0.2], [2040, 0.18]], revElastic: 1.5,
        prod: [[1990, 0.03], [1991, 0.08], [1993, 0.11], [1997, 0.09], [2000, 0.085], [2005, 0.085], [2008, 0.07], [2011, 0.06], [2015, 0.05], [2019, 0.045], [2025, 0.032], [2035, 0.02], [2050, 0.014], [2080, 0.012]],
        infl: 'cn', longRun: { infl: 0.02 }, histEnd: 2026, ref: 'cn',
        struct: { trade: 0.75, fin: 0.65, ind: 0.6, tour: 0.5, prop: 0.65 },
        events: [
          { id: 'pudong1990', y: 1990, m: 4, kind: 'open', scope: '本地', title: '浦东开发开放', desc: '浦东新区设立，外资、金融与贸易机构大量进入，上海重新成为全国的经济中心。', lv: [0.002, 0.006, 0.012, 0.018, 0.022, 0.024], keep: true },
          { id: 'nanxun1992', y: 1992, m: 1 },
          { id: 'tight1993', y: 1993, m: 6 },
          { id: 'asia1997', y: 1997, m: 7, scale: 0.6 },
          { id: 'wto2001', y: 2001, m: 12 },
          { id: 'sars2003', y: 2003, m: 4, scale: 0.4 },
          { id: 'tight2004', y: 2004, m: 4 },
          { id: 'gfc2008', y: 2008, m: 9, desc: '外贸与航运骤降，上海的出口制造业与港口受到明显冲击。' },
          { id: 'stim2008', y: 2008, m: 11 },
          { id: 'expo2010', y: 2010, m: 5, kind: 'boom', scope: '本地', title: '世博会', desc: '世博会带动旅游、会展与城市更新，园区周边加快开发。', lv: [0.004, 0.003, 0] },
          { id: 'cnstock2015', y: 2015, m: 6 },
          { id: 'trade2018', y: 2018, m: 7 },
          { id: 'covid2020', y: 2020, m: 1, scale: 0.8 },
        ],
      },
    },
    cam: { cx: 63 + oldOffset[0], cy: 80 + oldOffset[1], zoom: 16 },
  });
})(window.CM);
