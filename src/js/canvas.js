import Alpine from 'alpinejs'

Alpine.data('canvas', () => ({
  width: window.innerWidth,
  height: window.innerHeight,

  polylines: [],
  selectedPolyline: null,

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

    if (polyline.points.length === 1) {
      handle.addEventListener('mousedown', (event) => {
        event.stopPropagation()

        if (Alpine.raw(this.selectedPolyline) !== polyline) {
          return
        }

        this.closePolyline(polyline)
      })
    } else {
      // Keep first handle on top
      this.$el.appendChild(polyline.handles[0])
    }
  },

  closePolyline(polyline) {
    if (polyline.closed) {
      return
    }

    if (polyline.points.length < 3) {
      return
    }

    polyline.closed = true

    const firstPoint = polyline.points[0]

    polyline.points.push({
      x: firstPoint.x,
      y: firstPoint.y
    })

    this.updatePolyline(polyline)

    this.selectedPolyline = null
  }
}))
