"""Build code-native Shanghai airport scenery from an OSM PBF.
Usage: python scripts/build-shanghai-airports.py SHANGHAI.osm.pbf
Requires Node, osmium, numpy, shapely. Terminal/runway opening dates are curated;
2028-12 for Pudong T3 follows the published completion target as a game scenario.
"""
import json,subprocess,sys
import numpy as np
import osmium
import shapely
from shapely.geometry import shape,LineString,Point
from shapely import make_valid

G=json.loads(subprocess.check_output(['node','-e','global.window={CM:{}};require(process.cwd()+"/js/geo_sh.js");process.stdout.write(JSON.stringify(window.CM.GEOS.sh.proj))']))
C=250
project=lambda p:shapely.transform(p,lambda a:np.column_stack(((a[:,0]-G['lon0'])*G['kx'],(G['lat0']-a[:,1])*G['ky'])))
point=lambda p:[round((p[0]-G['lon0'])*G['kx'],4),round((G['lat0']-p[1])*G['ky'],4)]
def polys(g):
 if g.geom_type=='Polygon':yield g
 elif hasattr(g,'geoms'):
  for p in g.geoms:yield from polys(p)
def footprint(g):return [[[round(x,4),round(y,4)] for x,y in p.exterior.coords] for p in polys(g.simplify(.006))]
calendar={'hq_t1':(1990,1,25),'hq_t2':(2010,3,39),'pvg_t1':(1999,9,30),'pvg_t2':(2008,3,40),'pvg_s1':(2019,9,20),'pvg_s2':(2019,9,20),'pvg_t3':(2028,12,46.65)}
runway_dates={'17L/35R':1999+8/12,'16R/34L':2005,'17R/35L':2008,'16L/34R':2015,'15/33':2017,'18L/36R':1990,'18R/36L':2010+2/12}
D={'terminals':[],'fields':[],'aprons':[],'runways':[],'roads':[]}
class Airports(osmium.SimpleHandler):
 def __init__(self):super().__init__();self.factory=osmium.geom.GeoJSONFactory();self.terminal_ids=set()
 def area(self,a):
  tags=a.tags;kind=tags.get('aeroway') or tags.get('construction:aeroway')
  if kind not in ('aerodrome','terminal','apron'):return
  try:g=make_valid(shape(json.loads(self.factory.create_multipolygon(a))))
  except (RuntimeError,ValueError):return
  p=g.representative_point();airport='hq' if 121.30<p.x<121.36 and 31.17<p.y<31.23 else 'pvg' if 121.76<p.x<121.87 and 31.06<p.y<31.21 else None
  if tags.get('iata') in ('SHA','PVG'):airport='hq' if tags.get('iata')=='SHA' else 'pvg'
  if not airport:return
  pg=project(g);bounds=[round(v,4) for v in pg.bounds]
  if kind=='aerodrome':
   yy,xx=np.mgrid[:560,:512];mask=shapely.intersects_xy(pg,xx+.5,yy+.5)
   D['fields'].append({'id':airport,'from':1990 if airport=='hq' else 1999+8/12,'bbox':bounds,'polygons':footprint(pg),'cells':np.flatnonzero(mask).tolist()});return
  if kind=='apron':
   # Modern apron geometry is phased with the adjacent terminal / runway area.
   year=1990 if airport=='hq' else (2019+8/12 if p.y<31.144 else 2008 if p.x>121.802 else 1999+8/12)
   if airport=='hq' and p.x<121.333:year=2010+2/12
   D['aprons'].append({'from':year,'bbox':bounds,'polygons':footprint(pg)});return
  name=tags.get('name') or ''
  suffix='s1' if name.startswith('S1') else 's2' if name.startswith('S2') else 't1' if name.startswith('1') else 't2' if name.startswith('2') else 't3' if name.startswith('3') else None
  key=airport+'_'+suffix if suffix else None
  if key not in calendar or key in self.terminal_ids:return
  self.terminal_ids.add(key);year,month,height=calendar[key];x=(pg.bounds[0]+pg.bounds[2])/2;y=(pg.bounds[1]+pg.bounds[3])/2
  D['terminals'].append({'id':key,'name':('虹桥机场' if airport=='hq' else '浦东机场')+name,'x':round(x,4),'y':round(y,4),'w':round((pg.bounds[2]-pg.bounds[0])*C,1),'d':round((pg.bounds[3]-pg.bounds[1])*C,1),'h':height,'kind':'airportTerminal','rot':0,'from':year+(month-1)/12,'outlines':footprint(pg),'construction':2022 if key=='pvg_t3' else None})
 def way(self,w):
  t=w.tags;name=t.get('name') or '';ref=t.get('ref');rw=t.get('aeroway')=='runway'
  names=('云亮路','云亭东路','通航二路','凯宇路','南横二路','南纬八路','南进场','南出场','南进出场')
  road=t.get('highway')=='construction' and any(n in name for n in names)
  if not(rw or road):return
  try:coords=[(n.lon,n.lat) for n in w.nodes]
  except osmium.InvalidLocationError:return
  if len(coords)<2:return
  p=LineString(coords).representative_point()
  if not(121.76<p.x<121.87 and 31.04<p.y<31.21 or rw and 121.30<p.x<121.36 and 31.17<p.y<31.23):return
  if rw and ref in runway_dates:
   D['runways'].append({'a':point(coords[0]),'b':point(coords[-1]),'from':runway_dates[ref],'ref':ref,'airport':'hq' if p.x<121.5 else 'pvg'})
  elif road:
   D['roads'].append({'n':name,'c':3 if name in ('云亮路','南横二路') else 2,'y':2026 if name in ('云亮路','南横二路') else 2028+11/12,'flags':(1 if t.get('bridge')=='yes' else 0)|(2 if t.get('tunnel')=='yes' else 0),'p':[point(q) for q in coords]})

handler=Airports();handler.apply_file(sys.argv[1],locations=True)
assert handler.terminal_ids==set(calendar),handler.terminal_ids
assert len(D['fields'])==2
for key in D:D[key].sort(key=lambda r:r.get('id',r.get('ref',r.get('n',str(r.get('from',0))))))
with open('js/data_sh_airports.js','w') as f:
 f.write("'use strict';\n// Generated from OpenStreetMap contributors (ODbL). Dates: curated history and published planning targets; heights are display estimates.\n(function(CM){CM.SH_AIRPORT_LAYOUT=")
 f.write(json.dumps(D,ensure_ascii=False,separators=(',',':')));f.write('; })(window.CM);\n')
print({k:len(v) for k,v in D.items()})
