export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function cbrt(value) {
  if (value === 0) return 0
  return Math.sign(value) * Math.pow(Math.abs(value), 1 / 3)
}

export function uniqueNumbers(values, tolerance = 1e-10) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
  const result = []

  for (const value of sorted) {
    const last = result[result.length - 1]

    if (!result.length || Math.abs(value - last) > tolerance) {
      result.push(value)
    }
  }

  return result
}
