// Layer model: each layer is one library component placed on the phone in
// device points (the backplate is drawn at DEVICE_W × DEVICE_H points).

export const DEVICE_W = 393
export const DEVICE_H = 854

export type LayerKind = 'nav' | 'beam' | 'orb' | 'voice' | 'avatar' | 'metal' | 'image' | 'gooey'

export type Props = Record<string, string | number | boolean>

export interface Layer {
  id: string
  kind: LayerKind
  name: string
  x: number
  y: number
  w: number
  h: number
  radius: number
  hidden?: boolean
  props: Props
}

export type Field =
  | { key: string; label: string; type: 'select'; options: (string | number)[] }
  | { key: string; label: string; type: 'number'; min: number; max: number; step: number }
  | { key: string; label: string; type: 'text' | 'color' | 'bool' }

const THEME: Field = { key: 'theme', label: 'Theme', type: 'select', options: ['light', 'dark', 'auto'] }
const PALETTE: Field = {
  key: 'colorVariant',
  label: 'Colour',
  type: 'select',
  options: ['colorful', 'mono', 'ocean', 'sunset', 'forest', 'candy', 'ice', 'gold'],
}

interface KindSpec {
  label: string
  pkg: string
  blurb: string
  size: { w: number; h: number; radius: number }
  props: Props
  fields: Field[]
}

export const KINDS: Record<LayerKind, KindSpec> = {
  nav: {
    label: 'Gooey nav',
    pkg: 'speechbench',
    blurb: 'SpeechBench mic / close nav',
    // A full-width strip along the bottom: the menu anchors to its bottom-right corner and docks at its centre.
    size: { w: DEVICE_W, h: 170, radius: 0 },
    props: { level: 0.7, glow: true, glowTheme: 'dark', overlay: true, overlayBlur: 6, overlayBlurStart: 0.45, conversation: true },
    fields: [
      { key: 'level', label: 'Simulated voice level', type: 'number', min: 0, max: 1, step: 0.05 },
      { key: 'glow', label: 'Voice glow while listening', type: 'bool' },
      { key: 'glowTheme', label: 'Glow theme', type: 'select', options: ['dark', 'light'] },
      { key: 'conversation', label: 'Simulated conversation (pill)', type: 'bool' },
      { key: 'overlay', label: 'Dark overlay in voice mode', type: 'bool' },
      { key: 'overlayBlur', label: 'Overlay blur at bottom (px)', type: 'number', min: 0, max: 24, step: 1 },
      { key: 'overlayBlurStart', label: 'Blur starts at (0 top – 1 bottom)', type: 'number', min: 0, max: 0.95, step: 0.05 },
    ],
  },
  beam: {
    label: 'Border beam',
    pkg: 'border-beam',
    blurb: 'Glow that travels or breathes around a box',
    size: { w: 172, h: 178, radius: 26 },
    props: { size: 'md', colorVariant: 'colorful', theme: 'light', duration: 2, strength: 1, brightness: 1.3, glowSize: 1, active: true },
    fields: [
      { key: 'size', label: 'Type', type: 'select', options: ['md', 'sm', 'line', 'pulse-inner', 'pulse-outside'] },
      PALETTE,
      THEME,
      { key: 'duration', label: 'Duration (s)', type: 'number', min: 0.5, max: 8, step: 0.1 },
      { key: 'strength', label: 'Strength', type: 'number', min: 0, max: 1, step: 0.05 },
      { key: 'brightness', label: 'Brightness', type: 'number', min: 0.2, max: 3, step: 0.05 },
      { key: 'glowSize', label: 'Glow size', type: 'number', min: 0.2, max: 3, step: 0.05 },
      { key: 'active', label: 'Active', type: 'bool' },
    ],
  },
  orb: {
    label: 'Thinking orb',
    pkg: 'thinking-orbs',
    blurb: 'Dotted loading orb, nine states',
    size: { w: 64, h: 64, radius: 0 },
    props: { state: 'working', size: 64, theme: 'light', color: '', speed: 1, dots: 1, dotSize: 1 },
    fields: [
      {
        key: 'state',
        label: 'State',
        type: 'select',
        options: ['working', 'searching', 'solving', 'listening', 'connecting', 'weaving', 'composing', 'breathing', 'shaping'],
      },
      { key: 'size', label: 'Size', type: 'select', options: [64, 32, 20] },
      THEME,
      { key: 'color', label: 'Tint', type: 'color' },
      { key: 'speed', label: 'Speed', type: 'number', min: 0.1, max: 4, step: 0.1 },
      { key: 'dots', label: 'Density', type: 'number', min: 0.1, max: 3, step: 0.1 },
      { key: 'dotSize', label: 'Dot size', type: 'number', min: 0.3, max: 3, step: 0.1 },
    ],
  },
  voice: {
    label: 'Voice glow',
    pkg: 'voice-glow',
    blurb: 'Sound-reactive glow along the bottom edge',
    size: { w: 393, h: 120, radius: 0 },
    props: { type: 'mobile', look: 'glow', colorVariant: 'colorful', theme: 'light', source: 'simulated', simLevel: 0.6 },
    fields: [
      { key: 'type', label: 'Type', type: 'select', options: ['mobile', 'default', 'pill'] },
      { key: 'look', label: 'Look', type: 'select', options: ['glow', 'dots', 'lines'] },
      PALETTE,
      THEME,
      { key: 'source', label: 'Level source', type: 'select', options: ['simulated', 'microphone', 'fixed'] },
      { key: 'simLevel', label: 'Level / amplitude', type: 'number', min: 0, max: 1, step: 0.05 },
    ],
  },
  avatar: {
    label: 'Bot avatar',
    pkg: 'bot-avatars',
    blurb: 'Animated plush / plastic bot faces',
    size: { w: 64, h: 64, radius: 0 },
    props: { type: 'clover', state: 'default', shading: 'fabric', face: 'eyes', color: '', hat: 'none', glasses: 'none', headphones: false, bowTie: false },
    fields: [
      {
        key: 'type',
        label: 'Shape',
        type: 'select',
        options: ['clover', 'flower', 'triangle', 'square', 'blob', 'ghost', 'circle', 'drop', 'star', 'droid', 'mech', 'alien', 'hexagon', 'cat', 'cloud', 'pill', 'pebble', 'puddle'],
      },
      { key: 'state', label: 'State', type: 'select', options: ['default', 'working', 'sleeping'] },
      { key: 'shading', label: 'Shading', type: 'select', options: ['fabric', 'plastic', 'crisp', 'smooth', 'flat'] },
      { key: 'face', label: 'Face', type: 'select', options: ['eyes', 'mouth'] },
      { key: 'color', label: 'Body colour', type: 'color' },
      { key: 'hat', label: 'Hat', type: 'select', options: ['none', 'beret', 'beanie', 'party', 'crown'] },
      { key: 'glasses', label: 'Glasses', type: 'select', options: ['none', 'round', 'square', 'shades'] },
      { key: 'headphones', label: 'Headphones', type: 'bool' },
      { key: 'bowTie', label: 'Bow tie', type: 'bool' },
    ],
  },
  metal: {
    label: 'Liquid metal',
    pkg: 'metal-fx',
    blurb: 'Liquid metal ring for buttons',
    size: { w: 200, h: 48, radius: 24 },
    props: { variant: 'button', preset: 'chromatic', theme: 'light', strength: 1, label: 'Pay with points', fill: '#ffffff', textColor: '#1d2b4f' },
    fields: [
      { key: 'variant', label: 'Variant', type: 'select', options: ['button', 'circle'] },
      { key: 'preset', label: 'Preset', type: 'select', options: ['chromatic', 'silver', 'gold'] },
      THEME,
      { key: 'strength', label: 'Strength', type: 'number', min: 0, max: 1, step: 0.05 },
      { key: 'label', label: 'Label (empty = ring only)', type: 'text' },
      { key: 'fill', label: 'Button fill', type: 'color' },
      { key: 'textColor', label: 'Text colour', type: 'color' },
    ],
  },
  image: {
    label: 'Image generation',
    pkg: 'img-fx',
    blurb: 'WebGL loader that reveals an image',
    size: { w: 345, h: 208, radius: 26 },
    props: { preset: 'pixels-organic', theme: 'light', strength: 1, pixelScale: 1, autoReveal: true, cardBg: '' },
    fields: [
      { key: 'preset', label: 'Preset', type: 'select', options: ['pixels-organic', 'pixels-mechanic', 'sweep-gradient'] },
      THEME,
      { key: 'strength', label: 'Strength', type: 'number', min: 0, max: 1, step: 0.05 },
      { key: 'pixelScale', label: 'Pixel scale', type: 'number', min: 0.25, max: 4, step: 0.25 },
      { key: 'autoReveal', label: 'Auto reveal', type: 'bool' },
      { key: 'cardBg', label: 'Card bg', type: 'color' },
    ],
  },
  gooey: {
    label: 'Gooey',
    pkg: 'liquid-gooey',
    blurb: 'Pieces that merge like liquid',
    size: { w: 300, h: 64, radius: 32 },
    props: { merged: false, autoplay: true, fill: '#2f57b8', blur: 10, label: 'Pay now', textColor: '#ffffff' },
    fields: [
      { key: 'merged', label: 'Merged', type: 'bool' },
      { key: 'autoplay', label: 'Autoplay toggle', type: 'bool' },
      { key: 'fill', label: 'Liquid fill', type: 'color' },
      { key: 'blur', label: 'Goo blur', type: 'number', min: 2, max: 30, step: 1 },
      { key: 'label', label: 'Label', type: 'text' },
      { key: 'textColor', label: 'Text colour', type: 'color' },
    ],
  },
}

let counter = 0
export function makeLayer(kind: LayerKind, at?: { x: number; y: number }): Layer {
  const spec = KINDS[kind]
  const { w, h, radius } = spec.size
  return {
    id: `${kind}-${Date.now().toString(36)}-${counter++}`,
    kind,
    name: spec.label,
    x: at?.x ?? Math.round((DEVICE_W - w) / 2),
    y: at?.y ?? (kind === 'nav' ? DEVICE_H - h : Math.round((DEVICE_H - h) / 2)),
    w,
    h,
    radius,
    props: { ...spec.props },
  }
}

// Starter layer: a border beam hugging the "Make a payment" card.
export function starterLayers(): Layer[] {
  const beam = makeLayer('beam')
  return [{ ...beam, name: 'Make a payment beam', x: 205, y: 247, w: 172, h: 179, radius: 26, props: { ...beam.props, theme: 'dark' } }]
}
