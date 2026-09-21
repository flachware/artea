import { SVG_NS } from './svg.js'
import { curves } from './curves.js'
import { spline } from './spline.js'
import { renderNodeHandles, renderSegmentHandles, renderOffCurveHandles } from './handles.js'
import { renderTangents } from './tangents.js'

const PATH_MODE = { curve: curves, spline }

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

    scene.paths.forEach((path) => {
      this.renderPath(path)

      if (showHandles) {
        const segmentHandles = renderSegmentHandles(this.svg, path)
        const offCurveHandles = renderOffCurveHandles(this.svg, path)
        const nodeHandles = renderNodeHandles(this.svg, path)

        handlesByPath.set(path, { nodeHandles, segmentHandles, offCurveHandles })
      }
    })

    return handlesByPath
  }

  renderPath(path) {
    if (path.nodes.length === 0) {
      return
    }

    const element = document.createElementNS(SVG_NS, 'path')
    const d = PATH_MODE[path.scene.pathMode](path)

    element.setAttribute('d', d)
    element.setAttribute('fill', 'none')
    element.setAttribute('stroke', 'black')
    element.setAttribute('stroke-width', '1.1')

    this.svg.appendChild(element)
  }
}
