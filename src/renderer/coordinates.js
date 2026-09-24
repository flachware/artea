/*
 * Editor/logical coordinates: up is
 * positive, down is negative. The origin
 * is centered in the canvas, then shifted
 * further left/down by this much, in
 * screen pixels. Shared by the renderer
 * (which draws logical coordinates onto
 * the screen) and the editor (which
 * converts incoming mouse positions back).
 */
const ORIGIN_OFFSET_X = -250
const ORIGIN_OFFSET_Y = 250

export function computeOrigin(width, height) {
  return {
    x: width / 2 + ORIGIN_OFFSET_X,
    y: height / 2 + ORIGIN_OFFSET_Y
  }
}

export function screenToLogical(origin, screenX, screenY) {
  return {
    x: screenX - origin.x,
    y: origin.y - screenY
  }
}
