-- Add equipo_id and usuario_soporte columns to visitas table
-- Run this in Supabase SQL Editor to fix schema issues

-- 1. Add equipo_id
ALTER TABLE public.visitas
ADD COLUMN IF NOT EXISTS equipo_id UUID REFERENCES public.equipos(id);

CREATE INDEX IF NOT EXISTS idx_visitas_equipo_id ON public.visitas(equipo_id);

-- 2. Add usuario_soporte
-- Assuming usuario_soporte is a text field or a FK to profiles/users.
-- Based on the name, it might be the name of the technician or a FK.
-- If it's the technician assignment:
ALTER TABLE public.visitas
ADD COLUMN IF NOT EXISTS usuario_soporte TEXT; -- Or UUID REFERENCES auth.users(id) / profiles(id) if strict

-- 3. Add other potentially missing columns if needed
ALTER TABLE public.visitas
ADD COLUMN IF NOT EXISTS tipo_visita TEXT,
ADD COLUMN IF NOT EXISTS costo_servicio NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS moneda TEXT DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS trabajo_realizado BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS descripcion_trabajo TEXT;

-- 4. Enable RLS if not enabled
ALTER TABLE public.visitas ENABLE ROW LEVEL SECURITY;

-- 5. Policies (adjust as needed)
CREATE POLICY "Enable all access for authenticated users" ON "public"."visitas"
AS PERMISSIVE FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
