-- Migración: Agregar columna numero_emergencia a la tabla vouchers
-- Ejecutar en: Supabase Dashboard > SQL Editor > Run

ALTER TABLE vouchers 
ADD COLUMN IF NOT EXISTS numero_emergencia TEXT;

COMMENT ON COLUMN vouchers.numero_emergencia IS 'Nombre y número de contacto para emergencias del pasajero';
