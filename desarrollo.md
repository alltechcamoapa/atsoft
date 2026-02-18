1. Definición funcional del sistema (fase cero)

Antes de construir, define con claridad los módulos base del sistema:

Módulos principales

Clientes

Contratos

Visitas / Servicios

Equipos

Reportes

Calendario de mantenimiento

Usuarios y roles

Configuración general (temas, monedas)

2. Diseño de la base de datos (estructura recomendada)

En Antigravity, comienza creando las tablas (o Data Sources).

2.1 Tabla: Clientes

Campos:

ClienteID (ID único)

NombreCliente

Empresa

Teléfono

Correo

Dirección

Estado (Activo / Inactivo)

FechaCreación

2.2 Tabla: Contratos

Campos:

ContratoID

ClienteID (Relación)

FechaInicio

FechaFin

Tarifa

Moneda (USD / NIO)

TipoContrato (Mensual, Anual, Soporte por horas)

EstadoContrato (Activo / Vencido / Cancelado)

2.3 Tabla: Visitas / Servicios

Campos:

VisitaID

ClienteID

ContratoID (Opcional – permite clientes sin contrato)

TipoVisita (Física / Remota)

FechaInicio

FechaFin

DescripciónTrabajo

TrabajoRealizado (Sí / No)

CostoServicio

Moneda

UsuarioSoporte

FotosAdjuntas (Campo tipo imagen múltiple)

2.4 Tabla: Equipos

Campos:

EquipoID

ClienteID

NombreEquipo

Marca

Modelo

Serie

Ubicación

Estado

2.5 Tabla: HistorialEquipos

Campos:

HistorialID

EquipoID

VisitaID

Fecha

TrabajoRealizado

Observaciones

2.6 Tabla: Usuarios

Campos:

UsuarioID

Nombre

Correo

RolID

Estado

2.7 Tabla: Roles

Campos:

RolID

NombreRol

Permisos (JSON o booleanos)

Ejemplo de roles:

Administrador

Técnico

Supervisor

Cliente (solo lectura)

3. Autenticación y control de acceso
Paso a paso:

Habilita autenticación por correo en Antigravity.

Relaciona el usuario autenticado con la tabla Usuarios.

Usa reglas de visibilidad:

Admin: acceso total

Técnico: crear visitas, subir fotos

Supervisor: ver reportes

Cliente: solo lectura de historial

4. Gestión de visitas (núcleo del sistema)
Flujo optimizado:

Crear visita → seleccionar cliente

Definir si tiene contrato o no

Registrar:

Fecha y hora

Tipo de visita

Equipo atendido

Subir fotos del trabajo realizado

Guardar automáticamente en:

Historial del cliente

Historial del equipo

5. Clientes sin contrato (soporte eventual)

Implementación:

Campo ContratoID = NULL

Campo TipoServicio = “Eventual”

Permitir definir tarifa manual por visita

Incluir en reportes financieros

Esto evita duplicar lógica y mantiene un solo flujo.

6. Calendario de mantenimiento
Implementación recomendada:

Vista tipo Calendar

Basada en FechaInicio y FechaFin

Filtros por:

Técnico

Cliente

Tipo de servicio

Alertas visuales para contratos vencidos

7. Reportes e historial
Reportes clave:

Historial por cliente

Historial por equipo

Servicios por técnico

Servicios con y sin contrato

Costos por período y moneda

Buenas prácticas:

Usa vistas agregadas

Filtros por rango de fechas

Exportación a PDF / Excel

8. Soporte multimedia (fotos por visita)

Configuración:

Campo FotosAdjuntas tipo imagen múltiple

Activar cámara desde móvil

Guardar evidencia por visita

Mostrar galería por cliente y por equipo

9. Multidivisas (USD y NIO)

Implementación eficiente:

Campo Moneda

Campo TipoCambio

Campo calculado:

MontoConvertido = IF(
  Moneda = "USD",
  Monto * TipoCambio,
  Monto
)


Permite reportes financieros homogéneos.

10. Temas visuales (modo claro y oscuro)
Estrategia:

Variables globales de tema

Toggle de usuario:

Claro

Oscuro

Colores recomendados:

Oscuro: gris #121212 / azul acento

Claro: blanco / azul corporativo

11. Optimización y velocidad de desarrollo
Reglas clave:

Reutiliza vistas

Usa componentes dinámicos

Evita duplicar formularios

Usa expresiones condicionales

Prefiere campos calculados

12. Seguridad y escalabilidad

Checklist final:

Validaciones obligatorias

Logs de cambios

Soft delete (no borrar registros)

Backup automático

Roles bien definidos

13. Roadmap sugerido (rápido)
Semana	Objetivo
1	Base de datos + clientes
2	Visitas + contratos
3	Equipos + historial
4	Reportes + calendario
5	UI, temas, roles
6	Pruebas y optimización