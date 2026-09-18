import { elliptic } from './elliptic.js'
import { artea } from './artea.js'

const SNAP_THRESHOLD = 10
const CURVE_MODE = { elliptic, artea }

class Path {
  constructor(scene) {
    this.scene = scene
    this.nodes = []
    this.selected = false
    this.closed = false
  }

  addNode(x, y) {
    const node = { x, y, type: 'line', smooth: null, selected: false }

    this.nodes.push(node)

    return node
  }

  toggleSmooth(node) {
    if (node.smooth !== 'smooth' && !this.hasAdjacentOffCurveNode(node)) {
      return
    }

    node.smooth = node.smooth === 'smooth' ? null : 'smooth'

    this.constrain()
  }

  hasAdjacentOffCurveNode(node) {
    return this.getSegments().some((segment) =>
      segment.controlPoint && (segment.startNode === node || segment.endNode === node)
    )
  }

  getTangent(node, segment) {
    const other = segment.startNode === node ? segment.endNode : segment.startNode

    if (segment.controlPoint) {
      const dx = segment.controlPoint.x - node.x
      const dy = segment.controlPoint.y - node.y
      const dist = Math.hypot(dx, dy) || 1

      return { dir: { x: dx / dist, y: dy / dist }, dist }
    }

    const dx = other.x - node.x
    const dy = other.y - node.y
    const dist = Math.hypot(dx, dy) || 1

    return { dir: { x: dx / dist, y: dy / dist }, dist: dist / 2 }
  }

  setControlPoint(controlPoint, node, dir, dist) {
    controlPoint.x = node.x + dir.x * dist
    controlPoint.y = node.y + dir.y * dist
  }

  intersectLines(origin1, dir1, origin2, dir2) {
    const denom = dir1.x * dir2.y - dir1.y * dir2.x

    if (Math.abs(denom) < 1e-6) {
      return null
    }

    const dx = origin2.x - origin1.x
    const dy = origin2.y - origin1.y
    const t = (dx * dir2.y - dy * dir2.x) / denom

    return { x: origin1.x + dir1.x * t, y: origin1.y + dir1.y * t }
  }

  constrain(movedPoint = null) {
    if (movedPoint) {
      this.constrainAroundMovedPoint(movedPoint)
      return
    }

    const segments = this.getSegments()

    for (let pass = 0; pass < segments.length; pass++) {
      segments.forEach((segment, index) => {
        const node = segment.endNode

        if (node.smooth !== 'smooth') {
          return
        }

        const next = segments[index + 1] || (this.closed ? segments[0] : null)

        if (!next || !next.controlPoint) {
          return
        }

        const sourceTangent = this.getTangent(node, segment)
        const targetTangent = this.getTangent(node, next)
        const dir = { x: -sourceTangent.dir.x, y: -sourceTangent.dir.y }

        this.setControlPoint(next.controlPoint, node, dir, targetTangent.dist)
      })
    }
  }

  constrainAroundMovedPoint(movedPoint) {
    const segments = this.getSegments()
    const segment = segments.find((s) => s.controlPoint === movedPoint)

    if (!segment) {
      return
    }

    this.constrainNodeAgainst(segments, segment.startNode, segment)
    this.constrainNodeAgainst(segments, segment.endNode, segment)
  }

  constrainNodeAgainst(segments, node, changedSegment) {
    if (node.smooth !== 'smooth') {
      return
    }

    const otherSegment = segments.find((s) =>
      s !== changedSegment && (s.startNode === node || s.endNode === node)
    )

    if (!otherSegment || !otherSegment.controlPoint) {
      return
    }

    const changedTangent = this.getTangent(node, changedSegment)
    const requiredDir = { x: -changedTangent.dir.x, y: -changedTangent.dir.y }

    const farNode = otherSegment.startNode === node ? otherSegment.endNode : otherSegment.startNode
    const farTangent = this.getTangent(farNode, otherSegment)

    const point = this.intersectLines(node, requiredDir, farNode, farTangent.dir)
    const isForward = point &&
      (point.x - node.x) * requiredDir.x + (point.y - node.y) * requiredDir.y > 0

    if (isForward) {
      otherSegment.controlPoint.x = point.x
      otherSegment.controlPoint.y = point.y
      return
    }

    const otherTangent = this.getTangent(node, otherSegment)

    this.setControlPoint(otherSegment.controlPoint, node, requiredDir, otherTangent.dist)
  }

  close() {
    this.closed = true
  }

  snapPoint(point, nodeA, nodeB) {
    const snapped = { x: point.x, y: point.y }

    if (Math.abs(point.x - nodeA.x) < SNAP_THRESHOLD) {
      snapped.x = nodeA.x
    } else if (Math.abs(point.x - nodeB.x) < SNAP_THRESHOLD) {
      snapped.x = nodeB.x
    }

    if (Math.abs(point.y - nodeA.y) < SNAP_THRESHOLD) {
      snapped.y = nodeA.y
    } else if (Math.abs(point.y - nodeB.y) < SNAP_THRESHOLD) {
      snapped.y = nodeB.y
    }

    return snapped
  }

  moveNode(node, x, y) {
    if (node.type === 'offcurve') {
      const segment = this.getSegments().find((s) => s.controlPoint === node)
      const point = segment ? this.snapPoint({ x, y }, segment.startNode, segment.endNode) : { x, y }

      node.x = point.x
      node.y = point.y

      this.constrain(node)

      return
    }

    const segments = this.getSegments()

    const touching = segments
      .filter((segment) => segment.controlPoint && (segment.startNode === node || segment.endNode === node))
      .map((segment) => {
        const farNode = segment.startNode === node ? segment.endNode : segment.startNode

        return {
          segment,
          ownTangent: this.getTangent(node, segment),
          farNode,
          farTangent: this.getTangent(farNode, segment)
        }
      })

    node.x = x
    node.y = y

    touching.forEach(({ segment, ownTangent, farNode, farTangent }) => {
      const point = this.intersectLines(node, ownTangent.dir, farNode, farTangent.dir)

      if (point) {
        segment.controlPoint.x = point.x
        segment.controlPoint.y = point.y
        return
      }

      this.setControlPoint(segment.controlPoint, node, ownTangent.dir, ownTangent.dist)
    })

    this.constrain(node)
  }

  getSegments() {
    const segments = []

    let previousEndNode = this.nodes[0]
    let i = 1

    while (i < this.nodes.length) {
      const node = this.nodes[i]

      if (node.type === 'offcurve') {
        const controlPoint = node
        const endNode = this.nodes[i + 1]

        if (!endNode) {
          if (this.closed) {
            segments.push({ startNode: previousEndNode, controlPoint, endNode: this.nodes[0], insertIndex: i })
          }

          return segments
        }

        segments.push({ startNode: previousEndNode, controlPoint, endNode, insertIndex: i })
        previousEndNode = endNode
        i += 2
      } else {
        segments.push({ startNode: previousEndNode, controlPoint: null, endNode: node, insertIndex: i })
        previousEndNode = node
        i += 1
      }
    }

    if (this.closed) {
      segments.push({
        startNode: previousEndNode,
        controlPoint: null,
        endNode: this.nodes[0],
        insertIndex: this.nodes.length
      })
    }

    return segments
  }

  convertSegmentToCurve(segmentIndex) {
    const segment = this.getSegments()[segmentIndex]

    if (!segment || segment.controlPoint) {
      return
    }

    const { startNode, endNode, insertIndex } = segment

    const controlPoint = {
      x: (startNode.x + endNode.x) / 2,
      y: (startNode.y + endNode.y) / 2,
      type: 'offcurve',
      selected: false
    }

    this.nodes.splice(insertIndex, 0, controlPoint)

    endNode.type = 'curve'
  }

  resolve(p0, p1, p2) {
    const speed = this.scene.speed(p0, p1, p2)

    return {
      p0,
      cp1: {
        x: p0.x + speed * (p1.x - p0.x),
        y: p0.y + speed * (p1.y - p0.y)
      },
      cp2: {
        x: p2.x + speed * (p1.x - p2.x),
        y: p2.y + speed * (p1.y - p2.y)
      },
      p3: p2
    }
  }
}

export class Scene {
  constructor(curveMode = 'elliptic') {
    this.paths = []
    this.curveMode = curveMode
  }

  speed(p0, p1, p2) {
    return CURVE_MODE[this.curveMode](p0, p1, p2)
  }

  addPath() {
    const path = new Path(this)

    this.paths.push(path)

    return path
  }
}
