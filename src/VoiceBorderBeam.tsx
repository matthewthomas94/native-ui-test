import { useMemo, type CSSProperties } from 'react'
import { BorderBeam } from 'border-beam'

/**
 * A border beam repainted in a voice glow palette: `border-beam`'s `md` stroke and inner glow, minus
 * the rainbow, drifting slowly so it reads as a quiet sheen rather than a spin. It fills its
 * positioned parent and takes no pointer events.
 */

export type BeamShape = 'rect' | 'circle'

/**
 * The rect's hotspots: the `md` layout. Widths stretch with the box from the 172pt card they were
 * tuned on; heights hug the edge as drawn.
 */
const CARD_W = 172
const CARD_SPOTS = [
  { pos: '33% -7.4%', w: 70, h: 40 },
  { pos: '12% -5%', w: 60, h: 35 },
  { pos: '2.1% 68.3%', w: 40, h: 70 },
  { pos: '2.1% 68.3%', w: 20, h: 35 },
  { pos: '74.4% 100%', w: 180, h: 32 },
  { pos: '55% 100%', w: 85, h: 26 },
  { pos: '93.9% 0%', w: 74, h: 32 },
  { pos: '100% 27.1%', w: 26, h: 42 },
  { pos: '100% 27.1%', w: 52, h: 48 },
]
/** A circle's corner-free edge takes one hotspot per colour, evenly round the ring, each this wide. */
const RING_SPOT = 45
/** A soft white sheen that travels along the stroke over the colour: the dark preset's, dimmed and spread wider. */
const SHEEN = `conic-gradient(from var(--beam-angle-{id}), transparent 0%, transparent 50%,
  rgba(255, 255, 255, 0.06) 56%, rgba(255, 255, 255, 0.18) 61%, rgba(255, 255, 255, 0.3) 66%,
  rgba(255, 255, 255, 0.18) 71%, rgba(255, 255, 255, 0.06) 76%, transparent 82%, transparent 100%)`
/** One slow lap, eased in and out so the beam drifts rather than spins. */
const LAP_S = 7
const EASE = 'cubic-bezier(0.37, 0, 0.63, 1)'
/** A quiet stroke and inner glow: enough to read on black, without the card preset's flash. */
const LIFT = { '--beam-stroke-opacity': 1.6, '--beam-inner-opacity': 0.8, '--beam-bloom-opacity': 0.4 } as CSSProperties

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

/** Radial hotspots as `<size> at <position>`, `scale`d about their centres. */
function spotShapes(shape: BeamShape, count: number, scale: number) {
  if (shape === 'rect') {
    return CARD_SPOTS.map((s) => `${((s.w * scale * 100) / CARD_W).toFixed(1)}% ${Math.round(s.h * scale)}px at ${s.pos}`)
  }
  const r = `${(RING_SPOT * scale).toFixed(1)}%`
  return Array.from({ length: count }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / count
    return `${r} ${r} at ${(50 + 50 * Math.cos(a)).toFixed(1)}% ${(50 + 50 * Math.sin(a)).toFixed(1)}%`
  })
}

/** Overrides the beam's stroke (`::after`) and inner glow (`::before`) with `colors`. */
function beamCss(colors: string[], shape: BeamShape) {
  const spots = (alpha: number, scale: number) =>
    spotShapes(shape, colors.length, scale)
      .map((s, i) => `radial-gradient(ellipse ${s}, ${rgba(colors[i % colors.length], alpha)}, transparent)`)
      .join(', ')
  const on = (layer: string) => `[data-beam="{id}"][data-active]${layer}, [data-beam="{id}"][data-fading]${layer}`
  // The root runs the spin then the fade; only the spin is eased. `staticColors` drops the hue drift
  // and, with it, the beam's brightness boost, so a lighter one goes back on.
  return `
${on('')} { animation-timing-function: ${EASE}, ease; }
${on('::after')} { background: ${SHEEN}, ${spots(1, 1)}; filter: brightness(1.1); }
${on('::before')} { background: ${spots(0.45, 0.9)}; filter: brightness(1.1); }`
}

export function VoiceBorderBeam({
  colors,
  shape = 'rect',
  radius,
  active = true,
  style,
}: {
  /** A voice glow palette; each colour lights one hotspot. */
  colors: string[]
  shape?: BeamShape
  /** The parent's corner radius, px. */
  radius: number
  /** Fades the beam in and out. */
  active?: boolean
  style?: CSSProperties
}) {
  const css = useMemo(() => beamCss(colors, shape), [colors, shape])
  return (
    <BorderBeam
      theme="dark"
      staticColors
      duration={LAP_S}
      borderRadius={radius}
      active={active}
      css={css}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', ...LIFT, ...style }}
    >
      <div />
    </BorderBeam>
  )
}
