// Copied into each road worker; only standard worker globals are used.
function roadKernelWorker(module, graph) {
  const kernel = new WebAssembly.Instance(module, {}).exports;
  const fixed = ['outStart', 'outArc', 'arcTo', 'arcFrom', 'start', 'nodes', 'times', 'km', 'arcKm'];
  let views, rows = 0, targets = 0;
  const useCch = graph.xy && graph.nN >= 1024 && (typeof navigator === 'undefined' || (navigator.deviceMemory || 8) >= 4);

  function bindViews() {
    views = fixed.map((key, id) => {
      const src = graph[key];
      return new src.constructor(kernel.memory.buffer, kernel.ptr(id), src.length);
    });
    for (const [id, Type, size] of [
      [9, Float32Array, graph.nA], [10, Int32Array, rows], [11, Float32Array, targets],
      [12, Float32Array, targets], [13, Float32Array, targets], [14, Float32Array, graph.nA],
      [15, Int32Array, rows + 1], [16, Int32Array, targets], [17, Int32Array, 2 * graph.nN],
    ]) views[id] = new Type(kernel.memory.buffer, kernel.ptr(id), size);
  }

  function configure(n, count) {
    rows = n > rows ? Math.min(graph.Z, Math.max(n, 16, rows * 2)) : rows;
    targets = count > targets ? Math.max(count, 256, targets * 2) : targets;
    const first = !views;
    const ok = first ? kernel.init(graph.nN, graph.nA, graph.Z, graph.nodes.length, rows, targets) : kernel.reserve(rows, targets);
    if (!ok) throw Error('Road kernel capacity');
    bindViews();
    if (first) {
      fixed.forEach((key, id) => views[id].set(graph[key]));
      if (graph.xy) views[17].set(graph.xy);
    }
  }

  return {
    solve(m) {
      const n = m.origins.length, count = m.tDest.length;
      if (!views || n > rows || count > targets) configure(n, count);
      views[9].set(m.time); views[10].set(m.origins); views[11].set(m.dem);
      views[15].set(m.tStart); views[16].set(m.tDest);
      const method = kernel.solve(n, count, useCch && m.cch !== false ? 1 : 0);
      if (!method) throw Error('Road kernel input');
      if (views[12].buffer !== kernel.memory.buffer) bindViews(); // Index allocation can grow WASM memory.
      return { rowsT: views[12].slice(0, count), rowsK: views[13].slice(0, count), aux: views[14].slice(), cch: method === 2 };
    },
  };
}
