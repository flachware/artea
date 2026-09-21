import { Path } from './renderer/path.js'
import { curve as elliptic } from './circle/curve.js'
import { curve as artea } from './artea/curve.js'

const CURVE_MODE = {
  elliptic,
  artea
}

const EPSILON = 1e-9

function sub(a, b) {
  return {
    x: a.x - b.x,
    y: a.y - b.y
  }
}

function add(a, b) {
  return {
    x: a.x + b.x,
    y: a.y + b.y
  }
}

function mul(a, s) {
  return {
    x: a.x * s,
    y: a.y * s
  }
}

function length(v) {
  return Math.hypot(v.x, v.y)
}

function normalize(v) {
  const len = length(v)

  if (len < EPSILON) {
    return null
  }

  return {
    x: v.x / len,
    y: v.y / len
  }
}

function determinant(a, b) {
  return a.x * b.y - a.y * b.x
}

function intersectLines(origin1, dir1, origin2, dir2) {
  const denominator = determinant(dir1, dir2)

  if (Math.abs(denominator) < EPSILON) {
    return null
  }

  const delta = sub(origin2, origin1)
  const t = determinant(delta, dir2) / denominator

  return add(origin1, mul(dir1, t))
}

function setPoint(point, value) {
  point.x = value.x
  point.y = value.y
}

function getAdjacentSegments(segments, path, node) {
  const incoming = segments.find(segment => {
    if (segment.endNode === node) {
      return true
    }

    if (
      path.closed &&
      segment.endNode === path.nodes[0] &&
      node === path.nodes[0]
    ) {
      return true
    }

    return false
  })

  const outgoing = segments.find(segment => {
    return segment.startNode === node
  })

  return {
    incoming,
    outgoing
  }
}

function getChordDirection(segments, path, node) {
  const { incoming, outgoing } =
    getAdjacentSegments(segments, path, node)

  const directions = []

  if (incoming) {
    const other =
      incoming.startNode === node
        ? incoming.endNode
        : incoming.startNode

    const direction = normalize(
      sub(other, node)
    )

    if (direction) {
      directions.push(direction)
    }
  }

  if (outgoing) {
    const other =
      outgoing.startNode === node
        ? outgoing.endNode
        : outgoing.startNode

    const direction = normalize(
      sub(other, node)
    )

    if (direction) {
      directions.push(direction)
    }
  }

  if (!directions.length) {
    return null
  }

  if (directions.length === 1) {
    return directions[0]
  }

  const direction = normalize(
    add(directions[0], directions[1])
  )

  return direction || directions[0]
}

function getExistingDirection(segments, path, node) {
  const { incoming, outgoing } =
    getAdjacentSegments(segments, path, node)

  const directions = []

  /*
   * Eingehendes Segment:
   *
   * Der Tangentenarm des Segments läuft vom
   * Node zurück zum Tangentenschnittpunkt.
   *
   * Deshalb:
   *
   *     Node <- T
   *
   * Richtung = Node - T
   */
  if (incoming && incoming.controlPoint) {
    const direction = normalize(
      sub(node, incoming.controlPoint)
    )

    if (direction) {
      directions.push(direction)
    }
  }

  /*
   * Ausgehendes Segment:
   *
   * Der Tangentenarm läuft vom Node zu T.
   *
   * Deshalb:
   *
   *     Node -> T
   *
   * Richtung = T - Node
   */
  if (outgoing && outgoing.controlPoint) {
    const direction = normalize(
      sub(outgoing.controlPoint, node)
    )

    if (direction) {
      directions.push(direction)
    }
  }

  if (!directions.length) {
    return null
  }

  if (directions.length === 1) {
    return directions[0]
  }

  /*
   * Beide Richtungen müssen dieselbe Tangente
   * beschreiben. Bei einem bereits vorhandenen
   * glatten Node mitteln wir nur die beiden
   * Richtungsvektoren.
   */
  const direction = normalize(
    add(directions[0], directions[1])
  )

  return direction || directions[0]
}

function getNodeDirection(segments, path, node) {
  const existing = getExistingDirection(
    segments,
    path,
    node
  )

  if (existing) {
    return existing
  }

  return getChordDirection(
    segments,
    path,
    node
  )
}

/*
 * Verschiebt den vorhandenen Tangentenschnittpunkt
 * entlang der vom Node vorgegebenen Tangente.
 *
 * Die bisherige Entfernung des T vom Node bleibt
 * erhalten.
 */
function preserveHandlePosition(
  segment,
  node,
  direction
) {
  if (!segment.controlPoint || !direction) {
    return
  }

  const distance = length(
    sub(segment.controlPoint, node)
  )

  if (distance < EPSILON) {
    return
  }

  const point = add(
    node,
    mul(direction, distance)
  )

  setPoint(
    segment.controlPoint,
    point
  )
}

function constrainSegment(segment, directions) {
  if (!segment.controlPoint) {
    return
  }

  const startSmooth =
    segment.startNode.smooth === 'smooth' &&
    directions.has(segment.startNode)

  const endSmooth =
    segment.endNode.smooth === 'smooth' &&
    directions.has(segment.endNode)

  /*
   * Beide Nodes smooth:
   *
   * Die beiden Tangenten schneiden sich in T.
   * T ist der gemeinsame Tangentenschnittpunkt
   * des Segments.
   */
  if (startSmooth && endSmooth) {
    const point = intersectLines(
      segment.startNode,
      directions.get(segment.startNode),
      segment.endNode,
      directions.get(segment.endNode)
    )

    if (point) {
      setPoint(
        segment.controlPoint,
        point
      )
    }

    return
  }

  /*
   * Nur Start-Node smooth:
   *
   * T bleibt auf der Tangente des Start-Nodes.
   * Seine bisherige Entfernung zum Node bleibt
   * erhalten.
   */
  if (startSmooth) {
    preserveHandlePosition(
      segment,
      segment.startNode,
      directions.get(segment.startNode)
    )

    return
  }

  /*
   * Nur End-Node smooth:
   *
   * T liegt hinter dem End-Node, also in der
   * entgegengesetzten Richtung der gespeicherten
   * Vorwärtsrichtung.
   */
  if (endSmooth) {
    const direction = directions.get(segment.endNode)

    preserveHandlePosition(
      segment,
      segment.endNode,
      direction && mul(direction, -1)
    )
  }
}

function constrainMovedHandle(
  segments,
  path,
  movedPoint
) {
  const changedSegment = segments.find(
    segment =>
      segment.controlPoint === movedPoint
  )

  if (!changedSegment) {
    return
  }

  const nodes = [
    changedSegment.startNode,
    changedSegment.endNode
  ]

  nodes.forEach(node => {
    if (node.smooth !== 'smooth') {
      return
    }

    /*
     * Der vom Benutzer bewegte T bestimmt die
     * Tangentenrichtung an diesem Node.
     *
     * Bei einem Start-Node:
     *
     *     Node -> T
     *
     * Bei einem End-Node:
     *
     *     Node <- T
     *
     * Beide müssen geometrisch dieselbe Tangente
     * repräsentieren.
     */
    let direction

    if (changedSegment.startNode === node) {
      direction = normalize(
        sub(movedPoint, node)
      )
    } else {
      direction = normalize(
        sub(node, movedPoint)
      )
    }

    if (!direction) {
      return
    }

    const {
      incoming,
      outgoing
    } = getAdjacentSegments(
      segments,
      path,
      node
    )

    const otherSegment =
      incoming === changedSegment
        ? outgoing
        : incoming

    if (
      !otherSegment ||
      !otherSegment.controlPoint
    ) {
      return
    }

    const farNode =
      otherSegment.startNode === node
        ? otherSegment.endNode
        : otherSegment.startNode

    let farDirection

    if (otherSegment.startNode === farNode) {
      farDirection = normalize(
        sub(
          otherSegment.controlPoint,
          farNode
        )
      )
    } else {
      farDirection = normalize(
        sub(
          farNode,
          otherSegment.controlPoint
        )
      )
    }

    if (!farDirection) {
      return
    }

    const point = intersectLines(
      node,
      direction,
      farNode,
      farDirection
    )

    if (!point) {
      return
    }

    setPoint(
      otherSegment.controlPoint,
      point
    )
  })
}

function constrainPath(
  path,
  movedPoint = null
) {
  const segments = path.getSegments()

  if (!segments.length) {
    return
  }

  /*
   * Ein direkt bewegter Curve-Handle definiert
   * die Tangente. Die gegenüberliegende Seite
   * wird daran angepasst.
   */
  if (movedPoint) {
    if (movedPoint.type === 'offcurve') {
      constrainMovedHandle(
        segments,
        path,
        movedPoint
      )
    }

    return
  }

  const smoothNodes = new Set()

  segments.forEach(segment => {
    if (
      segment.startNode.smooth === 'smooth'
    ) {
      smoothNodes.add(
        segment.startNode
      )
    }

    if (
      segment.endNode.smooth === 'smooth'
    ) {
      smoothNodes.add(
        segment.endNode
      )
    }
  })

  const directions = new Map()

  smoothNodes.forEach(node => {
    const direction = getNodeDirection(
      segments,
      path,
      node
    )

    if (direction) {
      directions.set(
        node,
        direction
      )
    }
  })

  segments.forEach(segment => {
    constrainSegment(
      segment,
      directions
    )
  })
}

export class Scene {
  constructor(
    pathMode = 'curve',
    curveMode = 'elliptic'
  ) {
    this.paths = []
    this.pathMode = pathMode
    this.curveMode = curveMode
  }

  addPath() {
    const path = new Path(this)

    this.paths.push(path)

    return path
  }

  speed(p0, p1, p2) {
    return CURVE_MODE[this.curveMode](
      p0,
      p1,
      p2
    )
  }

  constrain(
    path,
    movedPoint = null
  ) {
    constrainPath(
      path,
      movedPoint
    )
  }
}
