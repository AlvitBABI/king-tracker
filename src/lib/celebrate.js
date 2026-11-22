import confetti from 'canvas-confetti'

const colors = ['#c8102e', '#ff3b3b', '#f3e9dc', '#8a0b1f', '#ffd166']

// Blood-red confetti burst from both bottom corners.
export function celebrate() {
  const opts = { particleCount: 70, spread: 70, startVelocity: 55, colors, zIndex: 1000, disableForReducedMotion: true }
  confetti({ ...opts, angle: 60, origin: { x: 0, y: 0.9 } })
  confetti({ ...opts, angle: 120, origin: { x: 1, y: 0.9 } })
  setTimeout(() => confetti({ ...opts, particleCount: 40, spread: 120, startVelocity: 35, origin: { x: 0.5, y: 0.6 } }), 250)
}

const gold = ['#d9a441', '#f5d27a', '#b8860b', '#fff3c4', '#c8102e']

// A smaller gold shower for a new book on the shelf. `origin` lets it burst
// from the card that was tapped.
export function celebrateOwned(origin = { x: 0.5, y: 0.7 }) {
  confetti({
    particleCount: 60,
    spread: 75,
    startVelocity: 32,
    gravity: 0.9,
    scalar: 0.9,
    shapes: ['square', 'circle'],
    colors: gold,
    origin,
    zIndex: 1000,
    disableForReducedMotion: true,
  })
}
