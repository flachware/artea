/*
 * Pure UI component: a <select> for
 * choosing between named options. Knows
 * nothing about what the value means -
 * onChange fires with the selected
 * option's value, and update() selects
 * the matching option.
 */
export class Select {
  constructor(
    container,
    { className = '', options = [], onChange } = {}
  ) {
    this.select = document.createElement('select')
    this.select.className = className
    this.select.innerHTML = options
      .map(
        (option) =>
          `<option value="${option.value}">${option.label}</option>`
      )
      .join('')

    this.select.addEventListener('change', () => {
      onChange?.(this.select.value)
    })

    container.append(this.select)
  }

  update(value) {
    this.select.value = value
  }
}
