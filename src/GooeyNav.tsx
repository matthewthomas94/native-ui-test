import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { VoiceBeam } from 'voice-glow'
import { TranscriptionPill, type PillContent } from './TranscriptionPill'
import { VoiceBorderBeam } from './VoiceBorderBeam'
import { runConversation, type Phase } from './conversation'

/**
 * Web port of SpeechBench's `GooeyMenu` (SwiftUI): the mic button bottom-right shoots straight out to
 * dock, a third bigger, at the bottom centre as the talk button, leaving a close button in its place;
 * close dismisses voice mode and draws the mic back in. Tapping the docked mic toggles listening, where
 * the mic melts into a waveform.
 * Blobs are blurred and alpha-thresholded so they merge like liquid; buttons sit on top, unblurred.
 */

type Item = 'close' | 'mic'
const ITEMS: Item[] = ['close', 'mic']

const SIZE = 48
const DOCKED_SCALE = 4 / 3
/** From the bottom-right corner to the mic / close button's centre. */
const INSET = { x: 26 + SIZE / 2, y: 27 + SIZE / 2 }
const EASE_CSS = 'cubic-bezier(0.34, 1.56, 0.64, 1)'
const EASE_MS = 550

/**
 * Voice glow palettes (lobe colours centre first, then pairs outward), from the mesh references:
 * the agent in blues with a navy edge, the user in orange and lavender under blue. The agent sets every
 * band colour so the theme's default red / green / blue fringes don't show in its glow.
 */
const GLOW = {
  agent: {
    colors: ['#5b97ff', '#86b8fb', '#3f72e0', '#bfe3f4', '#24428f', '#4f86f7', '#2f63d6'],
    band: { core: '#eaf6ff', above: '#7ab8ff', mid: '#9fd2f5', below: '#4f86f7' },
  },
  user: {
    colors: ['#f27650', '#9b8fc6', '#ec8a6c', '#3d82ff', '#a99ad0', '#5d8ff5', '#f0a184'],
    band: { mid: '#8fb4ff' },
  },
}
/** The transcription pill's beam takes the speaker's glow: the user's while transcribing, the agent's while replying. */
const PILL_BEAM = { stt: GLOW.user.colors, tts: GLOW.agent.colors }

interface Screen {
  /** The layer's origin within the screen, so the glow can cover the whole screen from inside it. */
  x: number
  y: number
  w: number
  h: number
  radius: number
}

export function GooeyNav({
  width,
  height,
  level = 0.7,
  screen,
  glow = true,
  glowTheme = 'dark',
  overlay = true,
  overlayBlur = 6,
  overlayBlurStart = 0.45,
  conversation = true,
}: {
  width: number
  height: number
  level?: number
  screen: Screen
  glow?: boolean
  glowTheme?: 'dark' | 'light'
  overlay?: boolean
  /** Background blur at the bottom of the screen, px; it rises linearly from none at `overlayBlurStart`. */
  overlayBlur?: number
  /** Fraction of the screen height where the blur begins. */
  overlayBlurStart?: number
  /** The talk button plays a scripted conversation through the transcription pill. */
  conversation?: boolean
}) {
  const [docked, setDocked] = useState(false)
  const [toggled, setToggled] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [pill, setPill] = useState<PillContent | null>(null)
  const [micOpen, setMicOpen] = useState(false)
  const run = useRef(0)
  const sendNow = useRef(false)

  // The waveform shows only while the mic is hot: waiting for speech or capturing it. Sending,
  // thinking and the agent's spoken reply show the microphone. The glow carries both voices.
  const micHot = phase === 'listening' || phase === 'recording'
  const listening = conversation ? micHot : toggled
  const speaking = conversation ? phase === 'recording' || phase === 'speaking' : toggled
  // The user's palette while the mic is hot; the agent's while sending, thinking and replying.
  const glowVoice = conversation && !micHot ? 'agent' : 'user'
  const glyphLevel = conversation ? (phase === 'recording' ? level : 0) : level

  const closeMic = () => {
    run.current++
    setMicOpen(false)
    setPhase('idle')
    setPill(null)
  }
  const openMic = () => {
    const id = ++run.current
    setMicOpen(true)
    void runConversation({
      pill: (c) => run.current === id && setPill(c),
      phase: (p) => {
        if (run.current !== id) return
        // Each new utterance starts without a pending send.
        if (p === 'listening') sendNow.current = false
        setPhase(p)
      },
      sendNow: () => sendNow.current,
      alive: () => run.current === id,
    })
  }
  useEffect(() => () => void run.current++, [])
  const fid = 'goo' + useId().replace(/[^a-zA-Z0-9]/g, '')

  const anchor = { x: width - INSET.x, y: height - INSET.y }
  const dockDx = width / 2 - anchor.x

  // The close blob never moves: at rest it hides under the mic, and the mic pulls away from it to dock.
  const shown = (i: Item) => i === 'mic' || docked
  const scale = (i: Item) => (i === 'mic' && docked ? DOCKED_SCALE : 1)
  const motion = (i: Item): CSSProperties => {
    const dx = i === 'mic' && docked ? dockDx : 0
    const t = `${EASE_MS}ms ${EASE_CSS}`
    return { transform: `translate(${dx}px, 0) scale(${scale(i)})`, transition: `transform ${t}, opacity ${t}` }
  }

  const onClose = () => {
    setDocked(false)
    setToggled(false)
    closeMic()
  }
  // The talk button opens and closes the mic; mid-utterance it sends what's been said straight away.
  const onTalk = () => {
    if (!conversation) return setToggled((l) => !l)
    if (phase === 'recording') sendNow.current = true
    else if (micOpen) closeMic()
    else openMic()
  }
  const onMic = () => (docked ? onTalk() : setDocked(true))

  const blobs = ITEMS.map((i) => (
    <circle
      key={i}
      cx={anchor.x}
      cy={anchor.y}
      r={SIZE / 2}
      style={{ ...motion(i), transformBox: 'fill-box', transformOrigin: 'center' }}
    />
  ))

  const voiceLevel = () => (speaking ? speech(performance.now() / 1000) * level : 0)
  // Sits just above the docked talk button: its top is 83pt above the layer's bottom edge.
  const pillBottom = screen.h - (screen.y + height) + INSET.y + (SIZE * DOCKED_SCALE) / 2 + 20

  return (
    <div className="gnav" style={{ width, height }}>
      {/* Voice mode darkens and blurs the screen behind the menu, more towards the bottom. */}
      {overlay && <VoiceOverlay on={docked} screen={screen} maxBlur={overlayBlur} blurStart={overlayBlurStart} />}
      {/* The glow rises from the bottom edge of the screen while the docked mic is listening. */}
      {glow && (
        <div className="gnav-voice" style={{ left: -screen.x, top: -screen.y }}>
          {/* One beam per voice, crossfaded: blue for the agent, orange under blue for the user. */}
          {(['agent', 'user'] as const).map((v) => (
            <div key={v} className="gnav-voice-palette" style={{ width: screen.w, height: screen.h, opacity: glowVoice === v ? 1 : 0 }}>
              <VoiceBeam
                type="mobile"
                colorVariant="mono"
                theme={glowTheme}
                colors={GLOW[v].colors}
                bandColors={GLOW[v].band}
                borderRadius={screen.radius}
                active={conversation ? micOpen : toggled}
                level={voiceLevel}
              >
                <div style={{ width: screen.w, height: screen.h, borderRadius: screen.radius }} />
              </VoiceBeam>
            </div>
          ))}
        </div>
      )}
      {conversation && (
        <div className="gnav-pill" style={{ left: -screen.x, top: -screen.y, width: screen.w, height: screen.h }}>
          <TranscriptionPill content={pill} screenWidth={screen.w} bottom={pillBottom} beamColors={PILL_BEAM} />
        </div>
      )}
      {/* Liquid glass: backdrop blur under each blob, then the goo shape tinted dark with lit rims. */}
      {ITEMS.map((i) => (
        <div key={i} className="gnav-glass" style={{ left: anchor.x - SIZE / 2, top: anchor.y - SIZE / 2, ...motion(i) }} />
      ))}
      <svg className="gnav-goo" width={width} height={height}>
        <defs>
          <filter id={fid} filterUnits="userSpaceOnUse" x={-40} y={-200} width={width + 80} height={height + 400}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            {/* Threshold alpha at 0.42 back to a hard edge. */}
            <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 60 -25.2" result="goo" />
            <feFlood floodColor="#000" floodOpacity="0.72" />
            <feComposite in2="goo" operator="in" result="tint" />
            {/* Rims: the shape less itself moved 1.5pt down (top light) and up (bottom light). */}
            <feOffset in="goo" dy="1.5" result="down" />
            <feComposite in="goo" in2="down" operator="out" result="topEdge" />
            <feFlood floodColor="#fff" floodOpacity="0.4" />
            <feComposite in2="topEdge" operator="in" result="topRim" />
            <feOffset in="goo" dy="-1.5" result="up" />
            <feComposite in="goo" in2="up" operator="out" result="bottomEdge" />
            <feFlood floodColor="#fff" floodOpacity="0.12" />
            <feComposite in2="bottomEdge" operator="in" result="bottomRim" />
            <feMerge>
              <feMergeNode in="tint" />
              <feMergeNode in="topRim" />
              <feMergeNode in="bottomRim" />
            </feMerge>
          </filter>
        </defs>
        <g filter={`url(#${fid})`} fill="#000">
          {blobs}
        </g>
      </svg>

      {/* Close sits under the mic, so at rest the mic takes the tap; the X spins in as the mic leaves. */}
      <NavButton item="close" anchor={anchor} style={motion('close')} shown={shown('close')} onClick={onClose}>
        <span
          style={{
            display: 'grid',
            transform: docked ? 'none' : 'rotate(-90deg) scale(0.4)',
            transition: `transform ${EASE_MS}ms ${EASE_CSS} ${docked ? 60 : 0}ms`,
          }}
        >
          <CloseIcon />
        </span>
      </NavButton>
      <NavButton item="mic" anchor={anchor} style={motion('mic')} shown={shown('mic')} onClick={onMic}>
        {/* Docked, the talk button wears the speaker's border beam, crossfading with the glow; under the glyph. */}
        {(['agent', 'user'] as const).map((v) => (
          <VoiceBorderBeam
            key={v}
            colors={GLOW[v].colors}
            shape="circle"
            radius={SIZE / 2}
            active={docked}
            style={{ zIndex: -1, opacity: glowVoice === v ? 1 : 0, transition: 'opacity 700ms ease-in-out' }}
          />
        ))}
        <TalkGlyph listening={listening} level={glyphLevel} />
      </NavButton>
    </div>
  )
}

/** Figma "Voice overlay": black from 0% at the top to 90% at the bottom, over a background blur. */
const OVERLAY_TINT = 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.9) 100%)'
const OVERLAY_FADE = 'opacity 250ms ease-in-out'
/** Bands in the progressive blur: more steps, a smoother ramp. */
const BLUR_STEPS = 8

/**
 * A linear (progressive) background blur: CSS only blurs a backdrop uniformly, so stack bands of
 * rising blur, each masked to fade in and out across its slice of the height. Opacity is set on each
 * layer, never on a shared parent — a translucent parent would cut the layers off from the backdrop.
 */
function VoiceOverlay({
  on,
  screen,
  maxBlur,
  blurStart,
}: {
  on: boolean
  screen: Screen
  maxBlur: number
  /** Where the blur begins, as a fraction of the screen height; above it the screen stays sharp. */
  blurStart: number
}) {
  const frame: CSSProperties = {
    position: 'absolute',
    left: -screen.x,
    top: -screen.y,
    width: screen.w,
    height: screen.h,
    borderRadius: screen.radius,
    pointerEvents: 'none',
    opacity: on ? 1 : 0,
    transition: OVERLAY_FADE,
  }
  // Ramp positions run 0–1 across the blurred part, mapped onto the screen below `blurStart`.
  const pct = (t: number) => `${(blurStart + (1 - blurStart) * Math.min(Math.max(t, 0), 1)) * 100}%`
  return (
    <>
      {Array.from({ length: BLUR_STEPS }, (_, i) => {
        const step = 1 / BLUR_STEPS
        // Each band ramps in over one step and out over the next; the first starts at `blurStart`
        // (at under a pixel of blur), and the last holds its full blur over the bottom step.
        const start = i * step
        const mask =
          i === BLUR_STEPS - 1
            ? `linear-gradient(to bottom, transparent ${pct(start - step)}, #000 ${pct(start)})`
            : `linear-gradient(to bottom, transparent ${pct(start - step)}, #000 ${pct(start)}, #000 ${pct(start + step)}, transparent ${pct(start + 2 * step)})`
        const blur = `blur(${(maxBlur * (i + 1)) / BLUR_STEPS}px)`
        return (
          <div
            key={i}
            className="gnav-overlay"
            style={{ ...frame, backdropFilter: blur, WebkitBackdropFilter: blur, maskImage: mask, WebkitMaskImage: mask }}
          />
        )
      })}
      <div className="gnav-overlay" style={{ ...frame, background: OVERLAY_TINT }} />
    </>
  )
}

function NavButton(props: {
  item: Item
  anchor: { x: number; y: number }
  style: CSSProperties
  shown: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      className="gnav-btn"
      aria-label={props.item}
      onClick={props.onClick}
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        left: props.anchor.x - SIZE / 2,
        top: props.anchor.y - SIZE / 2,
        width: SIZE,
        height: SIZE,
        ...props.style,
        opacity: props.shown ? 1 : 0,
        pointerEvents: props.shown ? 'auto' : 'none',
      }}
    >
      {props.children}
    </button>
  )
}

/* ---------- Glyphs (approximating SF Symbols at 18pt semibold) ---------- */

const GLYPH = 18

/** xmark, its arms trimmed to match the mic's visual weight. */
function CloseIcon() {
  return (
    <svg width={GLYPH} height={GLYPH} viewBox="0 0 18 18" stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
      <path d="M3.5 3.5l11 11M14.5 3.5l-11 11" />
    </svg>
  )
}

/** mic.fill, drawn around (0, 0) so it can shrink about its centre. */
function MicShape() {
  return (
    <g>
      <rect x={-3.6} y={-9} width={7.2} height={12.4} rx={3.6} fill="#fff" />
      <path d="M-6.4 -1.2a6.4 6.4 0 0 0 12.8 0" fill="none" stroke="#fff" strokeWidth={1.7} strokeLinecap="round" />
      <path d="M0 5.4V8.6M-3 8.8H3" fill="none" stroke="#fff" strokeWidth={1.7} strokeLinecap="round" />
    </g>
  )
}

/* ---------- Talk glyph: mic ↔ waveform that melts through goo and follows the voice ---------- */

/** The `waveform` symbol's bars at 18pt semibold: width, pitch and heights. */
const BAR = 1.7
const PITCH = 3.1
const HEIGHTS = [4.9, 12.3, 18.9, 9.9, 15.1, 6.6]

function TalkGlyph({ listening, level }: { listening: boolean; level: number }) {
  const [frame, setFrame] = useState({ wave: 0, loud: 0, time: 0 })
  const anim = useRef({ from: 0, to: 0, start: 0, loud: 0, last: 0 })
  const fid = 'talk' + useId().replace(/[^a-zA-Z0-9]/g, '')

  useEffect(() => {
    const a = anim.current
    const now = performance.now()
    a.from = waveAt(a, now)
    a.to = listening ? 1 : 0
    a.start = now
    let raf = 0
    const tick = (t: number) => {
      const wave = waveAt(a, t)
      // Simulated voice in place of the mic's RMS: rises fast, falls slowly, like `Loudness`.
      const target = listening ? speech(t / 1000) * level : 0
      const dt = a.last ? Math.min(Math.max((t - a.last) / 1000, 0), 0.1) : 0
      a.last = t
      a.loud += (target - a.loud) * (1 - Math.exp(-(target > a.loud ? 25 : 6) * dt))
      setFrame({ wave, loud: a.loud, time: t / 1000 })
      if (listening || wave > 0) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [listening, level])

  const { wave, loud, time } = frame
  if (wave <= 0) {
    return (
      <svg width={24} height={24} viewBox="-12 -12 24 24" overflow="visible">
        <MicShape />
      </svg>
    )
  }
  const melt = Math.sin(Math.PI * Math.min(wave, 1))
  return (
    <svg width={SIZE} height={SIZE} viewBox={`${-SIZE / 2} ${-SIZE / 2} ${SIZE} ${SIZE}`} overflow="visible">
      <defs>
        <filter id={fid} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={2.5 * melt} />
          <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 40 -20" />
        </filter>
      </defs>
      <g filter={melt > 0.01 ? `url(#${fid})` : undefined}>
        {wave < 1 && (
          <g opacity={1 - wave} transform={`scale(${1 - 0.4 * wave})`}>
            <MicShape />
          </g>
        )}
        {HEIGHTS.map((height, i) => {
          // Silence leaves short bars; a voice stretches them past the symbol's own heights.
          const sway = 1 + 0.12 * (0.3 + loud) * Math.sin(time * 7 + i * 1.9)
          const gain = (0.3 + 0.9 * loud) * sway
          const h = (BAR + (height - BAR) * gain) * wave
          const w = BAR * Math.min(wave, 1)
          const x = (i - 2.5) * PITCH * wave
          return <rect key={i} x={x - w / 2} y={-h / 2} width={w} height={h} rx={w / 2} fill="#fff" />
        })}
      </g>
    </svg>
  )
}

function waveAt(a: { from: number; to: number; start: number }, t: number) {
  const p = Math.min(Math.max((t - a.start) / EASE_MS, 0), 1)
  return a.from + (a.to - a.from) * cubicBezier(0.34, 1.56, 0.64, 1, p)
}

/** Speech-like loudness, 0–1: syllables riding a slower phrase envelope. */
function speech(t: number) {
  const phrase = 0.55 + 0.45 * Math.sin(t * 1.3)
  const syllable = 0.5 + 0.5 * Math.sin(t * 9 + Math.sin(t * 2.1) * 3)
  return Math.min(1, phrase * (0.35 + 0.65 * syllable))
}

/** CSS-style cubic-bezier timing: solve x(s) = p for s, return y(s). */
function cubicBezier(x1: number, y1: number, x2: number, y2: number, p: number) {
  const bx = (s: number) => 3 * x1 * s * (1 - s) ** 2 + 3 * x2 * s * s * (1 - s) + s ** 3
  const by = (s: number) => 3 * y1 * s * (1 - s) ** 2 + 3 * y2 * s * s * (1 - s) + s ** 3
  let lo = 0
  let hi = 1
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (bx(mid) < p) lo = mid
    else hi = mid
  }
  return by((lo + hi) / 2)
}
