// Sincronización en la nube sin perder cambios de otras personas.
// Todo el estado de la planilla vive en un documento JSON con número de versión. Cada equipo guarda una copia de lo último
// que sincronizó (la "base"); al reconciliar se hace una fusión de 3 vías (base, lo mío, lo de la nube) a nivel de jugada.

const sortKeys = (v) =>
  Array.isArray(v) ? v.map(sortKeys)
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]))
  : v
export const stable = (v) => JSON.stringify(sortKeys(v))
export const same = (a, b) => stable(a) === stable(b)
const snap = (s) => JSON.parse(JSON.stringify(s)) // copia para que la base no cambie si alguien muta el estado

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const hasId = (x) => isObj(x) && x.id !== undefined

function mergeById(base, mine, theirs) {
  const idx = (arr) => new Map(arr.map((x) => [x.id, x]))
  const B = idx(base), M = idx(mine), T = idx(theirs)
  const order = [...theirs.map((x) => x.id), ...mine.map((x) => x.id).filter((id) => !T.has(id))]
  const out = []
  for (const id of order) {
    const b = B.get(id), m = M.get(id), t = T.get(id)
    if (m === undefined && t === undefined) continue
    if (m === undefined) { if (!same(t, b)) out.push(t); continue } // yo la borré: gana la edición ajena
    if (t === undefined) { if (!same(m, b)) out.push(m); continue } // la borraron: gana mi edición
    out.push(merge(b, m, t))
  }
  return out
}

// Fusión de 3 vías. Si los dos cambiaron lo mismo, gana lo mío.
export function merge(base, mine, theirs) {
  if (same(mine, theirs)) return mine
  if (same(mine, base)) return theirs
  if (same(theirs, base)) return mine
  if (isObj(mine) && isObj(theirs)) {
    const b = isObj(base) ? base : {}
    const out = {}
    for (const k of new Set([...Object.keys(mine), ...Object.keys(theirs)])) {
      const v = merge(b[k], mine[k], theirs[k])
      if (v !== undefined) out[k] = v
    }
    return out
  }
  if (Array.isArray(mine) && Array.isArray(theirs)) {
    const b = Array.isArray(base) ? base : []
    const all = [...mine, ...theirs]
    if (all.length && all.every(hasId)) return mergeById(b.filter(hasId), mine, theirs)
    if (all.every((x) => x === null || typeof x !== 'object')) {
      // listas simples (p. ej. nombres de clientes): unión, sin los que alguien borró
      const union = [...theirs, ...mine.filter((x) => !theirs.includes(x))]
      return union.filter((x) => !(b.includes(x) && (!mine.includes(x) || !theirs.includes(x))))
    }
  }
  return mine
}

// backend: { get() -> {state, version} | null, set(state, expectedVersion) -> {ok, state, version}, notify?() }
// readOnly: solo trae los cambios de la nube (usuarios de solo lectura). isEmpty: detecta una planilla vacía.
export function createSync({ backend, getLocal, onRemote, onStatus = () => {}, backupLocal, readOnly = false, isEmpty = () => false }) {
  let base = null
  let busy = false
  let again = false
  let closed = false
  let timer = null

  const run = async () => {
    if (closed) return
    if (busy) { again = true; return }
    busy = true
    onStatus('syncing')
    try {
      for (let i = 0; i < 6 && !closed; i++) {
        const local = getLocal()
        const remote = await backend.get()

        if (readOnly) { // solo lectura: lo de la nube manda, no se sube nada
          if (remote) {
            base = { state: snap(remote.state), version: remote.version }
            if (!same(remote.state, getLocal())) onRemote(remote.state)
          }
          break
        }

        if (!remote) { // sala vacía: se siembra con lo que hay acá
          const r = await backend.set(local, 0)
          if (r.ok) { base = { state: snap(local), version: r.version }; backend.notify?.(); break }
          continue
        }

        let merged
        if (!base) {
          if (isEmpty(remote.state) && !isEmpty(local)) {
            merged = local // la nube está vacía y acá hay datos: se suben (migración inicial)
          } else { // primer contacto con una planilla que ya tiene datos: manda la nube (se guarda copia de lo local)
            if (!same(local, remote.state)) backupLocal?.(local)
            merged = remote.state
          }
        } else {
          merged = merge(base.state, local, remote.state)
        }

        let ok = true
        let version = remote.version
        if (!same(merged, remote.state)) {
          const r = await backend.set(merged, remote.version)
          ok = r.ok
          if (ok) { version = r.version; backend.notify?.() }
        }
        if (!ok) continue // alguien guardó en el medio: reintentar

        base = { state: snap(merged), version }
        if (!same(getLocal(), local)) continue // hubo cambios mientras sincronizaba: otra vuelta
        if (!same(merged, local)) onRemote(merged)
        break
      }
      onStatus('ok')
    } catch (e) {
      onStatus('error', e)
    } finally {
      busy = false
      if (again && !closed) { again = false; run() }
    }
  }

  return {
    run,
    schedule: (ms = 700) => { clearTimeout(timer); timer = setTimeout(run, ms) },
    hasChanges: (local) => !base || !same(local, base.state),
    close: () => { closed = true; clearTimeout(timer) },
  }
}
