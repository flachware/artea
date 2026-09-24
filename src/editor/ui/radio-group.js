/*
 * Pure UI component: a fieldset of radio
 * buttons for choosing between named
 * options. Knows nothing about what the
 * value means - onChange fires with the
 * selected option's value, and update()
 * checks the matching radio.
 */
export class RadioGroup {
  constructor(
    container,
    { className = '', name, options = [], onChange } = {}
  ) {
    this.fieldset = document.createElement('fieldset')
    this.fieldset.className = className
    this.fieldset.innerHTML = options
      .map(
        (option) => `
          <label>
            <input type="radio" name="${name}" value="${option.value}">
            ${option.label}
          </label>
        `
      )
      .join('')

    this.inputs = [
      ...this.fieldset.querySelectorAll('input')
    ]

    this.inputs.forEach((input) => {
      input.addEventListener('change', () => {
        if (input.checked) {
          onChange?.(input.value)
        }
      })
    })

    container.append(this.fieldset)
  }

  update(value) {
    this.inputs.forEach((input) => {
      input.checked = input.value === value
    })
  }
}
