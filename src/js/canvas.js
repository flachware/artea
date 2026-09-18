import Alpine from 'alpinejs'

const SVG_NS = 'http://www.w3.org/2000/svg'

Alpine.data('canvas', () => ({
  width: window.innerWidth,
  height: window.innerHeight,

  paths: [],
  selectedPath: null,
  selectedPointHandle: null,
  selectedSegmentHandle: null,
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
    this.deselectPoint()
    this.deselectSegment()

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
        points: [],
        pointHandles: [],
        segmentHandles: [],
        closed: false
      }

      this.paths.push(path)
      this.selectedPath = path
    }

    const point = {
      x: event.clientX,
      y: event.clientY
    }

    const previousPoint = path.points[path.points.length - 1]

    path.points.push(point)

    this.updatePath(path)

    if (previousPoint) {
      this.addSegmentHandle(path, previousPoint, point)
    }

    this.addPointHandle(path, point)
  },

  updatePath(path) {
    path.element.setAttribute(
      'd',
      path.points
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`)
        .join(' ')
    )
  },

  addPointHandle(path, point) {
    const pointHandle = document.createElementNS(SVG_NS, 'circle')

    pointHandle.setAttribute('cx', point.x)
    pointHandle.setAttribute('cy', point.y)
    pointHandle.setAttribute('r', 5)
    pointHandle.setAttribute('fill', 'none')
    pointHandle.setAttribute('stroke', 'black')
    pointHandle.setAttribute('stroke-width', '1.1')
    pointHandle.setAttribute('pointer-events', 'all')

    this.$el.appendChild(pointHandle)

    path.pointHandles.push(pointHandle)

    pointHandle.addEventListener('mousedown', (event) => {
      event.stopPropagation()

      const isFirstHandle = pointHandle === path.pointHandles[0]
      const isOpenAndSelected = !path.closed &&
        Alpine.raw(this.selectedPath) === path

      if (isFirstHandle && isOpenAndSelected && (event.ctrlKey || event.metaKey)) {
        this.closePath(path)
        return
      }

      this.selectPoint(pointHandle)
      this.dragPoint(path, point, pointHandle, event)
    })

    if (path.pointHandles.length > 1) {
      // Keep first handle on top
      this.$el.appendChild(path.pointHandles[0])
    }
  },

  addSegmentHandle(path, pointA, pointB) {
    const segmentHandle = document.createElementNS(SVG_NS, 'line')

    segmentHandle.setAttribute('x1', pointA.x)
    segmentHandle.setAttribute('y1', pointA.y)
    segmentHandle.setAttribute('x2', pointB.x)
    segmentHandle.setAttribute('y2', pointB.y)
    segmentHandle.setAttribute('stroke', 'transparent')
    segmentHandle.setAttribute('stroke-width', '10')
    segmentHandle.setAttribute('pointer-events', 'all')

    this.$el.appendChild(segmentHandle)

    path.segmentHandles.push(segmentHandle)

    segmentHandle.addEventListener('mousedown', (event) => {
      event.stopPropagation()

      this.selectSegment(segmentHandle)
    })

    // Keep point handles above segment handles
    path.pointHandles.forEach((pointHandle) => {
      this.$el.appendChild(pointHandle)
    })
  },

  updateSegmentHandles(path) {
    path.segmentHandles.forEach((segmentHandle, i) => {
      const pointA = path.points[i]
      const pointB = path.points[i + 1]

      segmentHandle.setAttribute('x1', pointA.x)
      segmentHandle.setAttribute('y1', pointA.y)
      segmentHandle.setAttribute('x2', pointB.x)
      segmentHandle.setAttribute('y2', pointB.y)
    })

    this.updateSegmentHighlight()
  },

  dragPoint(path, point, pointHandle, startEvent) {
    const startX = startEvent.clientX
    const startY = startEvent.clientY
    const threshold = 5

    let dragging = false

    const onMouseMove = (event) => {
      if (!dragging) {
        const dx = event.clientX - startX
        const dy = event.clientY - startY

        if (Math.hypot(dx, dy) < threshold) {
          return
        }

        dragging = true
      }

      point.x = event.clientX
      point.y = event.clientY

      pointHandle.setAttribute('cx', point.x)
      pointHandle.setAttribute('cy', point.y)

      this.updatePath(path)
      this.updateSegmentHandles(path)
    }

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  },

  selectPoint(pointHandle) {
    this.deselectSegment()
    this.deselectPoint()

    this.selectedPointHandle = pointHandle
    pointHandle.setAttribute('fill', 'black')
  },

  deselectPoint() {
    if (!this.selectedPointHandle) {
      return
    }

    this.selectedPointHandle.setAttribute('fill', 'none')
    this.selectedPointHandle = null
  },

  selectSegment(segmentHandle) {
    this.deselectPoint()
    this.deselectSegment()

    this.selectedSegmentHandle = segmentHandle

    if (!this.segmentHighlight) {
      this.segmentHighlight = document.createElementNS(SVG_NS, 'line')
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

    const segmentHandle = this.selectedSegmentHandle

    this.segmentHighlight.setAttribute('x1', segmentHandle.getAttribute('x1'))
    this.segmentHighlight.setAttribute('y1', segmentHandle.getAttribute('y1'))
    this.segmentHighlight.setAttribute('x2', segmentHandle.getAttribute('x2'))
    this.segmentHighlight.setAttribute('y2', segmentHandle.getAttribute('y2'))
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

    if (path.points.length < 3) {
      return
    }

    path.closed = true

    const lastPoint = path.points[path.points.length - 1]
    const firstPoint = path.points[0]

    path.points.push(firstPoint)

    this.updatePath(path)
    this.addSegmentHandle(path, lastPoint, firstPoint)

    this.selectedPath = null
  }
}))
