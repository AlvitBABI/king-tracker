import confetti from 'canvas-confetti'

const colors = ['#c8102e', '#ff3b3b', '#f3e9dc', '#8a0b1f', '#ffd166']

// Blood-red confetti burst from both bottom corners.
export function celebrate() {
  const opts = { particleCount: 70, spread: 70, startVelocity: 55, colors, zIndex: 1000, disableForReducedMotion: true }
  confetti({ ...opts, angle: 60, origin: { x: 0, y: 0.9 } })
  confetti({ ...opts, angle: 120, origin: { x: 1, y: 0.9 } })
  setTimeout(() => confetti({ ...opts, particleCount: 40, spread: 120, startVelocity: 35, origin: { x: 0.5, y: 0.6 } }), 250)
}
