import { useState, useEffect, useRef, useCallback } from 'react'
import { Syringe } from 'lucide-react'

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
        {/* Icon + tagline */}
        <div className="flex items-center gap-2 mb-3">
          <Syringe size={16} className="text-white/70 flex-shrink-0" aria-hidden="true" />
          <span className="text-white/80 text-sm font-medium leading-snug">
            Cold chain integrity, always monitored
          </span>
        </div>

        {/* Status pills */}
        <div className="flex flex-wrap gap-2 mb-3">
          <span className="bg-akuh-navy text-white text-xs font-semibold px-3 py-1 rounded-full">
            Real-time vaccine stock visibility
          </span>
          <span className="bg-akuh-maroon text-white text-xs font-semibold px-3 py-1 rounded-full">
            Alerts before you run out
          </span>
        </div>

        {/* Network attribution */}
        <p className="text-white/40 text-[11px] mb-5">
          Aga Khan University Hospital network
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
