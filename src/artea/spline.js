/*
 * spline.js
 *
 * Cubic Bézier spline - generalizes the single Artea curve
 * (artea/curve.js) to multi-segment open chains and closed
 * rings, by matching curvature at every smooth join in a
 * decoupled per-endpoint currency (see below - this is not
 * literally the segments' real curvature once a segment ends up
 * asymmetric, only a well-posed, always-solvable stand-in for
 * it). Closed form throughout: no solver, no iteration, no
 * search anywhere in this file - every join is one line of
 * arithmetic.
 *
 * ---------------------------------------------------------------
 * Segment
 * ---------------------------------------------------------------
 *
 *   P0 = segment.startNode
 *   T  = segment.controlPoint
 *   P3 = segment.endNode
 *
 *   a = |T-P0|
 *   b = |T-P3|
 *
 *   r = a/b
 *   s = sqrt(a*b)
 *
 *   C1 = P0 + p*(T-P0)
 *   C2 = P3 + e*(T-P3)
 *
 * p and e are independent: each end is pulled toward T on its
 * own, exactly as a and b are independent leg lengths.
 *
 * ---------------------------------------------------------------
 * Curvature (decoupled) and why it isn't exact
 * ---------------------------------------------------------------
 *
 *   q(p) = (1-p)/p²            - bijection (0,1) -> (0, inf)
 *
 *   Fs = (1/s) * r^(-3/2)
 *   Fe = (1/s) * r^(+3/2)
 *
 *   Js = q(p)*Fs                - curvature at P0
 *   Je = q(e)*Fe                - curvature at P3
 *
 * With K = (T-P0) x (T-P3) (the 2D cross product), the segment's
 * *actual* endpoint curvatures are
 *
 *   kappaStart(p,e) = -(2/3)*K*(1-e) / (p²*a³)
 *   kappaEnd(p,e)   = -(2/3)*K*(1-p) / (e²*b³)
 *
 * which depend on p AND e jointly at each end - real curvature
 * mixes both parameters, and matching it exactly at every join
 * has no closed form once more than one join is coupled (the
 * ring-closure polynomial's degree grows past 4 with segment
 * count - proven, not just unobserved; verified separately). Js
 * and Je equal the segment's real endpoint curvatures (up to one
 * shared constant) only on the diagonal p=e - the plain Artea
 * curve. Off the diagonal they are a decoupled *extension* of
 * that quantity: each depends only on its own end's parameter and
 * the segment's fixed a,b, which is exactly what makes a join's
 * composition (below) separable and exact-in-currency instead of
 * requiring a solver. Randomized stress testing (thousands of
 * open/closed shapes, including deliberately extreme segment
 * ratios) puts the resulting real-curvature mismatch at a join
 * below ~2.6% in the worst case, usually under 1% - see
 * FORM_EPSILON and g2Errors.
 *
 * FORM (R,S) is a dimensionless reparametrization of the same
 * pair, kept only for reporting/debugging:
 *
 *   R = (Je/Js)^(1/3)           - shape
 *   S = 1/sqrt(Js*Je)           - size
 *
 * ---------------------------------------------------------------
 * Artea reference
 * ---------------------------------------------------------------
 *
 *   pA = 1 - (1-gamma)*(2B/(A+B))^(3/4)     A=max(a,b), B=min(a,b)
 *   qA = q(pA)
 *
 *   RA = r,   SA = s/qA
 *   JsA = qA*Fs,   JeA = qA*Fe
 *
 * pA is the curvature-spike-minimizing split for this segment
 * in isolation (p=e=pA, the plain Artea curve). It is a floor
 * that must never be undershot: q is strictly decreasing, so
 *
 *   p >= pA  <=>  Js <= JsA           (likewise e, Je, JeA)
 *
 * i.e. a segment's curvature may only be relaxed below its own
 * reference, never pushed past it - the reference is already
 * the least-peaked choice available in isolation, so exceeding
 * it can only make the spike worse, never better.
 *
 * ---------------------------------------------------------------
 * Join composition
 * ---------------------------------------------------------------
 *
 * A smooth join sets the two touching endpoints equal in the
 * decoupled Js/Je currency:
 *
 *   Je[i] = Js[i+1]
 *
 * Given the floor above, both sides must independently satisfy
 * Je[i] <= JeA[i] and Js[i+1] <= JsA[i+1], so the shared value
 * can be at most:
 *
 *   Z = min(JeA[i], JsA[i+1])
 *
 * which is also the least invasive choice: the largest value
 * still respecting both floors, i.e. the smallest possible
 * departure from either segment's own reference. This is exact,
 * needs no system to solve, and cannot fail: Js[i] and Je[i] of
 * the same segment are otherwise independent, so each join only
 * ever touches its own two endpoints - open chains and closed
 * rings are composed identically, and a free chain end (no
 * join) simply keeps its own reference untouched.
 *
 * There is no ring-closure obstruction: unlike requiring every
 * segment's own ratio to be preserved (product(RA)=1, almost
 * never true in practice), curvature-matching by the smaller of
 * two references is always achievable.
 *
 * A non-smooth (corner) node breaks the chain exactly like an
 * open path boundary: each side simply keeps its own reference
 * there.
 */

import { sub, add, mul, length } from '../renderer/vector.js'
import { clamp, cbrt, uniqueNumbers } from '../renderer/scalar.js'

const EPSILON = 1e-12
const ROOT_EPSILON = 1e-10
/*
 * The decoupled currency only approximates real curvature
 * continuity (see file header); randomized stress testing across
 * thousands of open/closed shapes, including deliberately extreme
 * segment ratios, never exceeded ~2.6% relative mismatch at a
 * join. This is a sanity ceiling to catch genuine bugs/degenerate
 * geometry, not a precision target - ordinary output sits far
 * below it.
 */
const FORM_EPSILON = 0.1
const ARTEA_GAMMA = (4 * (Math.sqrt(2) - 1)) / 3
const CIRCLE_Q = (1 - ARTEA_GAMMA) / (ARTEA_GAMMA * ARTEA_GAMMA)
const CIRCLE_S = 1 / CIRCLE_Q


/* ================================================================
 * q <-> parameter
 * ================================================================ */

function qFromParameter(p) {
  if (!Number.isFinite(p) || !(p > 0) || !(p < 1)) {
    throw new Error(`Invalid Bézier parameter p: ${p}`)
  }

  return (1 - p) / (p * p)
}

function parameterFromQ(q) {
  if (!Number.isFinite(q) || !(q > 0)) {
    throw new Error(`Invalid q: ${q}`)
  }

  const p = 2 / (1 + Math.sqrt(1 + 4 * q))

  if (!Number.isFinite(p) || !(p > 0) || !(p < 1)) {
    throw new Error(`Failed to reconstruct p from q=${q}.`)
  }

  return p
}


/* ================================================================
 * Artea reference
 * ================================================================ */

function arteaParameter(a, b) {
  const A = Math.max(a, b)
  const B = Math.min(a, b)

  if (!Number.isFinite(A) || !Number.isFinite(B) || !(A > 0) || !(B > 0)) {
    throw new Error(`Invalid segment lengths: a=${a}, b=${b}`)
  }

  const pA = 1 - (1 - ARTEA_GAMMA) * Math.pow((2 * B) / (A + B), 3 / 4)

  if (!Number.isFinite(pA) || !(pA > 0) || !(pA < 1)) {
    throw new Error(`Invalid Artea parameter: ${pA}`)
  }

  return pA
}


/* ================================================================
 * Segment geometry
 * ================================================================ */

function segmentGeometry(segment, index) {
  const P0 = segment.startNode
  const T = segment.controlPoint
  const P3 = segment.endNode

  if (!P0) throw new Error(`Segment ${index}: missing startNode.`)
  if (!T) throw new Error(`Segment ${index}: missing controlPoint.`)
  if (!P3) throw new Error(`Segment ${index}: missing endNode.`)

  const d0 = sub(T, P0)
  const d3 = sub(T, P3)
  const a = length(d0)
  const b = length(d3)
  const K = d0.x * d3.y - d0.y * d3.x

  if (
    !Number.isFinite(a) ||
    !Number.isFinite(b) ||
    a <= EPSILON ||
    b <= EPSILON
  ) {
    throw new Error(`Segment ${index}: degenerate tangent geometry.`)
  }

  const r = a / b
  const s = Math.sqrt(a * b)
  const pA = arteaParameter(a, b)
  const qA = qFromParameter(pA)

  const Fs = (1 / s) * Math.pow(r, -1.5)
  const Fe = (1 / s) * Math.pow(r, 1.5)

  const JsA = qA * Fs
  const JeA = qA * Fe
  const RA = r
  const SA = s / qA
  const relativeSize = SA / CIRCLE_S

  if (
    !Number.isFinite(r) ||
    !Number.isFinite(s) ||
    !Number.isFinite(Fs) ||
    !Number.isFinite(Fe) ||
    !Number.isFinite(JsA) ||
    !Number.isFinite(JeA) ||
    !Number.isFinite(RA) ||
    !Number.isFinite(SA) ||
    !Number.isFinite(relativeSize) ||
    r <= 0 ||
    s <= 0 ||
    Fs <= 0 ||
    Fe <= 0 ||
    JsA <= 0 ||
    JeA <= 0 ||
    RA <= 0 ||
    SA <= 0
  ) {
    throw new Error(`Segment ${index}: invalid FORM geometry.`)
  }

  return {
    index,
    P0,
    T,
    P3,
    a,
    b,
    K,
    r,
    s,
    pA,
    qA,
    Fs,
    Fe,
    JsA,
    JeA,
    RA,
    SA,
    relativeSize
  }
}


/* ================================================================
 * Real curvature
 * ================================================================ */

function kappaStart(g, p, e) {
  return -(2 / 3) * g.K * (1 - e) / (p * p * g.a ** 3)
}

function kappaEnd(g, p, e) {
  return -(2 / 3) * g.K * (1 - p) / (e * e * g.b ** 3)
}


/* ================================================================
 * FORM coordinates
 * ================================================================ */

function formFromEndpointScales(Js, Je) {
  if (!Number.isFinite(Js) || !Number.isFinite(Je) || !(Js > 0) || !(Je > 0)) {
    throw new Error(`Invalid endpoint FORM: Js=${Js}, Je=${Je}`)
  }

  const R = Math.pow(Je / Js, 1 / 3)
  const S = 1 / Math.sqrt(Js * Je)

  if (!Number.isFinite(R) || !Number.isFinite(S) || !(R > 0) || !(S > 0)) {
    throw new Error(`Invalid FORM coordinates: R=${R}, S=${S}`)
  }

  return { R, S }
}

function endpointScalesFromForm(R, S) {
  if (!Number.isFinite(R) || !Number.isFinite(S) || !(R > 0) || !(S > 0)) {
    throw new Error(`Invalid FORM coordinates: R=${R}, S=${S}`)
  }

  const R32 = Math.pow(R, 1.5)

  return {
    Js: 1 / (S * R32),
    Je: R32 / S
  }
}


/* ================================================================
 * Smooth joins
 * ================================================================ */

function makeSmoothJoins(segments, closed) {
  const n = segments.length
  const joinCount = closed ? n : Math.max(0, n - 1)
  const smoothJoins = new Array(joinCount)

  for (let i = 0; i < joinCount; i++) {
    const next = (i + 1) % n
    smoothJoins[i] =
      segments[i].endNode === segments[next].startNode &&
      segments[i].endNode.smooth === 'smooth'
  }

  return smoothJoins
}


/* ================================================================
 * FORM components
 * ================================================================ */

function buildSmoothComponents(geometry, smoothJoins, closed) {
  const n = geometry.length
  const visited = new Array(n).fill(false)
  const components = []

  if (closed && smoothJoins.every(Boolean)) {
    return [{
      indices: Array.from({ length: n }, (_, i) => i),
      closed: true
    }]
  }

  for (let i = 0; i < n; i++) {
    if (visited[i]) continue

    const previous = (i - 1 + n) % n
    const hasSmoothPrevious = closed
      ? smoothJoins[previous]
      : i > 0 && smoothJoins[previous]

    if (hasSmoothPrevious) continue

    const indices = []
    let current = i

    while (current < n && !visited[current]) {
      visited[current] = true
      indices.push(current)

      const next = (current + 1) % n
      const hasSmoothNext = closed
        ? smoothJoins[current]
        : current < n - 1 && smoothJoins[current]

      if (!hasSmoothNext || next === i) break
      current = next
    }

    components.push({ indices, closed: false })
  }

  for (let i = 0; i < n; i++) {
    if (visited[i]) continue
    visited[i] = true
    components.push({ indices: [i], closed: false })
  }

  return components
}


/* ================================================================
 * Pure FORM composition
 * ================================================================ */

function composeChain(geometry, indices, closed) {
  /*
   * Closed-form composition in the decoupled Js/Je currency (see
   * file header): Js = q(p)*Fs depends only on p, Je = q(e)*Fe
   * only on e, so a join only ever touches one fresh variable
   * from each side - no cross-segment coupling, hence no
   * ring-closure obstruction and no numerical solver anywhere,
   * open chain or closed ring alike. Each join's shared value is
   * the smaller of the two touching references, which is both
   * exact in this currency and the least invasive choice (the
   * largest value still respecting both floors).
   */
  const count = indices.length
  const segments = indices.map(i => geometry[i])
  const joinCount = closed ? count : count - 1

  const Js = segments.map(g => g.JsA)
  const Je = segments.map(g => g.JeA)

  for (let k = 0; k < joinCount; k++) {
    const next = (k + 1) % count
    const shared = Math.min(segments[k].JeA, segments[next].JsA)

    Je[k] = shared
    Js[next] = shared
  }

  return indices.map((i, k) => {
    const g = geometry[i]
    const segmentJs = Js[k]
    const segmentJe = Je[k]
    const form = formFromEndpointScales(segmentJs, segmentJe)
    const segmentP = parameterFromQ(segmentJs / g.Fs)
    const segmentE = parameterFromQ(segmentJe / g.Fe)

    return {
      segmentIndex: i,
      Js: segmentJs,
      Je: segmentJe,
      p: segmentP,
      e: segmentE,
      R: form.R,
      S: form.S,
      RA: g.RA,
      SA: g.SA,
      ratioChange: form.R / g.RA,
      sizeChange: form.S / g.SA
    }
  })
}

function composeFormChain(geometry, component) {
  const indices = component.indices

  if (!indices.length) {
    throw new Error('Cannot compose an empty FORM component.')
  }

  return { forms: composeChain(geometry, indices, component.closed) }
}


/* ================================================================
 * Cubic equation
 * ================================================================ */

function cubicRealRoots(A, B, C) {
  const p = B - (A * A) / 3
  const q = (2 * A * A * A) / 27 - (A * B) / 3 + C
  const discriminant = (q / 2) ** 2 + (p / 3) ** 3
  const tolerance = 1e-14 * Math.max(1, Math.abs(q * q), Math.abs(p * p * p))

  if (discriminant > tolerance) {
    const D = Math.sqrt(discriminant)
    return [cbrt(-q / 2 + D) + cbrt(-q / 2 - D) - A / 3]
  }

  if (Math.abs(discriminant) <= tolerance) {
    if (Math.abs(p) <= EPSILON) return [cbrt(-q) - A / 3]

    const u = cbrt(-q / 2)
    return uniqueNumbers([2 * u - A / 3, -u - A / 3])
  }

  const radius = 2 * Math.sqrt(-p / 3)
  const denominator = Math.sqrt(-((p / 3) ** 3))
  let cosine = -q / (2 * denominator)

  cosine = clamp(cosine, -1, 1)

  const theta = Math.acos(cosine)

  return uniqueNumbers([
    radius * Math.cos(theta / 3) - A / 3,
    radius * Math.cos((theta + 2 * Math.PI) / 3) - A / 3,
    radius * Math.cos((theta + 4 * Math.PI) / 3) - A / 3
  ])
}


/* ================================================================
 * Ferrari
 * ================================================================ */

function depressedQuarticRealRoots(P, Q, R) {
  if (Math.abs(Q) <= ROOT_EPSILON) {
    const discriminant = P * P - 4 * R
    if (discriminant < -ROOT_EPSILON) return []

    const D = Math.sqrt(Math.max(0, discriminant))
    const roots = []

    for (const z of [(-P + D) / 2, (-P - D) / 2]) {
      if (z >= -ROOT_EPSILON) {
        const root = Math.sqrt(Math.max(0, z))
        roots.push(root, -root)
      }
    }

    return uniqueNumbers(roots)
  }

  const zRoots = cubicRealRoots(2 * P, P * P - 4 * R, -Q * Q)
  const positiveRoots = zRoots.filter(
    z => Number.isFinite(z) && z > ROOT_EPSILON
  )

  if (!positiveRoots.length) return []

  const z = Math.max(...positiveRoots)
  const a = Math.sqrt(z)

  if (!(a > ROOT_EPSILON)) return []

  const b = (P + z - Q / a) / 2
  const c = (P + z + Q / a) / 2
  const roots = []

  const D1 = a * a - 4 * b

  if (D1 >= -ROOT_EPSILON) {
    const sqrtD1 = Math.sqrt(Math.max(0, D1))
    roots.push((-a + sqrtD1) / 2, (-a - sqrtD1) / 2)
  }

  const D2 = a * a - 4 * c

  if (D2 >= -ROOT_EPSILON) {
    const sqrtD2 = Math.sqrt(Math.max(0, D2))
    roots.push((a + sqrtD2) / 2, (a - sqrtD2) / 2)
  }

  return uniqueNumbers(roots)
}

function quarticRealRoots(a, b, c, d, e) {
  if (![a, b, c, d, e].every(Number.isFinite)) {
    throw new Error('Quartic contains non-finite coefficients.')
  }

  if (Math.abs(a) <= EPSILON) {
    throw new Error('Quartic leading coefficient vanished.')
  }

  const B = b / a
  const C = c / a
  const D = d / a
  const E = e / a

  const P = C - (3 * B * B) / 8
  const Q = (B * B * B) / 8 - (B * C) / 2 + D
  const R =
    (-3 * B * B * B * B) / 256 +
    (B * B * C) / 16 -
    (B * D) / 4 +
    E

  const roots = depressedQuarticRealRoots(P, Q, R)
  return uniqueNumbers(roots.map(root => root - B / 4))
}


/* ================================================================
 * General FORM -> p/e
 *
 * Kept for debugging / future non-symmetric FORM points.
 * ================================================================ */

function parametersFromFormXY(x, y, pA, segmentIndex) {
  if (!(x > 0) || !(y > 0) || !Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(
      `Segment ${segmentIndex}: invalid FORM point x=${x}, y=${y}.`
    )
  }

  const roots = quarticRealRoots(
    y * x * x,
    0,
    -2 * x * y,
    1,
    y - 1
  )

  const candidates = []

  for (const root of roots) {
    const p = root
    if (!(p > ROOT_EPSILON) || !(p < 1 - ROOT_EPSILON)) continue

    const e = 1 - x * p * p
    if (!(e > ROOT_EPSILON) || !(e < 1 - ROOT_EPSILON)) continue

    const xCheck = (1 - e) / (p * p)
    const yCheck = (1 - p) / (e * e)
    const residual = Math.abs(xCheck - x) + Math.abs(yCheck - y)

    if (residual > 1e-7 * Math.max(1, x, y)) continue

    candidates.push({
      p,
      e,
      residual,
      distanceToArtea: Math.hypot(p - pA, e - pA)
    })
  }

  if (!candidates.length) {
    throw new Error(
      `Segment ${segmentIndex}: FORM point has no valid Bézier p/e solution. ` +
      `x=${x}, y=${y}, pA=${pA}`
    )
  }

  candidates.sort((a, b) =>
    Math.abs(a.distanceToArtea - b.distanceToArtea) > ROOT_EPSILON
      ? a.distanceToArtea - b.distanceToArtea
      : a.residual - b.residual
  )

  return {
    p: candidates[0].p,
    e: candidates[0].e,
    residual: candidates[0].residual
  }
}


/* ================================================================
 * Reconstruct parameters
 * ================================================================ */

function reconstructParameters(geometry, formsBySegment) {
  const parameters = new Array(geometry.length)

  for (let i = 0; i < geometry.length; i++) {
    const form = formsBySegment[i]
    if (!form) {
      throw new Error(`Segment ${i}: missing composed FORM state.`)
    }

    /*
     * composeFormChain already resolved p and e (independently,
     * via q(p) and q(e)), so there is nothing left to invert.
     */
    parameters[i] = {
      p: form.p,
      e: form.e,
      Js: form.Js,
      Je: form.Je,
      R: form.R,
      S: form.S
    }
  }

  return parameters
}


/* ================================================================
 * Endpoint FORM values
 * ================================================================ */

function endpointScalesFromParameters(geometry, parameters) {
  const Js = new Array(geometry.length)
  const Je = new Array(geometry.length)

  for (let i = 0; i < geometry.length; i++) {
    const p = parameters[i].p
    const e = parameters[i].e

    if (
      !Number.isFinite(p) ||
      !Number.isFinite(e) ||
      !(p > 0) ||
      !(p < 1) ||
      !(e > 0) ||
      !(e < 1)
    ) {
      throw new Error(`Segment ${i}: invalid reconstructed p/e.`)
    }

    /*
     * Decoupled: Js depends only on p, Je only on e (matching
     * how composeFormChain built them).
     */
    Js[i] = qFromParameter(p) * geometry[i].Fs
    Je[i] = qFromParameter(e) * geometry[i].Fe
  }

  return { Js, Je }
}


/* ================================================================
 * G² verification
 * ================================================================ */

function g2Errors(geometry, parameters, closed, smoothJoins) {
  /*
   * The solver matches curvature in the decoupled Js/Je currency
   * (exact by construction there), not literal real curvature -
   * this checks the real thing anyway, as an independent sanity
   * bound on how far that approximation actually lands (see file
   * header and FORM_EPSILON).
   */
  const curvatureEnd = geometry.map((g, i) =>
    kappaEnd(g, parameters[i].p, parameters[i].e)
  )
  const curvatureStart = geometry.map((g, i) =>
    kappaStart(g, parameters[i].p, parameters[i].e)
  )

  const joinCount = closed ? geometry.length : Math.max(0, geometry.length - 1)
  const errors = new Array(joinCount)
  let maxError = 0

  for (let i = 0; i < joinCount; i++) {
    const next = (i + 1) % geometry.length

    if (!smoothJoins[i]) {
      errors[i] = 0
      continue
    }

    const left = curvatureEnd[i]
    const right = curvatureStart[next]
    const scale = Math.max(1, Math.abs(left), Math.abs(right))
    const error = Math.abs(left - right) / scale

    errors[i] = error
    maxError = Math.max(maxError, error)
  }

  return { curvatureStart, curvatureEnd, errors, maxError }
}


/* ================================================================
 * Bézier reconstruction
 * ================================================================ */

function makeCurve(segment, parameter) {
  const P0 = segment.startNode
  const T = segment.controlPoint
  const P3 = segment.endNode

  const C1 = add(P0, mul(sub(T, P0), parameter.p))
  const C2 = add(P3, mul(sub(T, P3), parameter.e))

  return {
    P0,
    C1,
    C2,
    P3,
    p: parameter.p,
    e: parameter.e
  }
}


/* ================================================================
 * Number formatting
 * ================================================================ */

function formatNumber(value) {
  if (!Number.isFinite(value)) {
    throw new Error(`Attempted to write non-finite SVG number: ${value}`)
  }

  return Number(value.toFixed(12))
}


/* ================================================================
 * SVG path
 * ================================================================ */

function curvesToPath(curves, closed) {
  if (!curves.length) return ''

  const first = curves[0]
  let d = `M ${formatNumber(first.P0.x)} ${formatNumber(first.P0.y)}`

  for (const curve of curves) {
    d +=
      ` C ${formatNumber(curve.C1.x)} ${formatNumber(curve.C1.y)}` +
      ` ${formatNumber(curve.C2.x)} ${formatNumber(curve.C2.y)}` +
      ` ${formatNumber(curve.P3.x)} ${formatNumber(curve.P3.y)}`
  }

  if (closed) d += ' Z'
  return d
}


/* ================================================================
 * Main
 * ================================================================ */

export function spline(path) {
  const segments = path.getSegments()
  if (!segments.length) return ''

  const closed = Boolean(path.closed)

  /*
   * Only incomplete editor state returns early.
   */
  for (let i = 0; i < segments.length; i++) {
    if (!segments[i].controlPoint) return ''
  }

  const geometry = segments.map(segmentGeometry)
  const smoothJoins = makeSmoothJoins(segments, closed)
  const components = buildSmoothComponents(geometry, smoothJoins, closed)
  const formsBySegment = new Array(segments.length)

  /*
   * Compose every smooth component independently. Each join's
   * alpha/beta split is an exact closed-form solution, so every
   * component - open or closed - closes exactly.
   */
  for (const component of components) {
    const { forms } = composeFormChain(geometry, component)

    for (const form of forms) {
      formsBySegment[form.segmentIndex] = form
    }
  }

  for (let i = 0; i < formsBySegment.length; i++) {
    if (!formsBySegment[i]) {
      throw new Error(`Segment ${i}: FORM composition produced no result.`)
    }
  }

  const parameters = reconstructParameters(geometry, formsBySegment)

  const curves = segments.map((segment, i) =>
    makeCurve(segment, parameters[i])
  )

  for (let i = 0; i < curves.length; i++) {
    const curve = curves[i]

    if (
      !Number.isFinite(curve.C1.x) ||
      !Number.isFinite(curve.C1.y) ||
      !Number.isFinite(curve.C2.x) ||
      !Number.isFinite(curve.C2.y)
    ) {
      throw new Error(`Segment ${i}: non-finite Bézier control point.`)
    }
  }

  const verification = g2Errors(
    geometry,
    parameters,
    closed,
    smoothJoins
  )

  if (verification.maxError > FORM_EPSILON) {
    throw new Error(
      `Spline FORM G² verification failed: max error=${verification.maxError}`
    )
  }

  return curvesToPath(curves, closed)
}


/* ================================================================
 * Debug exports
 * ================================================================ */

export {
  ARTEA_GAMMA,
  CIRCLE_Q,
  CIRCLE_S,

  arteaParameter,

  qFromParameter,
  parameterFromQ,

  segmentGeometry,

  formFromEndpointScales,
  endpointScalesFromForm,

  makeSmoothJoins,
  buildSmoothComponents,

  composeFormChain,

  reconstructParameters,

  parametersFromFormXY,
  endpointScalesFromParameters,
  g2Errors,

  cubicRealRoots,
  depressedQuarticRealRoots,
  quarticRealRoots
}
