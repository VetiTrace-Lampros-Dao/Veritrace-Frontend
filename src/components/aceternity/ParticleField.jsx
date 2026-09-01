import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useTheme } from '../providers/ExperienceProvider'

/**
 * ParticleField — Canvas-based animated particle network
 * Highly optimized: uses useTheme hook to avoid DOM queries in the render loop,
 * pre-parses colors to integers once, and uses rgba string template to avoid hex conversion GC pressure.
 * Uses IntersectionObserver to pause animation when off-screen.
 */
export function ParticleField({ className, density = 50, color = '' }) {
  const canvasRef = useRef(null)
  const { theme } = useTheme()
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    if (prefersReducedMotion) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf = null
    let particles = []
    const isMobile = window.innerWidth < 768
    const effectiveDensity = isMobile ? Math.round(density * 0.5) : density
    const linkDistance = isMobile ? 80 : 120

    // Use theme colors — matches the brand accent (violet) in both modes
    const r = theme === 'dark' ? 155 : 124
    const g = theme === 'dark' ? 125 : 92
    const b = theme === 'dark' ? 255 : 252
    const opacityBase = theme === 'dark' ? 0.5 : 0.25
    const fillStyleStr = `rgba(${r}, ${g}, ${b}, ${theme === 'dark' ? '0.37' : '0.25'})`

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      canvas.width = parent.offsetWidth
      canvas.height = parent.offsetHeight
      particles = Array.from({ length: effectiveDensity }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.5 + 0.5,
      }))
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      particles.forEach((p, i) => {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = fillStyleStr
        ctx.fill()

        for (let j = i + 1; j < particles.length; j++) {
          const dx = p.x - particles[j].x
          const dy = p.y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < linkDistance) {
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(particles[j].x, particles[j].y)
            const alpha = (opacityBase * (1 - dist / linkDistance)).toFixed(2)
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      })
      raf = requestAnimationFrame(draw)
    }

    resize()

    // Only run the animation loop when the canvas is visible
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        if (!raf) draw()
      } else {
        if (raf) {
          cancelAnimationFrame(raf)
          raf = null
        }
      }
    }, { threshold: 0.05 })

    observer.observe(canvas)
    window.addEventListener('resize', resize)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      observer.disconnect()
      window.removeEventListener('resize', resize)
    }
  }, [density, color, theme, prefersReducedMotion])

  if (prefersReducedMotion) return null

  return (
    <canvas
      ref={canvasRef}
      className={cn('absolute inset-0 pointer-events-none', className)}
      style={{ transform: 'translateZ(0)' }}
    />
  )
}
