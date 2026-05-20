-- SQL migration to add 'comercial' field to 'cotizaciones' table
-- Run this in your Supabase SQL Editor:

ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS comercial TEXT;

-- SQL migration to add 'ciudad' field to 'profiles' table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ciudad TEXT;

-- SQL migration to add 'celular' field to 'profiles' table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS celular TEXT;

