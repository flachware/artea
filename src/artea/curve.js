export function curve(P0, T, P3) {
  const t1 = Math.hypot(T.x - P0.x, T.y - P0.y)
  const t2 = Math.hypot(T.x - P3.x, T.y - P3.y)
  const A = Math.max(t1, t2)
  const B = Math.min(t1, t2)

  const kappa = 4 * (Math.sqrt(2) - 1) / 3;

  const p = 1 - (1 - kappa) * Math.pow(2 * B / (A + B), 3 / 4)

  return p
}
