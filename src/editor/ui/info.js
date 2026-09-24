export class Info {
  constructor(container) {
    this.element = document.createElement('div')
    this.element.classList.add('info')

    container.appendChild(this.element)
  }

  update(editor) {
    const node = editor.selectedNode

    this.element.textContent = node
      ? `x: ${Math.round(node.x)}, y: ${Math.round(node.y)}`
      : ''
  }
}
