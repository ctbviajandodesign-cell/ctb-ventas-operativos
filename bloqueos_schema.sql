-- ==============================================================================
-- CTB VIAJANDO — MÓDULO DE BLOQUEOS (CUPOS AÉREOS Y HOTELES)
-- Ejecutar en el SQL Editor de Supabase
-- ==============================================================================

-- 1. Tabla de etiquetas dinámicas predictivas para "Otros Costos"
CREATE TABLE IF NOT EXISTS bloqueo_etiquetas_costos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre text UNIQUE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insertar etiquetas base más comunes de CTB
INSERT INTO bloqueo_etiquetas_costos (nombre)
VALUES 
  ('Seguro de Asistencia Médica'),
  ('Traslados In / Out'),
  ('Impuestos de Muelle / Tasas Turísticas'),
  ('Tours Opcionales'),
  ('Kit de Viaje'),
  ('Guía Turístico Receptivo')
ON CONFLICT (nombre) DO NOTHING;

-- 2. Tabla Maestra de Bloqueos
CREATE TABLE IF NOT EXISTS bloqueos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo text UNIQUE NOT NULL,
  titulo text NOT NULL,
  destino text NOT NULL,
  aerolinea text,
  fecha_salida date NOT NULL,
  fecha_retorno date,
  fecha_limite_pago date,
  fecha_limite_emision date,
  cupos_totales integer NOT NULL DEFAULT 30,
  precio_venta_pax numeric(12,2) NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'activo', -- 'activo', 'cerrado', 'cancelado', 'completado'
  notas text,

  -- Campos confidenciales de armado (Solo Admin / Superadmin)
  precio_vuelo numeric(12,2) DEFAULT 0,
  precio_operador numeric(12,2) DEFAULT 0,
  otros_costos jsonb DEFAULT '[]'::jsonb, -- Array [{ id, concepto, monto }]
  ganancia_unitaria numeric(12,2) DEFAULT 0,
  costo_total_unitario numeric(12,2) DEFAULT 0,

  creado_por uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabla de Pasajeros y Asignación de Cupos (1..N)
CREATE TABLE IF NOT EXISTS bloqueo_pasajeros (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  bloqueo_id uuid REFERENCES bloqueos(id) ON DELETE CASCADE NOT NULL,
  numero_cupo integer NOT NULL,
  
  -- Agrupamiento (para grupos de 2, 3, 4, 6 o más)
  grupo_id text,
  grupo_nombre text,

  -- Vínculo a Cotización independiente
  codigo_cotizacion text,
  cotizacion_id uuid REFERENCES cotizaciones(id) ON DELETE SET NULL,

  -- Trazabilidad Comercial
  agencia text,
  ciudad text, -- 'GYE', 'UIO', 'CUE', 'Nacional', etc.
  tipo_servicio text DEFAULT 'PAQUETE COMPLETO', -- 'PAQUETE COMPLETO', 'SOLO LAND TOUR', 'TWINS', etc.
  operativo_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  operativo_nombre text,
  comercial_id uuid REFERENCES comerciales(id) ON DELETE SET NULL,
  comercial_nombre text,
  hoteles text,

  -- Datos completos de aerolínea (NO OBLIGATORIOS / OPCIONALES)
  nombres text,
  apellidos text,
  tipo_documento text DEFAULT 'Cédula', -- 'Cédula', 'Pasaporte', 'DNI'
  numero_documento text,
  fecha_nacimiento date,
  caducidad_pasaporte date,
  nacionalidad text DEFAULT 'ECUATORIANA',
  genero text, -- 'M', 'F', 'Otro'
  tipo_habitacion text DEFAULT 'Doble', -- 'Simple', 'Doble', 'Triple', 'Matrimonial', 'Twin'
  requerimientos_especiales text,

  -- Finanzas y Plan de Pagos
  precio_acordado numeric(12,2) DEFAULT 0,
  abono_1 numeric(12,2) DEFAULT 0,
  fecha_abono_1 date,
  abono_2 numeric(12,2) DEFAULT 0,
  fecha_abono_2 date,
  abono_3 numeric(12,2) DEFAULT 0,
  fecha_abono_3 date,
  faltante numeric(12,2) GENERATED ALWAYS AS (
    GREATEST(0, COALESCE(precio_acordado, 0) - (COALESCE(abono_1, 0) + COALESCE(abono_2, 0) + COALESCE(abono_3, 0)))
  ) STORED,
  estado_pago text DEFAULT 'pendiente', -- 'pendiente', 'abono_parcial', 'pagado_total'
  plan_pagos jsonb DEFAULT '[]'::jsonb, -- Plan de pagos ilimitados [{ id, numero, monto, fecha, estado, nota }]
  fecha_limite_pago_agencia date, -- Fecha de cobro acordada con la agencia
  observaciones text,

  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,

  UNIQUE(bloqueo_id, numero_cupo)
);

-- 4. Índices para consultas ultra-rápidas
CREATE INDEX IF NOT EXISTS idx_bloqueos_estado ON bloqueos(estado);
CREATE INDEX IF NOT EXISTS idx_bloqueos_fecha_salida ON bloqueos(fecha_salida);
CREATE INDEX IF NOT EXISTS idx_bloqueos_codigo ON bloqueos(codigo);
CREATE INDEX IF NOT EXISTS idx_bloqueo_pasajeros_bloqueo_id ON bloqueo_pasajeros(bloqueo_id);
CREATE INDEX IF NOT EXISTS idx_bloqueo_pasajeros_operativo ON bloqueo_pasajeros(operativo_id);
CREATE INDEX IF NOT EXISTS idx_bloqueo_pasajeros_grupo ON bloqueo_pasajeros(grupo_id);
CREATE INDEX IF NOT EXISTS idx_bloqueo_pasajeros_codigo_cotiz ON bloqueo_pasajeros(codigo_cotizacion);

-- 5. Habilitar Row Level Security (RLS)
ALTER TABLE bloqueo_etiquetas_costos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en etiquetas" ON bloqueo_etiquetas_costos;
CREATE POLICY "Permitir todo a usuarios autenticados en etiquetas" ON bloqueo_etiquetas_costos FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE bloqueos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en bloqueos" ON bloqueos;
CREATE POLICY "Permitir todo a usuarios autenticados en bloqueos" ON bloqueos FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE bloqueo_pasajeros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en pasajeros" ON bloqueo_pasajeros;
CREATE POLICY "Permitir todo a usuarios autenticados en pasajeros" ON bloqueo_pasajeros FOR ALL TO authenticated USING (true) WITH CHECK (true);
