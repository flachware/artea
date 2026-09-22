import {
  sub,
  normalize,
  intersectLines
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
      this.scene.constrain(this)
      return
    }

    let segments = this.getSegments()

    let adjacent = segments.filter(
      segment =>
        segment.startNode === node ||
        segment.endNode === node
    )

    if (!adjacent.length) {
      return
    }

    /*
     * A smooth node needs a curve segment
     * on both sides.
     */
    const needsCurve = adjacent.filter(
      segment =>
        !segment.controlPoint
    )

    needsCurve.forEach(segment => {
      const currentSegments =
        this.getSegments()

      const index =
        currentSegments.findIndex(
          current =>
            current.startNode ===
              segment.startNode &&
            current.endNode ===
              segment.endNode
        )

      if (index !== -1) {
        this.convertSegmentToCurve(index)
      }
    })

    segments = this.getSegments()

    adjacent = segments.filter(
      segment =>
        segment.startNode === node ||
        segment.endNode === node
    )

    if (
      adjacent.length < 2 ||
      adjacent.some(
        segment =>
          !segment.controlPoint
      )
    ) {
      return
    }

    node.smooth = 'smooth'

    this.scene.constrain(this)
  }

  getTangent(node, segment) {
    const other =
      segment.startNode === node
        ? segment.endNode
        : segment.startNode

    if (segment.controlPoint) {
      const direction =
        normalize(
          sub(
            segment.controlPoint,
            node
          )
        )

      if (!direction) {
        return {
          dir: {
            x: 0,
            y: 0
          },
          dist: 1
        }
      }

      return {
        dir: direction,

        dist:
          Math.hypot(
            segment.controlPoint.x -
              node.x,
            segment.controlPoint.y -
              node.y
          ) || 1
      }
    }

    const direction =
      normalize(
        sub(
          other,
          node
        )
      )

    if (!direction) {
      return {
        dir: {
          x: 0,
          y: 0
        },
        dist: 1
      }
    }

    return {
      dir: direction,

      dist:
        Math.hypot(
          other.x - node.x,
          other.y - node.y
        ) / 2 || 1
    }
  }

  setControlPoint(
    controlPoint,
    node,
    dir,
    dist
  ) {
    controlPoint.x =
      node.x +
      dir.x * dist

    controlPoint.y =
      node.y +
      dir.y * dist
  }

  moveNode(
    node,
    x,
    y
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

      const point =
        segment
          ? this.snapPoint(
              {
                x,
                y
              },
              segment.startNode,
              segment.endNode
            )
          : {
              x,
              y
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

            ownTangent:
              this.getTangent(
                node,
                segment
              ),

            farNode,

            farTangent:
              this.getTangent(
                farNode,
                segment
              )
          }
        })

    node.x = x
    node.y = y

    touching.forEach(
      ({
        segment,
        ownTangent,
        farNode,
        farTangent
      }) => {
        const point =
          intersectLines(
            node,
            ownTangent.dir,
            farNode,
            farTangent.dir
          )

        if (point) {
          segment.controlPoint.x =
            point.x

          segment.controlPoint.y =
            point.y

          return
        }

        this.setControlPoint(
          segment.controlPoint,
          node,
          ownTangent.dir,
          ownTangent.dist
        )
      }
    )

    /*
     * Then apply smooth constraints.
     */
    this.scene.constrain(
      this,
      node
    )
  }

  snapPoint(
    point,
    nodeA,
    nodeB
  ) {
    const snapped = {
      x: point.x,
      y: point.y
    }

    if (
      Math.abs(
        point.x - nodeA.x
      ) < SNAP_THRESHOLD
    ) {
      snapped.x = nodeA.x
    } else if (
      Math.abs(
        point.x - nodeB.x
      ) < SNAP_THRESHOLD
    ) {
      snapped.x = nodeB.x
    }

    if (
      Math.abs(
        point.y - nodeA.y
      ) < SNAP_THRESHOLD
    ) {
      snapped.y = nodeA.y
    } else if (
      Math.abs(
        point.y - nodeB.y
      ) < SNAP_THRESHOLD
    ) {
      snapped.y = nodeB.y
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
