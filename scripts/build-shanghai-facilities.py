"""Build geographic Shanghai facility models from pinned OSM ways and relations.

Usage: python scripts/build-shanghai-facilities.py shanghai.osm.pbf jiangsu.osm.pbf [local-extract.osm ...]
Requires Node, osmium, numpy and Shapely.
Pass newer local extracts after the regional extracts if a pinned site is missing
or has an outdated outline. Include the nodes and member ways of each pinned area.
"""
from collections import defaultdict
import json
import re
import subprocess
import sys

import numpy as np
import osmium
import shapely
from shapely.geometry import Polygon, box, shape
from shapely.strtree import STRtree


GRID_M = 250
PROJECTION = json.loads(subprocess.check_output([
    'node', '-e', 'global.window={CM:{}};require("./js/geo_sh.js");'
    'process.stdout.write(JSON.stringify(window.CM.GEOS.sh.proj))',
]))
with open('data/shanghai-facility-sources.json', encoding='utf-8') as source:
    SITES = json.load(source)

FALLBACK_HEIGHT = {
    'rail': 15, 'uni': 14, 'scenic': 12, 'library': 22, 'shop': 22,
    'cbd': 24, 'venue': 23, 'stadium': 23, 'hosp': 20,
}
BUILDING_CAP = {
    'uni': 24, 'hosp': 16, 'shop': 16, 'cbd': 16, 'venue': 12,
    'rail': 6, 'scenic': 12, 'library': 6, 'stadium': 6,
}


def project(geometry):
    p = PROJECTION
    return shapely.transform(geometry, lambda points: np.column_stack((
        (points[:, 0] - p['lon0']) * p['kx'], (p['lat0'] - points[:, 1]) * p['ky'],
    )))


def point(lat, lon):
    p = PROJECTION
    return [round((lon - p['lon0']) * p['kx'], 4), round((p['lat0'] - lat) * p['ky'], 4)]


def polygons(geometry):
    if geometry.geom_type == 'Polygon':
        if geometry.area:
            yield geometry
    elif hasattr(geometry, 'geoms'):
        for part in geometry.geoms:
            yield from polygons(part)


def outline(polygon):
    rings = [polygon.exterior, *polygon.interiors]
    return [[[round(x, 4), round(y, 4)] for x, y in ring.coords[:-1]] for ring in rings]


def osmid(area):
    return ('w' if area.from_way() else 'r') + str(area.orig_id())


class Areas(osmium.SimpleHandler):
    def __init__(self, ids=None, sites=None):
        super().__init__()
        self.factory = osmium.geom.GeoJSONFactory()
        self.ids = ids
        self.areas = {}
        self.sites = sites
        self.tree = STRtree([g for _, g in sites]) if sites else None
        self.buildings = defaultdict(dict)

    def area(self, area):
        key = osmid(area)
        building = area.tags.get('building', '') not in ('', 'no', 'roof', 'construction')
        if self.ids is not None and key not in self.ids:
            return
        if self.ids is None and not building:
            return
        try:
            geom = shapely.make_valid(shape(json.loads(self.factory.create_multipolygon(area))))
        except (ValueError, RuntimeError):
            return
        if geom.is_empty:
            return
        if self.ids is not None:
            self.areas[key] = (geom, dict(area.tags))
            return
        for i in self.tree.query(geom):
            name, site = self.sites[i]
            if geom.area < 0.000000018 or site.intersection(geom).area < geom.area * 0.93:
                continue
            self.buildings[name][key] = (geom, dict(area.tags))


def height(tags, category):
    meters = re.fullmatch(r'(\d+(?:\.\d+)?)\s*m?', tags.get('height', ''))
    levels = re.fullmatch(r'\d+(?:\.\d+)?', tags.get('building:levels', ''))
    if meters:
        return min(420, max(3, float(meters[1])))
    if levels:
        return min(420, max(3, float(levels[0]) * 3.5))
    return FALLBACK_HEIGHT[category]


def building_parts(geometry, meters, **props):
    return [
        {'rings': outline(part), 'h': round(meters, 1), **props}
        for part in polygons(geometry.simplify(0.012, preserve_topology=True))
        if part.area * GRID_M ** 2 >= 100
    ]


def make_layout(geometry, category, parts):
    bounds = geometry.bounds
    center = [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2]
    return {
        'x': round(center[0], 4), 'y': round(center[1], 4), 'type': category,
        'w': round((bounds[2] - bounds[0]) * GRID_M, 1), 'd': round((bounds[3] - bounds[1]) * GRID_M, 1),
        'h': max((part['h'] for part in parts), default=0),
        'area': [outline(p) for p in polygons(geometry.simplify(0.025, preserve_topology=True))],
        'parts': parts,
    }


def songjiang(geometry):
    # OSM 360016934 combines both concourses and the link. Partition it at the
    # building seams in the district site plan. The old hall corners are retained
    # from the original structure on the south side of the historic tracks.
    north = geometry.intersection(box(121.221, 30.98715, 121.229, 30.990))
    service = geometry.intersection(box(121.221, 30.98552, 121.229, 30.98715))
    south = Polygon([
        (121.2250134, 30.9849783), (121.2253567, 30.9845138),
        (121.2266468, 30.9851922), (121.2263223, 30.9856567),
    ])
    modern = project(north.union(service))
    main = building_parts(project(north), 48)
    for part, ring in zip(main, polygons(project(north).simplify(0.012))):
        part['glass'] = [outline(p) for p in polygons(ring.buffer(-0.10).simplify(0.01))]
    service_parts = building_parts(project(service), 25)
    for part, ring in zip(service_parts, polygons(project(service).simplify(0.012))):
        if ring.area * GRID_M ** 2 < 600:
            part['h'] = 7
        else:
            part['glass'] = [outline(p) for p in polygons(ring.buffer(-0.063).simplify(0.01))]
    old = project(south)
    return make_layout(modern, 'rail', main + service_parts), make_layout(old, 'rail', building_parts(old, 15))


def main(files):
    ids = {key for s in SITES.values() for key in s['osm']}
    shapes = Areas(ids=ids)
    for file in files:
        shapes.apply_file(file, locations=True)
    missing = ids.difference(shapes.areas)
    if missing:
        raise RuntimeError(f'Missing curated OSM areas: {sorted(missing)}')

    site_geometries = {
        name: shapely.union_all([shapes.areas[key][0] for key in data['osm']])
        for name, data in SITES.items()
    }
    building_sites = [(name, geom) for name, geom in site_geometries.items()
                      if SITES[name]['type'] in BUILDING_CAP and name != 'sh_songjiang_station' and not SITES[name].get('outlineOnly')]
    building_scan = Areas(sites=building_sites)
    for file in files:
        building_scan.apply_file(file, locations=True)

    result = {}
    for name, data in SITES.items():
        category = data['type']
        site = site_geometries[name]
        if data.get('outlineOnly'):
            layout = make_layout(project(site), category, [])
            layout['outlineOnly'] = True
        elif name == 'sh_songjiang_station':
            layout, legacy = songjiang(site)
            legacy.update({'id': 'sh_songjiang_south_hall', 'name': '原松江南站站房', 'from': 2010.75})
            layout['legacy'] = legacy
        else:
            candidates = building_scan.buildings[name]
            for key in data['osm']:
                geom, tags = shapes.areas[key]
                if tags.get('building', '') not in ('', 'no', 'roof'):
                    candidates[key] = (geom, tags)
            parts = []
            for geom, tags in sorted(candidates.values(), key=lambda x: x[0].area, reverse=True)[:BUILDING_CAP.get(category, 0)]:
                parts.extend(building_parts(project(geom), height(tags, category)))
            layout = make_layout(project(site), category, parts)
        if 'entrance' in data:
            layout['entrance'] = point(*data['entrance'])
        if 'url' in data:
            layout['url'] = data['url']
        if data.get('relocate'):
            center = site.representative_point()
            layout['anchor'] = point(center.y, center.x)
        layout['osm'] = data['osm']
        result[name] = layout
    with open('js/data_sh_facilities.js', 'w', encoding='utf-8') as output:
        output.write("'use strict';\n// Facility footprints from OpenStreetMap contributors (ODbL). Heights are measured where tagged and estimated otherwise.\n")
        output.write('(function (CM) { CM.SH_FACILITY_LAYOUT = {\n')
        output.write(',\n'.join(f'  {json.dumps(name)}: {json.dumps(layout, ensure_ascii=False, separators=(",", ":"))}'
                               for name, layout in sorted(result.items())))
        output.write('\n}; })(window.CM);\n')
    print(f'{len(result)} facilities, {sum(len(r["parts"]) for r in result.values())} building outlines')


if __name__ == '__main__':
    main(sys.argv[1:])
