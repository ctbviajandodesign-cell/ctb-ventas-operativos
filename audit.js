const fs = require('fs');
fs.readFileSync('.env.local', 'utf8').split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2];
});

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function runAudit() {
  console.log('--- INICIANDO AUDITORÍA DE DATOS ---');
  
  const { data: perfiles, error: profError } = await supabase.from('profiles').select('*');
  if (profError) { console.error('Error fetching profiles', profError); return; }
  
  const eva = perfiles.find(p => p.nombre && p.nombre.toUpperCase().includes('EVA'));
  
  if (!eva) {
    console.log('No se encontró a Eva Freire en la BD. Perfiles encontrados:');
    perfiles.forEach(p => console.log(p.nombre));
    return;
  }
  console.log(`Operativo ID para ${eva.nombre}: ${eva.id}`);

  const startDate = new Date('2026-06-01T00:00:00Z').toISOString();
  const endDate = new Date('2026-06-30T23:59:59Z').toISOString();

  let { data: cotizaciones, error } = await supabase
    .from('cotizaciones')
    .select(`
      id, codigo, estado, valor_total, agencia, motivo_perdida, created_at,
      ventas(id, total, estado)
    `)
    .eq('operativo_id', eva.id)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  if (error) {
    console.error('Error fetching data:', error);
    return;
  }

  console.log(`\nTotal Cotizaciones encontradas (${eva.nombre} - Junio 2026): ${cotizaciones.length}`);
  
  let totalCotizado = 0;
  let totalVendido = 0;
  let canceladas = 0;
  let sinValorCotizado = 0;
  
  const agenciasMap = {};

  cotizaciones.forEach(q => {
    const vCotizado = Number(q.valor_total) || 0;
    const venta = q.ventas && q.ventas.length > 0 ? q.ventas[0] : null;
    
    let isVendida = false;
    if (q.estado !== 'anulada' && q.estado !== 'perdida' && venta && venta.estado !== 'anulada') {
      isVendida = true;
    }
    
    const vVendido = isVendida ? (Number(venta.total) || 0) : 0;
    
    totalCotizado += vCotizado;
    totalVendido += vVendido;
    
    if (vCotizado === 0) {
      sinValorCotizado++;
    }
    
    if (q.estado === 'anulada' || q.estado === 'perdida') {
      canceladas++;
    }
    
    const agencia = (q.agencia || 'Directo').trim();
    if (!agenciasMap[agencia]) agenciasMap[agencia] = { cotizado: 0, vendido: 0 };
    agenciasMap[agencia].cotizado += vCotizado;
    agenciasMap[agencia].vendido += vVendido;
  });

  console.log(`- Total Cotizado Bruto DB: $${totalCotizado}`);
  console.log(`- Total Vendido DB: $${totalVendido}`);
  console.log(`- Cotizaciones registradas con Valor $0: ${sinValorCotizado}`);
  console.log(`- Cotizaciones Canceladas/Perdidas explícitas: ${canceladas}`);
  
  console.log(`\n--- AGENCIAS ZERO-BUY CHECK ---`);
  let zeroBuy = 0;
  for (const [ag, d] of Object.entries(agenciasMap)) {
    if (d.vendido === 0 && d.cotizado > 0) {
      console.log(`Agencia Zero-Buy: ${ag} | Cotizó: $${d.cotizado} | Compró: $0`);
      zeroBuy++;
    }
  }
  if (zeroBuy === 0) {
    console.log('No hay ninguna agencia que cumpla (vendido === 0 Y cotizado > 0)');
  }
  
  console.log('\nAuditoría Finalizada.');
}

runAudit();
