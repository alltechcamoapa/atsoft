-- FIX: Add missing tecnico_id column to visitas table
-- This column seems to be required by a database constraint or trigger that was added recently.
-- Run this in Supabase SQL Editor.

ALTER TABLE public.visitas
ADD COLUMN IF NOT EXISTS tecnico_id TEXT;

-- If tecnico_id is meant to be the same as usuario_soporte, we can migrate data
UPDATE public.visitas
SET tecnico_id = usuario_soporte
WHERE tecnico_id IS NULL;

-- If the constraint is NOT NULL, we need to ensure it's populated or set a default.
-- For now, let's just make sure the column exists. If there's a NOT NULL constraint, 
-- your Insert query MUST provide it.
