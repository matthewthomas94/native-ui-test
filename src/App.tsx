import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { DEVICE_H, DEVICE_W, KINDS, makeLayer, starterLayers, type Field, type Layer, type LayerKind } from './layers'
import { Overlay } from './Overlay'
import './App.css'

const STORE_KEY = 'native-ui-test:layers:v1'
/** Navigation always sits above every other layer, whatever the layer order. */
const NAV_Z = 1000

function loadLayers(): Layer[] {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return starterLayers()
}

type Drag = { id: string; mode: 'move' | 'resize'; sx: number; sy: number; orig: Layer }

export default function App() {
  const [layers, setLayers] = useState<Layer[]>(loadLayers)
  const [selected, setSelected] = useState<string | null>(() => layers[0]?.id ?? null)
  const [editing, setEditing] = useState(true)
  const [plateOpacity, setPlateOpacity] = useState(1)
  const [showOverlays, setShowOverlays] = useState(true)
  // Fit the phone to the window height so the bottom of the screen (and its nav) is reachable.
  const [zoom, setZoom] = useState(() => Math.min(1, Math.max(0.5, (window.innerHeight - 140) / DEVICE_H)))
  const [plate, setPlate] = useState('/backplate.webp')
  const drag = useRef<Drag | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(layers))
    } catch {
      /* ignore */
    }
  }, [layers])

  const update = useCallback((id: string, patch: Partial<Layer>) => {
    setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }, [])

  const add = (kind: LayerKind) => {
    const l = makeLayer(kind)
    setLayers((ls) => [...ls, l])
    setSelected(l.id)
    setEditing(true)
  }

  const remove = (id: string) => {
    setLayers((ls) => ls.filter((l) => l.id !== id))
    setSelected((s) => (s === id ? null : s))
  }

  const duplicate = (id: string) => {
    const src = layers.find((l) => l.id === id)
    if (!src) return
    const copy = { ...makeLayer(src.kind), ...src, props: { ...src.props }, x: src.x + 12, y: src.y + 12 }
    copy.id = makeLayer(src.kind).id
    setLayers((ls) => [...ls, copy])
    setSelected(copy.id)
  }

  const move = (id: string, dir: -1 | 1) => {
    setLayers((ls) => {
      const i = ls.findIndex((l) => l.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= ls.length) return ls
      const next = [...ls]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  // Keyboard: arrows nudge (shift = 10pt), backspace deletes, cmd/ctrl+d duplicates.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (!selected || !editing || t.closest('input, select, textarea')) return
      const l = layers.find((x) => x.id === selected)
      if (!l) return
      const step = e.shiftKey ? 10 : 1
      const nudges: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      }
      if (nudges[e.key]) {
        e.preventDefault()
        update(l.id, { x: l.x + nudges[e.key][0], y: l.y + nudges[e.key][1] })
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        remove(l.id)
      } else if (e.key === 'd' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        duplicate(l.id)
      } else if (e.key === 'Escape') {
        setSelected(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const startDrag = (e: RPointerEvent, layer: Layer, mode: Drag['mode']) => {
    e.stopPropagation()
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    setSelected(layer.id)
    drag.current = { id: layer.id, mode, sx: e.clientX, sy: e.clientY, orig: layer }
  }
  const onDrag = (e: RPointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = Math.round((e.clientX - d.sx) / zoom)
    const dy = Math.round((e.clientY - d.sy) / zoom)
    if (d.mode === 'move') update(d.id, { x: d.orig.x + dx, y: d.orig.y + dy })
    else update(d.id, { w: Math.max(8, d.orig.w + dx), h: Math.max(8, d.orig.h + dy) })
  }
  const endDrag = () => {
    drag.current = null
  }

  const onPlateFile = (f: File | undefined) => {
    if (f) setPlate(URL.createObjectURL(f))
  }

  const sel = layers.find((l) => l.id === selected) ?? null

  return (
    <div className="app">
      <aside className="panel left">
        <h2>Library</h2>
        <div className="kinds">
          {(Object.keys(KINDS) as LayerKind[]).map((k) => (
            <button key={k} className="kind" onClick={() => add(k)} title={`Add ${KINDS[k].label}`}>
              <strong>{KINDS[k].label}</strong>
              <span>{KINDS[k].blurb}</span>
              <code>{KINDS[k].pkg}</code>
            </button>
          ))}
        </div>

        <h2>Layers</h2>
        {layers.length === 0 && <p className="muted">Nothing on the backplate yet. Add something above.</p>}
        <ul className="layers">
          {[...layers].reverse().map((l) => (
            <li key={l.id} className={l.id === selected ? 'on' : ''} onClick={() => setSelected(l.id)}>
              <button
                className="eye"
                title={l.hidden ? 'Show' : 'Hide'}
                onClick={(e) => {
                  e.stopPropagation()
                  update(l.id, { hidden: !l.hidden })
                }}
              >
                {l.hidden ? '◌' : '●'}
              </button>
              <span className="lname">{l.name}</span>
              <span className="lkind">{KINDS[l.kind].pkg}</span>
            </li>
          ))}
        </ul>
        {layers.length > 0 && (
          <button
            className="ghost small"
            onClick={() => {
              if (confirm('Remove all layers?')) {
                setLayers([])
                setSelected(null)
              }
            }}
          >
            Clear all layers
          </button>
        )}
      </aside>

      <main className="stage" onPointerDown={() => setSelected(null)}>
        <div className="toolbar" onPointerDown={(e) => e.stopPropagation()}>
          <div className="seg">
            <button className={editing ? 'on' : ''} onClick={() => setEditing(true)}>
              Edit
            </button>
            <button className={!editing ? 'on' : ''} onClick={() => setEditing(false)}>
              Preview
            </button>
          </div>
          <label>
            <input type="checkbox" checked={showOverlays} onChange={(e) => setShowOverlays(e.target.checked)} /> Overlays
          </label>
          <label>
            Backplate
            <input type="range" min={0} max={1} step={0.05} value={plateOpacity} onChange={(e) => setPlateOpacity(+e.target.value)} />
          </label>
          <label>
            Zoom
            <input type="range" min={0.5} max={1.5} step={0.05} value={zoom} onChange={(e) => setZoom(+e.target.value)} />
          </label>
          <label className="file">
            Swap screenshot
            <input type="file" accept="image/*" onChange={(e) => onPlateFile(e.target.files?.[0])} />
          </label>
        </div>

        <div className="device-wrap" style={{ width: DEVICE_W * zoom, height: DEVICE_H * zoom }}>
          <div className="device" style={{ width: DEVICE_W, height: DEVICE_H, transform: `scale(${zoom})` }}>
            <img className="plate" src={plate} style={{ opacity: plateOpacity }} alt="" draggable={false} />
            {showOverlays &&
              layers.map((l) =>
                l.hidden ? null : (
                  <div
                    key={l.id}
                    className={`layer ${editing && l.id === selected ? 'selected' : ''}`}
                    style={{ left: l.x, top: l.y, width: l.w, height: l.h, zIndex: l.kind === 'nav' ? NAV_Z : undefined }}
                  >
                    <Overlay layer={l} />
                    {editing && (
                      <div
                        className="handle"
                        style={{ borderRadius: l.radius }}
                        onPointerDown={(e) => startDrag(e, l, 'move')}
                        onPointerMove={onDrag}
                        onPointerUp={endDrag}
                      >
                        {l.id === selected && (
                          <>
                            <span className="tag">
                              {l.name} · {l.w}×{l.h} @ {l.x},{l.y}
                            </span>
                            <span
                              className="resize"
                              onPointerDown={(e) => startDrag(e, l, 'resize')}
                              onPointerMove={onDrag}
                              onPointerUp={endDrag}
                            />
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ),
              )}
          </div>
        </div>
        <p className="hint">
          {editing
            ? 'Drag to move · corner to resize · arrows nudge (⇧ ×10) · ⌘D duplicate · ⌫ delete'
            : 'Preview mode: overlays are live and clickable.'}
        </p>
      </main>

      <aside className="panel right">
        {sel ? (
          <Inspector
            layer={sel}
            onChange={(patch) => update(sel.id, patch)}
            onRemove={() => remove(sel.id)}
            onDuplicate={() => duplicate(sel.id)}
            onMove={(d) => move(sel.id, d)}
          />
        ) : (
          <p className="muted">Select a layer to edit its props.</p>
        )}
      </aside>
    </div>
  )
}

function Inspector({
  layer,
  onChange,
  onRemove,
  onDuplicate,
  onMove,
}: {
  layer: Layer
  onChange: (patch: Partial<Layer>) => void
  onRemove: () => void
  onDuplicate: () => void
  onMove: (d: -1 | 1) => void
}) {
  const spec = KINDS[layer.kind]
  const setProp = (key: string, v: string | number | boolean) => onChange({ props: { ...layer.props, [key]: v } })
  const num = (key: 'x' | 'y' | 'w' | 'h' | 'radius') => (
    <label className="geo">
      <span>{key === 'radius' ? 'r' : key}</span>
      <input type="number" value={layer[key]} onChange={(e) => onChange({ [key]: Number(e.target.value) })} />
    </label>
  )
  return (
    <div className="inspector">
      <input className="title" value={layer.name} onChange={(e) => onChange({ name: e.target.value })} />
      <p className="muted">
        <code>{spec.pkg}</code>
      </p>

      <h3>Frame (pt)</h3>
      <div className="geo-row">
        {num('x')}
        {num('y')}
        {num('w')}
        {num('h')}
        {num('radius')}
      </div>

      <h3>Props</h3>
      {spec.fields.map((f) => (
        <FieldInput key={f.key} field={f} value={layer.props[f.key]} onChange={(v) => setProp(f.key, v)} />
      ))}

      <div className="actions">
        <button onClick={() => onMove(1)}>Bring forward</button>
        <button onClick={() => onMove(-1)}>Send back</button>
        <button onClick={onDuplicate}>Duplicate</button>
        <button className="danger" onClick={onRemove}>
          Delete
        </button>
        <button onClick={() => onChange({ props: { ...spec.props } })}>Reset props</button>
        <button onClick={() => navigator.clipboard.writeText(JSON.stringify(layer, null, 2))}>Copy JSON</button>
      </div>
    </div>
  )
}

function FieldInput({ field, value, onChange }: { field: Field; value: unknown; onChange: (v: string | number | boolean) => void }) {
  switch (field.type) {
    case 'select':
      return (
        <label className="field">
          <span>{field.label}</span>
          <select
            value={String(value)}
            onChange={(e) => {
              const raw = e.target.value
              onChange(typeof field.options[0] === 'number' ? Number(raw) : raw)
            }}
          >
            {field.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      )
    case 'number':
      return (
        <label className="field">
          <span>
            {field.label} <em>{Number(value).toFixed(field.step < 1 ? 2 : 0)}</em>
          </span>
          <input
            type="range"
            min={field.min}
            max={field.max}
            step={field.step}
            value={Number(value)}
            onChange={(e) => onChange(Number(e.target.value))}
          />
        </label>
      )
    case 'bool':
      return (
        <label className="field inline">
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
          <span>{field.label}</span>
        </label>
      )
    case 'color':
      return (
        <label className="field">
          <span>{field.label}</span>
          <div className="color-row">
            <input type="color" value={(value as string) || '#000000'} onChange={(e) => onChange(e.target.value)} />
            <input type="text" placeholder="default" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
          </div>
        </label>
      )
    case 'text':
      return (
        <label className="field">
          <span>{field.label}</span>
          <input type="text" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
        </label>
      )
  }
}
