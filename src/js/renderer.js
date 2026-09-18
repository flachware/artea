const SVG_NS = 'http://www.w3.org/2000/svg'

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
      scene.paths.forEach((path) => this.renderTangents(path))
    }

    const handlesByPath = new Map()

    scene.paths.forEach((path) => {
      this.renderPath(path)

      if (showHandles) {
        const segmentHandles = this.renderSegmentHandles(path)
        const offCurveHandles = this.renderOffCurveHandles(path)
        const nodeHandles = this.renderNodeHandles(path)

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

    element.setAttribute('d', this.pathData(path))
    element.setAttribute('fill', 'none')
    element.setAttribute('stroke', 'black')
    element.setAttribute('stroke-width', '1.1')

    this.svg.appendChild(element)
  }

  pathData(path) {
    const first = path.nodes[0]
    const commands = path.getSegments().map((segment) => this.segmentCommand(path, segment))

    return [`M${first.x},${first.y}`, ...commands].join(' ')
  }

  segmentCommand(path, segment) {
    const { startNode, controlPoint, endNode } = segment

    if (controlPoint) {
      const { cp1, cp2 } = path.resolve(startNode, controlPoint, endNode)

      return `C${cp1.x},${cp1.y} ${cp2.x},${cp2.y} ${endNode.x},${endNode.y}`
    }

    return `L${endNode.x},${endNode.y}`
  }

  renderNodeHandles(path) {
    return path.nodes
      .filter((node) => node.type !== 'offcurve')
      .map((node) => this.renderNodeHandle(node))
  }

  renderNodeHandle(node) {
    if (node.smooth === 'smooth') {
      return this.renderSmoothNodeHandle(node)
    }

    return this.renderCornerNodeHandle(node)
  }

  renderCornerNodeHandle(node) {
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

    this.svg.appendChild(rect)

    return rect
  }

  renderSmoothNodeHandle(node) {
    const size = 10
    const circle = document.createElementNS(SVG_NS, 'circle')

    circle.setAttribute('cx', node.x)
    circle.setAttribute('cy', node.y)
    circle.setAttribute('r', size / 2)
    circle.setAttribute('fill', node.selected ? 'black' : 'none')
    circle.setAttribute('stroke', 'black')
    circle.setAttribute('stroke-width', '1.1')
    circle.setAttribute('pointer-events', 'all')

    this.svg.appendChild(circle)

    return circle
  }

  renderSegmentHandles(path) {
    return path.getSegments().map((segment) => this.renderSegmentHandle(path, segment))
  }

  renderSegmentHandle(path, segment) {
    const { startNode } = segment

    const element = document.createElementNS(SVG_NS, 'path')

    element.setAttribute('d', `M${startNode.x},${startNode.y} ${this.segmentCommand(path, segment)}`)
    element.setAttribute('fill', 'none')
    element.setAttribute('stroke', 'transparent')
    element.setAttribute('stroke-width', '8')
    element.setAttribute('pointer-events', 'all')

    this.svg.appendChild(element)

    return element
  }

  renderOffCurveHandles(path) {
    return path.nodes
      .filter((node) => node.type === 'offcurve')
      .map((node) => this.renderOffCurveHandle(node))
  }

  renderOffCurveHandle(node) {
    const circle = document.createElementNS(SVG_NS, 'circle')

    circle.setAttribute('cx', node.x)
    circle.setAttribute('cy', node.y)
    circle.setAttribute('r', 4)
    circle.setAttribute('fill', node.selected ? 'black' : 'white')
    circle.setAttribute('stroke', node.selected ? 'black' : '#bbb')
    circle.setAttribute('stroke-width', '1.1')
    circle.setAttribute('pointer-events', 'all')

    this.svg.appendChild(circle)

    return circle
  }

  renderTangents(path) {
    path.getSegments().forEach((segment) => {
      if (!segment.controlPoint) {
        return
      }

      this.renderTangent(segment.startNode, segment.controlPoint)
      this.renderTangent(segment.endNode, segment.controlPoint)
    })
  }

  renderTangent(from, to) {
    const line = document.createElementNS(SVG_NS, 'line')

    line.setAttribute('x1', from.x)
    line.setAttribute('y1', from.y)
    line.setAttribute('x2', to.x)
    line.setAttribute('y2', to.y)
    line.setAttribute('stroke', '#bbb')
    line.setAttribute('stroke-width', '1')
    line.setAttribute('pointer-events', 'none')

    this.svg.appendChild(line)

    return line
  }
}
