import { Path } from './renderer/path.js'
import { curve as elliptic } from './circle/curve.js'
import { curve as artea } from './artea/curve.js'

const CURVE_MODE = {
  elliptic,
  artea
}

const EPSILON = 1e-9

/*
 * If the tangent intersection point for a
 * both-smooth segment lands closer to a
 * node than this fraction of the segment's
 * own chord length, the tangent length has
 * effectively collapsed to zero there (its
 * direction becomes undefined). That's a
 * correctness bug, not just an aesthetic
 * one: spline.js treats near-zero tangent
 * length as degenerate geometry.
 */
const MIN_HANDLE_DISTANCE_FACTOR = 0.05

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

function dot(a, b) {
  return a.x * b.x + a.y * b.y
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
   * Incoming segment:
   *
   * The segment's tangent arm runs from the
   * node back to the tangent intersection point.
   *
   * Therefore:
   *
   *     Node <- T
   *
   * Direction = Node - T
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
   * Outgoing segment:
   *
   * The tangent arm runs from the node to T.
   *
   * Therefore:
   *
   *     Node -> T
   *
   * Direction = T - Node
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
   * Both directions must describe the same tangent.
   * For an already-smooth node we just average the
   * two direction vectors.
   */
  const direction = normalize(
    add(directions[0], directions[1])
  )

  return direction || directions[0]
}

/*
 * If exactly one of the two adjacent
 * segments is a straight line, its
 * direction is fixed (a line has no
 * tangent to bend) and takes priority:
 * the curve side is the one that must
 * be aligned to it, not the other way
 * around.
 *
 * path.js only allows a node into this
 * mixed configuration when the curve
 * side's far endpoint is already smooth
 * (i.e. it's the outer end of an
 * established multi-segment curve run),
 * so this only ever fires there.
 */
function getMixedNeighborDirection(
  segments,
  path,
  node
) {
  const { incoming, outgoing } =
    getAdjacentSegments(segments, path, node)

  if (!incoming || !outgoing) {
    return null
  }

  const incomingIsLine = !incoming.controlPoint
  const outgoingIsLine = !outgoing.controlPoint

  if (incomingIsLine === outgoingIsLine) {
    return null
  }

  /*
   * Direction convention: pointing
   * forward, in the path's direction
   * of travel through node (matching
   * getExistingDirection above).
   */
  if (incomingIsLine) {
    const other =
      incoming.startNode === node
        ? incoming.endNode
        : incoming.startNode

    return normalize(
      sub(node, other)
    )
  }

  const other =
    outgoing.startNode === node
      ? outgoing.endNode
      : outgoing.startNode

  return normalize(
    sub(other, node)
  )
}

/*
 * A smooth node's tangent direction is a
 * persisted property of that node, not
 * something recomputed from its neighbors
 * every time anything nearby moves -
 * otherwise moving one node would rotate
 * every other smooth node's tangent along
 * the way (each one partly derives its
 * direction from the very control point
 * that just moved). It's set once here
 * (when the node has none yet) and
 * updated only when the user explicitly
 * drags one of ITS OWN handles (see
 * constrainMovedHandle). A mixed node is
 * the one deliberate exception: its
 * direction is tied to a line that can
 * legitimately still be moving, so it's
 * always read fresh.
 */
function getNodeDirection(segments, path, node) {
  const mixed = getMixedNeighborDirection(
    segments,
    path,
    node
  )

  if (mixed) {
    return mixed
  }

  if (node.smoothDirection) {
    return node.smoothDirection
  }

  const direction =
    getExistingDirection(
      segments,
      path,
      node
    ) ||
    getChordDirection(
      segments,
      path,
      node
    )

  if (direction) {
    node.smoothDirection = direction
  }

  return direction
}

/*
 * Moves the existing tangent intersection point
 * along the tangent given by the node.
 *
 * The previous distance of T from the node is
 * preserved.
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

/*
 * Both nodes smooth: the two tangents
 * intersect at T, which is the segment's
 * shared tangent intersection point - but
 * if that intersection collapses onto one
 * of the two nodes (tangent length -> 0,
 * direction undefined there), fall back to
 * only honoring the OTHER node's (still
 * reliable) direction, exactly like the
 * single-sided cases below.
 *
 * Shared by constrainSegment (the general
 * pass) and constrainMovedHandle (dragging
 * a handle directly), which hits the same
 * "both ends smooth" shape but for the
 * SIBLING segment, not the one whose
 * handle was actually moved.
 */
function resolveBothSmoothSegment(
  segment,
  directions,
  preferredNode = null
) {
  const startDirection = directions.get(
    segment.startNode
  )

  const endDirection = directions.get(
    segment.endNode
  )

  const point = intersectLines(
    segment.startNode,
    startDirection,
    segment.endNode,
    endDirection
  )

  const chordLength = length(
    sub(segment.endNode, segment.startNode)
  )

  const minDistance =
    MIN_HANDLE_DISTANCE_FACTOR * chordLength

  /*
   * Signed distance of the point along
   * each node's OWN forward direction:
   * negative (or too small) means the
   * point isn't actually ahead of that
   * node in its tangent direction - it's
   * either too close (tangent length ->
   * 0) or on the wrong side entirely
   * (mirrored, a visible cusp), which is
   * just as invalid. A parallel/missing
   * intersection (point === null) counts
   * as invalid on both sides.
   */
  const startProjection =
    point &&
    dot(
      sub(point, segment.startNode),
      startDirection
    )

  const endProjection =
    point &&
    -dot(
      sub(point, segment.endNode),
      endDirection
    )

  const startInvalid =
    !point || startProjection < minDistance

  const endInvalid =
    !point || endProjection < minDistance

  if (!startInvalid && !endInvalid) {
    setPoint(
      segment.controlPoint,
      point
    )

    return
  }

  const preserveStart = () =>
    preserveHandlePosition(
      segment,
      segment.startNode,
      startDirection
    )

  const preserveEnd = () =>
    preserveHandlePosition(
      segment,
      segment.endNode,
      endDirection && mul(endDirection, -1)
    )

  /*
   * A caller-marked authoritative node
   * (e.g. the one just dragged) always
   * wins outright once anything here is
   * invalid - trusting the "geometrically
   * valid" side instead would silently
   * discard the very side the user just
   * deliberately set, mirroring the
   * handle onto the wrong side.
   */
  if (preferredNode) {
    if (preferredNode === segment.endNode) {
      preserveEnd()
    } else {
      preserveStart()
    }

    return
  }

  /*
   * No explicit preference (the general
   * pass): trust whichever side is
   * geometrically valid, since neither is
   * more "recent" than the other.
   */
  if (startInvalid && !endInvalid) {
    preserveEnd()
  } else if (endInvalid && !startInvalid) {
    preserveStart()
  }
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

  if (startSmooth && endSmooth) {
    resolveBothSmoothSegment(
      segment,
      directions
    )

    return
  }

  /*
   * Only start node smooth:
   *
   * T stays on the start node's tangent. Its
   * previous distance to the node is preserved.
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
   * Only end node smooth:
   *
   * T lies behind the end node, i.e. in the
   * opposite direction of the stored forward
   * direction.
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

/*
 * If either end of the dragged handle's
 * own segment is a mixed smooth node
 * (its direction fixed by an adjacent
 * line), the handle can't be dragged
 * off that line: project it back onto
 * the fixed direction, preserving only
 * the distance the user dragged along
 * it.
 */
function clampMovedHandle(
  segments,
  path,
  changedSegment,
  movedPoint
) {
  const nodes = [
    changedSegment.startNode,
    changedSegment.endNode
  ]

  nodes.forEach(node => {
    if (node.smooth !== 'smooth') {
      return
    }

    const fixed = getMixedNeighborDirection(
      segments,
      path,
      node
    )

    if (!fixed) {
      return
    }

    const relative = sub(movedPoint, node)
    const projected = dot(relative, fixed)

    setPoint(
      movedPoint,
      add(node, mul(fixed, projected))
    )
  })
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

  clampMovedHandle(
    segments,
    path,
    changedSegment,
    movedPoint
  )

  /*
   * If the handle sits right on top of
   * one of its own segment's nodes (e.g.
   * snapped there), the direction implied
   * at the OTHER node is just an artifact
   * of that coincidence, not a deliberate
   * tangent. Don't let it overwrite a
   * persisted smoothDirection with
   * nonsense - skip until the handle
   * moves to a sane position again.
   */
  const chordLength = length(
    sub(
      changedSegment.endNode,
      changedSegment.startNode
    )
  )

  const minDistance =
    MIN_HANDLE_DISTANCE_FACTOR * chordLength

  if (
    length(
      sub(movedPoint, changedSegment.startNode)
    ) < minDistance ||
    length(
      sub(movedPoint, changedSegment.endNode)
    ) < minDistance
  ) {
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
     * The T moved by the user determines the
     * tangent direction at this node.
     *
     * For a start node:
     *
     *     Node -> T
     *
     * For an end node:
     *
     *     Node <- T
     *
     * Both must geometrically represent the
     * same tangent.
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

    /*
     * The user just dragged this handle
     * directly: that's a deliberate
     * update to this node's persisted
     * tangent direction.
     */
    node.smoothDirection = direction

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

    /*
     * Read the far node's own persisted
     * (or mixed) direction here too,
     * instead of re-deriving it ad hoc
     * from its current handle - that
     * duplicate logic could disagree with
     * getNodeDirection and drag the
     * intersection to a degenerate point.
     */
    if (farNode.smooth !== 'smooth') {
      return
    }

    const farDirection = getNodeDirection(
      segments,
      path,
      farNode
    )

    if (!farDirection) {
      return
    }

    resolveBothSmoothSegment(
      otherSegment,
      new Map([
        [node, direction],
        [farNode, farDirection]
      ]),
      node
    )
  })
}

/*
 * Last-resort safety net, run over every
 * segment regardless of which rule above
 * touched it (or didn't): whatever
 * produced a near-collapsed tangent arm,
 * fall back to the segment's own
 * midpoint (the same default a freshly
 * converted curve gets) rather than risk
 * degenerate geometry.
 */
function enforceMinimumTangentLength(
  segment
) {
  if (!segment.controlPoint) {
    return
  }

  const chordLength = length(
    sub(segment.endNode, segment.startNode)
  )

  if (chordLength < EPSILON) {
    return
  }

  const minDistance =
    MIN_HANDLE_DISTANCE_FACTOR * chordLength

  const distToStart = length(
    sub(
      segment.controlPoint,
      segment.startNode
    )
  )

  const distToEnd = length(
    sub(
      segment.controlPoint,
      segment.endNode
    )
  )

  if (
    distToStart >= minDistance &&
    distToEnd >= minDistance
  ) {
    return
  }

  setPoint(
    segment.controlPoint,
    mul(
      add(
        segment.startNode,
        segment.endNode
      ),
      0.5
    )
  )
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
   * A directly moved curve handle defines the
   * tangent. The opposite side is adjusted to
   * match it.
   */
  if (movedPoint) {
    if (movedPoint.type === 'offcurve') {
      constrainMovedHandle(
        segments,
        path,
        movedPoint
      )
    }

    /*
     * The segment whose handle was just
     * dragged is intentionally skipped
     * here: path.js's reflectHandle
     * already keeps it from crossing past
     * a smooth endpoint, and momentarily
     * sitting right on top of one (e.g.
     * snapped there) is fine - it
     * shouldn't get yanked back to the
     * midpoint for that.
     */
    segments.forEach(segment => {
      if (segment.controlPoint === movedPoint) {
        return
      }

      enforceMinimumTangentLength(segment)
    })

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

  segments.forEach(
    enforceMinimumTangentLength
  )
}

export class Scene {
  constructor(
    pathMode = 'curve',
    curveMode = 'elliptic'
  ) {
    this.paths = []
    this.pathMode = pathMode
    this.curveMode = curveMode
    this.verticalStretch = 1
  }

  addPath() {
    const path = new Path(this)

    this.paths.push(path)

    return path
  }

  /*
   * Replaces the current content with an
   * example (see examples/) - plain data:
   * closed, an optional anisotropy percent
   * (see the Anisotropy slider) and a list
   * of points, each optionally smooth and/
   * or carrying a controlPoint for the
   * segment starting at it (toward the
   * next point, wrapping around if
   * closed).
   */
  loadExample(example) {
    this.paths = []
    this.verticalStretch = 1 + (example.anisotropy || 0) / 100

    const path = this.addPath()

    example.points.forEach((point) => {
      path.addNode(point.x, point.y)
    })

    path.closed = Boolean(example.closed)

    const segmentCount = path.getSegments().length

    for (let i = 0; i < segmentCount; i++) {
      path.convertSegmentToCurve(i)
    }

    const segments = path.getSegments()

    segments.forEach((segment, index) => {
      const controlPoint = example.points[index].controlPoint

      if (controlPoint) {
        segment.controlPoint.x = controlPoint.x
        segment.controlPoint.y = controlPoint.y
      }
    })

    const nodes = path.nodes.filter(
      (node) => node.type !== 'offcurve'
    )

    example.points.forEach((point, index) => {
      if (point.smooth) {
        path.toggleSmooth(nodes[index])
      }
    })
  }

  speed(p0, p1, p2) {
    return CURVE_MODE[this.curveMode](
      p0,
      p1,
      p2,
      this.verticalStretch
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
