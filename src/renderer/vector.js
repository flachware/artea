export function sub(a, b) {
  return {
    x: a.x - b.x,
    y: a.y - b.y
  }
}

export function add(a, b) {
  return {
    x: a.x + b.x,
    y: a.y + b.y
  }
}

export function mul(v, s) {
  return {
    x: v.x * s,
    y: v.y * s
  }
}

export function length(v) {
  return Math.hypot(v.x, v.y)
}

export function dot(a, b) {
  return (
    a.x * b.x +
    a.y * b.y
  )
}

export function normalize(v) {
  const d = length(v)

  if (d < 1e-9) {
    return null
  }

  return {
    x: v.x / d,
    y: v.y / d
  }
}

export function determinant(a, b) {
  return (
    a.x * b.y -
    a.y * b.x
  )
}

export function intersectLines(
  origin1,
  dir1,
  origin2,
  dir2
) {
  const denom =
    determinant(dir1, dir2)

  if (Math.abs(denom) < 1e-9) {
    return null
  }

  const delta =
    sub(origin2, origin1)

  const t =
    determinant(delta, dir2) /
    denom

  return add(
    origin1,
    mul(dir1, t)
  )
}

export function distance(a, b) {
  return length(
    sub(a, b)
  )
}

export function setPoint(point, value) {
  point.x = value.x
  point.y = value.y
}
