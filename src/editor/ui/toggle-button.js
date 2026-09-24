/*
 * Pure UI component: a button that shows
 * whatever label update() is given and
 * fires onClick when pressed. Knows
 * nothing about what it toggles - the
 * caller wires that up.
 */
export class ToggleButton {
  constructor(container, { className = '', onClick } = {}) {
    this.button = document.createElement('button')
    this.button.className = className

    this.button.addEventListener('click', () => {
      onClick?.()
    })

    container.append(this.button)
  }

  update(label) {
    this.button.textContent = label
  }
}
