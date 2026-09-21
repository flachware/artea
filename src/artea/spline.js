/*
 * spline.js
 *
 * Closed cubic Bézier G² spline.
 *
 * The optimization is expressed entirely in FORM space.
 * No direct curvature evaluation is used.
 *
 * Segment geometry:
 *
 *   a = |T-P0|
 *   b = |T-P3|
 *   r = a / b
 *   s = sqrt(a*b)
 *
 * Artea local reference:
 *
 *   gamma = 4*(sqrt(2)-1)/3
 *   pA = 1 - (1-gamma) * (2*B/(A+B))^(3/4)
 *   qA = (1-pA)/pA²
 *
 * Exact endpoint form factors:
 *
 *   q(x) = (1-x)/x²
 *   Js = q(e) / s * r^(-3/2)
 *   Je = q(p) / s * r^(+3/2)
 *
 * Effective FORM (R,S):
 *
 *   Js = 1 / (S * R^(3/2))
 *   Je = R^(3/2) / S
 *
 * with
 *
 *   R = r * (q(p)/q(e))^(1/3)
 *   S = s / sqrt(q(p)q(e))
 *
 * Local Artea form:
 *
 *   RA = r
 *   SA = s / qA
 *
 * Form deformation coordinates:
 *
 *   alpha = log(qA/q(p)) >= 0
 *   beta  = log(qA/q(e)) >= 0
 *
 * so that
 *
 *   R = RA * exp((beta-alpha)/3)
 *   S = SA * exp((alpha+beta)/2)
 *
 * The natural symmetric log-form distance is
 *
 *   E = 1/2 * (alpha² + beta²)
 *     = log(S/SA)² + (3/2*log(R/RA))²
 *
 * G² at a join is simply
 *
 *   Je[i] = Js[i+1]
 *
 * and in alpha/beta coordinates this becomes
 *
 *   alpha[i] - beta[i+1] = c[i]
 *
 * where
 *
 *   c[i] = log(
 *     qA[i] * Fe[i] /
 *     (qA[i+1] * Fs[i+1])
 *   )
 *
 * Because every alpha/beta appears in exactly one join equation,
 * the global minimum of sum(E) separates into independent joins:
 *
 *   if c >= 0: alpha = c, beta = 0
 *   if c <  0: alpha = 0, beta = -c
 *
 * Thus the final Bézier parameters are reconstructed only after
 * the form optimization is complete.
 */

const EPSILON = 1e-12
const G2_EPSILON = 1e-9

/*
 * Temporary fallback only. This is not part of the G² construction.
 */
const FALLBACK_PARAMETER = 1 / 3

const ARTEA_GAMMA =
  4 * (Math.sqrt(2) - 1) / 3


/* ================================================================
 * Vector helpers
 * ================================================================ */

function sub(a, b) {
  return {
    x: a.x - b.x,
    y: a.y - b.y
  }
}

function add(a, b) {
  return {
    x: a.x + b.x,
    y: a.y + b.y
  }
}

function mul(v, scalar) {
  return {
    x: v.x * scalar,
    y: v.y * scalar
  }
}

function length(v) {
  return Math.hypot(v.x, v.y)
}


/* ================================================================
 * q <-> parameter
 * ================================================================ */

function qFromParameter(x) {
  if (!(x > 0 && x < 1)) {
    throw new Error(
      `Invalid Bézier parameter: ${x}`
    )
  }

  return (1 - x) / (x * x)
}

function parameterFromQ(q) {
  if (!(q > 0) || !Number.isFinite(q)) {
    throw new Error(
      `Invalid q: ${q}`
    )
  }

  return (
    2 /
    (1 + Math.sqrt(1 + 4 * q))
  )
}


/* ================================================================
 * Artea local form
 * ================================================================ */

function arteaParameter(a, b) {
  const A = Math.max(a, b)
  const B = Math.min(a, b)

  if (!(A > 0 && B > 0)) {
    return null
  }

  const p =
    1 -
    (1 - ARTEA_GAMMA) *
    Math.pow(
      2 * B / (A + B),
      3 / 4
    )

  if (
    !(p > 0 && p < 1) ||
    !Number.isFinite(p)
  ) {
    return null
  }

  return p
}


/* ================================================================
 * Segment geometry
 * ================================================================ */

function segmentGeometry(segment) {
  const P0 =
    segment.startNode

  const T =
    segment.controlPoint

  const P3 =
    segment.endNode

  if (!T) {
    return null
  }

  const a =
    length(
      sub(T, P0)
    )

  const b =
    length(
      sub(T, P3)
    )

  if (
    !Number.isFinite(a) ||
    !Number.isFinite(b) ||
    a < EPSILON ||
    b < EPSILON
  ) {
    return null
  }

  const r =
    a / b

  const s =
    Math.sqrt(a * b)

  if (
    !Number.isFinite(r) ||
    !Number.isFinite(s) ||
    r <= 0 ||
    s <= 0
  ) {
    return null
  }

  const pA =
    arteaParameter(
      a,
      b
    )

  if (pA === null) {
    return null
  }

  const qA =
    qFromParameter(
      pA
    )

  /*
   * Shear enters only through the changed lengths a,b,
   * therefore there is no transformed-angle / delta factor here.
   */
  const Fs =
    1 /
    s *
    Math.pow(
      r,
      -1.5
    )

  const Fe =
    1 /
    s *
    Math.pow(
      r,
      1.5
    )

  /*
   * Local Artea reference form.
   */
  const RA =
    r

  const SA =
    s /
    qA

  if (
    !Number.isFinite(Fs) ||
    !Number.isFinite(Fe) ||
    !Number.isFinite(RA) ||
    !Number.isFinite(SA) ||
    Fs <= 0 ||
    Fe <= 0 ||
    SA <= 0
  ) {
    return null
  }

  return {
    P0,
    T,
    P3,

    a,
    b,
    r,
    s,

    pA,
    qA,

    Fs,
    Fe,

    RA,
    SA
  }
}


/* ================================================================
 * Form conversion
 * ================================================================ */

function formFromAlphaBeta(
  geometry,
  alpha,
  beta
) {
  const R =
    geometry.RA *
    Math.exp(
      (beta - alpha) / 3
    )

  const S =
    geometry.SA *
    Math.exp(
      (alpha + beta) / 2
    )

  return {
    R,
    S,

    /*
     * Exact deformation energy in log-form coordinates.
     */
    energy:
      0.5 *
      (
        alpha * alpha +
        beta * beta
      )
  }
}


function parametersFromFormDeformation(
  geometry,
  alpha,
  beta
) {
  if (
    !Number.isFinite(alpha) ||
    !Number.isFinite(beta) ||
    alpha < 0 ||
    beta < 0
  ) {
    return null
  }

  /*
   * q <= qA  <=>  p/e >= pA
   */
  const qStart =
    geometry.qA *
    Math.exp(
      -alpha
    )

  const qEnd =
    geometry.qA *
    Math.exp(
      -beta
    )

  if (
    !(qStart > 0) ||
    !(qEnd > 0) ||
    !Number.isFinite(qStart) ||
    !Number.isFinite(qEnd)
  ) {
    return null
  }

  const p =
    parameterFromQ(
      qStart
    )

  const e =
    parameterFromQ(
      qEnd
    )

  if (
    !Number.isFinite(p) ||
    !Number.isFinite(e) ||
    !(p > 0 && p < 1) ||
    !(e > 0 && e < 1)
  ) {
    return null
  }

  const form =
    formFromAlphaBeta(
      geometry,
      alpha,
      beta
    )

  return {
    p,
    e,

    alpha,
    beta,

    qStart,
    qEnd,

    ...form
  }
}


/* ================================================================
 * Global form optimization
 * ================================================================ */

function optimizeForms(geometry) {
  const n =
    geometry.length

  if (!n) {
    return null
  }

  const alpha =
    new Array(n).fill(0)

  const beta =
    new Array(n).fill(0)

  const mismatch =
    new Array(n)

  /*
   * Ideal local forms generally do not satisfy G² against each other.
   *
   * At join i:
   *
   *   alpha[i] - beta[next] = c[i]
   *
   * Minimize
   *
   *   1/2(alpha² + beta²)
   *
   * with
   *
   *   alpha >= 0
   *   beta  >= 0
   *
   * The solution is the positive part on exactly one side.
   */
  for (
    let i = 0;
    i < n;
    i++
  ) {
    const next =
      (i + 1) % n

    const c =
      Math.log(
        geometry[i].qA *
        geometry[i].Fe /
        (
          geometry[next].qA *
          geometry[next].Fs
        )
      )

    if (
      !Number.isFinite(c)
    ) {
      return null
    }

    mismatch[i] =
      c

    if (c >= 0) {
      /*
       * Increase alpha on segment i.
       */
      alpha[i] =
        c

      /*
       * Keep beta on next segment at its
       * local Artea value.
       */
      beta[next] =
        0
    } else {
      /*
       * Keep alpha on segment i at its
       * local Artea value.
       */
      alpha[i] =
        0

      /*
       * Increase beta on next segment.
       */
      beta[next] =
        -c
    }
  }

  const forms =
    new Array(n)

  const parameters =
    new Array(n)

  for (
    let i = 0;
    i < n;
    i++
  ) {
    const result =
      parametersFromFormDeformation(
        geometry[i],
        alpha[i],
        beta[i]
      )

    if (!result) {
      return null
    }

    forms[i] = {
      R:
        result.R,

      S:
        result.S,

      RA:
        geometry[i].RA,

      SA:
        geometry[i].SA,

      ratioFactor:
        result.R /
        geometry[i].RA,

      sizeFactor:
        result.S /
        geometry[i].SA,

      energy:
        result.energy,

      alpha:
        result.alpha,

      beta:
        result.beta
    }

    parameters[i] = {
      p:
        result.p,

      e:
        result.e,

      qStart:
        result.qStart,

      qEnd:
        result.qEnd
    }
  }

  return {
    alpha,
    beta,
    mismatch,
    forms,
    parameters,

    totalEnergy:
      forms.reduce(
        (
          sum,
          form
        ) =>
          sum +
          form.energy,
        0
      )
  }
}


/* ================================================================
 * Endpoint form scales / G² verification
 * ================================================================ */

function endpointFormScales(
  form
) {
  const start =
    1 /
    (
      form.S *
      Math.pow(
        form.R,
        1.5
      )
    )

  const end =
    Math.pow(
      form.R,
      1.5
    ) /
    form.S

  return {
    start,
    end
  }
}


function g2Errors(
  geometry,
  solution
) {
  const n =
    geometry.length

  const starts =
    new Array(n)

  const ends =
    new Array(n)

  const errors =
    new Array(n)

  for (
    let i = 0;
    i < n;
    i++
  ) {
    const form =
      solution.forms[i]

    const scales =
      endpointFormScales(
        form
      )

    starts[i] =
      scales.start

    ends[i] =
      scales.end
  }

  for (
    let i = 0;
    i < n;
    i++
  ) {
    const next =
      (i + 1) % n

    errors[i] =
      ends[i] -
      starts[next]
  }

  const maxError =
    errors.reduce(
      (
        max,
        value
      ) =>
        Math.max(
          max,
          Math.abs(value)
        ),
      0
    )

  return {
    starts,
    ends,
    errors,
    maxError
  }
}


/* ================================================================
 * Bézier curve
 * ================================================================ */

function makeCurve(
  segment,
  parameters
) {
  const P0 =
    segment.startNode

  const T =
    segment.controlPoint

  const P3 =
    segment.endNode

  const C1 =
    add(
      P0,
      mul(
        sub(
          T,
          P0
        ),
        parameters.p
      )
    )

  const C2 =
    add(
      P3,
      mul(
        sub(
          T,
          P3
        ),
        parameters.e
      )
    )

  return {
    P0,
    C1,
    C2,
    P3
  }
}


/*
 * Safe fallback for unusable segment geometry.
 */
function makeFallbackCurve(
  segment
) {
  const P0 =
    segment.startNode

  const T =
    segment.controlPoint

  const P3 =
    segment.endNode

  if (!T) {
    return null
  }

  const C1 =
    add(
      P0,
      mul(
        sub(
          T,
          P0
        ),
        FALLBACK_PARAMETER
      )
    )

  const C2 =
    add(
      P3,
      mul(
        sub(
          T,
          P3
        ),
        FALLBACK_PARAMETER
      )
    )

  return {
    P0,
    C1,
    C2,
    P3,

    fallback: true
  }
}


/* ================================================================
 * SVG formatting
 * ================================================================ */

function formatNumber(
  value
) {
  if (!Number.isFinite(value)) {
    throw new Error(
      `Attempted to write non-finite SVG number: ${value}`
    )
  }

  return Number(
    value.toFixed(12)
  )
}


function curvesToPath(
  curves,
  closed
) {
  if (!curves.length) {
    return ''
  }

  const first =
    curves[0]

  let d =
    `M ${formatNumber(first.P0.x)} ` +
    `${formatNumber(first.P0.y)}`

  for (
    const curve of curves
  ) {
    d +=
      ` C ${formatNumber(curve.C1.x)} ` +
      `${formatNumber(curve.C1.y)}` +
      ` ${formatNumber(curve.C2.x)} ` +
      `${formatNumber(curve.C2.y)}` +
      ` ${formatNumber(curve.P3.x)} ` +
      `${formatNumber(curve.P3.y)}`
  }

  if (closed) {
    d += ' Z'
  }

  return d
}


function linePath(
  segments,
  closed
) {
  if (!segments.length) {
    return ''
  }

  const first =
    segments[0].startNode

  let d =
    `M ${formatNumber(first.x)} ` +
    `${formatNumber(first.y)}`

  for (
    const segment of segments
  ) {
    d +=
      ` L ${formatNumber(segment.endNode.x)} ` +
      `${formatNumber(segment.endNode.y)}`
  }

  if (closed) {
    d += ' Z'
  }

  return d
}


/* ================================================================
 * Main public API
 * ================================================================ */

export function spline(path) {
  const segments =
    path.getSegments()

  if (!segments.length) {
    return ''
  }

  /*
   * A segment without a T cannot participate
   * in the G² construction.
   */
  if (
    segments.some(
      segment =>
        !segment.controlPoint
    )
  ) {
    return linePath(
      segments,
      path.closed
    )
  }

  /*
   * Calculate reference geometry.
   */
  const geometry =
    segments.map(
      segmentGeometry
    )

  /*
   * Unusable geometry:
   * use a safe Bézier fallback.
   */
  if (
    geometry.some(
      geometryItem =>
        !geometryItem
    )
  ) {
    const fallback =
      segments.map(
        makeFallbackCurve
      )

    if (
      fallback.some(
        curve => !curve
      )
    ) {
      return linePath(
        segments,
        path.closed
      )
    }

    return curvesToPath(
      fallback,
      path.closed
    )
  }

  /*
   * Global FORM optimization.
   *
   * No join-level optimization.
   * No direct curvature calculation.
   * No direct curvature sampling.
   */
  const solution =
    optimizeForms(
      geometry
    )

  if (!solution) {
    return linePath(
      segments,
      path.closed
    )
  }

  /*
   * Reconstruct Bézier control points.
   */
  const curves =
    segments.map(
      (
        segment,
        i
      ) =>
        makeCurve(
          segment,
          solution.parameters[i]
        )
    )

  /*
   * Final finite-number check.
   */
  const invalid =
    curves.some(
      curve =>
        !curve ||
        !Number.isFinite(
          curve.C1.x
        ) ||
        !Number.isFinite(
          curve.C1.y
        ) ||
        !Number.isFinite(
          curve.C2.x
        ) ||
        !Number.isFinite(
          curve.C2.y
        )
    )

  if (invalid) {
    console.warn(
      'Spline produced invalid control points; ' +
      'using safe fallback.'
    )

    const fallback =
      segments.map(
        makeFallbackCurve
      )

    return curvesToPath(
      fallback,
      path.closed
    )
  }

  /*
   * Algebraic G² verification.
   *
   * This checks only the derived endpoint form
   * equations, not curvature directly.
   */
  const verification =
    g2Errors(
      geometry,
      solution
    )

  if (
    verification.maxError >
    G2_EPSILON
  ) {
    console.warn(
      'Spline G² error:',
      verification.maxError
    )
  }

  /*
   * SVG path.
   */
  return curvesToPath(
    curves,
    path.closed
  )
}


/* ================================================================
 * Debug exports
 * ================================================================ */

export {
  arteaParameter,
  segmentGeometry,
  formFromAlphaBeta,
  parametersFromFormDeformation,
  optimizeForms,
  endpointFormScales,
  g2Errors,
  qFromParameter,
  parameterFromQ
}
