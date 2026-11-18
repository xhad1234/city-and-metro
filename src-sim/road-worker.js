// Copied into each road worker; only standard worker globals are used.
function roadKernelWorker(module, graph) {
  const kernel = new WebAssembly.Instance(module, {}).exports;
  const fixed = ['outStart', 'outArc', 'arcTo', 'arcFrom', 'start', 'nodes', 'times', 'km', 'arcKm'];
  let views, rows = 0, targets = 0;

  function configure(n, count) {
    // Grow the packed buffers independently of the total number of city zones.
    rows = Math.min(graph.Z, Math.max(n, 16, rows * 2));
    targets = Math.max(count, 256, targets * 2);
    if (!kernel.init(graph.nN, graph.nA, graph.Z, graph.nodes.length, rows, targets)) throw Error('Road kernel capacity');
    views = fixed.map((key, id) => {
      const src = graph[key], view = new src.constructor(kernel.memory.buffer, kernel.ptr(id), src.length);
      view.set(src);
      return view;
    });
    for (const [id, Type, size] of [
      [9, Float32Array, graph.nA], [10, Int32Array, rows], [11, Float32Array, targets],
      [12, Float32Array, targets], [13, Float32Array, targets], [14, Float32Array, graph.nA],
      [15, Int32Array, rows + 1], [16, Int32Array, targets],
    ]) views[id] = new Type(kernel.memory.buffer, kernel.ptr(id), size);
  }

  return {
    solve(m) {
      const n = m.origins.length, count = m.tDest.length;
      if (!views || n > rows || count > targets) configure(n, count);
      views[9].set(m.time); views[10].set(m.origins); views[11].set(m.dem);
      views[15].set(m.tStart); views[16].set(m.tDest);
      if (!kernel.solve(n, count)) throw Error('Road kernel input');
      return { rowsT: views[12].slice(0, count), rowsK: views[13].slice(0, count), aux: views[14].slice() };
    },
  };
}
