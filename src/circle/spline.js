/*
 * spline.js
 *
 * Closed cubic Bézier G² spline, circle variant.
 *
 * Same FORM-space construction as artea/spline.js, but the local
 * reference parameter p is always the constant value returned by
 * circle/curve.js, independent of a segment's own geometry.
 *
 * Segment geometry:
 *
 *   a = |T-P0|
 *   b = |T-P3|
 *   r = a / b
 *   s = sqrt(a*b)
 *
 * Local reference:
 *
 *   p = curve(P0, T, P3)
 *   q = (1-p)/p²
 *
 * Exact endpoint form factors:
 *
 *   Fs = 1/s * r^(-3/2)
 *   Fe = 1/s * r^(+3/2)
 *
 * Form deformation coordinates:
 *
 *   alpha = log(q/qStart) >= 0
 *   beta  = log(q/qEnd)   >= 0
 *
 * G² at a join is
 *
 *   Je[i] = Js[i+1]
 *
 * which in alpha/beta coordinates becomes
 *
 *   alpha[i] - beta[i+1] = c[i]
 *
 * where
 *
 *   c[i] = log(q[i] * Fe[i] / (q[i+1] * Fs[i+1]))
 *
 * and the closed-form minimizer of sum(1/2(alpha²+beta²)) is
 *
 *   if c >= 0: alpha = c, beta = 0
 *   if c <  0: alpha = 0, beta = -c
 */

import { curve } from './curve.js'

const EPSILON = 1e-12
const G2_EPSILON = 1e-9

/*
 * Temporary fallback only. This is not part of the G² construction.
 */
const FALLBACK_PARAMETER = 1 / 3


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
 * Segment geometry
 * ================================================================ */

function segmentGeometry(segment) {
  const P0 = segment.startNode
  const T = segment.controlPoint
  const P3 = segment.endNode

  if (!T) {
    return null
  }

  const a = length(sub(T, P0))
  const b = length(sub(T, P3))

  if (
    !Number.isFinite(a) ||
    !Number.isFinite(b) ||
    a < EPSILON ||
    b < EPSILON
  ) {
    return null
  }

  const r = a / b
  const s = Math.sqrt(a * b)

  if (
    !Number.isFinite(r) ||
    !Number.isFinite(s) ||
    r <= 0 ||
    s <= 0
  ) {
    return null
  }

  const p = curve(P0, T, P3)

  if (!(p > 0 && p < 1) || !Number.isFinite(p)) {
    return null
  }

  const q = qFromParameter(p)

  const Fs = 1 / s * Math.pow(r, -1.5)
  const Fe = 1 / s * Math.pow(r, 1.5)

  const RA = r
  const SA = s / q

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

    q,

    Fs,
    Fe,

    RA,
    SA
  }
}


/* ================================================================
 * Form conversion
 * ================================================================ */

function formFromAlphaBeta(geometry, alpha, beta) {
  const R = geometry.RA * Math.exp((beta - alpha) / 3)
  const S = geometry.SA * Math.exp((alpha + beta) / 2)

  return {
    R,
    S,

    energy: 0.5 * (alpha * alpha + beta * beta)
  }
}

function parametersFromFormDeformation(geometry, alpha, beta) {
  if (
    !Number.isFinite(alpha) ||
    !Number.isFinite(beta) ||
    alpha < 0 ||
    beta < 0
  ) {
    return null
  }

  const qStart = geometry.q * Math.exp(-alpha)
  const qEnd = geometry.q * Math.exp(-beta)

  if (
    !(qStart > 0) ||
    !(qEnd > 0) ||
    !Number.isFinite(qStart) ||
    !Number.isFinite(qEnd)
  ) {
    return null
  }

  const p = parameterFromQ(qStart)
  const e = parameterFromQ(qEnd)

  if (
    !Number.isFinite(p) ||
    !Number.isFinite(e) ||
    !(p > 0 && p < 1) ||
    !(e > 0 && e < 1)
  ) {
    return null
  }

  const form = formFromAlphaBeta(geometry, alpha, beta)

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
  const n = geometry.length

  if (!n) {
    return null
  }

  const alpha = new Array(n).fill(0)
  const beta = new Array(n).fill(0)
  const mismatch = new Array(n)

  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n

    const c = Math.log(
      geometry[i].q * geometry[i].Fe /
      (geometry[next].q * geometry[next].Fs)
    )

    if (!Number.isFinite(c)) {
      return null
    }

    mismatch[i] = c

    if (c >= 0) {
      alpha[i] = c
      beta[next] = 0
    } else {
      alpha[i] = 0
      beta[next] = -c
    }
  }

  const forms = new Array(n)
  const parameters = new Array(n)

  for (let i = 0; i < n; i++) {
    const result = parametersFromFormDeformation(geometry[i], alpha[i], beta[i])

    if (!result) {
      return null
    }

    forms[i] = {
      R: result.R,
      S: result.S,

      RA: geometry[i].RA,
      SA: geometry[i].SA,

      ratioFactor: result.R / geometry[i].RA,
      sizeFactor: result.S / geometry[i].SA,

      energy: result.energy,

      alpha: result.alpha,
      beta: result.beta
    }

    parameters[i] = {
      p: result.p,
      e: result.e,

      qStart: result.qStart,
      qEnd: result.qEnd
    }
  }

  return {
    alpha,
    beta,
    mismatch,
    forms,
    parameters,

    totalEnergy: forms.reduce((sum, form) => sum + form.energy, 0)
  }
}


/* ================================================================
 * Endpoint form scales / G² verification
 * ================================================================ */

function endpointFormScales(form) {
  const start = 1 / (form.S * Math.pow(form.R, 1.5))
  const end = Math.pow(form.R, 1.5) / form.S

  return {
    start,
    end
  }
}

function g2Errors(geometry, solution) {
  const n = geometry.length

  const starts = new Array(n)
  const ends = new Array(n)
  const errors = new Array(n)

  for (let i = 0; i < n; i++) {
    const scales = endpointFormScales(solution.forms[i])

    starts[i] = scales.start
    ends[i] = scales.end
  }

  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n

    errors[i] = ends[i] - starts[next]
  }

  const maxError = errors.reduce(
    (max, value) => Math.max(max, Math.abs(value)),
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

function makeCurve(segment, parameters) {
  const P0 = segment.startNode
  const T = segment.controlPoint
  const P3 = segment.endNode

  const C1 = add(P0, mul(sub(T, P0), parameters.p))
  const C2 = add(P3, mul(sub(T, P3), parameters.e))

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
function makeFallbackCurve(segment) {
  const P0 = segment.startNode
  const T = segment.controlPoint
  const P3 = segment.endNode

  if (!T) {
    return null
  }

  const C1 = add(P0, mul(sub(T, P0), FALLBACK_PARAMETER))
  const C2 = add(P3, mul(sub(T, P3), FALLBACK_PARAMETER))

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

function formatNumber(value) {
  if (!Number.isFinite(value)) {
    throw new Error(
      `Attempted to write non-finite SVG number: ${value}`
    )
  }

  return Number(value.toFixed(12))
}

function curvesToPath(curves, closed) {
  if (!curves.length) {
    return ''
  }

  const first = curves[0]

  let d = `M ${formatNumber(first.P0.x)} ${formatNumber(first.P0.y)}`

  for (const curve of curves) {
    d +=
      ` C ${formatNumber(curve.C1.x)} ${formatNumber(curve.C1.y)}` +
      ` ${formatNumber(curve.C2.x)} ${formatNumber(curve.C2.y)}` +
      ` ${formatNumber(curve.P3.x)} ${formatNumber(curve.P3.y)}`
  }

  if (closed) {
    d += ' Z'
  }

  return d
}

function linePath(segments, closed) {
  if (!segments.length) {
    return ''
  }

  const first = segments[0].startNode

  let d = `M ${formatNumber(first.x)} ${formatNumber(first.y)}`

  for (const segment of segments) {
    d += ` L ${formatNumber(segment.endNode.x)} ${formatNumber(segment.endNode.y)}`
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
  const segments = path.getSegments()

  if (!segments.length) {
    return ''
  }

  if (segments.some(segment => !segment.controlPoint)) {
    return linePath(segments, path.closed)
  }

  const geometry = segments.map(segmentGeometry)

  if (geometry.some(geometryItem => !geometryItem)) {
    const fallback = segments.map(makeFallbackCurve)

    if (fallback.some(curve => !curve)) {
      return linePath(segments, path.closed)
    }

    return curvesToPath(fallback, path.closed)
  }

  const solution = optimizeForms(geometry)

  if (!solution) {
    return linePath(segments, path.closed)
  }

  const curves = segments.map((segment, i) => makeCurve(segment, solution.parameters[i]))

  const invalid = curves.some(curve =>
    !curve ||
    !Number.isFinite(curve.C1.x) ||
    !Number.isFinite(curve.C1.y) ||
    !Number.isFinite(curve.C2.x) ||
    !Number.isFinite(curve.C2.y)
  )

  if (invalid) {
    console.warn('Spline produced invalid control points; using safe fallback.')

    const fallback = segments.map(makeFallbackCurve)

    return curvesToPath(fallback, path.closed)
  }

  const verification = g2Errors(geometry, solution)

  if (verification.maxError > G2_EPSILON) {
    console.warn('Spline G² error:', verification.maxError)
  }

  return curvesToPath(curves, path.closed)
}


/* ================================================================
 * Debug exports
 * ================================================================ */

export {
  segmentGeometry,
  formFromAlphaBeta,
  parametersFromFormDeformation,
  optimizeForms,
  endpointFormScales,
  g2Errors,
  qFromParameter,
  parameterFromQ
}
