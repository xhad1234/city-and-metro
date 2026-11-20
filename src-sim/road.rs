//! Road traffic assignment, with the original Dijkstra solver as a fallback.
mod cch;
use std::cell::RefCell;
const INF: f64 = 1e30;
// Graph ranges are checked once, changing origins/costs before each solve.
// Positive costs finalize each node at most once; each improving arc and each
// initial connection can push at most once, so order[nn] and heap[na+nc+4] fit.
// These helpers remove redundant bounds checks only inside those invariants.
#[inline(always)] fn get<T:Copy>(a:&[T],i:usize)->T {debug_assert!(i<a.len());unsafe{*a.get_unchecked(i)}}
#[inline(always)] fn set<T>(a:&mut[T],i:usize,v:T) {debug_assert!(i<a.len());unsafe{*a.get_unchecked_mut(i)=v;}}
struct Road {
    out_start: Vec<i32>, out_arc: Vec<i32>, arc_to: Vec<i32>, arc_from: Vec<i32>,
    start: Vec<i32>, nodes: Vec<i32>, times: Vec<f64>, km: Vec<f64>, arc_km: Vec<f64>,
    time: Vec<f32>, origins: Vec<i32>, dem: Vec<f32>, rows_t: Vec<f32>, rows_k: Vec<f32>, aux: Vec<f32>,
    target_start: Vec<i32>, target_dest: Vec<i32>, mark: Vec<usize>,
    component: Vec<usize>, component_mark: Vec<usize>,
    xy: Vec<i32>, cch: Option<cch::Cch>, cch_attempted: bool,
    dist: Vec<f64>, dkm: Vec<f32>, pred: Vec<i32>, order: Vec<usize>, acc: Vec<f64>,
    heap_k: Vec<f64>, heap_v: Vec<usize>, z: usize, validated: bool,
}
impl Road {
    fn new(nn: usize, na: usize, z: usize, nc: usize, rows: usize, targets: usize) -> Self {
        Self { out_start: vec![0;nn+1], out_arc: vec![0;na], arc_to: vec![0;na], arc_from: vec![0;na],
            start: vec![0;z+1], nodes: vec![0;nc], times: vec![0.;nc], km: vec![0.;nc], arc_km: vec![0.;na],
            time: vec![0.;na], origins: vec![0;rows], dem: vec![0.;targets], rows_t: vec![f32::NAN;targets], rows_k: vec![f32::NAN;targets], aux: vec![0.;na],
            target_start: vec![0;rows+1], target_dest: vec![0;targets], mark: vec![0;nn],
            component: (0..nn).collect(), component_mark: vec![0;nn],
            xy: vec![0; 2 * nn], cch: None, cch_attempted: false,
            dist: vec![INF;nn], dkm: vec![0.;nn], pred: vec![0;nn], order: vec![0;nn], acc: vec![0.;nn],
            heap_k: vec![0.;na+nc+4], heap_v: vec![0;na+nc+4], z,validated:false }
    }
    fn validate(&self)->bool {
        let nn=self.dist.len() as i32;let na=self.time.len() as i32;let nc=self.nodes.len() as i32;
        let ranges=|a:&[i32],end:i32|a.first()==Some(&0)&&a.last()==Some(&end)&&a.windows(2).all(|p|p[0]>=0&&p[0]<=p[1]);
        ranges(&self.out_start,na)&&ranges(&self.start,nc)&&self.out_arc.iter().all(|&i|i>=0&&i<na)&&self.arc_to.iter().chain(&self.arc_from).chain(&self.nodes).all(|&i|i>=0&&i<nn)&&self.times.iter().chain(&self.km).chain(&self.arc_km).all(|v|v.is_finite()&&*v>=0.)
    }
    fn build_components(&mut self) {
        fn root(parent: &mut [usize], mut node: usize) -> usize {
            while node != parent[node] {
                parent[node] = parent[parent[node]];
                node = parent[node];
            }
            node
        }
        for from in 0..self.component.len() {
            for k in self.out_start[from] as usize..self.out_start[from + 1] as usize {
                let to = self.arc_to[self.out_arc[k] as usize] as usize;
                let from_root = root(&mut self.component, from);
                let to_root = root(&mut self.component, to);
                self.component[from_root] = to_root;
            }
        }
        for node in 0..self.component.len() {
            self.component[node] = root(&mut self.component, node);
        }
    }
    #[inline(always)]
    fn push(&mut self, count: &mut usize, key: f64, val: usize) {
        let mut i=*count; *count+=1;
        while i>0 { let p=(i-1)>>1;let k=get(&self.heap_k,p);if k<=key {break;}let v=get(&self.heap_v,p);set(&mut self.heap_k,i,k);set(&mut self.heap_v,i,v);i=p; }
        set(&mut self.heap_k,i,key);set(&mut self.heap_v,i,val);
    }
    fn tree(&mut self, origin: usize, mut remaining: usize, stamp: usize) -> usize {
        self.dist.fill(INF); let mut count=0;
        for k in get(&self.start,origin) as usize..get(&self.start,origin+1) as usize {
            let v=get(&self.nodes,k) as usize; let t=get(&self.times,k);
            if t<get(&self.dist,v) {set(&mut self.dist,v,t);set(&mut self.dkm,v,get(&self.km,k) as f32);set(&mut self.pred,v,-1);self.push(&mut count,t,v);}
        }
        let mut no=0;
        while count>0 {
            let u=get(&self.heap_v,0); let du=get(&self.heap_k,0); count-=1;
            if count>0 {
                let key=get(&self.heap_k,count);let val=get(&self.heap_v,count);let mut i=0;
                loop {let left=i*2+1;if left>=count {break;} let right=left+1;let child=if right<count&&get(&self.heap_k,right)<get(&self.heap_k,left) {right}else{left};
                    let ck=get(&self.heap_k,child);if ck>=key {break;}let cv=get(&self.heap_v,child);set(&mut self.heap_k,i,ck);set(&mut self.heap_v,i,cv);i=child;}
                set(&mut self.heap_k,i,key);set(&mut self.heap_v,i,val);
            }
            if du>get(&self.dist,u) {continue;}set(&mut self.order,no,u);no+=1;
            if get(&self.mark, u) == stamp {
                remaining -= 1;
                if remaining == 0 { break; }
            }
            for k in get(&self.out_start,u) as usize..get(&self.out_start,u+1) as usize {
                let a=get(&self.out_arc,k) as usize;let v=get(&self.arc_to,a) as usize;let nd=du+get(&self.time,a) as f64;
                if nd<get(&self.dist,v) {let km=(get(&self.dkm,u) as f64+get(&self.arc_km,a)) as f32;set(&mut self.dist,v,nd);set(&mut self.dkm,v,km);set(&mut self.pred,v,a as i32);self.push(&mut count,nd,v);}
            }
        }
        no
    }
    fn solve(&mut self, n: usize, targets: usize, use_cch: bool) -> i32 {
        if n > self.origins.len() || targets > self.target_dest.len() { return 0; }
        if !self.validated {
            if !self.validate() { return 0; }
            self.build_components();
            self.validated = true;
        }
        if self.origins[..n].iter().any(|&o|o<0||o as usize>=self.z)||self.time.iter().any(|&t|!t.is_finite()||t<=0.){return 0;}
        let offsets = &self.target_start[..=n];
        if offsets[0] != 0 || offsets[n] != targets as i32 || offsets.windows(2).any(|p| p[0] > p[1])
            || self.target_dest[..targets].iter().any(|&d| d < 0 || d as usize >= self.z) { return 0; }
        self.rows_t[..targets].fill(f32::NAN);
        self.rows_k[..targets].fill(f32::NAN);
        self.aux.fill(0.);
        self.mark.fill(0);
        self.component_mark.fill(0);
        if use_cch {
            if !self.cch_attempted {
                self.cch = cch::Cch::build(self);
                self.cch_attempted = true;
            }
            if let Some(mut index) = self.cch.take() {
                index.solve(self, n);
                self.cch = Some(index);
                return 2;
            }
        }
        for i in 0..n {
            let o = self.origins[i] as usize;
            let q0 = self.target_start[i] as usize;
            let q1 = self.target_start[i + 1] as usize;
            let stamp = i + 1;
            let mut remaining = 0;
            for k in self.start[o] as usize..self.start[o + 1] as usize {
                self.component_mark[self.component[self.nodes[k] as usize]] = stamp;
            }
            // Keep all connectors in components seeded by this origin. Nodes
            // outside those components cannot be reached, even on a directed graph.
            for q in q0..q1 {
                let d = self.target_dest[q] as usize;
                if d == o { continue; }
                for k in self.start[d] as usize..self.start[d + 1] as usize {
                    let node = self.nodes[k] as usize;
                    if self.mark[node] != stamp && self.component_mark[self.component[node]] == stamp {
                        self.mark[node] = stamp;
                        remaining += 1;
                    }
                }
            }
            if remaining == 0 { continue; }
            let no = self.tree(o, remaining, stamp);
            for q in q0..q1 {
                let d = self.target_dest[q] as usize;
                if d == o { continue; }
                let mut best = INF;
                let mut best_node = None;
                let mut distance = 0.;
                for k in self.start[d] as usize..self.start[d + 1] as usize {
                    let node = self.nodes[k] as usize;
                    let time = self.dist[node] + self.times[k];
                    if time < best {
                        best = time;
                        best_node = Some(node);
                        distance = self.dkm[node] as f64 + self.km[k];
                    }
                }
                let Some(node) = best_node else { continue; };
                self.rows_t[q] = best as f32;
                self.rows_k[q] = distance as f32;
                let demand = self.dem[q] as f64;
                if demand > 0. { self.acc[node] += demand; }
            }
            for q in (0..no).rev() {let node=self.order[q];let a=self.acc[node];if a>0. {let e=self.pred[node];if e>=0 {let e=e as usize;self.aux[e]=(self.aux[e] as f64+a) as f32;self.acc[self.arc_from[e] as usize]+=a;}self.acc[node]=0.;}}
        }
        1
    }
}
thread_local! {static ROAD: RefCell<Option<Road>>=const {RefCell::new(None)};}
fn capacity_ok(nn: usize, na: usize, z: usize, nc: usize, rows: usize, targets: usize) -> bool {
    let bytes=(nn as u64)*64+(na as u64)*44+(nc as u64)*40+(z as u64)*4+(rows as u64)*8+(targets as u64)*16;
    nn != 0 && z != 0 && rows <= z && bytes <= 128 * 1024 * 1024
}
#[no_mangle]
pub extern "C" fn init(nn: usize, na: usize, z: usize, nc: usize, rows: usize, targets: usize) -> i32 {
    if !capacity_ok(nn, na, z, nc, rows, targets) { return 0; }
    ROAD.with_borrow_mut(|r| {
        *r = None;
        *r = Some(Road::new(nn, na, z, nc, rows, targets));
    });
    1
}
#[no_mangle]
pub extern "C" fn reserve(rows: usize, targets: usize) -> i32 {
    ROAD.with_borrow_mut(|slot| {
        let Some(road) = slot else { return 0; };
        if !capacity_ok(road.dist.len(), road.time.len(), road.z, road.nodes.len(), rows, targets) {
            return 0;
        }
        road.origins.resize(rows, 0);
        road.target_start.resize(rows + 1, 0);
        road.target_dest.resize(targets, 0);
        road.dem.resize(targets, 0.);
        road.rows_t.resize(targets, f32::NAN);
        road.rows_k.resize(targets, f32::NAN);
        1
    })
}
#[no_mangle]
pub extern "C" fn ptr(field: u32) -> usize {
    ROAD.with_borrow_mut(|r|{let Some(r)=r else{return 0;};match field {
        0=>r.out_start.as_mut_ptr() as usize,1=>r.out_arc.as_mut_ptr() as usize,2=>r.arc_to.as_mut_ptr() as usize,3=>r.arc_from.as_mut_ptr() as usize,
        4=>r.start.as_mut_ptr() as usize,5=>r.nodes.as_mut_ptr() as usize,6=>r.times.as_mut_ptr() as usize,7=>r.km.as_mut_ptr() as usize,
        8=>r.arc_km.as_mut_ptr() as usize,9=>r.time.as_mut_ptr() as usize,10=>r.origins.as_mut_ptr() as usize,
        11=>r.dem.as_mut_ptr() as usize,12=>r.rows_t.as_mut_ptr() as usize,13=>r.rows_k.as_mut_ptr() as usize,14=>r.aux.as_mut_ptr() as usize,
        15=>r.target_start.as_mut_ptr() as usize,16=>r.target_dest.as_mut_ptr() as usize,17=>r.xy.as_mut_ptr() as usize,_=>0}})
}
#[no_mangle]
pub extern "C" fn solve(rows: usize, targets: usize, use_cch: i32) -> i32 {
    ROAD.with_borrow_mut(|r| r.as_mut().map_or(0, |r| r.solve(rows, targets, use_cch != 0)))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn diamond_keeps_first_equal_path_and_float_rounding() {
        let mut r=Road::new(4,4,3,3,1,3);r.out_start.copy_from_slice(&[0,2,3,4,4]);r.out_arc.copy_from_slice(&[0,1,2,3]);r.arc_from.copy_from_slice(&[0,0,1,2]);r.arc_to.copy_from_slice(&[1,2,3,3]);r.time.fill(1.);r.arc_km.copy_from_slice(&[0.1,0.2,0.3,0.2]);r.start.copy_from_slice(&[0,1,2,3]);r.nodes.copy_from_slice(&[0,3,2]);r.target_start.copy_from_slice(&[0,3]);r.target_dest.copy_from_slice(&[0,1,2]);r.dem.copy_from_slice(&[0.,3.25,1.1]);
        assert_eq!(r.solve(1,3, false), 1);assert!(r.rows_t[0].is_nan());assert_eq!(r.rows_t[1],2.);assert_eq!(r.rows_t[2],1.);assert_eq!(r.rows_k[1],(0.1_f32 as f64+0.3) as f32);assert_eq!(r.aux,[3.25,1.1,3.25,0.]);
    }
    #[test] fn unreachable_and_reused_scratch_remain_clean() {
        let mut r=Road::new(2,0,2,2,1,2);r.start.copy_from_slice(&[0,1,2]);r.nodes.copy_from_slice(&[0,1]);r.target_start.copy_from_slice(&[0,2]);r.target_dest.copy_from_slice(&[0,1]);r.dem[1]=100.;assert_eq!(r.solve(1,2, false), 1);assert!(r.rows_t[1].is_nan());assert_eq!(r.solve(1,2, false), 1);assert_eq!(r.acc,[0.,0.]);assert_eq!(r.solve(2,2, false), 0);
    }
    #[test] fn invalid_graph_and_dynamic_inputs_are_rejected() {
        let mut r=Road::new(2,1,2,2,1,2);r.out_start.copy_from_slice(&[0,1,1]);r.start.copy_from_slice(&[0,1,2]);r.nodes.copy_from_slice(&[0,1]);r.arc_to[0]=3;r.time[0]=1.;assert_eq!(r.solve(1,2, false), 0);r.arc_to[0]=1;r.origins[0]=-1;assert_eq!(r.solve(1,2, false), 0);r.origins[0]=0;r.time[0]=0.;assert_eq!(r.solve(1,2, false), 0);r.time[0]=f32::NAN;assert_eq!(r.solve(1,2, false), 0);
    }
    #[test]
    fn sparse_rows_share_connectors_and_stop_at_the_last_requested_node() {
        let mut r = Road::new(5, 4, 3, 4, 2, 3);
        r.out_start.copy_from_slice(&[0, 1, 2, 3, 4, 4]);
        r.out_arc.copy_from_slice(&[0, 1, 2, 3]);
        r.arc_from.copy_from_slice(&[0, 1, 2, 3]);
        r.arc_to.copy_from_slice(&[1, 2, 3, 4]);
        r.time.fill(1.);
        r.arc_km.fill(1.);
        r.start.copy_from_slice(&[0, 1, 3, 4]);
        r.nodes.copy_from_slice(&[0, 1, 2, 2]);
        r.times.copy_from_slice(&[0., 10., 0., 0.]);
        r.origins.copy_from_slice(&[0, 0]);
        r.target_start.copy_from_slice(&[0, 2, 3]);
        r.target_dest.copy_from_slice(&[1, 2, 2]);
        r.dem.copy_from_slice(&[1., 2., 3.]);
        assert_eq!(r.solve(2, 3, false), 1);
        assert_eq!(r.rows_t, [2., 2., 2.]);
        assert_eq!(r.rows_k, [2., 2., 2.]);
        assert_eq!(r.aux, [6., 6., 0., 0.]);
        assert_eq!(r.dist[3], INF);
        assert_eq!(r.solve(2, 3, false), 1);
        assert_eq!(r.aux, [6., 6., 0., 0.]);
        r.target_start[1] = 4;
        assert_eq!(r.solve(2, 3, false), 0);
    }
    #[test]
    fn searches_only_components_seeded_by_each_origin() {
        let mut r = Road::new(6, 4, 5, 7, 3, 6);
        r.out_start.copy_from_slice(&[0, 1, 2, 2, 3, 4, 4]);
        r.out_arc.copy_from_slice(&[0, 1, 2, 3]);
        r.arc_from.copy_from_slice(&[0, 1, 3, 4]);
        r.arc_to.copy_from_slice(&[1, 2, 4, 5]);
        r.time.fill(1.);
        r.arc_km.fill(1.);
        r.start.copy_from_slice(&[0, 1, 3, 5, 6, 7]);
        r.nodes.copy_from_slice(&[0, 1, 5, 0, 3, 4, 5]);
        r.times[1] = 10.;
        r.origins.copy_from_slice(&[0, 2, 0]);
        r.target_start.copy_from_slice(&[0, 3, 5, 6]);
        r.target_dest.copy_from_slice(&[1, 3, 4, 1, 3, 4]);
        r.dem.fill(1.);

        assert_eq!(r.solve(1, 3, false), 1);
        assert_eq!(r.dist[2], INF); // Farther nodes in the reachable component were skipped.
        assert_eq!(r.rows_t[0], 11.);
        assert!(r.rows_t[1].is_nan() && r.rows_t[2].is_nan());

        assert_eq!(r.solve(3, 6, false), 1);
        assert_eq!(&r.rows_t[3..5], &[2., 1.]); // The second origin seeds both components.
        assert_eq!(&r.rows_k[3..5], &[2., 1.]);
        assert!(r.rows_t[5].is_nan()); // The last origin must not reuse the second one's labels.
        assert_eq!(r.aux, [1., 0., 2., 1.]);
    }
}
