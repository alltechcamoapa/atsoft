-- ============================================
-- TABLA: empleados
-- Descripción: Gestión de empleados para prestaciones sociales (Nicaragua)
-- ============================================

CREATE TABLE IF NOT EXISTS empleados (
    -- Campos básicos
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    
    -- Datos personales
    nombre TEXT NOT NULL,
    cedula TEXT NOT NULL UNIQUE,
    email TEXT,
    telefono TEXT,
    
    -- Información laboral
    cargo TEXT NOT NULL,
    fecha_alta DATE NOT NULL DEFAULT CURRENT_DATE,
    tipo_salario TEXT CHECK (tipo_salario IN ('Mensual', 'Quincenal', 'Por Hora', 'Por Proyecto')),
    salario_total DECIMAL(12,2) DEFAULT 0,
    tipo_contrato TEXT CHECK (tipo_contrato IN ('Indefinido', 'Temporal', 'Por Obra', 'Prueba')) DEFAULT 'Indefinido',
    tiempo_contrato INTEGER, -- Duración en meses (solo para contratos temporales)
    
    -- Estado y prestaciones
    estado TEXT CHECK (estado IN ('Activo', 'Inactivo', 'Suspendido')) DEFAULT 'Activo',
    vacaciones_tomadas INTEGER DEFAULT 0,
    aguinaldo_pagado BOOLEAN DEFAULT false,
    
    -- Observaciones
    observaciones TEXT
);

-- ============================================
-- ÍNDICES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_empleados_estado ON empleados(estado);
CREATE INDEX IF NOT EXISTS idx_empleados_cedula ON empleados(cedula);
CREATE INDEX IF NOT EXISTS idx_empleados_fecha_alta ON empleados(fecha_alta);
CREATE INDEX IF NOT EXISTS idx_empleados_cargo ON empleados(cargo);

-- ============================================
-- RLS (Row Level Security)
-- ============================================

ALTER TABLE empleados ENABLE ROW LEVEL SECURITY;

-- Policy: Permitir SELECT a todos los usuarios autenticados
CREATE POLICY "Empleados: SELECT para autenticados"
    ON empleados FOR SELECT
    TO authenticated
    USING (true);

-- Policy: Permitir INSERT solo a administradores
CREATE POLICY "Empleados: INSERT para administradores"
    ON empleados FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role = 'Administrador'
        )
    );

-- Policy: Permitir UPDATE solo a administradores
CREATE POLICY "Empleados: UPDATE para administradores"
    ON empleados FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role = 'Administrador'
        )
    );

-- Policy: Permitir DELETE solo a administradores
CREATE POLICY "Empleados: DELETE para administradores"
    ON empleados FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role = 'Administrador'
        )
    );

-- ============================================
-- TRIGGER: Actualizar updated_at automáticamente
-- ============================================

CREATE OR REPLACE FUNCTION update_empleados_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_empleados_updated_at
    BEFORE UPDATE ON empleados
    FOR EACH ROW
    EXECUTE FUNCTION update_empleados_updated_at();

-- ============================================
-- COMENTARIOS
-- ============================================

COMMENT ON TABLE empleados IS 'Gestión de empleados para prestaciones sociales conforme a la ley de Nicaragua';
COMMENT ON COLUMN empleados.nombre IS 'Nombre completo del empleado';
COMMENT ON COLUMN empleados.cedula IS 'Cédula de identidad (único)';
COMMENT ON COLUMN empleados.cargo IS 'Puesto o cargo del empleado';
COMMENT ON COLUMN empleados.fecha_alta IS 'Fecha de ingreso a la empresa';
COMMENT ON COLUMN empleados.tipo_salario IS 'Tipo de pago: Mensual, Quincenal, Por Hora, Por Proyecto';
COMMENT ON COLUMN empleados.salario_total IS 'Salario bruto total en Córdobas (C$)';
COMMENT ON COLUMN empleados.tipo_contrato IS 'Tipo de contrato laboral';
COMMENT ON COLUMN empleados.tiempo_contrato IS 'Duración del contrato en meses (solo para temporales)';
COMMENT ON COLUMN empleados.estado IS 'Estado actual: Activo, Inactivo, Suspendido';
COMMENT ON COLUMN empleados.vacaciones_tomadas IS 'Días de vacaciones tomados en el período actual';
COMMENT ON COLUMN empleados.aguinaldo_pagado IS 'Indica si el aguinaldo del año actual fue pagado';

-- ============================================
-- ACTUALIZACIÓN DE user_profiles PARA CAMPOS LABORALES
-- ============================================

-- Agregar columnas laborales a user_profiles si existen
DO $$
BEGIN
    -- Verificar y agregar columnas solo si la tabla existe y no tiene las columnas
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'fecha_alta') THEN
            ALTER TABLE user_profiles ADD COLUMN fecha_alta DATE;
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'tipo_salario') THEN
            ALTER TABLE user_profiles ADD COLUMN tipo_salario TEXT;
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'salario_total') THEN
            ALTER TABLE user_profiles ADD COLUMN salario_total DECIMAL(12,2);
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'tiempo_contrato') THEN
            ALTER TABLE user_profiles ADD COLUMN tiempo_contrato INTEGER;
        END IF;
    END IF;
END $$;

COMMENT ON COLUMN user_profiles.fecha_alta IS 'Fecha de ingreso del usuario a la empresa';
COMMENT ON COLUMN user_profiles.tipo_salario IS 'Tipo de salario del usuario';
COMMENT ON COLUMN user_profiles.salario_total IS 'Salario total del usuario';
COMMENT ON COLUMN user_profiles.tiempo_contrato IS 'Duración del contrato en meses';
