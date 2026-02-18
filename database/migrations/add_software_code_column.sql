-- Add codigo_software column if it doesn't exist
ALTER TABLE public.software 
ADD COLUMN IF NOT EXISTS codigo_software TEXT;

-- Update existing records to have a code (if any)
UPDATE public.software 
SET codigo_software = 'SOFT' || SUBSTRING(id::text, 1, 6)
WHERE codigo_software IS NULL;

-- Make it NOT NULL
ALTER TABLE public.software 
ALTER COLUMN codigo_software SET NOT NULL;

-- Add unique constraint
ALTER TABLE public.software 
ADD CONSTRAINT software_codigo_software_key UNIQUE (codigo_software);
