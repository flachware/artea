/*
 * A standard 4-node circle, described as
 * plain coordinates - each point's own
 * controlPoint is the T for the segment
 * starting at that point (going to the
 * next point, wrapping around since the
 * path is closed). Values are the
 * canonical tangent-corner geometry (each
 * T sits where the two axis-aligned
 * tangent lines of its quadrant meet).
 * Works unchanged in either curve mode -
 * the actual Bezier parameters are derived
 * from this geometry at render time.
 */
export const name = 'Optical Circle'

export const anisotropy = 11

export const closed = true

export const points = [
  { x: 512, y: 250, smooth: true, controlPoint: { x: 512, y: 512 } },
  { x: 250, y: 512, smooth: true, controlPoint: { x: -12, y: 512 } },
  { x: -12, y: 250, smooth: true, controlPoint: { x: -12, y: -12 } },
  { x: 250, y: -12, smooth: true, controlPoint: { x: 512, y: -12 } }
]
