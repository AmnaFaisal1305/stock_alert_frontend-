import { useState, useEffect, useRef, useCallback } from 'react'

const SLIDE_DURATION = 5000

// Per-image object-position tweaks — adjust if a subject is off-centre after reviewing the photos
const IMAGE_POSITIONS = ['center', 'center', 'center', 'center']

export default function HeroCarousel({ images }) {
  const [currentIndex, setCurrentIndex]   = useState(0)
  const [isPaused,     setIsPaused]       = useState(false)
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
  const [isDesktop, setIsDesktop] = useState(
    () => window.matchMedia('(min-width: 768px)').matches
  )
  const timerRef = useRef(null)

  // Sync media queries
  useEffect(() => {
    const mqMotion  = window.matchMedia('(prefers-reduced-motion: reduce)')
    const mqDesktop = window.matchMedia('(min-width: 768px)')
    const onMotion  = (e) => setReducedMotion(e.matches)
    const onDesktop = (e) => setIsDesktop(e.matches)
    mqMotion.addEventListener('change', onMotion)
    mqDesktop.addEventListener('change', onDesktop)
    return () => {
      mqMotion.removeEventListener('change', onMotion)
      mqDesktop.removeEventListener('change', onDesktop)
    }
  }, [])

  // Preload all images on mount to avoid first-cycle crossfade stutter
  useEffect(() => {
    images.forEach((src) => {
      const img = new Image()
      img.src = src
    })
  }, [images])

  const startTimer = useCallback(() => {
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setCurrentIndex((i) => (i + 1) % images.length)
    }, SLIDE_DURATION)
  }, [images.length])

  useEffect(() => {
    if (!isPaused && !reducedMotion) {
      startTimer()
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [isPaused, reducedMotion, startTimer])

  const goToSlide = useCallback((index) => {
    setCurrentIndex(index)
    if (!reducedMotion) startTimer()
  }, [reducedMotion, startTimer])

  const shouldAnimate = !reducedMotion
  const shouldZoom    = !reducedMotion && isDesktop

  return (
    <div
      className="relative w-full h-full overflow-hidden bg-slate-900"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Carousel images — all absolutely stacked, crossfade via opacity */}
      {images.map((src, i) => {
        const isActive = reducedMotion ? i === 0 : i === currentIndex
        return (
          <div
            key={src}
            aria-hidden="true"
            className={[
              'absolute inset-0',
              shouldAnimate
                ? 'transition-opacity duration-[1200ms] ease-in-out'
                : '',
              isActive ? 'opacity-100' : 'opacity-0',
            ].join(' ')}
          >
            <img
              src={src}
              alt=""
              aria-hidden="true"
              className={[
                'w-full h-full object-cover will-change-transform',
                isActive && shouldZoom ? 'animate-ken-burns' : '',
              ].join(' ')}
              style={{ objectPosition: IMAGE_POSITIONS[i] ?? 'center' }}
            />
          </div>
        )
      })}

      {/* Gradient overlay — keeps text legible over any photo */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(0deg, rgba(15,4,6,0.9) 0%, rgba(15,4,6,0.2) 60%, transparent 100%)',
        }}
      />

      {/* Bottom-anchored overlay content */}
      <div className="absolute bottom-0 left-0 right-0 px-10 pb-10">
        {/* Main tagline */}
        <p className="text-white font-bold text-base leading-snug mb-1">
          Piloting Stock Management &amp; Alert System Expansion
        </p>
        <p className="text-white/80 text-sm font-medium mb-3">
          To The Facility Level in Sindh
        </p>

        {/* Sub label */}
        <p className="text-white/50 text-[11px] mb-5 uppercase tracking-wider font-semibold">
          Sprint 02 Digital Intervention
        </p>

        {/* Dot indicators */}
        {!reducedMotion && (
          <div
            role="group"
            aria-label="Carousel navigation"
            className="flex items-center gap-2"
          >
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goToSlide(i)}
                aria-label={`Go to slide ${i + 1} of ${images.length}`}
                className={[
                  'w-2 h-2 rounded-full bg-white transition-opacity duration-300',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
                  i === currentIndex ? 'opacity-100' : 'opacity-40',
                ].join(' ')}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
