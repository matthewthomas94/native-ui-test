import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { VoiceBorderBeam } from './VoiceBorderBeam'

/**
 * Web port of Relay Runner's `TranscriptionPill` (AppKit): a bottom-centre pill showing a status
 * title (compact) or a title over live transcription / a response preview (full).
 *
 * Motion, as in the original:
 *   - Entrance: slide up from below the screen + blur 48→0 + fade in (0.3s ease-in)
 *   - Exit: slide down below the screen + blur 0→48 + fade out (0.3s ease-in)
 *   - Compact ↔ full, or STT ↔ TTS, while visible: blur out (0.12s) → swap → blur in (0.4s)
 *   - Same-state updates resize in place (0.4s spring); a changed title crossfades through a blur
 *   - STT body pins to its latest line; a long TTS body scrolls up like a teleprompter
 */

export type PillTheme = 'stt' | 'tts'
export interface PillContent {
  title: string
  /** Omitted for the compact, title-only pill. */
  body?: string
  theme: PillTheme
}

const PAD_H = 24
const PAD_V = 18
const TEXT_GAP = 12
const RADIUS = 16
/** About four lines at 14pt; longer bodies scroll inside it. */
const MAX_BODY_H = 96
const MAX_W = 460
const EXIT_BLUR = 48
const VISIBILITY_MS = 300
const TRANSITION_BLUR_MS = 120
const TRANSITION_UNBLUR_MS = 400
const SPRING = 'cubic-bezier(0.2, 0.9, 0.3, 1)'
/** Teleprompter: wait this long, then scroll at this speed. */
const SCROLL_PAUSE_MS = 1000
const SCROLL_PX_PER_S = 25

interface Shown extends PillContent {
  /** Swap the title (and a new TTS body) through the text crossfade rather than instantly. */
  crossfade: boolean
}

export function TranscriptionPill({
  content,
  screenWidth,
  bottom,
  beamColors,
}: {
  content: PillContent | null
  screenWidth: number
  /** Distance from the bottom of the screen to the bottom of the pill. */
  bottom: number
  /** A border beam in the speaker's palette per theme; omitted, the pill has none. */
  beamColors?: Record<PillTheme, string[]>
}) {
  const maxW = Math.min(MAX_W, screenWidth - 32)
  const contentW = maxW - PAD_H * 2

  const [shown, setShown] = useState<Shown | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0, titleH: 0, bodyH: 0 })
  const [instant, setInstant] = useState(true)
  const root = useRef<HTMLDivElement>(null)
  const measureTitle = useRef<HTMLSpanElement>(null)
  const measureBody = useRef<HTMLDivElement>(null)
  const visible = useRef(false)
  const entering = useRef(false)
  const generation = useRef(0)
  const transitioning = useRef(false)
  const shownRef = useRef<Shown | null>(null)
  shownRef.current = shown
  // The latest request: a follow-up during a blur transition lands at peak blur rather than being lost.
  const pendingRef = useRef<PillContent | null>(null)
  pendingRef.current = content

  const blur = (from: number, to: number, ms: number) =>
    root.current?.animate([{ filter: `blur(${from}px)` }, { filter: `blur(${to}px)` }], {
      duration: ms,
      easing: SPRING,
      fill: 'forwards',
    })

  // React to new content the way `showCompact` / `showFull` / `hide` do.
  useLayoutEffect(() => {
    const gen = ++generation.current
    const prev = shownRef.current
    if (!content) {
      if (!visible.current) return
      visible.current = false
      transitioning.current = false
      const el = root.current
      if (!el) return
      const h = el.offsetHeight
      const anim = el.animate(
        [
          { transform: 'translateY(0)', opacity: 1, filter: 'blur(0px)' },
          { transform: `translateY(${bottom + h + 20}px)`, opacity: 0, filter: `blur(${EXIT_BLUR}px)` },
        ],
        { duration: VISIBILITY_MS, easing: 'ease-in', fill: 'forwards' },
      )
      anim.onfinish = () => {
        if (generation.current === gen) setShown(null)
      }
      return
    }

    if (!visible.current || !prev) {
      // Fresh entrance: lay out instantly, then slide in once measured.
      visible.current = true
      entering.current = true
      setInstant(true)
      setShown({ ...content, crossfade: false })
      return
    }

    const wasCompact = prev.body === undefined
    const isCompact = content.body === undefined
    if (wasCompact !== isCompact || prev.theme !== content.theme) {
      // State-to-state: blur out, swap at peak blur, blur back in.
      if (transitioning.current) {
        setShown({ ...content, crossfade: false })
        return
      }
      transitioning.current = true
      blur(0, 40, TRANSITION_BLUR_MS)
      window.setTimeout(() => {
        // Hidden meanwhile: the exit animation owns the pill now.
        if (!visible.current || !pendingRef.current) return
        setShown({ ...pendingRef.current, crossfade: false })
        blur(40, 0, TRANSITION_UNBLUR_MS)
        window.setTimeout(() => {
          transitioning.current = false
        }, TRANSITION_UNBLUR_MS)
      }, TRANSITION_BLUR_MS * 0.8)
      return
    }

    // Same state: swap copy in place; the surface resizes with its transition.
    setShown({ ...content, crossfade: true })
  }, [content, bottom])

  // Measure the shown copy and size the pill like `applyLayout`.
  useLayoutEffect(() => {
    if (!shown) return
    const measure = () => {
      // offset* sizes are layout sizes, unaffected by the device's zoom transform.
      const titleW = measureTitle.current?.offsetWidth ?? 0
      const titleH = measureTitle.current?.offsetHeight ?? 17
      const bodyH = measureBody.current?.offsetHeight ?? 0
      const compact = shown.body === undefined
      const hasBody = !compact && !!shown.body?.trim()
      const w = compact ? Math.min(maxW, Math.ceil(titleW) + PAD_H * 2 + 8) : maxW
      const h = compact
        ? Math.ceil(titleH) + PAD_V * 2
        : PAD_V + titleH + (hasBody ? TEXT_GAP + Math.min(bodyH, MAX_BODY_H) : 0) + PAD_V
      setSize({ w, h, titleH, bodyH })
    }
    measure()
    document.fonts?.ready.then(measure)
  }, [shown, maxW])

  // Slide in once the first layout is in place.
  useEffect(() => {
    if (!entering.current || !shown || size.w === 0) return
    entering.current = false
    const el = root.current
    if (!el) return
    el.animate(
      [
        { transform: `translateY(${bottom + size.h + 20}px)`, opacity: 0, filter: `blur(${EXIT_BLUR}px)` },
        { transform: 'translateY(0)', opacity: 1, filter: 'blur(0px)' },
      ],
      { duration: VISIBILITY_MS, easing: 'ease-in', fill: 'forwards' },
    )
    const raf = requestAnimationFrame(() => setInstant(false))
    return () => cancelAnimationFrame(raf)
  }, [shown, size, bottom])

  if (!shown) return null
  const compact = shown.body === undefined
  const hasBody = !compact && !!shown.body?.trim()
  const bodyVisibleH = hasBody ? Math.min(size.bodyH, MAX_BODY_H) : 0
  const move = instant ? 'none' : `all ${TRANSITION_UNBLUR_MS}ms ${SPRING}`

  return (
    <div
      ref={root}
      className="tp"
      style={{
        width: size.w,
        height: size.h,
        left: (screenWidth - size.w) / 2,
        bottom,
        borderRadius: RADIUS,
        transition: instant ? 'none' : `width ${TRANSITION_UNBLUR_MS}ms ${SPRING}, height ${TRANSITION_UNBLUR_MS}ms ${SPRING}, left ${TRANSITION_UNBLUR_MS}ms ${SPRING}`,
      }}
    >
      {/* Under the copy: its own stacking context keeps the beam's layers beneath the text. Recoloured
          when the theme swaps, which happens at peak blur so the change doesn't show. */}
      {beamColors && <VoiceBorderBeam colors={beamColors[shown.theme]} radius={RADIUS - 1} style={{ zIndex: 0 }} />}

      {/* Off-screen copies at the final width, for measuring. */}
      <div className="tp-measure" aria-hidden>
        <span ref={measureTitle} className="tp-title-text" style={{ whiteSpace: 'nowrap' }}>
          {shown.title}
        </span>
        <div ref={measureBody} className="tp-body-text" style={{ width: contentW }}>
          {shown.body}
        </div>
      </div>

      <div
        className="tp-title"
        style={{
          left: PAD_H,
          right: PAD_H,
          top: compact ? (size.h - size.titleH) / 2 : PAD_V,
          textAlign: compact ? 'center' : 'left',
          transition: move,
        }}
      >
        <TextSwap text={shown.title} crossfade={shown.crossfade} />
      </div>

      <div
        className="tp-body"
        style={{
          left: PAD_H,
          width: contentW,
          top: PAD_V + size.titleH + TEXT_GAP,
          height: bodyVisibleH,
          opacity: hasBody ? 1 : 0,
          transition: move,
        }}
      >
        {hasBody && (
          <Body
            text={shown.body!}
            theme={shown.theme}
            height={size.bodyH}
            crossfade={shown.crossfade && shown.theme === 'tts'}
          />
        )}
      </div>
    </div>
  )
}

/** Replaces copy by letting the old text sink, blur and fade while the new rises in after it. */
function TextSwap({ text, crossfade }: { text: string; crossfade: boolean }) {
  const [current, setCurrent] = useState(text)
  const [leaving, setLeaving] = useState<{ text: string; key: number } | null>(null)
  const key = useRef(0)
  useLayoutEffect(() => {
    if (text === current) return
    if (crossfade && current) {
      key.current++
      setLeaving({ text: current, key: key.current })
    } else {
      setLeaving(null)
    }
    setCurrent(text)
  }, [text, crossfade, current])
  return (
    <span className="tp-swap">
      {leaving && (
        <span key={`out${leaving.key}`} className="tp-title-text tp-out" onAnimationEnd={() => setLeaving(null)}>
          {leaving.text}
        </span>
      )}
      <span key={`in${key.current}`} className={`tp-title-text ${leaving ? 'tp-in' : ''}`}>
        {current}
      </span>
    </span>
  )
}

/**
 * The body inside its clipping window. STT pins the latest line to the bottom; TTS starts at the
 * top and, after a reading pause, scrolls up at a fixed speed. A wheel/trackpad scroll takes over.
 */
function Body({ text, theme, height, crossfade }: { text: string; theme: PillTheme; height: number; crossfade: boolean }) {
  const overflow = Math.max(0, height - MAX_BODY_H)
  const [y, setY] = useState(0)
  const [duration, setDuration] = useState(0)
  const manual = useRef(false)
  const lastText = useRef<string | null>(null)
  const label = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const isNew = lastText.current !== text
    lastText.current = text
    if (theme === 'stt') {
      setDuration(0)
      setY(-overflow)
      return
    }
    // A new message drops any manual scroll; while the user holds one, leave it be.
    if (isNew) manual.current = false
    if (manual.current) return
    setDuration(0)
    setY(0)
    if (overflow <= 0) return
    const t = window.setTimeout(() => {
      setDuration(overflow / SCROLL_PX_PER_S)
      setY(-overflow)
    }, SCROLL_PAUSE_MS)
    return () => window.clearTimeout(t)
  }, [text, theme, overflow])

  const onWheel = (e: React.WheelEvent) => {
    if (theme !== 'tts' || overflow <= 0 || !label.current) return
    manual.current = true
    const now = new DOMMatrix(getComputedStyle(label.current).transform).m42
    setDuration(0)
    setY(Math.max(-overflow, Math.min(0, now - e.deltaY)))
  }

  const style: CSSProperties = {
    transform: `translateY(${y}px)`,
    transition: duration ? `transform ${duration}s linear` : 'none',
  }
  return (
    <div className="tp-body-clip" onWheel={onWheel}>
      <div ref={label} key={crossfade ? text.slice(0, 24) : 'body'} className={`tp-body-text ${crossfade ? 'tp-in' : ''}`} style={style}>
        {text}
      </div>
    </div>
  )
}
