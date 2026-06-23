-- Función RPC para calcular las métricas del Dashboard en el lado del servidor (Base de Datos)
-- Esto evita descargar miles de filas al navegador.

CREATE OR REPLACE FUNCTION get_dashboard_metrics(
  p_start_iso TIMESTAMP WITH TIME ZONE,
  p_end_iso TIMESTAMP WITH TIME ZONE,
  p_operativo_id UUID DEFAULT NULL,
  p_city TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_ventas_data JSON;
  v_pipeline_data JSON;
  v_vouchers_count INT;
  v_total_vendido NUMERIC := 0;
  v_total_ganancia NUMERIC := 0;
  v_por_cobrar_mes NUMERIC := 0;
  v_ganadas_count INT := 0;
  v_total_pipeline INT := 0;
  v_abiertas INT := 0;
  v_caducadas INT := 0;
  v_perdidas INT := 0;
  v_anuladas INT := 0;
  v_top_destino TEXT := 'N/A';
BEGIN
  
  -- 1. Ventas Metrics (Total Vendido, Ganancia, Por Cobrar)
  SELECT 
    COALESCE(SUM(total), 0),
    COALESCE(SUM(COALESCE(comision, 0) + COALESCE(utilidad, 0)), 0),
    COUNT(*),
    COALESCE(SUM(GREATEST(0, COALESCE(total, 0) - (COALESCE(abono_1, 0) + COALESCE(abono_2, 0) + COALESCE(abono_tarjeta, 0)))), 0)
  INTO
    v_total_vendido,
    v_total_ganancia,
    v_ganadas_count,
    v_por_cobrar_mes
  FROM ventas v
  LEFT JOIN profiles p ON v.operativo_id = p.id
  WHERE v.created_at >= p_start_iso AND v.created_at <= p_end_iso
    AND (p_operativo_id IS NULL OR v.operativo_id = p_operativo_id)
    AND (p_city IS NULL OR p_city = 'global' OR p.ciudad = p_city);

  -- 2. Cotizaciones/Pipeline Metrics
  -- (A simplified version of the logic to count states and top dest)
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE estado = 'abierta' AND (
      fecha_caducidad IS NULL OR 
      (fecha_caducidad || ' ' || COALESCE(hora_caducidad, '23:59:59'))::timestamp > NOW()
    )),
    COUNT(*) FILTER (WHERE estado = 'abierta' AND (
      fecha_caducidad IS NOT NULL AND 
      (fecha_caducidad || ' ' || COALESCE(hora_caducidad, '23:59:59'))::timestamp <= NOW()
    )),
    COUNT(*) FILTER (WHERE estado = 'perdida'),
    COUNT(*) FILTER (WHERE estado = 'anulada'),
    (
      SELECT destino 
      FROM cotizaciones c2 
      LEFT JOIN profiles p2 ON c2.operativo_id = p2.id
      WHERE c2.created_at >= p_start_iso AND c2.created_at <= p_end_iso
        AND (p_operativo_id IS NULL OR c2.operativo_id = p_operativo_id)
        AND (p_city IS NULL OR p_city = 'global' OR p2.ciudad = p_city)
      GROUP BY destino 
      ORDER BY count(*) DESC 
      LIMIT 1
    )
  INTO
    v_total_pipeline,
    v_abiertas,
    v_caducadas,
    v_perdidas,
    v_anuladas,
    v_top_destino
  FROM cotizaciones c
  LEFT JOIN profiles p ON c.operativo_id = p.id
  WHERE c.created_at >= p_start_iso AND c.created_at <= p_end_iso
    AND (p_operativo_id IS NULL OR c.operativo_id = p_operativo_id)
    AND (p_city IS NULL OR p_city = 'global' OR p.ciudad = p_city);

  -- 3. Vouchers
  SELECT COUNT(*)
  INTO v_vouchers_count
  FROM vouchers v
  LEFT JOIN profiles p ON v.operativo_id = p.id
  WHERE v.estado = 'activo' AND v.created_at >= p_start_iso AND v.created_at <= p_end_iso
    AND (p_operativo_id IS NULL OR v.operativo_id = p_operativo_id)
    AND (p_city IS NULL OR p_city = 'global' OR p.ciudad = p_city);

  -- 4. Construir y retornar el JSON
  RETURN json_build_object(
    'totalVendido', v_total_vendido,
    'totalGanancia', v_total_ganancia,
    'porCobrarMes', v_por_cobrar_mes,
    'ganadas', v_ganadas_count,
    'totalPipeline', v_total_pipeline,
    'abiertas', v_abiertas,
    'caducadas', v_caducadas,
    'perdidas', v_perdidas,
    'anuladas', v_anuladas,
    'topDestino', COALESCE(v_top_destino, 'N/A'),
    'vouchersEmitidos', v_vouchers_count
  );
END;
$$ LANGUAGE plpgsql;
