-- Change tipo_software from ENUM to TEXT to allow any value (like "FACT")
ALTER TABLE public.software 
ALTER COLUMN tipo_software TYPE TEXT;

-- Optional: Drop the enum type if it's no longer used
DROP TYPE IF EXISTS public.tipo_software_enum;
