-- Optimización de índices para acelerar los dashboards
CREATE INDEX IF NOT EXISTS idx_cotizaciones_created_at ON cotizaciones(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_estado ON cotizaciones(estado);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_operativo_id ON cotizaciones(operativo_id);

CREATE INDEX IF NOT EXISTS idx_ventas_created_at ON ventas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ventas_estado ON ventas(estado);
CREATE INDEX IF NOT EXISTS idx_ventas_operativo_id ON ventas(operativo_id);

CREATE INDEX IF NOT EXISTS idx_vouchers_venta_id ON vouchers(venta_id);
