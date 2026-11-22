import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Bottom sheet: slides up, closes on backdrop tap, Escape, or swiping down
// from the handle/header area.
export default function Sheet({ title, onClose, children, className = '' }) {
  const panel = useRef(null)
  const drag = useRef(null)
  const [closing, setClosing] = useState(false)

  const close = () => {
    setClosing(true)
    setTimeout(onClose, 200)
  }

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && close()
    document.addEventListener('keydown', onKey)
    document.body.classList.add('no-scroll')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('no-scroll')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onTouchStart = (e) => {
    drag.current = { y: e.touches[0].clientY, dy: 0 }
  }
  const onTouchMove = (e) => {
    if (!drag.current) return
    const dy = Math.max(0, e.touches[0].clientY - drag.current.y)
    drag.current.dy = dy
    panel.current.style.transition = 'none'
    panel.current.style.transform = `translateY(${dy}px)`
  }
  const onTouchEnd = () => {
    if (!drag.current) return
    const { dy } = drag.current
    drag.current = null
    panel.current.style.transition = ''
    panel.current.style.transform = ''
    if (dy > 90) close()
  }

  return createPortal(
    <div className={`sheet-root${closing ? ' closing' : ''}`}>
      <div className="sheet-backdrop" onClick={close} />
      <div className={`sheet ${className}`} ref={panel} role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-grab" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <span className="sheet-handle" />
          {title && <h2 className="sheet-title">{title}</h2>}
          <button className="icon-btn sheet-close" onClick={close} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
