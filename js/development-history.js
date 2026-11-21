'use strict';
(function (CM) {
  const U = CM.U;
  const month = date => U.ymIndex(date.y, date.m);
  const key = date => date.y * 10000 + date.m * 100 + date.d;
  const label = date => date.y + '-' + String(date.m).padStart(2, '0') + '-' + String(date.d).padStart(2, '0');

  // Only changed cells are stored. Gaps and signed differences use variable-length integers.
  function encode(counts, base) {
    let bytes = new Uint8Array(counts.length * 2 + 16), size = 0, previous = -1;
    const write = number => {
      while (number >= 128) { bytes[size++] = (number & 127) | 128; number >>>= 7; }
      bytes[size++] = number;
    };
    for (let c = 0; c < counts.length; c++) {
      const delta = Math.round(counts[c]) - (base ? base[c] : 0);
      if (!delta) continue;
      if (size + 10 > bytes.length) {
        const grown = new Uint8Array(bytes.length * 2);
        grown.set(bytes);
        bytes = grown;
      }
      write(c - previous);
      write(delta < 0 ? -2 * delta - 1 : 2 * delta);
      previous = c;
    }
    return U.bytesToB64(bytes.subarray(0, size));
  }

  function decode(data, count, base) {
    const bytes = U.b64ToBytes(data), out = base ? base.slice() : new Int32Array(count);
    let i = 0, cell = -1;
    const read = () => {
      let value = 0;
      for (let shift = 0; shift <= 28 && i < bytes.length; shift += 7) {
        const b = bytes[i++];
        value += (b & 127) * 2 ** shift;
        if (!(b & 128)) return value;
      }
      throw new Error('无效的地块发展快照');
    };
    while (i < bytes.length) {
      const gap = read(), integer = read();
      cell += gap;
      if (!gap || cell >= count || integer > 0xffffffff) throw new Error('无效的地块发展快照');
      out[cell] += integer % 2 ? -(integer + 1) / 2 : integer / 2;
    }
    return out;
  }

  function DevelopmentHistory(city, clock, saved, metric = 'pop') {
    this.metric = metric;
    this.frames = [];
    this.decoded = new Map();
    if (saved?.v === 1 && Array.isArray(saved.frames)) {
      let last = 0, base = null;
      for (const frame of saved.frames) {
        if (!frame || typeof frame.data !== 'string' || !Number.isInteger(frame.y) || !Number.isInteger(frame.m) ||
            !Number.isInteger(frame.d) || frame.m < 1 || frame.m > 12 || frame.d < 1 || frame.d > U.daysInMonth(frame.y, frame.m)) break;
        const date = key(frame);
        if (date <= last || date > key(clock)) break;
        if (frame.extent) {
          const { x, y, w, h } = frame.extent;
          if (![x, y, w, h].every(Number.isInteger) || x < 0 || y < 0 || w < 1 || h < 1 || x + w > city.W || y + h > city.H) break;
          base = frame;
        }
        if (!base) break;
        this.frames.push(frame);
        last = date;
      }
    }
    const extent = this.baseOf(this.frames.at(-1))?.extent;
    if (!extent || extent.w !== city.W || extent.h !== city.H) this.capture(city, clock, true);
  }

  DevelopmentHistory.key = key;
  DevelopmentHistory.label = label;
  DevelopmentHistory.colors = { gain: '#c83232', loss: '#2846be', unknown: '#6c7786' };
  DevelopmentHistory.scale = { rate: 0.5, net: 500 };

  DevelopmentHistory.prototype.baseOf = function (frame) {
    for (let i = this.frames.indexOf(frame); i >= 0; i--) {
      if (this.frames[i].extent) return this.frames[i];
    }
    return null;
  };

  DevelopmentHistory.prototype.values = function (frame) {
    if (this.decoded.has(frame)) return this.decoded.get(frame);
    const base = this.baseOf(frame);
    if (!base) return null;
    const { w, h } = base.extent;
    let counts = null;
    try {
      if (base === frame) counts = decode(base.data, w * h, null);
      else {
        const source = this.values(base);
        if (source) counts = decode(frame.data, w * h, source.counts);
      }
    } catch (error) {
      // An unreadable optional snapshot does not block restoring the game.
    }
    const result = counts && { counts, ...base.extent };
    this.decoded.set(frame, result);
    if (this.decoded.size > 4) this.decoded.delete(this.decoded.keys().next().value);
    return result;
  };

  DevelopmentHistory.prototype.capture = function (city, clock, full = false) {
    const last = this.frames.at(-1), date = key(clock);
    if (last && (date < key(last) || (date === key(last) && !full))) return;
    if (last && date === key(last)) { this.frames.pop(); this.decoded.delete(last); }
    const firstOfYear = clock.m === 1 && !this.frames.some(f => f.y === clock.y && f.extent?.w === city.W && f.extent?.h === city.H);
    const base = !full && !firstOfYear ? this.values(this.baseOf(this.frames.at(-1))) : null;
    const currentBase = base && base.w === city.W && base.h === city.H ? base.counts : null;
    const frame = { y: clock.y, m: clock.m, d: clock.d, data: encode(city[this.metric], currentBase) };
    if (!currentBase) frame.extent = { x: 0, y: 0, w: city.W, h: city.H };
    this.frames.push(frame);
    const earliestMonth = month(clock) - 36;
    this.frames = this.frames.filter(f => f.extent || month(f) >= earliestMonth);
  };

  DevelopmentHistory.prototype.serialize = function () {
    return { v: 1, frames: this.frames.slice() };
  };
  DevelopmentHistory.shift = function (saved, dx, dy) {
    if (saved?.v !== 1 || !Array.isArray(saved.frames)) return;
    for (const frame of saved.frames) {
      if (!frame?.extent) continue;
      frame.extent.x += dx;
      frame.extent.y += dy;
    }
  };

  DevelopmentHistory.prototype.window = function (months, startKey, endKey) {
    const last = this.frames.at(-1);
    if (!last) return null;
    if (months) {
      const wanted = month(last) - months;
      const start = this.frames.find(f => month(f) >= wanted) || last;
      return { start, end: last };
    }
    const end = this.frames.find(f => key(f) === endKey) || last;
    const start = this.frames.find(f => key(f) >= startKey) || this.frames[0];
    return { start: key(start) <= key(end) ? start : end, end };
  };

  DevelopmentHistory.at = function (snapshot, x, y) {
    if (!snapshot) return -1;
    const i = x - snapshot.x, j = y - snapshot.y;
    return i < 0 || j < 0 || i >= snapshot.w || j >= snapshot.h ? -1 : snapshot.counts[j * snapshot.w + i];
  };

  CM.DevelopmentHistory = DevelopmentHistory;
})(window.CM);
