import { SVG_NS } from './svg.js'
import { curve } from './curves.js'

export function renderNodeHandles(svg, path) {
  return path.nodes
    .filter((node) => node.type !== 'offcurve')
    .map((node) => renderNodeHandle(svg, node))
}

export function renderNodeHandle(svg, node) {
  if (node.smooth === 'smooth') {
    return renderSmoothNodeHandle(svg, node)
  }

  return renderCornerNodeHandle(svg, node)
}

export function renderCornerNodeHandle(svg, node) {
  const size = 8
  const rect = document.createElementNS(SVG_NS, 'rect')

  rect.setAttribute('x', node.x - size / 2)
  rect.setAttribute('y', node.y - size / 2)
  rect.setAttribute('width', size)
  rect.setAttribute('height', size)
  rect.setAttribute('fill', node.selected ? 'black' : 'none')
  rect.setAttribute('stroke', 'black')
  rect.setAttribute('stroke-width', '1.1')
  rect.setAttribute('pointer-events', 'all')

  svg.appendChild(rect)

  return rect
}

export function renderSmoothNodeHandle(svg, node) {
  const size = 10
  const circle = document.createElementNS(SVG_NS, 'circle')

  circle.setAttribute('cx', node.x)
  circle.setAttribute('cy', node.y)
  circle.setAttribute('r', size / 2)
  circle.setAttribute('fill', node.selected ? 'black' : 'none')
  circle.setAttribute('stroke', 'black')
  circle.setAttribute('stroke-width', '1.1')
  circle.setAttribute('pointer-events', 'all')

  svg.appendChild(circle)

  return circle
}

export function renderSegmentHandles(svg, path) {
  return path.getSegments().map((segment) => renderSegmentHandle(svg, path, segment))
}

export function renderSegmentHandle(svg, path, segment) {
  const { startNode } = segment

  const element = document.createElementNS(SVG_NS, 'path')

  element.setAttribute('d', `M${startNode.x},${startNode.y} ${curve(path, segment)}`)
  element.setAttribute('fill', 'none')
  element.setAttribute('stroke', 'transparent')
  element.setAttribute('stroke-width', '8')
  element.setAttribute('pointer-events', 'all')

  svg.appendChild(element)

  return element
}

export function renderOffCurveHandles(svg, path) {
  return path.nodes
    .filter((node) => node.type === 'offcurve')
    .map((node) => renderOffCurveHandle(svg, node))
}

export function renderOffCurveHandle(svg, node) {
  const circle = document.createElementNS(SVG_NS, 'circle')

  circle.setAttribute('cx', node.x)
  circle.setAttribute('cy', node.y)
  circle.setAttribute('r', 4)
  circle.setAttribute('fill', node.selected ? 'black' : 'white')
  circle.setAttribute('stroke', node.selected ? 'black' : '#bbb')
  circle.setAttribute('stroke-width', '1.1')
  circle.setAttribute('pointer-events', 'all')

  svg.appendChild(circle)

  return circle
}
