import { motion, useMotionValue, useTransform, animate, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useCallback } from 'react'
import { useIntegrityTone, useTheme } from './providers/ExperienceProvider'
import { AuroraBackground } from './ui/aurora-background'

/** Renders a hardware-accelerated dot-matrix overlay via Canvas API. */
function DotMatrix({ theme }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      draw()
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const spacing = 28
      const cols = Math.ceil(canvas.width / spacing)
      const rows = Math.ceil(canvas.height / spacing)
      const cx = canvas.width / 2
      const cy = canvas.height / 2

      // Both modes: violet dots, lighter alpha in light mode
      const dotColor = theme === 'dark'
        ? 'rgba(155, 125, 255, 0.11)'
        : 'rgba(124, 92, 252, 0.08)'

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = i * spacing + spacing / 2
          const y = j * spacing + spacing / 2

          // Radial fade — dots near edges are transparent
          const dx = (x - cx) / (canvas.width / 2)
          const dy = (y - cy) / (canvas.height / 2)
          const dist = Math.sqrt(dx * dx + dy * dy)
          const alpha = Math.max(0, 1 - dist * 1.1)

          ctx.beginPath()
          ctx.arc(x, y, 1.2, 0, Math.PI * 2)
          ctx.fillStyle = dotColor.replace(/[\d.]+\)$/, `${parseFloat(dotColor.match(/[\d.]+\)$/)?.[0] ?? 0.1) * alpha})`)
          ctx.fill()
        }
      }
    }

    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [theme])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ opacity: 1 }}
      aria-hidden="true"
    />
  )
}

/** Mouse-tracking radial spotlight — only active in light mode */
function MouseSpotlight({ theme }) {
  const spotRef = useRef(null)

  const handleMouseMove = useCallback((e) => {
    if (!spotRef.current || theme === 'dark') return
    spotRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`
    spotRef.current.style.opacity = '1'
  }, [theme])

  const handleMouseLeave = useCallback(() => {
    if (!spotRef.current) return
    spotRef.current.style.opacity = '0'
  }, [])

  useEffect(() => {
    if (theme === 'dark') return
    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('mouseleave', handleMouseLeave)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [theme, handleMouseMove, handleMouseLeave])

  if (theme === 'dark') return null

  return (
    <div
      ref={spotRef}
      className="fixed pointer-events-none"
      style={{
        left: 0,
        top: 0,
        width: '520px',
        height: '520px',
        borderRadius: '50%',
        transform: 'translate3d(-100%, -100%, 0) translate(-50%, -50%)',
        background: 'radial-gradient(circle, rgba(184,160,255,0.08) 0%, rgba(124,92,252,0.04) 35%, transparent 70%)',
        opacity: 0,
        transition: 'opacity 0.4s ease',
        zIndex: 0,
      }}
      aria-hidden="true"
    />
  )
}

/** Orb config per theme × integrity tone */
function getOrbConfig(theme, integrityTone) {
  if (integrityTone === 'alert') {
    return {
      one:   { bg: theme === 'dark' ? '#E53935' : '#f97316', opacity: theme === 'dark' ? 0.08 : 0.18 },
      two:   { bg: theme === 'dark' ? '#F4A023' : '#ef4444', opacity: theme === 'dark' ? 0.065 : 0.13 },
      three: { bg: theme === 'dark' ? '#E53935' : '#f97316', opacity: theme === 'dark' ? 0.05 : 0.10 },
    }
  }
  if (theme === 'dark') {
    return {
      one:   { bg: '#7C5CFC', opacity: 0.045 },
      two:   { bg: '#9B7DFF', opacity: 0.030 },
      three: { bg: '#5B3FBD', opacity: 0.055 },
    }
  }
  // Light mode — same violet family as dark, at higher opacity for a light background
  return {
    one:   { bg: '#9B7DFF', opacity: 0.16 },
    two:   { bg: '#B8A0FF', opacity: 0.13 },
    three: { bg: '#7C5CFC', opacity: 0.10 },
  }
}

/** Persistent, low-contrast cinematic atmosphere used across the product. */
export default function AmbientBackground() {
  const { integrityTone } = useIntegrityTone()
  const { theme } = useTheme()
  const prefersReducedMotion = useReducedMotion()

  const orbs = getOrbConfig(theme, integrityTone)
  const isAlert = integrityTone === 'alert'
  const isLight = theme !== 'dark'

  return (
    <div
      className={`ambient-background ambient-${integrityTone}`}
      aria-hidden="true"
    >
      {/* Aurora streaks — global ambient aurora animation */}
      <AuroraBackground className="absolute inset-0 pointer-events-none" showRadialGradient />

      {/* Dot-matrix genesis chain overlay */}
      <DotMatrix theme={theme} />

      {/* Mouse spotlight — light mode only */}
      <MouseSpotlight theme={theme} />

      {/* Grid scan lines */}
      <div className="ambient-grid" />

      {/* Orb 1 — primary */}
      <motion.div
        className="ambient-orb ambient-orb-one"
        animate={prefersReducedMotion ? {} : {
          x: [0, 80, -30, 0],
          y: [0, 50, 95, 0],
          scale: [1, 1.16, 0.92, 1],
        }}
        transition={{ duration: isAlert ? 16 : 22, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          willChange: 'transform',
          background: orbs.one.bg,
          opacity: orbs.one.opacity,
          filter: isLight ? 'blur(110px)' : 'blur(140px)',
        }}
      />

      {/* Orb 2 — secondary */}
      <motion.div
        className="ambient-orb ambient-orb-two"
        animate={prefersReducedMotion ? {} : {
          x: [0, -70, 45, 0],
          y: [0, 75, 35, 0],
          scale: [1, 0.86, 1.12, 1],
        }}
        transition={{ duration: isAlert ? 20 : 27, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          willChange: 'transform',
          background: orbs.two.bg,
          opacity: orbs.two.opacity,
          filter: isLight ? 'blur(120px)' : 'blur(140px)',
        }}
      />

      {/* Orb 3 — accent */}
      <motion.div
        className="ambient-orb ambient-orb-three"
        animate={prefersReducedMotion ? {} : {
          x: [0, -60, 30, 0],
          y: [0, -45, 55, 0],
          scale: [0.85, 1.08, 0.95, 0.85],
        }}
        transition={{ duration: isAlert ? 24 : 31, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          willChange: 'transform',
          background: orbs.three.bg,
          opacity: orbs.three.opacity,
          filter: isLight ? 'blur(100px)' : 'blur(140px)',
        }}
      />

      {/* Light mode: warm vignette for depth */}
      {isLight && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(124,92,252,0.05) 0%, transparent 70%)',
            zIndex: 0,
          }}
        />
      )}

      {/* Noise grain */}
      <div className="ambient-noise" />
    </div>
  )
}
