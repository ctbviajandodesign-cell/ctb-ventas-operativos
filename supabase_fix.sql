-- Ejecuta esto en el SQL Editor de Supabase
ALTER TABLE cotizaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir operaciones a usuarios logueados" ON cotizaciones;
CREATE POLICY "Permitir operaciones a usuarios logueados" ON cotizaciones FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir operaciones a usuarios logueados" ON ventas;
CREATE POLICY "Permitir operaciones a usuarios logueados" ON ventas FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir operaciones a usuarios logueados" ON vouchers;
CREATE POLICY "Permitir operaciones a usuarios logueados" ON vouchers FOR ALL TO authenticated USING (true) WITH CHECK (true);
