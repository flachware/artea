import Alpine from 'alpinejs'

Alpine.data('canvas', () => ({
  width: window.innerWidth,
  height: window.innerHeight,

  get viewBox() {
    return `0 0 ${this.width} ${this.height}`
  },

  init() {
    window.addEventListener('resize', () => {
      this.width = window.innerWidth
      this.height = window.innerHeight
    })
  },

  edit() {
    console.log('point')
  }
}))
