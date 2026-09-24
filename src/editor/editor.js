import { Scene } from '../scene.js'
import { Renderer } from '../renderer/renderer.js'
import { ToggleButton } from './ui/toggle-button.js'
import { Slider } from './ui/slider.js'
import { Readout } from './ui/readout.js'

const DOUBLE_CLICK_TIMEOUT = 400
const PATH_MODE = 'spline'
const CURVE_MODE = 'artea'

export class Editor {
  constructor(selector) {
    const container = document.querySelector(selector)
    const panel = document.querySelector('.panel')

    this.scene = new Scene(PATH_MODE, CURVE_MODE)
    this.renderer = new Renderer(container)
    this.currentPath = null
    this.selectedPath = null
    this.selectedNode = null
    this.lastNodeClick = null

    this.components = panel ? this.createUIComponents(panel) : []

    container.addEventListener('mousedown', (event) => this.handleMouseDown(event))
    window.addEventListener('keydown', (event) => this.handleKeyDown(event))

    this.render()
  }

  createUIComponents(panel) {
    return [
      {
        component: new ToggleButton(panel, {
          className: 'spline-toggle',
          onClick: () => {
            this.scene.pathMode =
              this.scene.pathMode === 'curve' ? 'spline' : 'curve'

            this.render()
          }
        }),

        getValue: () =>
          this.scene.pathMode === 'curve' ? 'Spline' : 'Curve'
      },

      {
        component: new ToggleButton(panel, {
          className: 'artea-toggle',
          onClick: () => {
            this.scene.curveMode =
              this.scene.curveMode === 'elliptic' ? 'artea' : 'elliptic'

            this.render()
          }
        }),

        getValue: () =>
          this.scene.curveMode === 'elliptic' ? 'Artea' : 'Circle'
      },

      {
        component: new Slider(panel, {
          className: 'anisotropy',
          label: 'Anisotropy',
          min: 0,
          max: 100,
          step: 1,
          formatLabel: (percent) => `${percent}%`,
          onChange: (percent) => {
            this.scene.verticalStretch = 1 + percent / 100

            this.render()
          }
        }),

        getValue: () =>
          Math.round((this.scene.verticalStretch - 1) * 100)
      },

      {
        component: new Readout(panel, { className: 'info' }),

        getValue: () => {
          const node = this.selectedNode

          return node
            ? `x: ${Math.round(node.x)}, y: ${Math.round(node.y)}`
            : ''
        }
      }
    ]
  }

  updateUI() {
    this.components.forEach(({ component, getValue }) => {
      component.update(getValue())
    })
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

    const node = this.currentPath.addNode(event.clientX, event.clientY)

    this.selectNode(this.currentPath, node)
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
      this.selectedPath = null
      changed = true
    }

    if (changed) {
      this.render()
    }
  }

  selectNode(path, node) {
    if (this.selectedNode) {
      this.selectedNode.selected = false
    }

    this.selectedPath = path
    this.selectedNode = node
    node.selected = true
  }

  handleKeyDown(event) {
    const deltas = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 }
    }

    const delta = deltas[event.key]

    if (!delta || !this.selectedNode || !this.selectedPath) {
      return
    }

    event.preventDefault()

    const step = event.shiftKey ? 10 : 1

    this.selectedPath.moveNode(
      this.selectedNode,
      this.selectedNode.x + delta.x * step,
      this.selectedNode.y + delta.y * step
    )

    this.render()
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
            this.selectNode(path, node)
            this.render()
            return
          }

          if (this.isDoubleClick(node)) {
            path.toggleSmooth(node)
            this.render()
            return
          }

          this.selectNode(path, node)
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

          this.selectNode(path, node)
          this.render()
          this.dragNode(path, node, event)
        })
      })
    })

    this.updateUI()
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
