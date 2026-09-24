import { Scene } from '../scene.js'
import { Renderer } from '../renderer/renderer.js'
import { computeOrigin, screenToLogical } from '../renderer/coordinates.js'
import { RadioGroup } from './ui/radio-group.js'
import { Slider } from './ui/slider.js'
import { Readout } from './ui/readout.js'

const DOUBLE_CLICK_TIMEOUT = 400
const PATH_MODE = 'spline'
const CURVE_MODE = 'artea'

export class Editor {
  constructor(selector) {
    this.container = document.querySelector(selector)
    const panel = document.querySelector('.panel')

    this.scene = new Scene(PATH_MODE, CURVE_MODE)
    this.renderer = new Renderer(this.container)
    this.currentPath = null
    this.selectedPath = null
    this.selectedNode = null
    this.lastNodeClick = null
    this.toolBeforeModifier = null

    this.components = panel ? this.createUIComponents(panel) : []

    this.setTool('select')

    this.container.addEventListener('mousedown', (event) => this.handleMouseDown(event))
    window.addEventListener('keydown', (event) => this.handleKeyDown(event))
    window.addEventListener('keyup', (event) => this.handleKeyUp(event))

    this.render()
  }

  toLogical(clientX, clientY) {
    const origin = computeOrigin(
      this.container.clientWidth,
      this.container.clientHeight
    )

    return screenToLogical(origin, clientX, clientY)
  }

  setTool(tool) {
    this.tool = tool

    this.container.classList.toggle('draw', tool === 'draw')
    this.container.classList.toggle('select', tool === 'select')

    this.updateUI()
  }

  createUIComponents(panel) {
    return [
      {
        component: new RadioGroup(panel, {
          className: 'tool-toggle',
          name: 'tool',
          options: [
            { value: 'select', label: 'Select' },
            { value: 'draw', label: 'Draw' }
          ],
          onChange: (value) => {
            this.setTool(value)
          }
        }),

        getValue: () => this.tool
      },

      {
        component: new RadioGroup(panel, {
          className: 'artea-toggle',
          name: 'curve-mode',
          options: [
            { value: 'artea', label: 'Artea' },
            { value: 'elliptic', label: 'Circle' }
          ],
          onChange: (value) => {
            this.scene.curveMode = value

            this.render()
          }
        }),

        getValue: () => this.scene.curveMode
      },

      {
        component: new RadioGroup(panel, {
          className: 'spline-toggle',
          name: 'path-mode',
          options: [
            { value: 'spline', label: 'Spline' },
            { value: 'curve', label: 'Curve' }
          ],
          onChange: (value) => {
            this.scene.pathMode = value

            this.render()
          }
        }),

        getValue: () => this.scene.pathMode
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
    if (this.tool !== 'draw') {
      this.deselectAll()
      return
    }

    if (!this.currentPath) {
      this.currentPath = this.scene.addPath()
      this.currentPath.selected = true
    }

    const point = this.toLogical(event.clientX, event.clientY)
    const node = this.currentPath.addNode(point.x, point.y)

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
    if (
      (event.key === 'Control' || event.key === 'Meta') &&
      this.tool !== 'draw'
    ) {
      this.toolBeforeModifier = this.tool
      this.setTool('draw')
    }

    const deltas = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: 1 },
      ArrowDown: { x: 0, y: -1 }
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
      this.selectedNode.y + delta.y * step,
      { snap: false }
    )

    this.render()
  }

  handleKeyUp(event) {
    if (
      (event.key === 'Control' || event.key === 'Meta') &&
      this.toolBeforeModifier
    ) {
      this.setTool(this.toolBeforeModifier)
      this.toolBeforeModifier = null
    }
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

          if (index === 0 && path.selected && this.tool === 'draw') {
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

      const point = this.toLogical(event.clientX, event.clientY)

      path.moveNode(node, point.x, point.y)
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
