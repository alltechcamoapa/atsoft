/**
 * ALLTECH - Database Types
 * Auto-generated types from Supabase
 * DO NOT EDIT MANUALLY - Regenerate using: npm run generate-types
 */

export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    public: {
        Tables: {
            audit_log: {
                Row: {
                    accion: Database["public"]["Enums"]["accion_audit_enum"]
                    created_at: string | null
                    datos_anteriores: Json | null
                    datos_nuevos: Json | null
                    id: string
                    ip_address: string | null
                    registro_id: string | null
                    tabla: string
                    user_agent: string | null
                    usuario_id: string | null
                }
                Insert: {
                    accion: Database["public"]["Enums"]["accion_audit_enum"]
                    created_at?: string | null
                    datos_anteriores?: Json | null
                    datos_nuevos?: Json | null
                    id?: string
                    ip_address?: string | null
                    registro_id?: string | null
                    tabla: string
                    user_agent?: string | null
                    usuario_id?: string | null
                }
                Update: {
                    accion?: Database["public"]["Enums"]["accion_audit_enum"]
                    created_at?: string | null
                    datos_anteriores?: Json | null
                    datos_nuevos?: Json | null
                    id?: string
                    ip_address?: string | null
                    registro_id?: string | null
                    tabla?: string
                    user_agent?: string | null
                    usuario_id?: string | null
                }
            }
            clientes: {
                Row: {
                    ciudad: string | null
                    codigo_cliente: string
                    correo: string | null
                    created_at: string | null
                    created_by: string | null
                    departamento: string | null
                    direccion: string | null
                    empresa: string
                    estado: Database["public"]["Enums"]["estado_cliente_enum"] | null
                    id: string
                    nombre_cliente: string
                    notas: string | null
                    pais: string | null
                    telefono: string
                    tipo_cliente: Database["public"]["Enums"]["tipo_cliente_enum"] | null
                    updated_at: string | null
                }
                Insert: {
                    ciudad?: string | null
                    codigo_cliente: string
                    correo?: string | null
                    created_at?: string | null
                    created_by?: string | null
                    departamento?: string | null
                    direccion?: string | null
                    empresa: string
                    estado?: Database["public"]["Enums"]["estado_cliente_enum"] | null
                    id?: string
                    nombre_cliente: string
                    notas?: string | null
                    pais?: string | null
                    telefono: string
                    tipo_cliente?: Database["public"]["Enums"]["tipo_cliente_enum"] | null
                    updated_at?: string | null
                }
                Update: {
                    ciudad?: string | null
                    codigo_cliente?: string
                    correo?: string | null
                    created_at?: string | null
                    created_by?: string | null
                    departamento?: string | null
                    direccion?: string | null
                    empresa?: string
                    estado?: Database["public"]["Enums"]["estado_cliente_enum"] | null
                    id?: string
                    nombre_cliente?: string
                    notas?: string | null
                    pais?: string | null
                    telefono?: string
                    tipo_cliente?: Database["public"]["Enums"]["tipo_cliente_enum"] | null
                    updated_at?: string | null
                }
            }
            contratos: {
                Row: {
                    archivo_contrato_url: string | null
                    cliente_id: string
                    codigo_contrato: string
                    created_at: string | null
                    created_by: string | null
                    descripcion: string | null
                    dias_aviso_vencimiento: number | null
                    estado_contrato: Database["public"]["Enums"]["estado_contrato_enum"] | null
                    fecha_fin: string
                    fecha_inicio: string
                    horas_incluidas: number | null
                    id: string
                    moneda: Database["public"]["Enums"]["moneda_enum"] | null
                    renovacion_automatica: boolean | null
                    tarifa: number
                    terminos: string | null
                    tipo_contrato: Database["public"]["Enums"]["tipo_contrato_enum"]
                    updated_at: string | null
                    visitas_incluidas: number | null
                }
                Insert: {
                    archivo_contrato_url?: string | null
                    cliente_id: string
                    codigo_contrato: string
                    created_at?: string | null
                    created_by?: string | null
                    descripcion?: string | null
                    dias_aviso_vencimiento?: number | null
                    estado_contrato?: Database["public"]["Enums"]["estado_contrato_enum"] | null
                    fecha_fin: string
                    fecha_inicio: string
                    horas_incluidas?: number | null
                    id?: string
                    moneda?: Database["public"]["Enums"]["moneda_enum"] | null
                    renovacion_automatica?: boolean | null
                    tarifa: number
                    terminos?: string | null
                    tipo_contrato: Database["public"]["Enums"]["tipo_contrato_enum"]
                    updated_at?: string | null
                    visitas_incluidas?: number | null
                }
                Update: {
                    archivo_contrato_url?: string | null
                    cliente_id?: string
                    codigo_contrato?: string
                    created_at?: string | null
                    created_by?: string | null
                    descripcion?: string | null
                    dias_aviso_vencimiento?: number | null
                    estado_contrato?: Database["public"]["Enums"]["estado_contrato_enum"] | null
                    fecha_fin?: string
                    fecha_inicio?: string
                    horas_incluidas?: number | null
                    id?: string
                    moneda?: Database["public"]["Enums"]["moneda_enum"] | null
                    renovacion_automatica?: boolean | null
                    tarifa?: number
                    terminos?: string | null
                    tipo_contrato?: Database["public"]["Enums"]["tipo_contrato_enum"]
                    updated_at?: string | null
                    visitas_incluidas?: number | null
                }
            }
            equipos: {
                Row: {
                    almacenamiento: string | null
                    cliente_id: string
                    codigo_equipo: string
                    created_at: string | null
                    created_by: string | null
                    criticidad: Database["public"]["Enums"]["criticidad_enum"] | null
                    direccion_ip: string | null
                    direccion_mac: string | null
                    estado: Database["public"]["Enums"]["estado_equipo_enum"] | null
                    fecha_adquisicion: string | null
                    fecha_garantia: string | null
                    id: string
                    marca: string | null
                    memoria_ram: string | null
                    modelo: string | null
                    nombre_equipo: string
                    notas: string | null
                    numero_serie: string | null
                    procesador: string | null
                    sistema_operativo: string | null
                    tipo_equipo: Database["public"]["Enums"]["tipo_equipo_enum"]
                    ubicacion: string | null
                    updated_at: string | null
                }
                Insert: {
                    almacenamiento?: string | null
                    cliente_id: string
                    codigo_equipo: string
                    created_at?: string | null
                    created_by?: string | null
                    criticidad?: Database["public"]["Enums"]["criticidad_enum"] | null
                    direccion_ip?: string | null
                    direccion_mac?: string | null
                    estado?: Database["public"]["Enums"]["estado_equipo_enum"] | null
                    fecha_adquisicion?: string | null
                    fecha_garantia?: string | null
                    id?: string
                    marca?: string | null
                    memoria_ram?: string | null
                    modelo?: string | null
                    nombre_equipo: string
                    notas?: string | null
                    numero_serie?: string | null
                    procesador?: string | null
                    sistema_operativo?: string | null
                    tipo_equipo: Database["public"]["Enums"]["tipo_equipo_enum"]
                    ubicacion?: string | null
                    updated_at?: string | null
                }
                Update: {
                    almacenamiento?: string | null
                    cliente_id?: string
                    codigo_equipo?: string
                    created_at?: string | null
                    created_by?: string | null
                    criticidad?: Database["public"]["Enums"]["criticidad_enum"] | null
                    direccion_ip?: string | null
                    direccion_mac?: string | null
                    estado?: Database["public"]["Enums"]["estado_equipo_enum"] | null
                    fecha_adquisicion?: string | null
                    fecha_garantia?: string | null
                    id?: string
                    marca?: string | null
                    memoria_ram?: string | null
                    modelo?: string | null
                    nombre_equipo?: string
                    notas?: string | null
                    numero_serie?: string | null
                    procesador?: string | null
                    sistema_operativo?: string | null
                    tipo_equipo?: Database["public"]["Enums"]["tipo_equipo_enum"]
                    ubicacion?: string | null
                    updated_at?: string | null
                }
            }
            // Simplified - Add all other tables as needed
            profiles: {
                Row: {
                    avatar_url: string | null
                    created_at: string | null
                    full_name: string
                    id: string
                    is_active: boolean | null
                    phone: string | null
                    role_id: string
                    updated_at: string | null
                    username: string
                }
            }
            roles: {
                Row: {
                    created_at: string | null
                    description: string | null
                    id: string
                    is_system: boolean | null
                    name: string
                }
            }
            permissions: {
                Row: {
                    can_create: boolean | null
                    can_delete: boolean | null
                    can_read: boolean | null
                    can_update: boolean | null
                    created_at: string | null
                    id: string
                    module_name: string
                    role_id: string
                }
            }
        }
        Enums: {
            accion_audit_enum: "INSERT" | "UPDATE" | "DELETE"
            criticidad_enum: "Baja" | "Media" | "Alta" | "Crítica"
            estado_cliente_enum: "Activo" | "Inactivo" | "Suspendido"
            estado_contrato_enum: "Activo" | "Vencido" | "Cancelado" | "Renovado"
            estado_equipo_enum: "Operativo" | "En Reparación" | "Fuera de Servicio" | "Dado de Baja"
            estado_producto_enum: "Activo" | "Inactivo" | "Descontinuado"
            estado_proforma_enum: "Borrador" | "Activa" | "Aprobada" | "Rechazada" | "Vencida" | "Anulada"
            estado_reparacion_enum: "En Proceso" | "Completada" | "Pendiente Repuestos" | "Cancelada"
            estado_software_enum: "Activa" | "Vencida" | "Suspendida" | "Cancelada"
            estado_trabajo_enum: "Programado" | "En Progreso" | "Completado" | "Cancelado"
            modo_activacion_enum: "ORIGINAL" | "HACK" | "DEMO" | "Open Source"
            moneda_enum: "USD" | "NIO"
            prioridad_enum: "Baja" | "Media" | "Alta" | "Urgente"
            tipo_cliente_enum: "Corporativo" | "PYME" | "Individual"
            tipo_contrato_enum: "Mensual" | "Trimestral" | "Semestral" | "Anual" | "Por Horas"
            tipo_dato_config_enum: "string" | "number" | "boolean" | "json"
            tipo_equipo_enum: "Servidor" | "Computadora" | "Laptop" | "Impresora" | "Router" | "Switch" | "Firewall" | "UPS" | "NAS" | "Otro"
            tipo_licencia_enum: "SERVIDOR" | "ADICIONAL" | "CORPORATIVA" | "Individual"
            tipo_producto_enum: "Producto" | "Servicio"
            tipo_renovacion_enum: "Manual" | "Automática" | "No Renovable"
            tipo_software_enum: "Sistema Operativo" | "Ofimática" | "Antivirus" | "Servidor" | "Base de Datos" | "Diseño" | "Otro"
            tipo_visita_enum: "Física" | "Remota"
        }
    }
}
