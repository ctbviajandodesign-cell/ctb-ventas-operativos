// Respaldo completo de Supabase (solo LECTURA, no modifica nada).
// Uso:  node scripts/respaldo-db.mjs
// Guarda en ./respaldos/AAAA-MM-DD_HHMM/  (carpeta excluida de git)
import fs from 'node:fs'
import path from 'node:path'

// Cargar .env.local
const envFile = fs.readFileSync(path.resolve('.env.local'), 'utf8')
for (const line of envFile.split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) { console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local'); process.exit(1) }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` }

const stamp = new Date().toLocaleString('sv-SE', { timeZone: 'America/Guayaquil' }).slice(0, 16).replace(' ', '_').replace(':', '')
const outDir = path.resolve('respaldos', stamp)
fs.mkdirSync(outDir, { recursive: true })

const toCsv = (rows) => {
  if (!rows.length) return ''
  const cols = [...new Set(rows.flatMap(r => Object.keys(r)))]
  const esc = v => v == null ? '' : `"${(typeof v === 'object' ? JSON.stringify(v) : String(v)).replace(/"/g, '""')}"`
  return [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n')
}

// 1. Descubrir TODAS las tablas expuestas
const spec = await (await fetch(`${URL}/rest/v1/`, { headers: H })).json()
const tablas = Object.keys(spec.definitions || {})
console.log(`Tablas encontradas (${tablas.length}): ${tablas.join(', ')}`)

const resumen = {}
for (const t of tablas) {
  const rows = []
  const page = 1000
  for (let from = 0; ; from += page) {
    const r = await fetch(`${URL}/rest/v1/${t}?select=*`, { headers: { ...H, Range: `${from}-${from + page - 1}` } })
    if (!r.ok) { console.warn(`  ! ${t}: ${r.status} ${await r.text()}`); break }
    const data = await r.json()
    rows.push(...data)
    if (data.length < page) break
  }
  fs.writeFileSync(path.join(outDir, `${t}.json`), JSON.stringify(rows, null, 2))
  fs.writeFileSync(path.join(outDir, `${t}.csv`), toCsv(rows))
  resumen[t] = rows.length
  console.log(`  ✓ ${t}: ${rows.length} filas`)
}

// 2. Usuarios de Auth (sin contraseñas)
const users = []
for (let p = 1; ; p++) {
  const r = await fetch(`${URL}/auth/v1/admin/users?page=${p}&per_page=500`, { headers: H })
  if (!r.ok) break
  const d = await r.json()
  users.push(...(d.users || []).map(u => ({ id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at, role: u.role })))
  if (!d.users || d.users.length < 500) break
}
fs.writeFileSync(path.join(outDir, `_auth_users.json`), JSON.stringify(users, null, 2))
resumen._auth_users = users.length
console.log(`  ✓ usuarios auth: ${users.length}`)

fs.writeFileSync(path.join(outDir, `_resumen.json`), JSON.stringify({ fecha: stamp, proyecto: URL, filas: resumen }, null, 2))
console.log(`\nRespaldo listo en: ${outDir}`)
