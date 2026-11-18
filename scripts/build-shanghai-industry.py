"""Build Shanghai industrial areas from curated official extents and OSM footprints.
Usage: python scripts/build-shanghai-industry.py SHANGHAI.osm.pbf
Requires osmium and shapely. The curated approximate boundaries are in data/.
"""
import json
from pathlib import Path
import re
import sys
import osmium
from shapely.geometry import shape, Polygon, box
from shapely import make_valid

ROOT = Path(__file__).resolve().parent.parent
DATA = json.loads((ROOT / 'data/shanghai-industrial-parks.json').read_text())
PROJ = json.loads(re.search(r'proj:\s*(\{[^}]+\})', (ROOT / 'js/geo_sh.js').read_text()).group(1))
WANTED = {r['osm'] for r in DATA['parks'] if 'osm' in r}


class Areas(osmium.SimpleHandler):
    def __init__(self):
        super().__init__(); self.factory = osmium.geom.GeoJSONFactory(); self.areas = {}

    def area(self, a):
        n = a.tags.get('name:zh') or a.tags.get('name')
        if n not in WANTED:
            return
        try:
            geom = make_valid(shape(json.loads(self.factory.create_multipolygon(a))))
        except (RuntimeError, ValueError):
            return
        # Duplicate OSM names can describe individual factories; retain the main area.
        if n not in self.areas or geom.area > self.areas[n].area:
            self.areas[n] = geom


def polygons(g):
    if g.geom_type == 'Polygon':
        yield g
    elif hasattr(g, 'geoms'):
        for p in g.geoms:
            yield from polygons(p)


def project(lon, lat):
    return [round((lon - PROJ['lon0']) * PROJ['kx'], 4), round((PROJ['lat0'] - lat) * PROJ['ky'], 4)]


if __name__ == '__main__':
    h = Areas(); h.apply_file(sys.argv[1], locations=True, idx='flex_mem')
    rows = []
    for record in DATA['parks']:
        r = dict(record)
        if 'osm' in r:
            if r['osm'] not in h.areas:
                raise ValueError('Missing OSM area: ' + r['osm'])
            geom = h.areas[r['osm']].simplify(0.00025, preserve_topology=True)
        elif 'polygon' in r:
            geom = Polygon(r['polygon'])
        else:
            geom = box(*r['bounds'])
        pt = r.get('point') or list(geom.representative_point().coords)[0]
        rows.append({'id': r['id'], 'n': r['n'], 't': 'industry', 'at': project(*pt),
                     'polygons': [[project(x, y) for x, y in p.exterior.coords] for p in polygons(geom)],
                     'existing': r.get('existing', False), 'y0': r.get('open'), 'gameYear': not r.get('existing', False),
                     'fixedSite': True, 'regionGate': True, 'noModel': True,
                     'note': r['note'] + ' 范围为公开四至与实际园区用地的游戏示意；岗位和到访量为游戏估算。' + (' 纳入游戏年份为扩图开放时间，不代表园区成立年份。' if not r.get('existing') else ''),
                     'src': {'pos': '位置：公开四至与OSM（示意范围）', 'year': '年份：游戏扩图开放' if not r.get('existing') else '年份：沿用原设施', 'url': DATA['source']}})
    target = ROOT / 'js/data_sh_industry.js'
    target.write_text("'use strict';\n// OpenStreetMap contributors, ODbL; official sources and approximate extents in data/shanghai-industrial-parks.json.\n"
                      '(function(CM){CM.SH_INDUSTRY=' + json.dumps(rows, ensure_ascii=False, separators=(',', ':')) + ';})(window.CM);\n')
    print(json.dumps({'parks': len(rows), 'output': str(target)}, ensure_ascii=False))
