/**
 * ALLTECH - Sistema de Logging y Auditoría
 * Registra todas las acciones críticas del sistema para auditoría
 */
const LogService = (() => {
    const STORAGE_KEY = 'alltech_audit_log';
    const MAX_LOGS = 1000; // Límite de registros en memoria

    /**
     * Registra una acción en la bitácora
     * @param {string} modulo - Nombre del módulo (contratos, visitas, etc.)
     * @param {string} accion - Tipo de acción (create, read, update, delete)
     * @param {string} entidad - ID de la entidad afectada
     * @param {string} descripcion - Descripción legible de la acción
     * @param {object} detalles - Datos adicionales relevantes
     */
    const log = (modulo, accion, entidad, descripcion, detalles = {}) => {
        try {
            const user = State.get('user');
            const logs = getLogs();

            const newLog = {
                id: 'LOG' + Date.now() + Math.random().toString(36).substr(2, 5),
                timestamp: new Date().toISOString(),
                usuario: user?.username || 'Sistema',
                nombreUsuario: user?.name || 'Sistema',
                modulo,
                accion,
                entidad,
                descripcion,
                detalles: JSON.stringify(detalles)
            };

            logs.unshift(newLog); // Agregar al inicio (más recientes primero)

            // Mantener solo los últimos MAX_LOGS registros
            if (logs.length > MAX_LOGS) {
                logs.length = MAX_LOGS;
            }

            localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));

            // Log en consola en desarrollo
            // console.log(`[LOG] ${accion.toUpperCase()} en ${modulo}:`, newLog);

            return newLog;
        } catch (error) {
            console.error('Error al registrar en bitácora:', error);
            return null;
        }
    };

    /**
     * Obtiene registros de la bitácora con filtros opcionales
     * @param {object} filter - Filtros: { modulo, usuario, accion, desde, hasta }
     * @returns {array} Array de registros
     */
    const getLogs = (filter = {}) => {
        try {
            const logs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

            // Aplicar filtros
            return logs.filter(log => {
                if (filter.modulo && log.modulo !== filter.modulo) return false;
                if (filter.usuario && log.usuario !== filter.usuario) return false;
                if (filter.accion && log.accion !== filter.accion) return false;

                // Filtro de fecha desde
                if (filter.desde) {
                    const logDate = new Date(log.timestamp);
                    const fromDate = new Date(filter.desde);
                    if (logDate < fromDate) return false;
                }

                // Filtro de fecha hasta
                if (filter.hasta) {
                    const logDate = new Date(log.timestamp);
                    const toDate = new Date(filter.hasta);
                    if (logDate > toDate) return false;
                }

                return true;
            });
        } catch (error) {
            console.error('Error al obtener logs:', error);
            return [];
        }
    };

    /**
     * Limpia todos los registros de la bitácora
     * @returns {boolean} true si se limpiaron correctamente
     */
    const clearLogs = () => {
        try {
            localStorage.removeItem(STORAGE_KEY);
            log('sistema', 'delete', 'bitacora', 'Bitácora limpiada');
            return true;
        } catch (error) {
            console.error('Error al limpiar bitácora:', error);
            return false;
        }
    };

    /**
     * Exporta los logs como JSON
     * @returns {string} JSON string de los logs
     */
    const exportLogs = () => {
        const logs = getLogs();
        return JSON.stringify(logs, null, 2);
    };

    /**
     * Obtiene estadísticas de la bitácora
     * @returns {object} Estadísticas
     */
    const getStats = () => {
        const logs = getLogs();

        const stats = {
            total: logs.length,
            porModulo: {},
            porAccion: {},
            porUsuario: {},
            ultimaAccion: logs[0] || null
        };

        logs.forEach(log => {
            // Contar por módulo
            stats.porModulo[log.modulo] = (stats.porModulo[log.modulo] || 0) + 1;

            // Contar por acción
            stats.porAccion[log.accion] = (stats.porAccion[log.accion] || 0) + 1;

            // Contar por usuario
            stats.porUsuario[log.usuario] = (stats.porUsuario[log.usuario] || 0) + 1;
        });

        return stats;
    };

    return {
        log,
        getLogs,
        clearLogs,
        exportLogs,
        getStats
    };
})();
