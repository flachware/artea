import { Scene } from './scene.js'
import { Renderer } from './renderer/renderer.js'

const DOUBLE_CLICK_TIMEOUT = 400
const PATH_MODE = 'spline'
const CURVE_MODE = 'artea'

export class Editor {
  constructor(selector) {
    const container = document.querySelector(selector)

    this.scene = new Scene(PATH_MODE, CURVE_MODE)
    this.renderer = new Renderer(container)
    this.currentPath = null
    this.selectedNode = null
    this.lastNodeClick = null
    this.modeButton = document.querySelector('.mode-toggle')

    container.addEventListener('mousedown', (event) => this.handleMouseDown(event))

    if (this.modeButton) {
      this.modeButton.addEventListener('click', () => this.togglePathMode())
      this.updateModeButton()
    }

    this.render()
  }

  togglePathMode() {
    this.scene.pathMode = this.scene.pathMode === 'curve' ? 'spline' : 'curve'

    this.updateModeButton()
    this.render()
  }

  updateModeButton() {
    this.modeButton.textContent = this.scene.pathMode === 'curve' ? 'Spline' : 'Curve'
  }

  handleMouseDown(event) {
    if (!event.ctrlKey && !event.metaKey) {
      this.deselectAll()
      return
    }

    if (!this.currentPath) {
      this.currentPath = this.scene.addPath()
      this.currentPath.selected = true
    }

    this.currentPath.addNode(event.clientX, event.clientY)

    this.render()
  }

  deselectAll() {
    let changed = false

    if (this.currentPath) {
      this.currentPath.selected = false
      this.currentPath = null
      changed = true
    }

    if (this.selectedNode) {
      this.selectedNode.selected = false
      this.selectedNode = null
      changed = true
    }

    if (changed) {
      this.render()
    }
  }

  selectNode(node) {
    if (this.selectedNode) {
      this.selectedNode.selected = false
    }

    this.selectedNode = node
    node.selected = true
  }

  isDoubleClick(node) {
    const now = performance.now()
    const isDouble = this.lastNodeClick &&
      this.lastNodeClick.node === node &&
      now - this.lastNodeClick.time < DOUBLE_CLICK_TIMEOUT

    this.lastNodeClick = isDouble ? null : { node, time: now }

    return isDouble
  }

  render() {
    const handlesByPath = this.renderer.render(this.scene, true)

    handlesByPath.forEach(({ nodeHandles, segmentHandles, offCurveHandles }, path) => {
      const onCurveNodes = path.nodes.filter((node) => node.type !== 'offcurve')
      const offCurveNodes = path.nodes.filter((node) => node.type === 'offcurve')

      nodeHandles.forEach((handle, index) => {
        const node = onCurveNodes[index]

        handle.addEventListener('mousedown', (event) => {
          event.stopPropagation()

          if (index === 0 && path.selected && (event.ctrlKey || event.metaKey)) {
            path.close()
            this.render()
            return
          }

          if (this.isDoubleClick(node)) {
            path.toggleSmooth(node)
            this.render()
            return
          }

          this.selectNode(node)
          this.render()
          this.dragNode(path, node, event)
        })
      })

      segmentHandles.forEach((handle, index) => {
        handle.addEventListener('mousedown', (event) => {
          if (!event.altKey) {
            return
          }

          event.stopPropagation()

          path.convertSegmentToCurve(index)
          this.render()
        })
      })

      offCurveHandles.forEach((handle, index) => {
        const node = offCurveNodes[index]

        handle.addEventListener('mousedown', (event) => {
          event.stopPropagation()

          this.selectNode(node)
          this.render()
          this.dragNode(path, node, event)
        })
      })
    })
  }

  dragNode(path, node, startEvent) {
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

      path.moveNode(node, event.clientX, event.clientY)
      this.render()
    }

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }
}
