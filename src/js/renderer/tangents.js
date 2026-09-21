import { SVG_NS } from './svg.js'

export function renderTangents(svg, path) {
  path.getSegments().forEach((segment) => {
    if (!segment.controlPoint) {
      return
    }

    renderTangent(svg, segment.startNode, segment.controlPoint)
    renderTangent(svg, segment.endNode, segment.controlPoint)
  })
}

export function renderTangent(svg, from, to) {
  const line = document.createElementNS(SVG_NS, 'line')

  line.setAttribute('x1', from.x)
  line.setAttribute('y1', from.y)
  line.setAttribute('x2', to.x)
  line.setAttribute('y2', to.y)
  line.setAttribute('stroke', '#bbb')
  line.setAttribute('stroke-width', '1')
  line.setAttribute('pointer-events', 'none')

  svg.appendChild(line)

  return line
}
