import Alpine from 'alpinejs'

Alpine.data('canvas', () => ({
  width: window.innerWidth,
  height: window.innerHeight,

  polylines: [],
  selectedPolyline: null,
  selectedHandle: null,

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

    if (!event.ctrlKey && !event.metaKey) {
      this.selectedPolyline = null
      return
    }

    let polyline = this.selectedPolyline

    if (!polyline) {
      const element = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'polyline'
      )

      element.setAttribute('fill', 'none')
      element.setAttribute('stroke', 'black')
      element.setAttribute('stroke-width', '1.1')

      this.$el.appendChild(element)

      polyline = {
        element,
        points: [],
        handles: [],
        closed: false
      }

      this.polylines.push(polyline)
      this.selectedPolyline = polyline
    }

    const point = {
      x: event.clientX,
      y: event.clientY
    }

    polyline.points.push(point)

    this.updatePolyline(polyline)
    this.addPointHandle(polyline, point)
  },

  updatePolyline(polyline) {
    polyline.element.setAttribute(
      'points',
      polyline.points
        .map(p => `${p.x},${p.y}`)
        .join(' ')
    )
  },

  addPointHandle(polyline, point) {
    const handle = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'circle'
    )

    handle.setAttribute('cx', point.x)
    handle.setAttribute('cy', point.y)
    handle.setAttribute('r', 5)
    handle.setAttribute('fill', 'none')
    handle.setAttribute('stroke', 'black')
    handle.setAttribute('stroke-width', '1.1')
    handle.setAttribute('pointer-events', 'all')

    this.$el.appendChild(handle)

    polyline.handles.push(handle)

    handle.addEventListener('mousedown', (event) => {
      event.stopPropagation()

      const isFirstHandle = handle === polyline.handles[0]
      const isOpenAndSelected = !polyline.closed &&
        Alpine.raw(this.selectedPolyline) === polyline

      if (isFirstHandle && isOpenAndSelected && (event.ctrlKey || event.metaKey)) {
        this.closePolyline(polyline)
        return
      }

      this.selectPoint(handle)
      this.dragPoint(polyline, point, handle, event)
    })

    if (polyline.points.length > 1) {
      // Keep first handle on top
      this.$el.appendChild(polyline.handles[0])
    }
  },

  dragPoint(polyline, point, handle, startEvent) {
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

      handle.setAttribute('cx', point.x)
      handle.setAttribute('cy', point.y)

      this.updatePolyline(polyline)
    }

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  },

  selectPoint(handle) {
    this.deselectPoint()

    this.selectedHandle = handle
    handle.setAttribute('fill', 'black')
  },

  deselectPoint() {
    if (!this.selectedHandle) {
      return
    }

    this.selectedHandle.setAttribute('fill', 'none')
    this.selectedHandle = null
  },

  closePolyline(polyline) {
    if (polyline.closed) {
      return
    }

    if (polyline.points.length < 3) {
      return
    }

    polyline.closed = true

    polyline.points.push(polyline.points[0])

    this.updatePolyline(polyline)

    this.selectedPolyline = null
  }
}))
