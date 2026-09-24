/*
 * Pure UI component: a range input with a
 * label and a text readout next to it.
 * Knows nothing about what the value
 * means - onChange fires with the raw
 * numeric value, and update() sets it.
 * label is static text, formatLabel
 * controls only the dynamic readout text.
 */
export class Slider {
  constructor(
    container,
    {
      className = '',
      label = '',
      min = 0,
      max = 100,
      step = 1,
      formatLabel = (value) => String(value),
      onChange
    } = {}
  ) {
    this.formatLabel = formatLabel

    this.wrapper = document.createElement('div')
    this.wrapper.className = `form-control ${className}`.trim()
    this.wrapper.innerHTML = `
      <input type="range" min="${min}" max="${max}" step="${step}">
      <label>${label} <span></span></label>
    `

    this.input = this.wrapper.querySelector('input')
    this.readout = this.wrapper.querySelector('span')

    this.input.addEventListener('input', () => {
      const value = Number(this.input.value)

      this.readout.textContent = this.formatLabel(value)
      onChange?.(value)
    })

    container.append(this.wrapper)
  }

  update(value) {
    this.input.value = String(value)
    this.readout.textContent = this.formatLabel(value)
  }
}
