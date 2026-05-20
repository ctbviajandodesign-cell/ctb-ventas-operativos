-- SQL migration to add 'comercial' field to 'cotizaciones' table
-- Run this in your Supabase SQL Editor:

ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS comercial TEXT;
