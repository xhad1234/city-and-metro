"""Build the expanded Shanghai map from uniform OpenStreetMap data (ODbL).

Pass the original geo_sh.js, OSMCoastline's simplified_land_polygons.shp,
and Geofabrik extracts for Shanghai, Jiangsu and Zhejiang, in that order.
Shanghai district relation /full .osm files can follow the PBF extracts
when their boundaries are incomplete in the regional extract.
Requires Node.js and the Python packages osmium, shapely, pyshp and
opencc-python-reimplemented. Writes the generated JavaScript to stdout.
"""
import json
import math
import subprocess
import sys

import numpy as np
import osmium
import shapefile
from opencc import OpenCC
from shapely import make_valid, transform, union_all
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.ops import polygonize
from shapely.strtree import STRtree

DX, DY = 192, 208
WIDTH, HEIGHT = 512, 560
CORE = box(DX, DY, DX + 152, DY + 152)
FRAME = box(0, 0, WIDTH, HEIGHT)
PERIMETER = FRAME.difference(CORE)
DISTRICTS = set('黄浦区 徐汇区 长宁区 静安区 普陀区 虹口区 杨浦区 闵行区 宝山区 嘉定区 浦东新区 金山区 松江区 青浦区 奉贤区 崇明区'.split())
ROAD_CLASS = {'motorway': 4, 'trunk': 4, 'primary': 3, 'secondary': 2, 'tertiary': 2}
STREETS = {'unclassified', 'residential', 'living_street', 'service', 'cycleway'}
CONVERTER = OpenCC('t2s')


def parts(geom, kind):
    if geom.is_empty:
        return
    if geom.geom_type == kind:
        yield geom
    elif hasattr(geom, 'geoms'):
        for item in geom.geoms:
            yield from parts(item, kind)


def encode(coords):
    previous = [0, 0]
    output = []
    for pair in coords:
        for axis, value in enumerate(pair):
            q = math.floor(value * 64 + 0.5)
            delta = q - previous[axis]
            previous[axis] = q
            value = delta * 2 if delta >= 0 else -delta * 2 - 1
            while value >= 32:
                output.append(chr(63 + (32 | (value & 31))))
                value >>= 5
            output.append(chr(63 + value))
    return ''.join(output)


def decode(encoded):
    x = y = 0
    count = shift = value = 0
    for char in encoded:
        byte = ord(char) - 63
        value |= (byte & 31) << shift
        if byte >= 32:
            shift += 5
            continue
        delta = -(value // 2) - 1 if value & 1 else value // 2
        if count % 2 == 0:
            x += delta
        else:
            y += delta
            yield x / 64 + DX, y / 64 + DY
        count += 1
        shift = value = 0


def source_name(tags):
    name = tags.get('name:zh-Hans') or tags.get('name:zh') or tags.get('name') or ''
    return CONVERTER.convert(name) if name else ''


def rings(polygon):
    return ['o' + encode(polygon.exterior.coords)] + [
        'i' + encode(ring.coords) for ring in polygon.interiors
    ]


def project(x, y):
    return (x - LON) * KX, (LAT - y) * KY


def project_geom(geom):
    return transform(geom, lambda pts: np.column_stack(project(pts[:, 0], pts[:, 1])))


def geographic(x, y):
    return x / KX + LON, LAT - y / KY


def in_frame(x, y, margin=0):
    return -margin <= x <= WIDTH + margin and -margin <= y <= HEIGHT + margin


class Extract(osmium.SimpleHandler):
    def __init__(self, out):
        super().__init__()
        self.out = out
        self.ids = {category: set() for category in ('ways', 'areas', 'nodes')}
        self.factory = osmium.geom.GeoJSONFactory()
        self.admin = {}
        self.coast = []
        self.shanghai = False
        self.places = set()

    def name(self, name):
        if name not in self.name_index:
            self.name_index[name] = len(self.out['names'])
            self.out['names'].append(name)
        return self.name_index[name]

    def load(self, filenames):
        self.name_index = {name: k for k, name in enumerate(self.out['names'])}
        for k, filename in enumerate(filenames):
            self.shanghai = k == 0 or filename.endswith('.osm')
            print('Reading', filename, file=sys.stderr)
            self.apply_file(filename, locations=True)

    def way(self, way):
        if way.id in self.ids['ways']:
            return
        t = way.tags
        coastal = t.get('natural') == 'coastline'
        highway = t.get('highway', '')
        link = highway.endswith('_link')
        road = ROAD_CLASS.get(highway.removesuffix('_link'))
        street = self.shanghai and highway in STREETS
        rail = t.get('railway') == 'rail' and t.get('usage') != 'industrial'
        water = self.shanghai and t.get('waterway') in ('river', 'canal')
        if not (coastal or road or street or rail or water):
            return
        try:
            coords = [project(n.lon, n.lat) for n in way.nodes]
        except osmium.InvalidLocationError:
            return
        if len(coords) < 2 or not any(in_frame(*p, margin=8) for p in coords):
            return
        self.ids['ways'].add(way.id)
        line = LineString(coords)
        if coastal:
            for shore in parts(line.intersection(FRAME), 'LineString'):
                # GEOS may reverse clipped line pieces. Restore the OSM land-on-left direction.
                if not line.is_closed and line.project(Point(shore.coords[0])) > line.project(Point(shore.coords[-1])):
                    shore = LineString(list(shore.coords)[::-1])
                self.coast.append(shore)
        if not (road or street or rail or water):
            return
        flags = int(t.get('bridge', 'no') != 'no') | (2 if t.get('tunnel', 'no') != 'no' else 0)
        name = self.name(source_name(t)) if road or rail or water else 0
        for piece in parts(line.intersection(FRAME).simplify(0.035), 'LineString'):
            if piece.length < 0.06:
                continue
            encoded = encode(piece.coords)
            if road:
                self.out['roads'].append([name, road, flags | (4 if link else 0), encoded])
            if street and piece.length >= 0.18:
                self.out['streets'].append(encoded)
            if rail:
                high_speed = t.get('highspeed') == 'yes'
                self.out['rail'].append([name, flags | (16 if high_speed else 0), encoded])
            if water and piece.length >= 0.2:
                try:
                    width = float(t.get('width', '12').removesuffix(' m'))
                except ValueError:
                    width = 12
                self.out['water'].append([name, max(0.05, min(width / 250, 0.3)), encoded])

    def area(self, area):
        if not self.shanghai or area.id in self.ids['areas']:
            return
        t = area.tags
        level = t.get('admin_level') if t.get('boundary') == 'administrative' else None
        name = source_name(t)
        natural, leisure, landuse = t.get('natural'), t.get('leisure'), t.get('landuse')
        if level == '6' and name in DISTRICTS or level == '8' and name or level == '4' and name == '上海市':
            key, admin = 'admin', int(level)
        elif natural == 'water' or t.get('waterway') == 'riverbank' or landuse in ('basin', 'reservoir'):
            key, admin = 'water', None
        elif leisure in ('park', 'nature_reserve'):
            key, admin = 'parks', None
        elif natural == 'wood' or landuse == 'forest':
            key, admin = 'woods', None
        else:
            return
        try:
            geom = project_geom(shape(json.loads(self.factory.create_multipolygon(area))))
        except (RuntimeError, ValueError):
            return
        if not geom.is_valid:
            geom = make_valid(geom)
        self.ids['areas'].add(area.id)
        if admin:
            clip = geom.intersection(FRAME)
            if not clip.is_empty:
                self.admin[(admin, name)] = clip
            return
        for poly in parts(geom.intersection(FRAME).simplify(0.05), 'Polygon'):
            if poly.area >= (0.06 if key == 'water' else 0.13):
                self.out[key].append([self.name(name), *rings(poly)])

    def node(self, node):
        if not self.shanghai or node.id in self.ids['nodes']:
            return
        t = node.tags
        if t.get('railway') == 'station':
            kind = 0 if t.get('station') == 'subway' or t.get('subway') == 'yes' else 1
        elif t.get('place') in ('town', 'suburb', 'island', 'city'):
            kind = 2
        else:
            return
        name = source_name(t)
        if not name or not node.location.valid():
            return
        x, y = project(node.lon, node.lat)
        if not in_frame(x, y):
            return
        self.ids['nodes'].add(node.id)
        key = name, kind, round(x / 2), round(y / 2)
        if key not in self.places:
            self.out['places'].append([name, round(x, 2), round(y, 2), kind])
            self.places.add(key)

    def add_admin(self):
        missing = DISTRICTS - {name for level, name in self.admin if level == 6}
        if missing:
            raise ValueError('Missing district outlines: ' + ', '.join(sorted(missing)))
        municipality = self.admin[(4, '上海市')]
        for poly in parts(municipality.intersection(CORE), 'Polygon'):
            self.out['admin'].append([6, self.name('原图市内补全'), *rings(poly)])
        for (level, name), geom in sorted(self.admin.items()):
            if level == 8:
                geom = geom.intersection(municipality)
            for poly in parts(geom.simplify(0.07), 'Polygon'):
                if poly.area >= 0.05:
                    self.out['admin'].append([level, self.name(name), *rings(poly)])
            if level == 8:
                for poly in parts(geom.intersection(PERIMETER).simplify(0.07), 'Polygon'):
                    if poly.area >= 0.05:
                        self.out['admin'].append([level, self.name(name + '（扩图）'), *rings(poly)])

    def add_sea(self, land_ref):
        coast = union_all([FRAME.boundary, *self.coast])
        polys = list(polygonize([coast]))
        # Inspect both sides of coastline segments to distinguish islands from holes.
        # In the screen's southward y-axis, OSM's land-on-left rule gives a negative
        # cross product. The simplified OSM land outline covers any unclosed seams.
        index = STRtree(polys)
        votes = [0] * len(polys)
        for shore in self.coast:
            for a, b in zip(shore.coords, list(shore.coords)[1:]):
                dx, dy = b[0] - a[0], b[1] - a[1]
                length = math.hypot(dx, dy)
                if length < 1e-6:
                    continue
                x, y = (a[0] + b[0]) * .5, (a[1] + b[1]) * .5
                d = min(0.025, length / 5) / length
                left = index.query(Point(x + dy * d, y - dx * d), predicate='within')
                right = index.query(Point(x - dy * d, y + dx * d), predicate='within')
                for k in left:
                    votes[k] += length
                for k in right:
                    votes[k] -= length
        land = []
        for poly, vote in zip(polys, votes):
            if vote > .01:
                land.append(poly)
            elif abs(vote) < .01:
                land.append(poly.intersection(land_ref))
        offshore = FRAME.difference(union_all(land))
        for poly in parts(offshore.simplify(0.03), 'Polygon'):
            if poly.area >= 0.05:
                self.out['water'].insert(0, [self.name('长江口·杭州湾'), *rings(poly)])
        print('Coastline:', len(self.coast), 'ways,', len(polys), 'closed areas', file=sys.stderr)


def reference_land(filename):
    radius = 6378137
    lo, hi = geographic(0, HEIGHT), geographic(WIDTH, 0)
    def merc(x, y):
        return radius * math.radians(x), radius * math.asinh(math.tan(math.radians(y)))
    def inverse(x, y):
        return project(np.degrees(x / radius), np.degrees(np.arctan(np.sinh(y / radius))))
    bounds = box(*merc(*lo), *merc(*hi))
    reader = shapefile.Reader(filename)
    land = []
    for record in reader.iterShapes(bbox=bounds.bounds):
        geom = shape(record.__geo_interface__)
        if not geom.is_valid:
            geom = make_valid(geom)
        land.append(transform(geom.intersection(bounds), lambda pts: np.column_stack(inverse(pts[:, 0], pts[:, 1]))))
    return union_all(land)


def shift_core(out):
    # Keep the historical region boundaries and curated heritage shapes; use
    # one extraction for the physical map so features can cross the old edge.
    for layer in ('roads', 'rail', 'streets', 'water', 'parks', 'woods', 'places'):
        out[layer] = []
    for row in out['reserves']:
        row[1:] = [s[0] + encode(decode(s[1:])) for s in row[1:]]
    old_admin, out['admin'] = out['admin'], []
    for level, name, *raw in old_admin:
        # An outer ring may be followed by its holes, then another outer ring.
        groups = []
        for ring in raw:
            coords = list(decode(ring[1:]))
            if ring[0] == 'o':
                groups.append([coords, []])
            elif groups:
                groups[-1][1].append(coords)
        name_id = len(out['names'])
        out['names'].append(out['names'][name] + '（原图）')
        for outer, holes in groups:
            geom = make_valid(Polygon(outer, holes)).intersection(CORE)
            for poly in parts(geom, 'Polygon'):
                out['admin'].append([level, name_id, *rings(poly)])


def render(out):
    print("'use strict';")
    print('// OpenStreetMap contributors, ODbL. 250 m cells, 1/64 cell delta encoding.')
    print('// Citywide Geofabrik and OSMCoastline geometry; original grid projection and historical regions.')
    print('(function (CM) {\n  (CM.GEOS = CM.GEOS || {}).sh = {')
    def compact(value):
        return json.dumps(value, ensure_ascii=False, separators=(',', ':'))
    for key, value in out.items():
        if isinstance(value, list) and key != 'names':
            print('    ' + key + ': [')
            for row in value:
                print('      ' + compact(row) + ',')
            print('    ],')
        else:
            print('    ' + key + ': ' + compact(value) + ',')
    print('  };\n})(window.CM);')


if __name__ == '__main__':
    if len(sys.argv) < 6:
        sys.exit(__doc__)
    base = subprocess.check_output(['node', '-e',
        'global.window={CM:{}};require(require("path").resolve(process.argv[1]));'
        'process.stdout.write(JSON.stringify(window.CM.GEOS.sh))', sys.argv[1]])
    out = json.loads(base)
    projection = out['proj']
    KX, KY = projection['kx'], projection['ky']
    LON, LAT = projection['lon0'] - DX / KX, projection['lat0'] + DY / KY
    projection.update(lon0=LON, lat0=LAT)
    shift_core(out)
    ext = Extract(out)
    ext.load(sys.argv[3:])
    ext.add_admin()
    ext.add_sea(reference_land(sys.argv[2]))
    out['streets'] = '!'.join(out['streets'])
    render(out)
