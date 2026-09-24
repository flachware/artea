export class PathModeToggle {
  constructor(container, editor) {
    this.button = document.createElement('button')
    this.button.classList.add('spline-toggle')

    this.button.addEventListener('click', () => {
      editor.scene.pathMode =
        editor.scene.pathMode === 'curve' ? 'spline' : 'curve'

      editor.render()
    })

    container.appendChild(this.button)
  }

  update(editor) {
    this.button.textContent =
      editor.scene.pathMode === 'curve' ? 'Spline' : 'Curve'
  }
}
