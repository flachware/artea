import Alpine from 'alpinejs'

const SVG_NS = 'http://www.w3.org/2000/svg'
const CURVE_PULL = 0.55
const DRAG_THRESHOLD = 5
const TANGENT_SNAP_THRESHOLD = 10
const SMOOTH_NODE_SIZE = 10
const CORNER_NODE_SIZE = 8

Alpine.data('canvas', () => ({
  width: window.innerWidth,
  height: window.innerHeight,

  paths: [],
  selectedPath: null,
  selectedNodeHandle: null,
  selectedSegmentHandle: null,
  selectedCurveHandle: null,
  segmentHighlight: null,

  get viewBox() {
    return `0 0 ${this.width} ${this.height}`
  },

  init() {
    window.addEventListener('resize', () => {
      this.width = window.innerWidth
      this.height = window.innerHeight
    })
  },

  edit(event) {
    this.deselectNode()
    this.deselectSegment()
    this.deselectCurveHandle()

    if (!event.ctrlKey && !event.metaKey) {
      this.selectedPath = null
      return
    }

    let path = this.selectedPath

    if (!path) {
      const element = document.createElementNS(SVG_NS, 'path')

      element.setAttribute('fill', 'none')
      element.setAttribute('stroke', 'black')
      element.setAttribute('stroke-width', '1.1')

      this.$el.appendChild(element)

      path = {
        element,
        nodes: [],
        nodeHandles: [],
        segmentHandles: [],
        curves: [],
        closed: false
      }

      this.paths.push(path)
      this.selectedPath = path
    }

    const node = {
      x: event.clientX,
      y: event.clientY,
      smooth: false
    }

    const previousNode = path.nodes[path.nodes.length - 1]

    path.nodes.push(node)

    this.updatePath(path)

    if (previousNode) {
      this.addSegmentHandle(path, previousNode, node)
    }

    this.addNodeHandle(path, node)
  },

  updatePath(path) {
    path.element.setAttribute(
      'd',
      path.nodes
        .map((p, i) => {
          if (i === 0) {
            return `M${p.x},${p.y}`
          }

          return this.segmentCommand(path.nodes[i - 1], p, path.curves[i - 1])
        })
        .join(' ')
    )
  },

  segmentCommand(nodeA, nodeB, curve) {
    if (curve) {
      return `C${curve.cp1.x},${curve.cp1.y} ${curve.cp2.x},${curve.cp2.y} ${nodeB.x},${nodeB.y}`
    }

    return `L${nodeB.x},${nodeB.y}`
  },

  segmentPathData(nodeA, nodeB, curve) {
    return `M${nodeA.x},${nodeA.y} ${this.segmentCommand(nodeA, nodeB, curve)}`
  },

  addNodeHandle(path, node) {
    const nodeHandle = document.createElementNS(SVG_NS, 'rect')

    nodeHandle.setAttribute('fill', 'none')
    nodeHandle.setAttribute('stroke', 'black')
    nodeHandle.setAttribute('stroke-width', '1.1')
    nodeHandle.setAttribute('pointer-events', 'all')

    this.updateNodeHandle(nodeHandle, node)
    this.updateNodeHandleShape(nodeHandle, node)

    this.$el.appendChild(nodeHandle)

    path.nodeHandles.push(nodeHandle)

    const index = path.nodeHandles.length - 1

    nodeHandle.addEventListener('mousedown', (event) => {
      event.stopPropagation()

      const isFirstHandle = nodeHandle === path.nodeHandles[0]
      const isOpenAndSelected = !path.closed &&
        Alpine.raw(this.selectedPath) === path

      if (isFirstHandle && isOpenAndSelected && (event.ctrlKey || event.metaKey)) {
        this.closePath(path)
        return
      }

      this.selectNode(nodeHandle)
      this.dragNode(path, node, nodeHandle, index, event)
    })

    nodeHandle.addEventListener('dblclick', (event) => {
      event.stopPropagation()

      this.toggleSmoothNode(path, index)
    })

    if (path.nodeHandles.length > 1) {
      // Keep first handle on top
      this.$el.appendChild(path.nodeHandles[0])
    }
  },

  updateNodeHandle(nodeHandle, node) {
    const size = node.smooth ? SMOOTH_NODE_SIZE : CORNER_NODE_SIZE

    nodeHandle.setAttribute('width', size)
    nodeHandle.setAttribute('height', size)
    nodeHandle.setAttribute('x', node.x - size / 2)
    nodeHandle.setAttribute('y', node.y - size / 2)
  },

  updateNodeHandleShape(nodeHandle, node) {
    const radius = node.smooth ? SMOOTH_NODE_SIZE / 2 : 0

    nodeHandle.setAttribute('rx', radius)
    nodeHandle.setAttribute('ry', radius)
  },

  addSegmentHandle(path, nodeA, nodeB) {
    const segmentHandle = document.createElementNS(SVG_NS, 'path')

    segmentHandle.setAttribute('d', this.segmentPathData(nodeA, nodeB, null))
    segmentHandle.setAttribute('fill', 'none')
    segmentHandle.setAttribute('stroke', 'transparent')
    segmentHandle.setAttribute('stroke-width', '10')
    segmentHandle.setAttribute('pointer-events', 'all')

    this.$el.appendChild(segmentHandle)

    path.segmentHandles.push(segmentHandle)
    path.curves.push(null)

    const index = path.segmentHandles.length - 1

    segmentHandle.addEventListener('mousedown', (event) => {
      event.stopPropagation()

      if (event.altKey) {
        this.convertSegmentToCurve(path, index)
        return
      }

      this.selectSegment(segmentHandle)
    })

    // Keep node handles above segment handles
    path.nodeHandles.forEach((nodeHandle) => {
      this.$el.appendChild(nodeHandle)
    })
  },

  updateSegmentHandles(path) {
    path.segmentHandles.forEach((segmentHandle, i) => {
      const nodeA = path.nodes[i]
      const nodeB = path.nodes[i + 1]
      const curve = path.curves[i]

      if (curve) {
        this.updateCurve(curve, nodeA, nodeB)
      }

      segmentHandle.setAttribute('d', this.segmentPathData(nodeA, nodeB, curve))
    })

    this.updateSegmentHighlight()
  },

  convertSegmentToCurve(path, index) {
    if (path.curves[index]) {
      return
    }

    const nodeA = path.nodes[index]
    const nodeB = path.nodes[index + 1]

    const midpoint = this.getConstrainedCurvePoint(path, index, {
      x: (nodeA.x + nodeB.x) / 2,
      y: (nodeA.y + nodeB.y) / 2
    })

    const curve = this.addCurve(path, index, midpoint)

    this.updateCurve(curve, nodeA, nodeB)
    this.updatePath(path)

    path.segmentHandles[index].setAttribute(
      'd',
      this.segmentPathData(nodeA, nodeB, curve)
    )
  },

  addCurve(path, index, point) {
    const nodeA = path.nodes[index]
    const nodeB = path.nodes[index + 1]

    const curveHandle = document.createElementNS(SVG_NS, 'circle')

    curveHandle.setAttribute('r', 4)
    curveHandle.setAttribute('fill', 'white')
    curveHandle.setAttribute('stroke', '#bbb')
    curveHandle.setAttribute('stroke-width', '1.1')
    curveHandle.setAttribute('pointer-events', 'all')

    this.$el.appendChild(curveHandle)

    const curve = {
      point: { x: point.x, y: point.y },
      cp1: {},
      cp2: {},
      curveHandle,
      guideA: this.addGuideLine(),
      guideB: this.addGuideLine()
    }

    path.curves[index] = curve

    curveHandle.addEventListener('mousedown', (event) => {
      event.stopPropagation()

      this.selectCurveHandle(curveHandle)
      this.dragCurveHandle(path, curve, index, nodeA, nodeB, event)
    })

    return curve
  },

  updateCurve(curve, nodeA, nodeB) {
    curve.cp1.x = nodeA.x + CURVE_PULL * (curve.point.x - nodeA.x)
    curve.cp1.y = nodeA.y + CURVE_PULL * (curve.point.y - nodeA.y)
    curve.cp2.x = nodeB.x + CURVE_PULL * (curve.point.x - nodeB.x)
    curve.cp2.y = nodeB.y + CURVE_PULL * (curve.point.y - nodeB.y)

    curve.curveHandle.setAttribute('cx', curve.point.x)
    curve.curveHandle.setAttribute('cy', curve.point.y)

    this.updateGuideLine(curve.guideA, nodeA, curve.point)
    this.updateGuideLine(curve.guideB, nodeB, curve.point)
  },

  addGuideLine() {
    const guideLine = document.createElementNS(SVG_NS, 'line')

    guideLine.setAttribute('stroke', '#bbb')
    guideLine.setAttribute('stroke-width', '1')
    guideLine.setAttribute('pointer-events', 'none')

    this.$el.insertBefore(guideLine, this.$el.firstChild)

    return guideLine
  },

  updateGuideLine(guideLine, node, curvePoint) {
    guideLine.setAttribute('x1', node.x)
    guideLine.setAttribute('y1', node.y)
    guideLine.setAttribute('x2', curvePoint.x)
    guideLine.setAttribute('y2', curvePoint.y)
  },

  startDrag(startEvent, onDrag) {
    const startX = startEvent.clientX
    const startY = startEvent.clientY

    let dragging = false

    const onMouseMove = (event) => {
      if (!dragging) {
        const dx = event.clientX - startX
        const dy = event.clientY - startY

        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) {
          return
        }

        dragging = true
      }

      onDrag(event)
    }

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  },

  dragNode(path, node, nodeHandle, index, startEvent) {
    const dragPlan = this.prepareNodeDrag(path, index, node)

    this.startDrag(startEvent, (event) => {
      node.x = event.clientX
      node.y = event.clientY

      this.updateNodeHandle(nodeHandle, node)
      this.applyNodeDrag(path, dragPlan, node)
      this.updateSegmentHandles(path)
      this.updatePath(path)
    })
  },

  // Captured once, before the node moves at all, so a curve's tangent
  // direction (and, when nothing else constrains it, its length too) never
  // gets recomputed mid-drag and can't drift — that's what keeps this
  // node's own angle perfectly stable no matter which way it's dragged.
  prepareNodeDrag(path, index, node) {
    const { incomingIndex, outgoingIndex } = this.getAdjacentSegments(path, index)

    const incomingCurve = incomingIndex != null ? path.curves[incomingIndex] : null
    const outgoingCurve = outgoingIndex != null ? path.curves[outgoingIndex] : null

    // A straight edge has no handle of its own to freeze — its direction
    // necessarily keeps changing as this node moves — so the curve on the
    // other side has to keep tracking it live instead.
    if (node.smooth && incomingCurve && !outgoingCurve) {
      return {
        mirror: { segmentIndex: incomingIndex, sourceIndex: outgoingIndex, sourceOtherNode: path.nodes[outgoingIndex + 1] }
      }
    }

    if (node.smooth && outgoingCurve && !incomingCurve) {
      return {
        mirror: { segmentIndex: outgoingIndex, sourceIndex: incomingIndex, sourceOtherNode: path.nodes[incomingIndex] }
      }
    }

    const sides = []

    if (incomingCurve) {
      sides.push(this.prepareCurveDragSide(path, incomingIndex, incomingIndex, node))
    }

    if (outgoingCurve) {
      const outgoingFarIndex = (outgoingIndex + 1) % path.nodeHandles.length

      sides.push(this.prepareCurveDragSide(path, outgoingIndex, outgoingFarIndex, node))
    }

    if (node.smooth && incomingCurve && outgoingCurve) {
      const axisDir = sides[0].dir

      sides[1].dir = { x: -axisDir.x, y: -axisDir.y }
    }

    return { sides }
  },

  prepareCurveDragSide(path, segmentIndex, farIndex, node) {
    const tangent = this.getSideTangent(path, segmentIndex, node, null)

    return {
      segmentIndex,
      stableLine: this.getStableTangentLine(path, farIndex, segmentIndex),
      dir: tangent.dir,
      dist: tangent.dist
    }
  },

  applyNodeDrag(path, plan, node) {
    if (plan.mirror) {
      const { segmentIndex, sourceIndex, sourceOtherNode } = plan.mirror

      this.mirrorCurveTangent(path, segmentIndex, node, sourceIndex, sourceOtherNode)
      return
    }

    plan.sides.forEach((side) => {
      let point

      if (side.stableLine) {
        // Sliding this node's frozen-direction axis along and intersecting
        // it with the far node's fixed line keeps that far angle exactly
        // fixed no matter where this node moves to.
        point = this.intersectLines({ origin: node, dir: side.dir }, side.stableLine) ||
          this.projectOntoLine(node, side.stableLine)
      } else {
        point = {
          x: node.x + side.dir.x * side.dist,
          y: node.y + side.dir.y * side.dist
        }
      }

      this.applyCurvePoint(path, side.segmentIndex, point)
    })
  },

  // Keeps this curve's tangent at `node` opposite another side's tangent
  // there (a curve, or a straight edge when `sourceOtherNode` is given),
  // preserving this curve's own current distance to `node`.
  mirrorCurveTangent(path, segmentIndex, node, sourceSegmentIndex, sourceOtherNode) {
    const sourceTangent = this.getSideTangent(path, sourceSegmentIndex, node, sourceOtherNode)
    const dir = { x: -sourceTangent.dir.x, y: -sourceTangent.dir.y }

    const curve = path.curves[segmentIndex]
    const dist = Math.hypot(curve.point.x - node.x, curve.point.y - node.y) || 1

    this.setCurveTangent(path, segmentIndex, node, dir, dist)
  },

  dragCurveHandle(path, curve, index, nodeA, nodeB, startEvent) {
    this.startDrag(startEvent, (event) => {
      const point = this.getConstrainedCurvePoint(path, index, {
        x: event.clientX,
        y: event.clientY
      })

      curve.point.x = point.x
      curve.point.y = point.y

      this.updateCurve(curve, nodeA, nodeB)

      path.segmentHandles[index].setAttribute(
        'd',
        this.segmentPathData(nodeA, nodeB, curve)
      )

      this.updateSegmentHighlight()

      this.realignSmoothNode(path, index, index)
      this.realignSmoothNode(path, (index + 1) % path.nodeHandles.length, index)

      this.updatePath(path)
    })
  },

  selectNode(nodeHandle) {
    this.deselectSegment()
    this.deselectNode()
    this.deselectCurveHandle()

    this.selectedNodeHandle = nodeHandle
    nodeHandle.setAttribute('fill', 'black')
  },

  deselectNode() {
    if (!this.selectedNodeHandle) {
      return
    }

    this.selectedNodeHandle.setAttribute('fill', 'none')
    this.selectedNodeHandle = null
  },

  selectCurveHandle(curveHandle) {
    this.deselectNode()
    this.deselectSegment()
    this.deselectCurveHandle()

    this.selectedCurveHandle = curveHandle
    curveHandle.setAttribute('fill', 'black')
    curveHandle.setAttribute('stroke', 'black')
  },

  deselectCurveHandle() {
    if (!this.selectedCurveHandle) {
      return
    }

    this.selectedCurveHandle.setAttribute('fill', 'white')
    this.selectedCurveHandle.setAttribute('stroke', '#bbb')
    this.selectedCurveHandle = null
  },

  selectSegment(segmentHandle) {
    this.deselectNode()
    this.deselectSegment()
    this.deselectCurveHandle()

    this.selectedSegmentHandle = segmentHandle

    if (!this.segmentHighlight) {
      this.segmentHighlight = document.createElementNS(SVG_NS, 'path')
      this.segmentHighlight.setAttribute('fill', 'none')
      this.segmentHighlight.setAttribute('stroke', 'black')
      this.segmentHighlight.setAttribute('stroke-width', '3')
      this.segmentHighlight.setAttribute('pointer-events', 'none')
    }

    this.updateSegmentHighlight()

    segmentHandle.parentNode.insertBefore(this.segmentHighlight, segmentHandle)
  },

  updateSegmentHighlight() {
    if (!this.selectedSegmentHandle) {
      return
    }

    this.segmentHighlight.setAttribute('d', this.selectedSegmentHandle.getAttribute('d'))
  },

  deselectSegment() {
    if (!this.selectedSegmentHandle) {
      return
    }

    if (this.segmentHighlight.parentNode) {
      this.segmentHighlight.parentNode.removeChild(this.segmentHighlight)
    }

    this.selectedSegmentHandle = null
  },

  closePath(path) {
    if (path.closed) {
      return
    }

    if (path.nodes.length < 3) {
      return
    }

    path.closed = true

    const lastNode = path.nodes[path.nodes.length - 1]
    const firstNode = path.nodes[0]

    path.nodes.push(firstNode)

    this.updatePath(path)
    this.addSegmentHandle(path, lastNode, firstNode)

    this.selectedPath = null
  },

  toggleSmoothNode(path, index) {
    const node = path.nodes[index]
    const nodeHandle = path.nodeHandles[index]

    if (!node.smooth && !this.hasAdjacentCurve(path, index)) {
      return
    }

    node.smooth = !node.smooth

    this.updateNodeHandle(nodeHandle, node)
    this.updateNodeHandleShape(nodeHandle, node)

    if (node.smooth) {
      this.makeSmoothNode(path, index)
    }
  },

  hasAdjacentCurve(path, index) {
    const { incomingIndex, outgoingIndex } = this.getAdjacentSegments(path, index)

    return (incomingIndex != null && !!path.curves[incomingIndex]) ||
      (outgoingIndex != null && !!path.curves[outgoingIndex])
  },

  makeSmoothNode(path, index) {
    const node = path.nodes[index]
    const { incomingIndex, outgoingIndex } = this.getAdjacentSegments(path, index)

    if (incomingIndex == null || outgoingIndex == null) {
      return
    }

    const incomingCurve = path.curves[incomingIndex]
    const outgoingCurve = path.curves[outgoingIndex]

    if (!incomingCurve && !outgoingCurve) {
      return
    }

    const incomingOtherNode = path.nodes[incomingIndex]
    const outgoingOtherNode = path.nodes[outgoingIndex + 1]

    const incomingTangent = this.getSideTangent(path, incomingIndex, node, incomingOtherNode)
    const outgoingTangent = this.getSideTangent(path, outgoingIndex, node, outgoingOtherNode)

    if (incomingCurve && outgoingCurve) {
      let axisX = outgoingTangent.dir.x - incomingTangent.dir.x
      let axisY = outgoingTangent.dir.y - incomingTangent.dir.y
      let axisLength = Math.hypot(axisX, axisY)

      if (axisLength === 0) {
        axisX = outgoingTangent.dir.x
        axisY = outgoingTangent.dir.y
        axisLength = 1
      }

      const dirOut = { x: axisX / axisLength, y: axisY / axisLength }
      const dirIn = { x: -dirOut.x, y: -dirOut.y }

      this.setCurveTangent(path, incomingIndex, node, dirIn, incomingTangent.dist)
      this.setCurveTangent(path, outgoingIndex, node, dirOut, outgoingTangent.dist)

      this.realignSmoothNode(path, incomingIndex, incomingIndex)
      this.realignSmoothNode(path, (outgoingIndex + 1) % path.nodeHandles.length, outgoingIndex)
    } else if (outgoingCurve) {
      // Incoming side stays a straight line; align the outgoing curve with it
      const dir = { x: -incomingTangent.dir.x, y: -incomingTangent.dir.y }

      this.setCurveTangent(path, outgoingIndex, node, dir, outgoingTangent.dist)

      this.realignSmoothNode(path, (outgoingIndex + 1) % path.nodeHandles.length, outgoingIndex)
    } else {
      // Outgoing side stays a straight line; align the incoming curve with it
      const dir = { x: -outgoingTangent.dir.x, y: -outgoingTangent.dir.y }

      this.setCurveTangent(path, incomingIndex, node, dir, incomingTangent.dist)

      this.realignSmoothNode(path, incomingIndex, incomingIndex)
    }

    this.updatePath(path)
  },

  getAdjacentSegments(path, index) {
    const segmentCount = path.segmentHandles.length

    let incomingIndex = index - 1
    let outgoingIndex = index

    if (incomingIndex < 0) {
      incomingIndex = path.closed ? segmentCount - 1 : null
    }

    if (outgoingIndex >= segmentCount) {
      outgoingIndex = null
    }

    return { incomingIndex, outgoingIndex }
  },

  getSideTangent(path, segmentIndex, node, otherNode) {
    const curve = path.curves[segmentIndex]

    if (curve) {
      const dx = curve.point.x - node.x
      const dy = curve.point.y - node.y
      const dist = Math.hypot(dx, dy) || 1

      return { dir: { x: dx / dist, y: dy / dist }, dist }
    }

    const dx = otherNode.x - node.x
    const dy = otherNode.y - node.y
    const dist = Math.hypot(dx, dy) || 1

    return {
      dir: { x: dx / dist, y: dy / dist },
      dist: dist / 2
    }
  },

  setCurveTangent(path, segmentIndex, node, dir, dist) {
    this.applyCurvePoint(path, segmentIndex, {
      x: node.x + dir.x * dist,
      y: node.y + dir.y * dist
    })
  },

  applyCurvePoint(path, segmentIndex, point) {
    const curve = path.curves[segmentIndex]

    curve.point.x = point.x
    curve.point.y = point.y

    const nodeA = path.nodes[segmentIndex]
    const nodeB = path.nodes[segmentIndex + 1]

    this.updateCurve(curve, nodeA, nodeB)

    path.segmentHandles[segmentIndex].setAttribute(
      'd',
      this.segmentPathData(nodeA, nodeB, curve)
    )

    this.updateSegmentHighlight()
  },

  // The tangent line a neighboring smooth node holds fixed, dictated by its
  // OTHER (untouched) side — a curve's tangent there, or a straight edge.
  getStableTangentLine(path, nodeIndex, excludeSegmentIndex) {
    const node = path.nodes[nodeIndex]

    if (!node.smooth) {
      return null
    }

    const { incomingIndex, outgoingIndex } = this.getAdjacentSegments(path, nodeIndex)
    const otherIndex = incomingIndex === excludeSegmentIndex ? outgoingIndex : incomingIndex

    if (otherIndex == null) {
      return null
    }

    const otherNode = otherIndex === incomingIndex
      ? path.nodes[incomingIndex]
      : path.nodes[outgoingIndex + 1]

    const tangent = this.getSideTangent(path, otherIndex, node, otherNode)

    return { origin: node, dir: tangent.dir }
  },

  realignSmoothNode(path, nodeIndex, changedSegmentIndex) {
    const node = path.nodes[nodeIndex]

    if (!node.smooth) {
      return
    }

    const { incomingIndex, outgoingIndex } = this.getAdjacentSegments(path, nodeIndex)
    const otherIndex = incomingIndex === changedSegmentIndex ? outgoingIndex : incomingIndex

    if (otherIndex == null || !path.curves[otherIndex]) {
      return
    }

    const changedTangent = this.getSideTangent(path, changedSegmentIndex, node, null)
    const otherTangent = this.getSideTangent(path, otherIndex, node, null)

    const dir = { x: -changedTangent.dir.x, y: -changedTangent.dir.y }

    this.setCurveTangent(path, otherIndex, node, dir, otherTangent.dist)
  },

  getConstrainedCurvePoint(path, index, point) {
    const nodeAIndex = index
    const nodeBIndex = (index + 1) % path.nodeHandles.length

    const snappedPoint = this.snapTangentPoint(
      point,
      path.nodes[nodeAIndex],
      path.nodes[nodeBIndex]
    )

    const constraintA = this.getTangentConstraintLine(path, nodeAIndex, index)
    const constraintB = this.getTangentConstraintLine(path, nodeBIndex, index)

    if (constraintA && constraintB) {
      return this.intersectLines(constraintA, constraintB) ||
        this.projectOntoLine(snappedPoint, constraintA)
    }

    if (constraintA) {
      return this.projectOntoLine(snappedPoint, constraintA)
    }

    if (constraintB) {
      return this.projectOntoLine(snappedPoint, constraintB)
    }

    return snappedPoint
  },

  // Snaps the curve handle to a horizontal or vertical tangent whenever it's
  // within TANGENT_SNAP_THRESHOLD px of lining up with either endpoint.
  snapTangentPoint(point, nodeA, nodeB) {
    const snapped = { x: point.x, y: point.y }

    if (Math.abs(point.x - nodeA.x) < TANGENT_SNAP_THRESHOLD) {
      snapped.x = nodeA.x
    } else if (Math.abs(point.x - nodeB.x) < TANGENT_SNAP_THRESHOLD) {
      snapped.x = nodeB.x
    }

    if (Math.abs(point.y - nodeA.y) < TANGENT_SNAP_THRESHOLD) {
      snapped.y = nodeA.y
    } else if (Math.abs(point.y - nodeB.y) < TANGENT_SNAP_THRESHOLD) {
      snapped.y = nodeB.y
    }

    return snapped
  },

  // A smooth node with a straight segment on one side has to keep its curve
  // handle (on the other side) in line with that segment, since the line's
  // own direction can't bend to match the curve.
  getTangentConstraintLine(path, nodeIndex, excludeSegmentIndex) {
    const { incomingIndex, outgoingIndex } = this.getAdjacentSegments(path, nodeIndex)
    const otherIndex = incomingIndex === excludeSegmentIndex ? outgoingIndex : incomingIndex

    if (otherIndex != null && path.curves[otherIndex]) {
      return null
    }

    return this.getStableTangentLine(path, nodeIndex, excludeSegmentIndex)
  },

  projectOntoLine(point, line) {
    const dx = point.x - line.origin.x
    const dy = point.y - line.origin.y
    const t = dx * line.dir.x + dy * line.dir.y

    return {
      x: line.origin.x + line.dir.x * t,
      y: line.origin.y + line.dir.y * t
    }
  },

  intersectLines(line1, line2) {
    const denom = line1.dir.x * line2.dir.y - line1.dir.y * line2.dir.x

    if (Math.abs(denom) < 1e-6) {
      return null
    }

    const dx = line2.origin.x - line1.origin.x
    const dy = line2.origin.y - line1.origin.y
    const t = (dx * line2.dir.y - dy * line2.dir.x) / denom

    return {
      x: line1.origin.x + line1.dir.x * t,
      y: line1.origin.y + line1.dir.y * t
    }
  }
}))
