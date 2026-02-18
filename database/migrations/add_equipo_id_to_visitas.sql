-- Add equipo_id column to visitas table
ALTER TABLE visitas
ADD COLUMN IF NOT EXISTS equipo_id UUID REFERENCES equipos(id);

-- Optional: Create an index for better performance on lookups
CREATE INDEX IF NOT EXISTS idx_visitas_equipo_id ON visitas(equipo_id);
