-- ============================================
-- TABLAS ADICIONALES PARA PRESTACIONES
-- Descripción: Tablas para historial de vacaciones, pagos y aguinaldos
-- ============================================

-- 1. Historial de Vacaciones
CREATE TABLE IF NOT EXISTS vacaciones_historial (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empleado_id UUID NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    dias INTEGER NOT NULL,
    anio_correspondiente INTEGER, -- Año al que corresponden las vacaciones
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_vacaciones_empleado ON vacaciones_historial(empleado_id);

-- 2. Nóminas / Recibos de Pago
CREATE TABLE IF NOT EXISTS nominas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empleado_id UUID NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
    periodo_inicio DATE NOT NULL,
    periodo_fin DATE NOT NULL,
    tipo_periodo TEXT CHECK (tipo_periodo IN ('Mensual', 'Quincenal')),
    
    -- Detalles financieros
    salario_base DECIMAL(12,2) NOT NULL DEFAULT 0,
    ingresos_extras DECIMAL(12,2) DEFAULT 0,
    deduccion_inss DECIMAL(12,2) DEFAULT 0,
    deduccion_ir DECIMAL(12,2) DEFAULT 0,
    otras_deducciones DECIMAL(12,2) DEFAULT 0,
    total_neto DECIMAL(12,2) NOT NULL DEFAULT 0,
    
    estado TEXT CHECK (estado IN ('Borrador', 'Pagado', 'Anulado')) DEFAULT 'Borrador',
    fecha_pago DATE,
    notas TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_nominas_empleado ON nominas(empleado_id);
CREATE INDEX IF NOT EXISTS idx_nominas_fecha ON nominas(periodo_fin);

-- 3. Historial de Aguinaldos
CREATE TABLE IF NOT EXISTS aguinaldos_historial (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empleado_id UUID NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
    anio INTEGER NOT NULL,
    monto DECIMAL(12,2) NOT NULL,
    dias_calculados INTEGER,
    fecha_pago DATE DEFAULT CURRENT_DATE,
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_aguinaldos_empleado ON aguinaldos_historial(empleado_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_aguinaldos_unico_anio ON aguinaldos_historial(empleado_id, anio);

-- ============================================
-- RLS (Row Level Security)
-- ============================================

-- Habilitar RLS
ALTER TABLE vacaciones_historial ENABLE ROW LEVEL SECURITY;
ALTER TABLE nominas ENABLE ROW LEVEL SECURITY;
ALTER TABLE aguinaldos_historial ENABLE ROW LEVEL SECURITY;

-- Policies para Vacaciones
CREATE POLICY "Vacaciones: SELECT para autenticados" ON vacaciones_historial FOR SELECT TO authenticated USING (true);
CREATE POLICY "Vacaciones: ALL para administradores" ON vacaciones_historial FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'Administrador')
);

-- Policies para Nóminas
CREATE POLICY "Nominas: SELECT para autenticados" ON nominas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Nominas: ALL para administradores" ON nominas FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'Administrador')
);

-- Policies para Aguinaldos
CREATE POLICY "Aguinaldos: SELECT para autenticados" ON aguinaldos_historial FOR SELECT TO authenticated USING (true);
CREATE POLICY "Aguinaldos: ALL para administradores" ON aguinaldos_historial FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'Administrador')
);

-- 4. Ausencias
CREATE TABLE IF NOT EXISTS ausencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empleado_id UUID NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    dias NUMERIC(5,1) NOT NULL,
    tipo_descuento TEXT NOT NULL CHECK (tipo_descuento IN ('vacaciones', 'dia_laboral')),
    motivo TEXT,
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_ausencias_empleado ON ausencias(empleado_id);
CREATE INDEX IF NOT EXISTS idx_ausencias_fecha ON ausencias(fecha_inicio);

ALTER TABLE ausencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ausencias_select" ON ausencias FOR SELECT TO authenticated USING (true);
CREATE POLICY "ausencias_manage" ON ausencias FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM profiles p
        JOIN roles r ON p.role_id = r.id
        WHERE p.id = auth.uid() AND r.name = 'Administrador'
    )
);
