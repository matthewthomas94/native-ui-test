import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { BorderBeam } from 'border-beam'
import { ThinkingOrb } from 'thinking-orbs'
import { VoiceBeam, useMicrophone } from 'voice-glow'
import { BotAvatar } from 'bot-avatars'
import { MetalFx } from 'metal-fx'
import { ImageGeneration } from 'img-fx'
import { Liquid } from 'liquid-gooey'
import { DEVICE_H, DEVICE_W, type Layer } from './layers'
import { GooeyNav } from './GooeyNav'

/** Matches `.device`'s corner radius in App.css. */
const SCREEN_RADIUS = 48

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any

// The libraries' prop unions are narrower than our generic Props bag.
const p = (layer: Layer) => layer.props as Record<string, Any>
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : undefined)

function box(layer: Layer, extra?: CSSProperties): CSSProperties {
  return { width: layer.w, height: layer.h, borderRadius: layer.radius, ...extra }
}

export function Overlay({ layer }: { layer: Layer }) {
  switch (layer.kind) {
    case 'nav':
      return (
        <GooeyNav
          width={layer.w}
          height={layer.h}
          level={Number(layer.props.level)}
          glow={layer.props.glow !== false}
          glowTheme={layer.props.glowTheme === 'light' ? 'light' : 'dark'}
          overlay={layer.props.overlay !== false}
          overlayBlur={layer.props.overlayBlur === undefined ? 6 : Number(layer.props.overlayBlur)}
          conversation={layer.props.conversation !== false}
          overlayBlurStart={layer.props.overlayBlurStart === undefined ? 0.45 : Number(layer.props.overlayBlurStart)}
          screen={{ x: layer.x, y: layer.y, w: DEVICE_W, h: DEVICE_H, radius: SCREEN_RADIUS }}
        />
      )
    case 'beam':
      return <Beam layer={layer} />
    case 'orb':
      return <Orb layer={layer} />
    case 'voice':
      return <Voice layer={layer} />
    case 'avatar':
      return <Avatar layer={layer} />
    case 'metal':
      return <Metal layer={layer} />
    case 'image':
      return <Image layer={layer} />
    case 'gooey':
      return <Gooey layer={layer} />
  }
}

function Beam({ layer }: { layer: Layer }) {
  const q = p(layer)
  return (
    <BorderBeam
      size={q.size}
      colorVariant={q.colorVariant}
      theme={q.theme}
      duration={q.duration}
      strength={q.strength}
      brightness={q.brightness}
      glowSize={q.glowSize}
      active={q.active}
      borderRadius={layer.radius}
    >
      {/* Transparent host so the backplate shows through the beam. */}
      <div style={box(layer)} />
    </BorderBeam>
  )
}

function Orb({ layer }: { layer: Layer }) {
  const q = p(layer)
  return (
    <div style={{ ...box(layer), display: 'grid', placeItems: 'center' }}>
      <ThinkingOrb
        state={q.state}
        size={Number(q.size) as Any}
        theme={q.theme}
        color={str(q.color)}
        speed={q.speed}
        dots={q.dots}
        dotSize={q.dotSize}
      />
    </div>
  )
}

function Voice({ layer }: { layer: Layer }) {
  const q = p(layer)
  const mic = useMicrophone()
  const amp = Number(q.simLevel)
  const level = useMemo(() => {
    if (q.source === 'fixed') return amp
    // Speech-like wobble: two sines plus jitter, scaled by amplitude.
    return () => {
      const t = performance.now() / 1000
      const env = 0.5 + 0.5 * Math.sin(t * 1.3)
      const syl = 0.5 + 0.5 * Math.sin(t * 9.0 + Math.sin(t * 2.1) * 3)
      return Math.max(0, Math.min(1, amp * env * (0.4 + 0.6 * syl) + Math.random() * 0.05))
    }
  }, [q.source, amp])

  const useMic = q.source === 'microphone'
  return (
    <div style={{ position: 'relative' }}>
      <VoiceBeam
        type={q.type}
        look={q.look}
        colorVariant={q.colorVariant}
        theme={q.theme}
        stream={useMic ? mic.stream : undefined}
        level={useMic ? undefined : level}
      >
        <div style={box(layer)} />
      </VoiceBeam>
      {useMic && mic.state !== 'live' && (
        <button className="mic-btn" onPointerDown={(e) => e.stopPropagation()} onClick={() => mic.start()}>
          {mic.state === 'requesting' ? 'Requesting…' : mic.state === 'denied' ? 'Mic denied' : 'Start mic'}
        </button>
      )}
    </div>
  )
}

function Avatar({ layer }: { layer: Layer }) {
  const q = p(layer)
  const size = Math.min(layer.w, layer.h)
  return (
    <div style={{ ...box(layer), display: 'grid', placeItems: 'center' }}>
      <BotAvatar
        type={q.type}
        state={q.state}
        shading={q.shading}
        face={q.face}
        color={str(q.color)}
        hat={q.hat}
        glasses={q.glasses}
        headphones={q.headphones}
        bowTie={q.bowTie}
        size={size}
      />
    </div>
  )
}

function Metal({ layer }: { layer: Layer }) {
  const q = p(layer)
  const label = str(q.label)
  return (
    <MetalFx variant={q.variant} preset={q.preset} theme={q.theme} strength={q.strength} borderRadius={layer.radius}>
      <div
        className="metal-host"
        style={box(layer, {
          background: label ? str(q.fill) ?? 'transparent' : 'transparent',
          color: str(q.textColor),
        })}
      >
        {label}
      </div>
    </MetalFx>
  )
}

// Generated locally so the reveal has something to show without network images.
function useSampleImages() {
  return useMemo(() => {
    const make = (a: string, b: string, c: string) => {
      const cv = document.createElement('canvas')
      cv.width = 640
      cv.height = 400
      const ctx = cv.getContext('2d')!
      const g = ctx.createLinearGradient(0, 0, 640, 400)
      g.addColorStop(0, a)
      g.addColorStop(0.55, b)
      g.addColorStop(1, c)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, 640, 400)
      for (let i = 0; i < 14; i++) {
        ctx.beginPath()
        ctx.fillStyle = `rgba(255,255,255,${0.06 + Math.random() * 0.12})`
        ctx.arc(Math.random() * 640, Math.random() * 400, 30 + Math.random() * 110, 0, Math.PI * 2)
        ctx.fill()
      }
      return cv.toDataURL('image/png')
    }
    return [make('#1e3a8a', '#3b82f6', '#a5b4fc'), make('#f97316', '#ec4899', '#8b5cf6'), make('#065f46', '#10b981', '#d9f99d')]
  }, [])
}

function Image({ layer }: { layer: Layer }) {
  const q = p(layer)
  const images = useSampleImages()
  return (
    <ImageGeneration
      preset={q.preset}
      theme={q.theme}
      strength={q.strength}
      pixelScale={q.pixelScale}
      autoReveal={q.autoReveal}
      cardBg={str(q.cardBg)}
      images={images}
      borderRadius={layer.radius}
    >
      <div style={box(layer)} />
    </ImageGeneration>
  )
}

function Gooey({ layer }: { layer: Layer }) {
  const q = p(layer)
  const [tick, setTick] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (!q.autoplay) return
    timer.current = window.setInterval(() => setTick((t) => !t), 1600)
    return () => window.clearInterval(timer.current)
  }, [q.autoplay])

  const merged = q.autoplay ? tick : !!q.merged
  const h = layer.h
  const pillW = Math.max(h, layer.w - h - 12)
  return (
    <Liquid blur={q.blur} fill={q.fill} style={{ width: layer.w, height: h, display: 'flex' }}>
      <Liquid.Item x={0} y={0} transition="bouncy">
        <div className="goo-piece" style={{ width: pillW, height: h, borderRadius: layer.radius, color: str(q.textColor) }}>
          {str(q.label)}
        </div>
      </Liquid.Item>
      {/* Items sit side by side in flow; x is an offset from that slot. */}
      <Liquid.Item x={merged ? -h * 0.7 : 12} y={0} transition="bouncy">
        <div className="goo-piece" style={{ width: h, height: h, borderRadius: h / 2, color: str(q.textColor) }}>
          →
        </div>
      </Liquid.Item>
    </Liquid>
  )
}
