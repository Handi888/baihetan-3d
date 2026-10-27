/** Sutherland–Hodgman clipping against an implicit wet half-space.
 * A mixed triangle becomes a triangle or quad. Never discard it just because
 * one of its vertices is on dry land. Intersections on shared edges use the same
 * endpoint order, keeping neighbouring fragments watertight after Float32 export.
 */
export function clipWetPolygon(poly, field) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], fa = field(a), fb = field(b);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) === (fb >= 0)) continue;
    // A canonical direction makes bisection reproducible for reversed shared edges.
    const reverse = a[0] > b[0] || (a[0] === b[0] && a[2] > b[2]);
    const start = reverse ? b : a, end = reverse ? a : b;
    const positive = field(start) >= 0;
    let lo = 0, hi = 1;
    for (let k = 0; k < 32; k++) {
      const t = (lo + hi) / 2;
      const p = start.map((v, axis) => v + (end[axis] - v) * t);
      if ((field(p) >= 0) === positive) lo = t; else hi = t;
    }
    const t = (lo + hi) / 2;
    out.push(start.map((v, axis) => v + (end[axis] - v) * t));
  }
  return out;
}

export function wetPolygonArea(poly) {
  let twice = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]; twice += a[0] * b[2] - b[0] * a[2];
  }
  return Math.abs(twice) / 2;
}
