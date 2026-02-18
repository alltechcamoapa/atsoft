-- 1. Drop the dependent view first to release the lock on column type
DROP VIEW IF EXISTS public.v_software_por_vencer;

-- 2. Now we can alter the column type safely
ALTER TABLE public.software 
ALTER COLUMN tipo_software TYPE TEXT;

-- 3. Eliminate the restrictive enum type if it exists
DROP TYPE IF EXISTS public.tipo_software_enum;

-- 4. Recreate the view (Reconstructed logic)
-- This view shows software whose update policy is expiring within 30 days
CREATE OR REPLACE VIEW public.v_software_por_vencer AS
SELECT 
    s.*,
    CASE 
        WHEN c.empresa IS NOT NULL THEN c.empresa
        ELSE c.nombre_cliente 
    END as nombre_cliente_display
FROM public.software s
LEFT JOIN public.clientes c ON s.cliente_id = c.id
WHERE s.fecha_fin_poliza IS NOT NULL 
  AND s.fecha_fin_poliza >= CURRENT_DATE 
  AND s.fecha_fin_poliza <= (CURRENT_DATE + INTERVAL '30 days');

-- Grant access to the view
GRANT SELECT ON public.v_software_por_vencer TO authenticated;
