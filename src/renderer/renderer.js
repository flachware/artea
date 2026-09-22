import { SVG_NS } from './svg.js'
import { curves } from './curves.js'
import { spline as arteaSpline } from '../artea/spline.js'
import { spline as circleSpline } from '../circle/spline.js'
import { renderNodeHandles, renderSegmentHandles, renderOffCurveHandles } from './handles.js'
import { renderTangents } from './tangents.js'

const SPLINE_MODE = { elliptic: circleSpline, artea: arteaSpline }

export class Renderer {
  constructor(container) {
    this.svg = document.createElementNS(SVG_NS, 'svg')
    this.svg.classList.add('canvas')
    this.svg.setAttribute('width', '100%')
    this.svg.setAttribute('height', '100%')

    container.appendChild(this.svg)
  }

  render(scene, showHandles) {
    this.svg.replaceChildren()

    if (showHandles) {
      scene.paths.forEach((path) => renderTangents(this.svg, path))
    }

    const handlesByPath = new Map()

    const pathData = new Map()

    scene.paths.forEach((path) => {
      pathData.set(path, this.renderPath(path))

      if (showHandles) {
        const segmentHandles = renderSegmentHandles(this.svg, path)
        const offCurveHandles = renderOffCurveHandles(this.svg, path)
        const nodeHandles = renderNodeHandles(this.svg, path)

        handlesByPath.set(path, { nodeHandles, segmentHandles, offCurveHandles })
      }
    })

    scene.paths.forEach((path) => {
      this.renderBezierPointMarkers(pathData.get(path))
    })

    return handlesByPath
  }

  renderPath(path) {
    if (path.nodes.length === 0) {
      return ''
    }

    const canSpline = path.scene.pathMode === 'spline' &&
      path.getSegments().every((segment) => segment.controlPoint)

    const { d, failed } = canSpline ? this.renderSpline(path) : { d: curves(path), failed: false }

    const element = document.createElementNS(SVG_NS, 'path')

    element.setAttribute('d', d)
    element.setAttribute('fill', 'none')
    element.setAttribute('stroke', failed ? 'red' : 'black')
    element.setAttribute('stroke-width', '1.1')

    this.svg.appendChild(element)

    return d
  }

  renderSpline(path) {
    try {
      return { d: SPLINE_MODE[path.scene.curveMode](path), failed: false }
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

    this.svg.appendChild(circle)
  }
}
