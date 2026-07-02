CREATE TABLE IF NOT EXISTS comerciales (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre text NOT NULL,
  ciudad text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE comerciales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir operaciones a usuarios logueados" ON comerciales;
CREATE POLICY "Permitir operaciones a usuarios logueados" ON comerciales FOR ALL TO authenticated USING (true) WITH CHECK (true);
