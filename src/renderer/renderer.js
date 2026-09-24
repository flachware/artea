import { SVG_NS } from './svg.js'
import { curves } from './curves.js'
import { spline as arteaSpline } from '../artea/spline.js'
import { spline as circleSpline } from '../circle/spline.js'
import { renderNodeHandles, renderSegmentHandles, renderOffCurveHandles } from './handles.js'
import { renderTangents } from './tangents.js'
import { computeOrigin, screenToLogical } from './coordinates.js'

const SPLINE_MODE = { elliptic: circleSpline, artea: arteaSpline }

export class Renderer {
  constructor(container) {
    this.svg = document.createElementNS(SVG_NS, 'svg')
    this.svg.classList.add('canvas')
    this.svg.setAttribute('width', '100%')
    this.svg.setAttribute('height', '100%')

    /*
     * Everything is rendered into this group,
     * which flips Y (up is positive) and moves
     * the origin - see coordinates.js, which
     * the editor uses to convert incoming mouse
     * positions the same way in reverse.
     */
    this.root = document.createElementNS(SVG_NS, 'g')
    this.svg.appendChild(this.root)

    container.appendChild(this.svg)
  }

  updateTransform() {
    const origin = computeOrigin(
      this.svg.clientWidth,
      this.svg.clientHeight
    )

    this.root.setAttribute(
      'transform',
      `translate(${origin.x}, ${origin.y}) scale(1, -1)`
    )
  }

  /*
   * Faint guide lines at the origin. Offset
   * by half a (logical, unscaled) unit so a
   * 1px stroke lands on a single pixel row/
   * column instead of straddling two and
   * blurring.
   */
  renderAxes() {
    const width = this.svg.clientWidth
    const height = this.svg.clientHeight
    const origin = computeOrigin(width, height)

    const topLeft = screenToLogical(origin, 0, 0)
    const bottomRight = screenToLogical(origin, width, height)

    this.renderAxisLine(topLeft.x, 0.5, bottomRight.x, 0.5)
    this.renderAxisLine(0.5, topLeft.y, 0.5, bottomRight.y)
  }

  renderAxisLine(x1, y1, x2, y2) {
    const line = document.createElementNS(SVG_NS, 'line')

    line.setAttribute('x1', x1)
    line.setAttribute('y1', y1)
    line.setAttribute('x2', x2)
    line.setAttribute('y2', y2)
    line.setAttribute('stroke', '#e6e6e6')
    line.setAttribute('stroke-width', '1')
    line.setAttribute('pointer-events', 'none')

    this.root.appendChild(line)
  }

  /*
   * In preview mode, the path/curve itself
   * is rendered as a solid filled shape and
   * everything else - editor UI: handles,
   * tangents, axes, bezier point markers -
   * is left out entirely.
   */
  render(scene, { preview = false } = {}) {
    this.root.replaceChildren()
    this.updateTransform()

    if (!preview) {
      this.renderAxes()
      scene.paths.forEach((path) => renderTangents(this.root, path))
    }

    const handlesByPath = new Map()

    const pathData = new Map()

    scene.paths.forEach((path) => {
      pathData.set(path, this.renderPath(path, preview))

      if (!preview) {
        /*
         * Offcurve handles are rendered after node
         * handles so they stay on top (and clickable)
         * even when T coincides with a node.
         */
        const segmentHandles = renderSegmentHandles(this.root, path)
        const nodeHandles = renderNodeHandles(this.root, path)
        const offCurveHandles = renderOffCurveHandles(this.root, path)

        handlesByPath.set(path, { nodeHandles, segmentHandles, offCurveHandles })
      }
    })

    if (!preview) {
      scene.paths.forEach((path) => {
        this.renderBezierPointMarkers(pathData.get(path))
      })
    }

    return handlesByPath
  }

  renderPath(path, preview) {
    if (path.nodes.length === 0) {
      return ''
    }

    const canSpline = path.scene.pathMode === 'spline' &&
      path.getSegments().every((segment) => segment.controlPoint)

    const { d, failed } = canSpline ? this.renderSpline(path) : { d: curves(path), failed: false }

    const element = document.createElementNS(SVG_NS, 'path')

    element.setAttribute('d', d)

    if (preview) {
      element.setAttribute('fill', '#000')
      element.setAttribute('stroke', 'none')
    } else {
      element.setAttribute('fill', 'none')
      element.setAttribute('stroke', failed ? 'red' : 'black')
      element.setAttribute('stroke-width', '1.1')
    }

    this.root.appendChild(element)

    return d
  }

  renderSpline(path) {
    try {
      return {
        d: SPLINE_MODE[path.scene.curveMode](
          path,
          path.scene.verticalStretch
        ),
        failed: false
      }
    } catch (error) {
      console.warn('Spline construction failed, falling back to curves:', error)

      return { d: curves(path), failed: true }
    }
  }

  renderBezierPointMarkers(d) {
    if (!d) {
      return
    }

    const CURVE_COMMAND = /C\s*(-?[\d.]+)[,\s]+(-?[\d.]+)\s+(-?[\d.]+)[,\s]+(-?[\d.]+)\s+(-?[\d.]+)[,\s]+(-?[\d.]+)/g

    let match

    while ((match = CURVE_COMMAND.exec(d))) {
      this.renderBezierPointMarker(Number(match[1]), Number(match[2]))
      this.renderBezierPointMarker(Number(match[3]), Number(match[4]))
    }
  }

  renderBezierPointMarker(x, y) {
    const circle = document.createElementNS(SVG_NS, 'circle')

    circle.setAttribute('cx', x)
    circle.setAttribute('cy', y)
    circle.setAttribute('r', 2)
    circle.setAttribute('fill', 'black')
    circle.setAttribute('pointer-events', 'none')

    this.root.appendChild(circle)
  }
}
