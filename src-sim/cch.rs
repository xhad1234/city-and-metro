//! Customizable contraction hierarchies for sparse one-to-many traffic assignment.
//! Topology, lower-triangle customization and restricted downward sweeps follow
//! Dibbelt, Strasser and Wagner (doi:10.1145/2886843) and
//! Buchhold, Sanders and Wagner (doi:10.4230/LIPIcs.SEA.2018.27).

use super::{Road, INF};

const NONE: u32 = u32::MAX;
const MAX_EDGES: usize = 450_000;
const MAX_DEGREE: usize = 384;
const MAX_CUSTOMIZATION_WORK: usize = 75_000_000;

struct Topology {
    rank: Vec<u32>,
    parent: Vec<u32>,
    start: Vec<usize>,
    tail: Vec<u32>,
    head: Vec<u32>,
    base: Vec<u32>,
}

impl Topology {
    fn build(road: &Road) -> Option<Self> {
        let nodes = road.component.len();
        let order = nested_order(road);
        let mut rank = vec![0; nodes];
        for (r, v) in order.into_iter().enumerate() {
            rank[v as usize] = r as u32;
        }
        let mut higher = vec![Vec::new(); nodes];
        for (&from, &to) in road.arc_from.iter().zip(&road.arc_to) {
            let a = rank[from as usize];
            let b = rank[to as usize];
            if a != b {
                higher[a.min(b) as usize].push(a.max(b));
            }
        }
        let mut start = vec![0; nodes + 1];
        let mut parent = vec![NONE; nodes];
        let mut tail = Vec::new();
        let mut head = Vec::new();
        let mut work = 0;
        for u in 0..nodes {
            let mut neighbors = std::mem::take(&mut higher[u]);
            neighbors.sort_unstable();
            neighbors.dedup();
            work += neighbors.len() * neighbors.len();
            if neighbors.len() > MAX_DEGREE
                || head.len() + neighbors.len() > MAX_EDGES
                || work > MAX_CUSTOMIZATION_WORK
            {
                return None;
            }
            if let Some((&p, rest)) = neighbors.split_first() {
                parent[u] = p;
                // Propagate the higher-neighbor clique through its first vertex.
                // Once that vertex is eliminated, it propagates the rest.
                higher[p as usize].extend_from_slice(rest);
            }
            tail.extend(std::iter::repeat_n(u as u32, neighbors.len()));
            head.extend(neighbors);
            start[u + 1] = head.len();
        }
        let mut base = vec![NONE; road.arc_to.len()];
        for (a, (&from, &to)) in road.arc_from.iter().zip(&road.arc_to).enumerate() {
            let u = rank[from as usize];
            let v = rank[to as usize];
            if u == v {
                continue; // Positive self loops cannot occur on a shortest path.
            }
            let lo = u.min(v) as usize;
            let row = &head[start[lo]..start[lo + 1]];
            let e = start[lo] + row.binary_search(&u.max(v)).ok()?;
            base[a] = (2 * e + usize::from(u > v)) as u32;
        }
        Some(Self {
            rank,
            parent,
            start,
            tail,
            head,
            base,
        })
    }

    fn edges(&self, v: usize) -> std::ops::Range<usize> {
        self.start[v]..self.start[v + 1]
    }
}

fn nested_order(road: &Road) -> Vec<u32> {
    fn split(road: &Road, nodes: &mut [u32], sides: &mut [i8], order: &mut Vec<u32>) {
        if nodes.len() <= 24 {
            nodes.sort_unstable_by_key(|&v| {
                let u = v as usize;
                (road.out_start[u + 1] - road.out_start[u], v)
            });
            order.extend_from_slice(nodes);
            return;
        }
        let mut lo = [i32::MAX; 2];
        let mut hi = [i32::MIN; 2];
        for &v in nodes.iter() {
            for axis in 0..2 {
                let x = road.xy[2 * v as usize + axis];
                lo[axis] = lo[axis].min(x);
                hi[axis] = hi[axis].max(x);
            }
        }
        let axis = usize::from((hi[1] as i64 - lo[1] as i64) > (hi[0] as i64 - lo[0] as i64));
        let half = nodes.len() / 2;
        nodes.select_nth_unstable_by_key(half, |&v| {
            (
                road.xy[2 * v as usize + axis],
                road.xy[2 * v as usize + (1 - axis)],
                v,
            )
        });
        for (i, &v) in nodes.iter().enumerate() {
            sides[v as usize] = (i >= half) as i8;
        }
        let mut left_cut = Vec::new();
        let mut right_cut = Vec::new();
        for &v in nodes.iter() {
            let u = v as usize;
            let side = sides[u];
            let crosses = (road.out_start[u] as usize..road.out_start[u + 1] as usize).any(|q| {
                let w = road.arc_to[road.out_arc[q] as usize] as usize;
                sides[w] == 1 - side
            });
            if crosses {
                if side == 0 {
                    left_cut.push(v);
                } else {
                    right_cut.push(v);
                }
            }
        }
        // The game supplies paired road arcs, so either side covers the cut.
        let (separator, side) = if left_cut.len() <= right_cut.len() {
            (left_cut, 0)
        } else {
            (right_cut, 1)
        };
        let (left, right) = nodes.split_at_mut(half);
        for v in &separator {
            sides[*v as usize] = -1;
        }
        let group = if side == 0 { &mut *left } else { &mut *right };
        let mut keep = 0;
        for i in 0..group.len() {
            if sides[group[i] as usize] >= 0 {
                group.swap(keep, i);
                keep += 1;
            }
        }
        for &v in left.iter().chain(right.iter()) {
            sides[v as usize] = -1;
        }
        let (a, b) = if side == 0 {
            (keep, right.len())
        } else {
            (left.len(), keep)
        };
        split(road, &mut left[..a], sides, order);
        split(road, &mut right[..b], sides, order);
        order.extend(separator);
    }
    let n = road.component.len();
    let mut nodes: Vec<_> = (0..n as u32).collect();
    nodes.sort_unstable_by_key(|&v| (road.component[v as usize], v));
    let mut sides = vec![-1; n];
    let mut order = Vec::with_capacity(n);
    for component in
        nodes.chunk_by_mut(|a, b| road.component[*a as usize] == road.component[*b as usize])
    {
        split(road, component, &mut sides, &mut order);
    }
    order
}

#[derive(Clone, Copy)]
struct Cost {
    time: f64,
    km: f64,
    first: u32,
    second: u32,
}

impl Cost {
    const UNREACHABLE: Self = Self {
        time: INF,
        km: 0.,
        first: NONE,
        second: NONE,
    };
}

struct Metric {
    time: Vec<f32>,
    costs: Vec<Cost>,
}

impl Metric {
    fn update(&mut self, top: &Topology, road: &Road) {
        self.time.clear();
        self.time.extend_from_slice(&road.time);
        self.costs.resize(2 * top.head.len(), Cost::UNREACHABLE);
        self.costs.fill(Cost::UNREACHABLE);
        for (a, &e) in top.base.iter().enumerate() {
            if e != NONE && (road.time[a] as f64) < self.costs[e as usize].time {
                self.costs[e as usize] = Cost {
                    time: road.time[a] as f64,
                    km: road.arc_km[a],
                    first: a as u32,
                    second: NONE,
                };
            }
        }
        for u in 0..top.parent.len() {
            let row = top.edges(u);
            // For each lower triangle u < v < w, test v → u → w and its reverse.
            // The two constituent arcs have already been customized.
            for uv in row.clone() {
                let v = top.head[uv] as usize;
                let mut next = row.end;
                for vw in top.edges(v).rev() {
                    let w = top.head[vw];
                    while next > uv + 1 && top.head[next - 1] > w {
                        next -= 1;
                    }
                    if next <= uv + 1 {
                        break;
                    }
                    if top.head[next - 1] == w {
                        let uw = next - 1;
                        self.relax(2 * vw, 2 * uv + 1, 2 * uw);
                        self.relax(2 * vw + 1, 2 * uw + 1, 2 * uv);
                    }
                }
            }
        }
    }

    #[inline]
    fn relax(&mut self, edge: usize, a: usize, b: usize) {
        let x = self.costs[a];
        let y = self.costs[b];
        let t = x.time + y.time;
        if t < self.costs[edge].time {
            self.costs[edge] = Cost {
                time: t,
                km: x.km + y.km,
                first: a as u32,
                second: b as u32,
            };
        }
    }
}

#[derive(Clone, Copy)]
struct Label {
    time: f64,
    km: f64,
    edge: u32,
}

impl Label {
    const EMPTY: Self = Self {
        time: INF,
        km: 0.,
        edge: NONE,
    };
}

struct Query {
    up: Vec<Label>,
    down: Vec<Label>,
    up_acc: Vec<f64>,
    down_acc: Vec<f64>,
    bits: Vec<u64>,
    sources: Vec<usize>,
    targets: Vec<usize>,
    edge_flow: Vec<f64>,
    arc_flow: Vec<f64>,
}

impl Query {
    fn new(top: &Topology, arcs: usize) -> Self {
        let n = top.rank.len();
        Self {
            up: vec![Label::EMPTY; n],
            down: vec![Label::EMPTY; n],
            up_acc: vec![0.; n],
            down_acc: vec![0.; n],
            bits: vec![0; n.div_ceil(64)],
            sources: Vec::new(),
            targets: Vec::new(),
            edge_flow: vec![0.; 2 * top.head.len()],
            arc_flow: vec![0.; arcs],
        }
    }

    fn include(bits: &mut [u64], parent: &[u32], mut u: u32) {
        while u != NONE {
            let i = u as usize;
            let mask = 1 << (i & 63);
            if bits[i >> 6] & mask != 0 {
                break;
            }
            bits[i >> 6] |= mask;
            u = parent[i];
        }
    }

    fn order(bits: &mut [u64], out: &mut Vec<usize>) {
        out.clear();
        for (block, bits) in bits.iter_mut().enumerate() {
            let mut word = std::mem::take(bits);
            while word != 0 {
                out.push(64 * block + word.trailing_zeros() as usize);
                word &= word - 1;
            }
        }
    }

    fn row(&mut self, top: &Topology, metric: &Metric, road: &mut Road, row: usize) {
        let origin = road.origins[row] as usize;
        let q0 = road.target_start[row] as usize;
        let q1 = road.target_start[row + 1] as usize;
        let start = road.start[origin] as usize..road.start[origin + 1] as usize;
        if start.is_empty() {
            return;
        }
        for k in start.clone() {
            let n = road.nodes[k] as usize;
            let u = top.rank[n];
            Self::include(&mut self.bits, &top.parent, u);
            road.component_mark[road.component[n]] = row + 1;
            if road.times[k] < self.up[u as usize].time {
                self.up[u as usize] = Label {
                    time: road.times[k],
                    km: road.km[k] as f32 as f64,
                    edge: NONE,
                };
            }
        }
        Self::order(&mut self.bits, &mut self.sources);
        for &u in &self.sources {
            let label = self.up[u];
            for e in top.edges(u) {
                let v = top.head[e] as usize;
                let cost = metric.costs[2 * e];
                let time = label.time + cost.time;
                if time < self.up[v].time {
                    self.up[v] = Label {
                        time,
                        km: label.km + cost.km,
                        edge: (2 * e) as u32,
                    };
                }
            }
        }
        for q in q0..q1 {
            let d = road.target_dest[q] as usize;
            if d != origin {
                for k in road.start[d] as usize..road.start[d + 1] as usize {
                    let n = road.nodes[k] as usize;
                    if road.component_mark[road.component[n]] == row + 1 {
                        Self::include(&mut self.bits, &top.parent, top.rank[n]);
                    }
                }
            }
        }
        Self::order(&mut self.bits, &mut self.targets);
        // Every higher neighbor of a selected rank is on its ancestor chain.
        // A descending sweep can therefore use prepared labels for all of them.
        for &u in self.targets.iter().rev() {
            let mut label = self.up[u];
            label.edge = NONE; // The upward and downward predecessor trees are distinct.
            for e in top.edges(u) {
                let v = top.head[e] as usize;
                let cost = metric.costs[2 * e + 1];
                let time = self.down[v].time + cost.time;
                if time < label.time {
                    label = Label {
                        time,
                        km: self.down[v].km + cost.km,
                        edge: (2 * e + 1) as u32,
                    };
                }
            }
            self.down[u] = label;
        }
        for q in q0..q1 {
            let d = road.target_dest[q] as usize;
            if d == origin {
                continue;
            }
            let mut best = INF;
            let mut winner = 0;
            let mut km = 0.;
            for k in road.start[d] as usize..road.start[d + 1] as usize {
                let u = top.rank[road.nodes[k] as usize] as usize;
                let time = self.down[u].time + road.times[k];
                if time < best {
                    best = time;
                    winner = u;
                    km = self.down[u].km + road.km[k];
                }
            }
            if best < INF {
                road.rows_t[q] = best as f32;
                road.rows_k[q] = km as f32;
                if road.dem[q] > 0. {
                    self.down_acc[winner] += road.dem[q] as f64;
                }
            }
        }
        for &u in &self.targets {
            let f = std::mem::take(&mut self.down_acc[u]);
            let edge = self.down[u].edge;
            self.down[u] = Label::EMPTY;
            if f == 0. {
                continue;
            }
            if edge != NONE {
                self.edge_flow[edge as usize] += f;
                self.down_acc[top.head[edge as usize / 2] as usize] += f;
            } else {
                self.up_acc[u] += f;
            }
        }
        for &u in self.sources.iter().rev() {
            let f = std::mem::take(&mut self.up_acc[u]);
            let edge = self.up[u].edge;
            self.up[u] = Label::EMPTY;
            if f != 0. && edge != NONE {
                self.edge_flow[edge as usize] += f;
                self.up_acc[top.tail[edge as usize / 2] as usize] += f;
            }
        }
    }

    fn unpack_flows(&mut self, metric: &Metric, out: &mut [f32]) {
        self.arc_flow.fill(0.);
        // The two parts of a shortcut always have a lower tail rank. Aggregate
        // their flows once per block instead of expanding each individual trip.
        for i in (0..self.edge_flow.len()).rev() {
            let f = std::mem::take(&mut self.edge_flow[i]);
            if f == 0. {
                continue;
            }
            let cost = metric.costs[i];
            if cost.second == NONE {
                self.arc_flow[cost.first as usize] += f;
            } else {
                self.edge_flow[cost.first as usize] += f;
                self.edge_flow[cost.second as usize] += f;
            }
        }
        for (v, f) in out.iter_mut().zip(&self.arc_flow) {
            *v = *f as f32;
        }
    }
}

pub(super) struct Cch {
    top: Topology,
    metrics: Vec<Metric>,
    query: Query,
}

impl Cch {
    pub(super) fn build(road: &Road) -> Option<Self> {
        // Road inputs are supplied as consecutive opposite directions by City.
        // Bounds keep both customization and per-worker storage predictable.
        let n = road.component.len();
        if n > 60_000
            || road.time.len() > 240_000
            || road.time.len() % 2 != 0
            || !road
                .arc_from
                .chunks_exact(2)
                .zip(road.arc_to.chunks_exact(2))
                .all(|(a, b)| a[0] == b[1] && a[1] == b[0])
        {
            return None;
        }
        let top = Topology::build(road)?;
        let query = Query::new(&top, road.time.len());
        Some(Self {
            top,
            metrics: Vec::new(),
            query,
        })
    }

    pub(super) fn solve(&mut self, road: &mut Road, rows: usize) {
        // At most two time periods usually share the road pool. Keep the last
        // two metrics so switching between their blocks does not redo triangles.
        let pos = self.metrics.iter().position(|m| m.time == road.time);
        let metric = if let Some(i) = pos {
            self.metrics.remove(i)
        } else {
            let mut metric = if self.metrics.len() == 2 {
                self.metrics.pop().unwrap()
            } else {
                Metric {
                    time: Vec::new(),
                    costs: Vec::new(),
                }
            };
            metric.update(&self.top, road);
            metric
        };
        for row in 0..rows {
            self.query.row(&self.top, &metric, road, row);
        }
        self.query.unpack_flows(&metric, &mut road.aux);
        self.metrics.insert(0, metric);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn grid() -> Road {
        const WIDTH: usize = 14;
        const HEIGHT: usize = 10;
        let n = WIDTH * HEIGHT;
        let mut arcs = Vec::new();
        for u in 0..n {
            let x = u % WIDTH;
            let y = u / WIDTH;
            // Separate the two halves, so some OD connectors are unreachable.
            if x + 1 < WIDTH && x != 6 {
                arcs.extend([(u, u + 1), (u + 1, u)]);
            }
            if y + 1 < HEIGHT {
                arcs.extend([(u, u + WIDTH), (u + WIDTH, u)]);
            }
        }
        let mut r = Road::new(n, arcs.len(), n, n + 1, 5, 5 * n);
        let mut adj = vec![Vec::new(); n];
        let mut random = 1560u32;
        for (a, (u, v)) in arcs.into_iter().enumerate() {
            r.arc_from[a] = u as i32;
            r.arc_to[a] = v as i32;
            adj[u].push(a as i32);
            random = random.wrapping_mul(1664525).wrapping_add(1013904223);
            r.time[a] = 0.5 + (random % 2_000_003) as f32 / 1_048_576.;
            r.arc_km[a] = 0.14 + (a % 6) as f64 / 80.;
        }
        let mut count = 0;
        for u in 0..n {
            r.xy[2 * u] = (u % WIDTH) as i32;
            r.xy[2 * u + 1] = (u / WIDTH) as i32;
            r.out_arc[count..count + adj[u].len()].copy_from_slice(&adj[u]);
            count += adj[u].len();
            r.out_start[u + 1] = count as i32;
            r.start[u + 1] = u as i32 + 2;
            r.nodes[u + 1] = u as i32;
            r.times[u + 1] = (u % 17) as f64 * 0.03125;
            r.km[u + 1] = r.times[u + 1] / 4.;
        }
        // Zone zero seeds both components.
        r.nodes[0] = 7;
        r.times[0] = 0.25;
        r.km[0] = 0.04;
        r.origins.copy_from_slice(&[0, 89, 72, 138, 23]);
        for i in 0..5 {
            for j in 0..n {
                r.target_dest[i * n + j] = j as i32;
                r.dem[i * n + j] = (i + j) as f32 / 3.5;
            }
            r.target_start[i + 1] = ((i + 1) * n) as i32;
        }
        r
    }

    #[test]
    fn restricted_sweep_matches_dijkstra_for_different_metrics() {
        let mut r = grid();
        let count = r.target_dest.len();
        let original = r.time.clone();
        for rush in [false, true, false] {
            r.time.copy_from_slice(&original);
            if rush {
                for w in r.time.iter_mut().step_by(3) {
                    *w *= 2.;
                }
            }
            assert_eq!(r.solve(5, count, false), 1);
            let time = r.rows_t.clone();
            let km = r.rows_k.clone();
            let flow = r.aux.clone();

            assert_eq!(r.solve(5, count, true), 2);
            assert!(r
                .rows_t
                .iter()
                .zip(time)
                .all(|(&a, b)| a.to_bits() == b.to_bits()));
            assert!(r
                .rows_k
                .iter()
                .zip(km)
                .all(|(&a, b)| (a.is_nan() && b.is_nan()) || (a - b).abs() < 1e-5));
            assert!(r.aux.iter().zip(flow).all(|(&a, b)| (a - b).abs() < 0.0002));
        }
    }
}
