ALTER TABLE public.visitas
ADD COLUMN IF NOT EXISTS equipo_id UUID REFERENCES public.equipos(id);

CREATE INDEX IF NOT EXISTS idx_visitas_equipo_id ON public.visitas(equipo_id);

ALTER TABLE public.visitas
ADD COLUMN IF NOT EXISTS usuario_soporte TEXT;

ALTER TABLE public.visitas
ADD COLUMN IF NOT EXISTS tipo_visita TEXT;

ALTER TABLE public.visitas
ADD COLUMN IF NOT EXISTS costo_servicio NUMERIC DEFAULT 0;

ALTER TABLE public.visitas
ADD COLUMN IF NOT EXISTS moneda TEXT DEFAULT 'USD';

ALTER TABLE public.visitas
ADD COLUMN IF NOT EXISTS trabajo_realizado BOOLEAN DEFAULT false;

ALTER TABLE public.visitas
ADD COLUMN IF NOT EXISTS descripcion_trabajo TEXT;

ALTER TABLE public.visitas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for authenticated users_v2" ON "public"."visitas"
AS PERMISSIVE FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
