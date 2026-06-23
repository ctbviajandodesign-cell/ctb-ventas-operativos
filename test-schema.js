const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')

const envFile = fs.readFileSync('.env.local', 'utf8')
const env = {}
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) {
    let val = match[2].trim()
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
    env[match[1].trim()] = val
  }
})

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

async function main() {
  const { data, error } = await supabase.from('ventas').select('*').limit(1)
  console.log(error || Object.keys(data[0]))
}
main()
