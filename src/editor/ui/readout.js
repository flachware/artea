/*
 * Pure UI component: displays whatever
 * text update() is given.
 */
export class Readout {
  constructor(container, { className = '' } = {}) {
    this.element = document.createElement('div')
    this.element.className = className

    container.append(this.element)
  }

  update(text) {
    this.element.textContent = text || ''
  }
}
