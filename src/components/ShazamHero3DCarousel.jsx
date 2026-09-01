import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Shield, FingerprintPattern as Fingerprint, Lock, ArrowRight, Zap, Eye } from 'lucide-react'

// Evidence cards data with high-contrast, theme-adaptive dark glass backgrounds and vibrant badge accents
const CAROUSEL_CARDS = [
  {
    id: 'sha256',
    title: 'SHA-256 Cryptographic Hash',
    tag: 'EXACT PROOF',
    badgeColor: '#12AAFF',
    cardBg: 'linear-gradient(145deg, #111827 0%, #0F172A 100%)',
    bgGlow: 'rgba(18, 170, 255, 0.4)',
    ambientBg: 'radial-gradient(ellipse at 70% 50%, rgba(18, 170, 255, 0.22) 0%, rgba(27, 74, 221, 0.12) 45%, transparent 75%)',
    description: 'Deterministic 256-bit fingerprint of raw file bytes. Any single byte modification completely changes the hash, giving byte-for-byte exact proof.',
    codeSnippet: '0xa1b2c3d4e5f67890123456789abcdef0...',
    stats: { speed: '< 5ms', accuracy: '100% Exact', layer: 'Layer 1' },
    icon: Lock
  },
  {
    id: 'phash',
    title: 'Perceptual Visual pHash',
    tag: 'STRUCTURE PROOF',
    badgeColor: '#00D395',
    cardBg: 'linear-gradient(145deg, #064E3B 0%, #022C22 100%)',
    bgGlow: 'rgba(0, 211, 149, 0.4)',
    ambientBg: 'radial-gradient(ellipse at 70% 50%, rgba(0, 211, 149, 0.22) 0%, rgba(0, 160, 100, 0.12) 45%, transparent 75%)',
    description: '64-bit DCT visual fingerprint. Resists image compression, resizing, color shifts, and format changes using Hamming distance matching.',
    codeSnippet: 'pHash: 0x8f3c1a9e4b7d206f (Dist <= 22)',
    stats: { speed: '< 15ms', accuracy: 'Fuzzy Visual', layer: 'Layer 2' },
    icon: Fingerprint
  },
  {
    id: 'semantic',
    title: 'Semantic Embedding',
    tag: 'AI TRANSFORMER',
    badgeColor: '#B388FF',
    cardBg: 'linear-gradient(145deg, #3B0764 0%, #1E1B4B 100%)',
    bgGlow: 'rgba(179, 136, 255, 0.4)',
    ambientBg: 'radial-gradient(ellipse at 70% 50%, rgba(179, 136, 255, 0.22) 0%, rgba(103, 58, 183, 0.12) 45%, transparent 75%)',
    description: 'High-dimensional vision transformer vectors encoding visual meaning. Catches heavy cropping, style-transfers, and AI regenerations.',
    codeSnippet: 'Cosine Sim: 0.942 [Vision-ViT-B/32]',
    stats: { speed: '~ 40ms', accuracy: '98.4% Semantic', layer: 'Layer 3' },
    icon: Zap
  },
  {
    id: 'arcface',
    title: 'ArcFace Biometric',
    tag: 'DEEPFAKE DETECTOR',
    badgeColor: 'var(--danger-text)',
    cardBg: 'linear-gradient(145deg, #7F1D1D 0%, #450A0A 100%)',
    bgGlow: 'rgba(255, 77, 77, 0.4)',
    ambientBg: 'radial-gradient(ellipse at 70% 50%, rgba(255, 77, 77, 0.22) 0%, rgba(183, 28, 28, 0.12) 45%, transparent 75%)',
    description: '512-dimensional face identity vector. Matches facial identities across lighting variations, age progression, face swaps, and deepfakes.',
    codeSnippet: 'ArcFace Distance: 0.312 (Match Confirmed)',
    stats: { speed: '~ 65ms', accuracy: '99.8% Facial', layer: 'Layer 4' },
    icon: Shield
  },
  {
    id: 'wav2vec2',
    title: 'wav2vec2 Voice Print',
    tag: 'AUDIO CLONE DETECTOR',
    badgeColor: 'var(--warning-text)',
    cardBg: 'linear-gradient(145deg, #7C2D12 0%, #451A03 100%)',
    bgGlow: 'rgba(255, 155, 0, 0.4)',
    ambientBg: 'radial-gradient(ellipse at 70% 50%, rgba(255, 155, 0, 0.22) 0%, rgba(191, 54, 12, 0.12) 45%, transparent 75%)',
    description: '768-d biometric audio vector. Extracts vocal frequency patterns to detect AI voice clones, synthesized audio, and speaker identity.',
    codeSnippet: 'wav2vec2 Vector: 768-dim Spectral Map',
    stats: { speed: '~ 50ms', accuracy: '97.6% Vocal', layer: 'Layer 5' },
    icon: Eye
  }
]

export default function ShazamHero3DCarousel() {
  const [activeIndex, setActiveIndex] = useState(0)
  const stackContainerRef = useRef(null)

  // Circular Index Navigation Helper (Circular Doubly-Linked List behavior)
  const getCircularIndex = useCallback((index) => {
    const len = CAROUSEL_CARDS.length
    return ((index % len) + len) % len
  }, [])

  const nextCard = useCallback(() => {
    setActiveIndex((prev) => getCircularIndex(prev + 1))
  }, [getCircularIndex])

  const prevCard = useCallback(() => {
    setActiveIndex((prev) => getCircularIndex(prev - 1))
  }, [getCircularIndex])

  // Drag/Touch tracking to scrub across 3D stack cards
  const handleScrubAtX = useCallback((clientX) => {
    if (!stackContainerRef.current) return
    const rect = stackContainerRef.current.getBoundingClientRect()
    const relativeX = clientX - rect.left
    const normalizedX = relativeX / rect.width // 0.0 (left) to 1.0 (right)

    const count = CAROUSEL_CARDS.length
    const targetIdx = Math.min(count - 1, Math.max(0, Math.floor(normalizedX * count)))
    if (targetIdx !== activeIndex) {
      setActiveIndex(targetIdx)
    }
  }, [activeIndex])

  const handleMouseMoveOverStack = useCallback((e) => {
    if (e.buttons !== 1) return
    handleScrubAtX(e.clientX)
  }, [handleScrubAtX])

  const handleTouchMoveOverStack = useCallback((e) => {
    if (e.touches && e.touches[0]) {
      handleScrubAtX(e.touches[0].clientX)
    }
  }, [handleScrubAtX])

  const activeCard = CAROUSEL_CARDS[activeIndex]

  return (
    <div className="relative w-full py-12 overflow-hidden transition-all duration-700 ease-out select-none">
      {/* ── Dynamic Ambient Background Glow (Morphs with Active Card Theme) ── */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-700 ease-out opacity-90"
        style={{ background: activeCard.ambientBg }}
      />

      <div className="max-w-[1280px] mx-auto px-5 relative z-10 grid grid-cols-1 lg:grid-cols-[1.1fr_1.3fr] gap-10 items-center">
        
        {/* ── Left Hero Headline & Dynamic Details Panel ── */}
        <div className="flex flex-col items-start text-left">
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border transition-all duration-500 shadow-sm"
            style={{
              backgroundColor: `${activeCard.badgeColor}18`,
              color: activeCard.badgeColor,
              borderColor: `${activeCard.badgeColor}50`
            }}
          >
            <span className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: activeCard.badgeColor }} />
            {activeCard.tag}
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[var(--text)] leading-[1.15] mb-4">
            Evidence powered by <span className="transition-colors duration-500" style={{ color: activeCard.badgeColor }}>3D Cryptography</span>.
          </h2>

          <p className="text-sm sm:text-base text-[var(--text-2)] leading-relaxed mb-6 max-w-xl">
            Click and drag across cards to scrub through VeriTrace's multi-layered forensic engine. Every asset is anchored against byte-level, visual, semantic, and biometric vectors.
          </p>

          {/* Active Card Quick Summary Metrics */}
          <div className="grid grid-cols-3 gap-3 w-full max-w-md p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] mb-8 shadow-sm transition-colors duration-500">
            <div>
              <div className="text-[10px] font-bold uppercase text-[var(--text-3)] tracking-wider">Processing</div>
              <div className="text-sm font-extrabold font-mono text-[var(--text)] mt-0.5">{activeCard.stats.speed}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase text-[var(--text-3)] tracking-wider">Accuracy</div>
              <div className="text-sm font-extrabold text-[var(--text)] mt-0.5">{activeCard.stats.accuracy}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase text-[var(--text-3)] tracking-wider">Security</div>
              <div className="text-sm font-extrabold text-[var(--text)] mt-0.5">{activeCard.stats.layer}</div>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={prevCard}
              className="p-3 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)] hover:scale-105 active:scale-95 transition-all shadow-sm"
              aria-label="Previous card"
            >
              <ChevronLeft size={20} />
            </button>
            
            <div className="flex gap-1.5 px-2">
              {CAROUSEL_CARDS.map((card, idx) => (
                <button
                  key={card.id}
                  onClick={() => setActiveIndex(idx)}
                  className={`h-2.5 rounded-full transition-all duration-300 ${idx === activeIndex ? 'w-8' : 'w-2.5 bg-[var(--text-4)] opacity-40 hover:opacity-80'}`}
                  style={{ backgroundColor: idx === activeIndex ? activeCard.badgeColor : undefined }}
                  aria-label={`Go to card ${idx + 1}`}
                />
              ))}
            </div>

            <button
              onClick={nextCard}
              className="p-3 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)] hover:scale-105 active:scale-95 transition-all shadow-sm"
              aria-label="Next card"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* ── Right 3D Perspective Card Carousel Stack (Cursor & Touch Responsive) ── */}
        <div
          ref={stackContainerRef}
          onMouseMove={handleMouseMoveOverStack}
          onTouchMove={handleTouchMoveOverStack}
          onTouchStart={handleTouchMoveOverStack}
          className="relative h-[390px] sm:h-[410px] w-full flex items-center justify-center perspective-[1000px] sm:perspective-[1200px] cursor-pointer touch-pan-y"
        >
          {CAROUSEL_CARDS.map((card, idx) => {
            // Calculate relative offset from active index
            const len = CAROUSEL_CARDS.length
            let diff = idx - activeIndex
            
            // Normalize offset for continuous circular loop
            if (diff > len / 2) diff -= len
            if (diff < -len / 2) diff += len

            // Render visible cards within range (-2 to +2)
            const isVisible = Math.abs(diff) <= 2
            if (!isVisible) return null

            const isActive = diff === 0
            const Icon = card.icon

            // Calculate 3D perspective transforms (responsive spacing for mobile vs desktop)
            const isMobile = typeof window !== 'undefined' && window.innerWidth < 640
            const rotateY = diff * (isMobile ? -12 : -18)
            const translateX = diff * (isMobile ? 65 : 115)
            const translateZ = isActive ? 0 : -Math.abs(diff) * (isMobile ? 70 : 120)
            const scale = isActive ? 1 : 0.84 - Math.abs(diff) * 0.08
            const opacity = isActive ? 1 : 0.45 - Math.abs(diff) * 0.15

            return (
              <motion.div
                key={card.id}
                onClick={() => setActiveIndex(idx)}
                className="absolute top-0 w-[270px] sm:w-[340px] h-[375px] sm:h-[395px] rounded-3xl p-5 sm:p-6 select-none transition-all duration-500 ease-out border flex flex-col justify-between transform-gpu"
                style={{
                  background: card.cardBg,
                  borderColor: isActive ? card.badgeColor : 'rgba(255,255,255,0.12)',
                  boxShadow: isActive
                    ? `0 24px 60px ${card.bgGlow}, 0 0 0 1px ${card.badgeColor}`
                    : '0 12px 30px rgba(0,0,0,0.6)',
                  zIndex: 20 - Math.abs(diff),
                }}
                animate={{
                  transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                  opacity: opacity
                }}
                transition={{ type: 'spring', stiffness: 280, damping: 24 }}
              >
                {/* Card Header & Content */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span
                      className="px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 shadow-sm"
                      style={{
                        backgroundColor: `${card.badgeColor}25`,
                        color: card.badgeColor,
                        border: `1px solid ${card.badgeColor}60`
                      }}
                    >
                      <Icon size={12} style={{ color: card.badgeColor }} />
                      {card.tag}
                    </span>
                    <span className="text-xs font-mono font-bold text-white/70">0{idx + 1}</span>
                  </div>

                  <h3 className="text-xl font-extrabold text-white mb-2.5 leading-snug tracking-tight drop-shadow-md">
                    {card.title}
                  </h3>

                  <p className="text-xs text-white/90 leading-relaxed font-medium">
                    {card.description}
                  </p>
                </div>

                {/* Card Code Snippet & Action Bar */}
                <div>
                  <div className="p-3.5 rounded-xl bg-black/80 border border-white/20 text-[11px] font-mono font-semibold text-white break-all shadow-inner mb-4">
                    {card.codeSnippet}
                  </div>

                  <div className="flex items-center justify-between pt-2.5 border-t border-white/20 text-xs font-bold text-white">
                    <span>Inspect Algorithm</span>
                    <ArrowRight size={15} style={{ color: card.badgeColor }} />
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

      </div>
    </div>
  )
}
