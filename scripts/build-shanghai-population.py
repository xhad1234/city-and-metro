"""Build 250m census control and settlement grids, no former-map clipping.

Usage: python scripts/build-shanghai-population.py SHANGHAI.osm.pbf
Requires osmium, numpy, shapely. Reads js/geo_sh.js via Node and the checked-in
2020 census CSV. Outputs js/data_sh_population.js; factual totals are checked.
"""
import base64,csv,json,subprocess,sys
from collections import defaultdict
import numpy as np
import osmium
import shapely
from shapely.geometry import shape,Polygon
from shapely import union_all,make_valid

W,H=512,560
G=json.loads(subprocess.check_output(['node','-e','global.window={CM:{}};require(process.cwd()+"/js/geo_sh.js");process.stdout.write(JSON.stringify(window.CM.GEOS.sh))']))
P=G['proj']
rows=list(csv.DictReader(open('data/shanghai-population-2020.csv')))
assert sum(int(r['population']) for r in rows)==24870895
aliases={'菊园新区':'菊园街道'}
# Census-only units absorbed by modern OSM township boundaries. Their population
# stays in its district and is included in the indicated real host unit.
hosts={'海湾旅游区':'海湾镇','前卫农场':'竖新镇','东平林场':'东平镇','上实现代农业园区':'陈家镇'}

def decode(s):
 x=y=0;out=[];axis=0;value=shift=0
 for ch in s:
  b=ord(ch)-63;value|=(b&31)<<shift
  if b>=32:shift+=5;continue
  delta=-(value//2)-1 if value&1 else value//2
  if axis==0:x+=delta
  else:y+=delta;out.append((x/64,y/64))
  axis=1-axis;value=shift=0
 return out

def geometry(a):
 polys=[];outer=None;holes=[]
 for ring in a:
  pts=decode(ring[1:])
  if ring[0]=='o':
   if outer:polys.append(make_valid(Polygon(outer,holes)))
   outer=pts;holes=[]
  elif outer:holes.append(pts)
 if outer:polys.append(make_valid(Polygon(outer,holes)))
 return union_all(polys)

admin=defaultdict(list)
for lev,n,*rings in G['admin']:
 name=G['names'][n]
 if name.endswith(('（原图）','（扩图）')) or lev not in (6,8):continue
 admin[(lev,name)].append(geometry(rings))
admin={k:union_all(v) for k,v in admin.items()}
yy,xx=np.mgrid[:H,:W];xx=xx+.5;yy=yy+.5
D=np.zeros((H,W),dtype='u1');districts=list(dict.fromkeys(r['district'] for r in rows))
for i,d in enumerate(districts,1):D[shapely.intersects_xy(admin[(6,d)],xx,yy)]=i
T=np.zeros((H,W),dtype='u1');groups=[]
for di,d in enumerate(districts,1):
 rr=[r for r in rows if r['district']==d]; merged={r['town']:int(r['population']) for r in rr}
 for n,host in hosts.items():
  if n in merged:merged[host]+=merged.pop(n)
 unresolved=[]
 for n,pop in merged.items():
  k=len(groups)+1;groups.append([d,n,pop])
  geom=admin.get((8,aliases.get(n,n)),admin.get((6,n)))
  if geom is None:unresolved.append(k);continue
  mask=shapely.intersects_xy(geom,xx,yy)&(D==di);T[mask]=k
 remaining=(D==di)&(T==0)
 if unresolved:
  # The missing development-zone boundary is the district area left after all
  # named townships. More than one unresolved unit would be ambiguous.
  if len(unresolved)!=1:raise ValueError((d,'Ambiguous missing boundaries',unresolved))
  T[remaining]=unresolved[0]
 else:
  # Coastal slivers / geometry tolerance: assign to nearest already-known cell
  # in the same district, never to a township across the municipal boundary.
  covered=np.flatnonzero((D==di)&(T>0));coords=np.column_stack((xx.ravel()[covered],yy.ravel()[covered]))
  tree=shapely.STRtree(shapely.points(coords))
  cells=np.flatnonzero(remaining)
  if len(cells):T.ravel()[cells]=T.ravel()[covered[tree.nearest(shapely.points(xx.ravel()[cells],yy.ravel()[cells]))]]
for k,(d,n,pop) in enumerate(groups,1):
 if not np.any(T==k):raise ValueError(('No census cells',d,n))
print('Census control groups',len(groups),'total',sum(r[2] for r in groups),file=sys.stderr)

# Real land-use and residential buildings: partial cell area, not binary at a
# boundary. 250m precision is a game allocation, not a block-level census.
R=np.zeros((H,W),dtype=float);J=np.zeros_like(R)
def burn(a,g):
 x0,y0,x1,y1=g.bounds
 x0=max(0,int(x0));y0=max(0,int(y0));x1=min(W,int(x1)+1);y1=min(H,int(y1)+1)
 if x0>=x1 or y0>=y1:return
 yy1,xx1=np.mgrid[y0:y1,x0:x1]
 cells=shapely.box(xx1,yy1,xx1+1,yy1+1)
 cover=shapely.area(shapely.intersection(g,cells))
 a[y0:y1,x0:x1]=np.maximum(a[y0:y1,x0:x1],cover)

class Land(osmium.SimpleHandler):
 def __init__(self):super().__init__();self.factory=osmium.geom.GeoJSONFactory();self.count=[0,0]
 def area(self,a):
  tags=a.tags;lu=tags.get('landuse');b=tags.get('building')
  res=lu=='residential' or b in ('apartments','residential','house','terrace','dormitory','detached')
  jobs=lu in ('commercial','retail','industrial')
  if not(res or jobs):return
  try:
   g=shape(json.loads(self.factory.create_multipolygon(a)))
   g=shapely.transform(g,lambda xy:np.column_stack(((xy[:,0]-P['lon0'])*P['kx'],(P['lat0']-xy[:,1])*P['ky'])))
   if not g.is_valid:g=make_valid(g)
   if res:burn(R,g);self.count[0]+=1
   if jobs:burn(J,g);self.count[1]+=1
  except (RuntimeError,ValueError):pass
land=Land();land.apply_file(sys.argv[1],locations=True)
print('Residential/employment polygons',land.count,file=sys.stderr)
# Keep fine actual footprint, plus a small neighbourhood contribution.
near=np.pad(R,1)
soft=sum(near[dy:dy+H,dx:dx+W] for dy in range(3) for dx in range(3))/9
R=np.maximum(R,soft*.45)

def packed(a):return {'t':'u8','n':W*H,'b':base64.b64encode(a.astype('u1').tobytes()).decode()}
obj={'revision':1,'year':2020,'total':24870895,'groups':groups,'townGrid':packed(T),'housing':packed(np.rint(np.clip(R,0,1)*255)),'employment':packed(np.rint(np.clip(J,0,1)*255))}
with open('js/data_sh_population.js','w') as out:
 out.write("'use strict';\n// Generated by scripts/build-shanghai-population.py. Census facts: data/shanghai-population-2020.csv. OSM contributors (ODbL).\n(function(CM) { CM.SH_POPULATION = ")
 out.write(json.dumps(obj,ensure_ascii=False,separators=(',',':')))
 out.write('; })(window.CM);\n')
