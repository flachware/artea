export class CurveModeToggle {
  constructor(container, editor) {
    this.button = document.createElement('button')
    this.button.classList.add('artea-toggle')

    this.button.addEventListener('click', () => {
      editor.scene.curveMode =
        editor.scene.curveMode === 'elliptic' ? 'artea' : 'elliptic'

      editor.render()
    })

    container.appendChild(this.button)
  }

  update(editor) {
    this.button.textContent =
      editor.scene.curveMode === 'elliptic' ? 'Artea' : 'Circle'
  }
}
