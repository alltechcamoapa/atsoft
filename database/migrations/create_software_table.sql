-- Create software table
CREATE TABLE IF NOT EXISTS public.software (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    nombre_software TEXT NOT NULL,
    tipo_software TEXT,
    numero_licencia TEXT NOT NULL,
    numero_serie TEXT,
    
    -- Replacing distinct "nombre_registro" with a link to clients table if possible
    -- But keeping nombre_registro for legacy reasons or if it's just a text field
    -- User wants to link it to client. So we add cliente_id.
    cliente_id UUID REFERENCES public.clientes(id),
    nombre_registro TEXT, -- Can be used as a fallback or display name
    
    tipo_licencia TEXT NOT NULL CHECK (tipo_licencia IN ('SERVIDOR', 'ADICIONAL')),
    modo_activacion TEXT NOT NULL CHECK (modo_activacion IN ('ORIGINAL', 'HACK')),
    
    fecha_inicio_poliza DATE DEFAULT CURRENT_DATE,
    fecha_fin_poliza DATE
);

-- Enable RLS
ALTER TABLE public.software ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read access for all authenticated users" ON "public"."software"
AS PERMISSIVE FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable insert for authenticated users" ON "public"."software"
AS PERMISSIVE FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON "public"."software"
AS PERMISSIVE FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users" ON "public"."software"
AS PERMISSIVE FOR DELETE
TO authenticated
USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS software_cliente_id_idx ON public.software(cliente_id);
