import {
  sub,
  add,
  dot,
  mul
} from './vector.js'

const SNAP_THRESHOLD = 10

export class Path {
  constructor(scene) {
    this.scene = scene
    this.nodes = []
    this.selected = false
    this.closed = false
  }

  addNode(x, y) {
    const node = {
      x,
      y,
      type: 'line',
      smooth: null,
      selected: false
    }

    this.nodes.push(node)

    return node
  }

  close() {
    if (this.closed) {
      return
    }

    if (this.nodes.length < 2) {
      return
    }

    this.closed = true

    this.scene.constrain(this)
  }

  toggleSmooth(node) {
    if (node.smooth === 'smooth') {
      node.smooth = null
      node.smoothDirection = null
      this.scene.constrain(this)
      return
    }

    const segments = this.getSegments()

    const adjacent = segments.filter(
      segment =>
        segment.startNode === node ||
        segment.endNode === node
    )

    if (adjacent.length < 2) {
      return
    }

    const bothCurves = adjacent.every(
      segment =>
        segment.controlPoint
    )

    /*
     * Otherwise: exactly one side is a
     * curve and the other a line. This is
     * only allowed when the curve side's
     * far endpoint is already smooth,
     * i.e. this node is the outer end of
     * an established multi-segment curve
     * run, not a lone curve flanked by
     * two unrelated lines.
     */
    const curveSegment = adjacent.find(
      segment =>
        segment.controlPoint
    )

    const mixedIntoEstablishedRun =
      adjacent.length === 2 &&
      curveSegment &&
      adjacent.some(
        segment =>
          !segment.controlPoint
      ) &&
      (
        curveSegment.startNode === node
          ? curveSegment.endNode
          : curveSegment.startNode
      ).smooth === 'smooth'

    if (
      !bothCurves &&
      !mixedIntoEstablishedRun
    ) {
      return
    }

    node.smooth = 'smooth'

    this.scene.constrain(this)
  }

  /*
   * Expresses controlPoint in the local
   * frame of the segment (node ->
   * farNode): `a` is the fraction along
   * that axis, `b` the fraction along
   * its perpendicular. Reapplying this
   * frame after node or farNode moves
   * keeps the control point's position
   * relative to the segment consistent
   * (same shape, scaled/rotated/
   * translated with the segment)
   * instead of preserving an absolute
   * tangent direction, which can flip
   * to the wrong side on a large move.
   *
   * Returns null if node and farNode
   * coincide (no frame to express it
   * in).
   */
  localFrame(
    node,
    controlPoint,
    farNode
  ) {
    const along =
      sub(
        farNode,
        node
      )

    const lengthSquared =
      dot(along, along)

    if (lengthSquared < 1e-18) {
      return null
    }

    const perpendicular = {
      x: -along.y,
      y: along.x
    }

    const relative =
      sub(
        controlPoint,
        node
      )

    return {
      a:
        dot(relative, along) /
        lengthSquared,

      b:
        dot(relative, perpendicular) /
        lengthSquared
    }
  }

  applyLocalFrame(
    node,
    farNode,
    frame
  ) {
    const along =
      sub(
        farNode,
        node
      )

    const perpendicular = {
      x: -along.y,
      y: along.x
    }

    return {
      x:
        node.x +
        frame.a * along.x +
        frame.b * perpendicular.x,

      y:
        node.y +
        frame.a * along.y +
        frame.b * perpendicular.y
    }
  }

  /*
   * If dragging this handle would push it
   * past one of its own segment's smooth
   * endpoints (onto the wrong side of that
   * node's established tangent direction),
   * bounce it back instead: as the raw
   * drag target crosses the node, the
   * handle reflects off it rather than
   * flipping the node's tangent to an
   * incompatible sense (same behavior as
   * Glyphs). Keeps a smooth node's tangent
   * from ever landing in a configuration
   * that's geometrically impossible to
   * reconcile with its OTHER neighbor.
   */
  reflectHandle(
    segment,
    point
  ) {
    let reflected = point

    if (
      segment.startNode.smooth ===
        'smooth' &&
      segment.startNode.smoothDirection
    ) {
      reflected =
        this.reflectAcrossNode(
          segment.startNode,
          segment.startNode
            .smoothDirection,
          reflected
        )
    }

    if (
      segment.endNode.smooth ===
        'smooth' &&
      segment.endNode.smoothDirection
    ) {
      reflected =
        this.reflectAcrossNode(
          segment.endNode,
          mul(
            segment.endNode
              .smoothDirection,
            -1
          ),
          reflected
        )
    }

    return reflected
  }

  /*
   * Reflects point off node along axis:
   * ahead of the node, it passes through
   * unchanged; past it (projection goes
   * negative), it bounces back out to the
   * same distance on the near side
   * instead of flipping the node's
   * tangent sense. Right at the node is
   * left alone here - that's fine to
   * pass through/snap onto; only actually
   * crossing past it triggers the bounce.
   */
  reflectAcrossNode(
    node,
    axis,
    point
  ) {
    const relative =
      sub(point, node)

    const t =
      dot(relative, axis)

    if (t >= 0) {
      return point
    }

    return sub(
      point,
      mul(axis, 2 * t)
    )
  }

  moveNode(
    node,
    x,
    y,
    {
      snap = true
    } = {}
  ) {
    /*
     * T point / offcurve point.
     */
    if (
      node.type === 'offcurve'
    ) {
      const segment =
        this.getSegments().find(
          s =>
            s.controlPoint === node
        )

      let point = {
        x,
        y
      }

      if (segment) {
        point = this.reflectHandle(
          segment,
          point
        )

        if (snap) {
          point = this.snapPoint(
            point,
            [
              segment.startNode,
              segment.endNode
            ]
          )
        }
      }

      node.x = point.x
      node.y = point.y

      /*
       * Scene then applies the
       * smooth constraint.
       */
      this.scene.constrain(
        this,
        node
      )

      return
    }

    /*
     * Regular node.
     *
     * The existing T points are first
     * moved together with the node.
     */
    const segments =
      this.getSegments()

    const nodeBefore = {
      x: node.x,
      y: node.y
    }

    const touching =
      segments
        .filter(
          segment =>
            segment.controlPoint &&
            (
              segment.startNode === node ||
              segment.endNode === node
            )
        )
        .map(segment => {
          const farNode =
            segment.startNode === node
              ? segment.endNode
              : segment.startNode

          return {
            segment,
            farNode
          }
        })
        .filter(({ farNode }) =>
          /*
           * If this node isn't smooth but
           * the far node is, the far
           * node's own smoothness fully
           * owns this segment's T (via
           * preserveHandlePosition in
           * scene.constrain() below) and
           * would just discard anything
           * set here. Leave it alone so
           * only one mechanism decides.
           *
           * If this node IS smooth, keep
           * updating it here too: even
           * though its own final T gets
           * recomputed by scene.constrain(),
           * that computation reads T from
           * neighboring segments, so it
           * still needs a sane value.
           */
          node.smooth === 'smooth' ||
          farNode.smooth !== 'smooth'
        )
        .map(({ segment, farNode }) => ({
          segment,

          farNode,

          frame:
            this.localFrame(
              node,
              segment.controlPoint,
              farNode
            )
        }))

    const candidates =
      this.nodes.filter(
        candidate =>
          candidate !== node &&
          candidate.type !== 'offcurve'
      )

    const point =
      snap
        ? this.snapPoint(
            {
              x,
              y
            },
            candidates
          )
        : {
            x,
            y
          }

    node.x = point.x
    node.y = point.y

    touching.forEach(
      ({
        segment,
        farNode,
        frame
      }) => {
        /*
         * node and farNode coincided
         * before the move (no frame to
         * express T in). Just carry T
         * along by the same delta.
         */
        if (!frame) {
          segment.controlPoint.x +=
            node.x - nodeBefore.x

          segment.controlPoint.y +=
            node.y - nodeBefore.y

          return
        }

        const moved =
          this.applyLocalFrame(
            node,
            farNode,
            frame
          )

        segment.controlPoint.x =
          moved.x

        segment.controlPoint.y =
          moved.y
      }
    )

    /*
     * Then re-align every smooth node's
     * tangent (not just the ones directly
     * touching this node): a mixed
     * smooth node elsewhere may depend on
     * a line segment that has an endpoint
     * here and just changed direction.
     */
    this.scene.constrain(this)
  }

  snapPoint(
    point,
    candidates
  ) {
    const snapped = {
      x: point.x,
      y: point.y
    }

    let bestX = null
    let bestY = null

    candidates.forEach(candidate => {
      const dx =
        Math.abs(
          point.x - candidate.x
        )

      if (
        dx < SNAP_THRESHOLD &&
        (
          !bestX ||
          dx < bestX.distance
        )
      ) {
        bestX = {
          distance: dx,
          value: candidate.x
        }
      }

      const dy =
        Math.abs(
          point.y - candidate.y
        )

      if (
        dy < SNAP_THRESHOLD &&
        (
          !bestY ||
          dy < bestY.distance
        )
      ) {
        bestY = {
          distance: dy,
          value: candidate.y
        }
      }
    })

    if (bestX) {
      snapped.x = bestX.value
    }

    if (bestY) {
      snapped.y = bestY.value
    }

    return snapped
  }

  getSegments() {
    const segments = []

    if (!this.nodes.length) {
      return segments
    }

    let previousEndNode =
      this.nodes[0]

    let i = 1

    while (
      i < this.nodes.length
    ) {
      const node =
        this.nodes[i]

      /*
       * Offcurve node = the segment's T.
       */
      if (
        node.type === 'offcurve'
      ) {
        const controlPoint =
          node

        const endNode =
          this.nodes[i + 1]

        /*
         * Offcurve at the end of a
         * closed path.
         */
        if (!endNode) {
          if (this.closed) {
            segments.push({
              startNode:
                previousEndNode,

              controlPoint,

              endNode:
                this.nodes[0],

              insertIndex:
                i
            })
          }

          return segments
        }

        segments.push({
          startNode:
            previousEndNode,

          controlPoint,

          endNode,

          insertIndex:
            i
        })

        previousEndNode =
          endNode

        i += 2

        continue
      }

      /*
       * Regular line segment.
       */
      segments.push({
        startNode:
          previousEndNode,

        controlPoint:
          null,

        endNode:
          node,

        insertIndex:
          i
      })

      previousEndNode =
        node

      i += 1
    }

    /*
     * For a closed path, last node ->
     * first node.
     *
     * If the last segment was already
     * created by an offcurve point,
     * this only adds the missing
     * closing connection.
     */
    if (
      this.closed &&
      previousEndNode !==
        this.nodes[0]
    ) {
      segments.push({
        startNode:
          previousEndNode,

        controlPoint:
          null,

        endNode:
          this.nodes[0],

        insertIndex:
          this.nodes.length
      })
    }

    return segments
  }

  convertSegmentToCurve(
    segmentIndex
  ) {
    const segment =
      this.getSegments()[
        segmentIndex
      ]

    if (
      !segment ||
      segment.controlPoint
    ) {
      return
    }

    const {
      startNode,
      endNode,
      insertIndex
    } = segment

    const controlPoint = {
      x:
        (
          startNode.x +
          endNode.x
        ) / 2,

      y:
        (
          startNode.y +
          endNode.y
        ) / 2,

      type:
        'offcurve',

      selected:
        false
    }

    this.nodes.splice(
      insertIndex,
      0,
      controlPoint
    )

    endNode.type =
      'curve'
  }

  resolve(
    p0,
    p1,
    p2
  ) {
    const speed =
      this.scene.speed(
        p0,
        p1,
        p2
      )

    return {
      p0,

      cp1: {
        x:
          p0.x +
          speed *
          (
            p1.x -
            p0.x
          ),

        y:
          p0.y +
          speed *
          (
            p1.y -
            p0.y
          )
      },

      cp2: {
        x:
          p2.x +
          speed *
          (
            p1.x -
            p2.x
          ),

        y:
          p2.y +
          speed *
          (
            p1.y -
            p2.y
          )
      },

      p3:
        p2
    }
  }
}
