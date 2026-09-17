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

        this.$el.appendChild(element)

        polyline = {
            element,
            points: [],
            circles: []
        }

        this.polylines.push(polyline)
        this.selectedPolyline = polyline
    }

    const point = {
        x: event.clientX,
        y: event.clientY
    }

    polyline.points.push(point)

    polyline.element.setAttribute(
        'points',
        polyline.points
            .map(p => `${p.x},${p.y}`)
            .join(' ')
    )

    const circle = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'circle'
    )

    circle.setAttribute('cx', point.x)
    circle.setAttribute('cy', point.y)
    circle.setAttribute('r', 5)
    circle.setAttribute('fill', 'none')
    circle.setAttribute('stroke', 'black')

    this.$el.appendChild(circle)

    polyline.circles.push(circle)
}
}))
