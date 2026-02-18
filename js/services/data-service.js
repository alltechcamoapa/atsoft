/**
 * ALLTECH - Data Service (Supabase Cloud Version)
 * Reemplaza el almacenamiento local con almacenamiento en Cloud (Supabase).
 * Mantiene un caché en memoria para velocidad de UI.
 */

const DataService = (() => {
    // ========== IN-MEMORY CACHE ==========
    let cache = {
        clientes: [],
        contratos: [],
        visitas: [],
        equipos: [],
        reparaciones: [],
        software: [],
        productos: [],
        proformas: [],
        pedidos: [],
        empleados: [],
        users: [],
        nominas: [],
        pagosTecnicos: [],
        ausencias: [],
        config: {
            monedaPrincipal: 'USD',
            tipoCambio: 36.5,
            alertasContratos: true,
            diasAnticipacion: 30,
            recordatoriosVisitas: true
        },
        permissions: {},
        contractTemplates: []
    };

    let isInitialized = false;
    let isRefreshing = false;
    let realtimeSubscription = null;

    // ========== UTILS: NORMALIZACIÓN DE DATOS ==========
    // Convierte snake_case de DB a camelCase de App y mapea IDs
    const toCamelCase = (str) => str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());

    const normalizeSupabaseData = (table, data) => {
        if (!data) return null;
        const normalized = {};
        for (const key in data) {
            normalized[toCamelCase(key)] = data[key];
        }

        // Mapeos críticos de compatibilidad
        if (table === 'clientes') normalized.clienteId = data.codigo_cliente || data.id;
        if (table === 'contratos') normalized.contratoId = data.codigo_contrato || data.id;
        if (table === 'equipos') normalized.equipoId = data.codigo_equipo || data.id;

        if (table === 'visitas') {
            normalized.visitaId = data.codigo_visita || data.id;
            // Corregir trabajo_realizado si viene como string "true"/"false"
            if (typeof data.trabajo_realizado === 'string') {
                normalized.trabajoRealizado = data.trabajo_realizado === 'true';
            }
            // Asegurar que si hay un objeto cliente unido, tengamos el clienteId (slug) disponible
            if (data.cliente) {
                normalized.clienteIdSlug = data.cliente.codigo_cliente;
            }
        }

        // Mantener id original de supabase
        normalized.id = data.id;

        return normalized;
    };

    // ========== INITIALIZATION ==========
    const init = async () => {
        if (isInitialized) return true;

        // console.log('☁️ DataService: Sincronizando desde Supabase...');

        try {
            // Asegurar que el cliente de Supabase esté inicializado
            if (typeof SupabaseDataService !== 'undefined' && SupabaseDataService.init) {
                SupabaseDataService.init();
            }

            // Cargar datos principales en paralelo
            const [
                clientes,
                contratos,
                equipos,
                visitas,
                productos,
                proformas,
                pedidos,
                empleados,
                nominas,
                software,
                users,
                pagosTecnicos,
                ausencias
            ] = await Promise.all([
                SupabaseDataService.getClientesSync(),
                SupabaseDataService.getContratosSync(),
                SupabaseDataService.getEquiposSync(),
                SupabaseDataService.getVisitasSync(),
                SupabaseDataService.getProductosSync(),
                SupabaseDataService.getProformasSync(),
                SupabaseDataService.getPedidosSync(),
                SupabaseDataService.getEmpleadosSync?.() || Promise.resolve([]),
                SupabaseDataService.getRecentNominas?.() || Promise.resolve([]),
                SupabaseDataService.getSoftwareSync(),
                SupabaseDataService.getUsersSync(),
                SupabaseDataService.getPagosTecnicos(),
                SupabaseDataService.getAllAusencias?.() || Promise.resolve([])
            ]);

            // Normalizar y almacenar en caché
            cache.clientes = (clientes || []).map(c => normalizeSupabaseData('clientes', c));
            cache.contratos = (contratos || []).map(c => ({ ...normalizeSupabaseData('contratos', c), cliente: normalizeSupabaseData('clientes', c.cliente) }));
            cache.equipos = (equipos || []).map(e => ({ ...normalizeSupabaseData('equipos', e), cliente: normalizeSupabaseData('clientes', e.cliente) }));
            cache.visitas = (visitas || []).map(v => normalizeSupabaseData('visitas', v));
            cache.software = (software || []).map(s => ({
                ...normalizeSupabaseData('software', s),
                cliente: s.cliente ? normalizeSupabaseData('clientes', s.cliente) : null
            }));
            cache.productos = (productos || []).map(p => ({
                ...p,
                productoId: p.id,
                precio: parseFloat(p.precio_venta) || 0
            }));
            cache.proformas = (proformas || []).map(p => ({
                ...p,
                proformaId: p.codigo_proforma,
                numero: p.numero_proforma,
                clienteId: p.cliente_id,
                cliente: p.cliente ? normalizeSupabaseData('clientes', p.cliente) : null
            }));
            cache.pedidos = (pedidos || []).map(p => ({
                ...p,
                pedidoId: p.pedido_id,
                numeroPedido: p.numero_pedido,
                clienteId: p.cliente_id,
                cliente: p.cliente ? normalizeSupabaseData('clientes', p.cliente) : null
            }));
            cache.empleados = (empleados || []).map(e => ({
                ...e,
                fechaAlta: e.fecha_alta || e.fechaAlta,
                salarioTotal: parseFloat(e.salario_total) || e.salarioTotal || 0,
                tipoSalario: e.tipo_salario || e.tipoSalario,
                tipoContrato: e.tipo_contrato || e.tipoContrato,
                tiempoContrato: e.tiempo_contrato || e.tiempoContrato,
                vacacionesTomadas: e.vacaciones_tomadas || e.vacacionesTomadas || 0,
                aguinaldoPagado: e.aguinaldo_pagado || e.aguinaldoPagado || false
            }));

            cache.users = (users || []).map(u => ({
                ...u,
                role: u.role || 'Usuario', // Fallback
                allowedModules: u.allowedModules || []
            }));

            cache.nominas = (nominas || []).map(n => ({
                ...n,
                empleadoNombre: n.empleado?.nombre || 'Desconocido',
                empleadoCargo: n.empleado?.cargo || '-'
            }));

            cache.pagosTecnicos = (pagosTecnicos || []).map(p => ({
                ...p,
                tecnicoNombre: p.tecnico?.full_name || 'Desconocido'
            }));

            cache.ausencias = (ausencias || []).map(a => ({
                ...normalizeSupabaseData('ausencias', a),
                empleadoNombre: a.empleado?.nombre || 'Desconocido'
            }));

            // Cargar permisos por defecto (hardcoded por seguridad)
            cache.permissions = loadDefaultPermissions();

            isInitialized = true;
            console.log(`✅ DataService: Sincronización completa (${cache.clientes.length} Clientes, ${cache.contratos.length} Contratos, ${cache.productos.length} Productos)`);

            // Suscribirse a cambios en tiempo real
            setupRealtimeSubscription();

            return true;
        } catch (error) {
            console.error('❌ Error fatal iniciando DataService:', error);
            // No fallar completamente, permitir reintentos
            return false;
        }
    };

    // ========== REFRESH DATA (MANUAL) ==========
    const refreshData = async () => {
        if (isRefreshing) {
            console.log('⏳ Refresh ya en progreso...');
            return false;
        }

        isRefreshing = true;
        console.log('🔄 DataService: Refrescando datos desde Supabase...');

        try {
            // Recargar todos los datos en paralelo
            // Recargar todos los datos en paralelo
            const [
                clientes,
                contratos,
                equipos,
                visitas,
                nominas,
                software,
                ausencias
            ] = await Promise.all([
                SupabaseDataService.getClientesSync(),
                SupabaseDataService.getContratosSync(),
                SupabaseDataService.getEquiposSync(),
                SupabaseDataService.getVisitasSync(),
                SupabaseDataService.getRecentNominas?.() || Promise.resolve([]),
                SupabaseDataService.getSoftwareSync(),
                SupabaseDataService.getAllAusencias?.() || Promise.resolve([])
            ]);

            // Actualizar caché
            cache.clientes = (clientes || []).map(c => normalizeSupabaseData('clientes', c));
            cache.contratos = (contratos || []).map(c => ({ ...normalizeSupabaseData('contratos', c), cliente: normalizeSupabaseData('clientes', c.cliente) }));
            cache.equipos = (equipos || []).map(e => ({ ...normalizeSupabaseData('equipos', e), cliente: normalizeSupabaseData('clientes', e.cliente) }));
            cache.visitas = (visitas || []).map(v => normalizeSupabaseData('visitas', v));
            cache.nominas = (nominas || []).map(n => ({ ...n, empleadoNombre: n.empleado?.nombre || 'Desconocido', empleadoCargo: n.empleado?.cargo || '-' }));
            cache.software = (software || []).map(s => ({ ...normalizeSupabaseData('software', s), cliente: s.cliente ? normalizeSupabaseData('clientes', s.cliente) : null }));
            cache.ausencias = (ausencias || []).map(a => ({
                ...normalizeSupabaseData('ausencias', a),
                empleadoNombre: a.empleado?.nombre || 'Desconocido'
            }));

            console.log(`✅ DataService: Refresh completo (${cache.clientes.length} Clientes)`);

            // Notificar a la UI
            dispatchRefreshEvent();

            isRefreshing = false;
            return true;
        } catch (error) {
            console.error('❌ Error en refreshData:', error);
            isRefreshing = false;
            return false;
        }
    };

    // ========== DISPATCH REFRESH EVENT ==========
    const dispatchRefreshEvent = () => {
        // Disparar evento personalizado para que la UI se actualice
        window.dispatchEvent(new CustomEvent('dataRefreshed', {
            detail: {
                timestamp: Date.now(),
                counts: {
                    clientes: cache.clientes.length,
                    contratos: cache.contratos.length,
                    equipos: cache.equipos.length,
                    visitas: cache.visitas.length
                }
            }
        }));
    };

    // ========== REALTIME SUBSCRIPTION SETUP ==========
    const setupRealtimeSubscription = () => {
        if (typeof SupabaseDataService === 'undefined' || !SupabaseDataService.subscribeToChanges) {
            console.warn('⚠️ SupabaseDataService.subscribeToChanges no disponible');
            return;
        }

        // Limpiar suscripción anterior si existe
        if (realtimeSubscription) {
            console.log('🔌 Limpiando suscripción anterior...');
            realtimeSubscription.unsubscribe?.();
        }

        // Crear nueva suscripción
        realtimeSubscription = SupabaseDataService.subscribeToChanges((payload) => {
            handleRealtimeUpdate(payload);
        });

        console.log('🔌 Suscripción Realtime establecida');
    };

    const loadDefaultPermissions = () => ({
        "Administrador": {
            "clientes": { create: true, read: true, update: true, delete: true },
            "contratos": { create: true, read: true, update: true, delete: true },
            "visitas": { create: true, read: true, update: true, delete: true },
            "equipos": { create: true, read: true, update: true, delete: true },
            "software": { create: true, read: true, update: true, delete: true },
            "productos": { create: true, read: true, update: true, delete: true },
            "pedidos": { create: true, read: true, update: true, delete: true },
            "proformas": { create: true, read: true, update: true, delete: true },
            "prestaciones": { create: true, read: true, update: true, delete: true },
            "calendario": { create: true, read: true, update: true, delete: true },
            "reportes": { create: true, read: true, update: true, delete: true },
            "usuarios": { create: true, read: true, update: true, delete: true },
            "configuracion": { create: true, read: true, update: true, delete: true },
            "editor-reportes": { create: true, read: true, update: true, delete: true },
            "gestion-tecnicos": { create: true, read: true, update: true, delete: true }
        },
        "Ejecutivo de Ventas": {
            "clientes": { create: true, read: true, update: true, delete: false },
            "contratos": { create: true, read: true, update: true, delete: false },
            "visitas": { create: false, read: true, update: false, delete: false },
            "equipos": { create: false, read: true, update: false, delete: false },
            "software": { create: false, read: true, update: false, delete: false },
            "productos": { create: true, read: true, update: true, delete: false },
            "pedidos": { create: true, read: true, update: true, delete: false },
            "proformas": { create: true, read: true, update: true, delete: false },
            "prestaciones": { create: false, read: true, update: false, delete: false },
            "calendario": { create: false, read: true, update: false, delete: false },
            "reportes": { create: false, read: true, update: false, delete: false },
            "usuarios": { create: false, read: false, update: false, delete: false },
            "configuracion": { create: false, read: true, update: false, delete: false },
            "editor-reportes": { create: false, read: true, update: false, delete: false },
            "gestion-tecnicos": { create: false, read: true, update: false, delete: false }
        },
        "Tecnico": {
            "clientes": { create: false, read: true, update: false, delete: false },
            "contratos": { create: false, read: true, update: false, delete: false },
            "visitas": { create: true, read: true, update: true, delete: false },
            "equipos": { create: true, read: true, update: true, delete: false },
            "software": { create: true, read: true, update: true, delete: false },
            "productos": { create: false, read: true, update: false, delete: false },
            "pedidos": { create: false, read: true, update: true, delete: false },
            "proformas": { create: false, read: true, update: false, delete: false },
            "prestaciones": { create: false, read: true, update: false, delete: false },
            "calendario": { create: false, read: true, update: false, delete: false },
            "reportes": { create: false, read: true, update: false, delete: false },
            "usuarios": { create: false, read: false, update: false, delete: false },
            "configuracion": { create: false, read: true, update: false, delete: false },
            "editor-reportes": { create: false, read: true, update: false, delete: false },
            "gestion-tecnicos": { create: false, read: true, update: false, delete: false }
        }
    });

    // ========== REALTIME UPDATE HANDLER ==========
    const handleRealtimeUpdate = (payload) => {
        try {
            const { table, eventType, new: newRecord, old: oldRecord } = payload;

            // Mapear tabla DB a propiedad del caché
            let target = null;
            if (table === 'clientes') target = cache.clientes;
            if (table === 'contratos') target = cache.contratos;
            if (table === 'equipos') target = cache.equipos;
            if (table === 'visitas') target = cache.visitas;

            if (!target) return;

            console.log(`🔄 Realtime: ${eventType} en ${table}`);

            if (eventType === 'INSERT') {
                const item = normalizeSupabaseData(table, newRecord);
                if (!target.find(i => i.id === item.id)) {
                    target.unshift(item);
                }
            } else if (eventType === 'UPDATE') {
                const item = normalizeSupabaseData(table, newRecord);
                const idx = target.findIndex(i => i.id === item.id);
                if (idx !== -1) target[idx] = { ...target[idx], ...item };
            } else if (eventType === 'DELETE') {
                const id = oldRecord.id;
                const idx = target.findIndex(i => i.id === id);
                if (idx !== -1) target.splice(idx, 1);
            }

            // Refrescar UI si es necesario
            if (typeof App !== 'undefined' && App.refreshCurrentModule) {
                const currentModule = State.get('currentModule');
                if (currentModule === table) App.refreshCurrentModule();
            }

        } catch (e) {
            console.error('Realtime Sync Error:', e);
        }
    };

    // ========== CRUD CLIENTES ==========
    const getClientesSync = () => [...cache.clientes];

    const getClientesFiltered = (filter) => {
        return cache.clientes.filter(c => {
            let matches = true;
            if (filter.search) {
                const s = filter.search.toLowerCase();
                matches = (c.nombreCliente || '').toLowerCase().includes(s) ||
                    (c.empresa || '').toLowerCase().includes(s) ||
                    (c.correo || '').toLowerCase().includes(s);
            }
            if (filter.status && filter.status !== 'all') matches = matches && c.estado === filter.status;
            return matches;
        });
    };

    const getClienteById = (id) => cache.clientes.find(c => c.clienteId === id || c.id === id);

    const createCliente = async (data) => {
        const res = await SupabaseDataService.createCliente(data);
        if (res.success) {
            const item = normalizeSupabaseData('clientes', res.data);
            cache.clientes.unshift(item); // Optimistic update fallback
            LogService.log('clientes', 'create', item.id, `Cliente creado: ${item.nombreCliente || item.empresa}`, { codigo: item.clienteId });
            return item;
        }
        throw new Error(res.error || 'Error al crear cliente');
    };

    const updateCliente = async (id, data) => {
        const current = getClienteById(id);
        const uuid = current ? current.id : id;
        const res = await SupabaseDataService.updateCliente(uuid, data);
        if (res.success) {
            const item = normalizeSupabaseData('clientes', res.data);
            const idx = cache.clientes.findIndex(c => c.id === uuid);
            if (idx !== -1) cache.clientes[idx] = { ...cache.clientes[idx], ...item };
            LogService.log('clientes', 'update', uuid, `Cliente actualizado: ${item.nombreCliente || item.empresa}`);
            return true;
        }
        throw new Error(res.error || 'Error al actualizar cliente');
    };

    const deleteCliente = async (id) => {
        const current = getClienteById(id);
        const uuid = current ? current.id : id;
        const res = await SupabaseDataService.deleteCliente(uuid);
        if (res.success) {
            cache.clientes = cache.clientes.filter(c => c.id !== uuid);
            LogService.log('clientes', 'delete', uuid, `Cliente eliminado: ${current?.nombreCliente || 'Desconocido'}`);
            return true;
        }
        throw new Error(res.error || 'Error al eliminar cliente');
    };

    // ========== CRUD CONTRATOS ==========
    const getContratosSync = () => [...cache.contratos];

    const getContratosFiltered = (filter) => {
        return cache.contratos.filter(c => {
            let matches = true;
            if (filter.search) {
                const cliente = getClienteById(c.clienteId);
                const s = filter.search.toLowerCase();
                matches = (c.contratoId || '').toLowerCase().includes(s) ||
                    (cliente?.empresa || '').toLowerCase().includes(s);
            }
            if (filter.status && filter.status !== 'all') matches = matches && c.estadoContrato === filter.status;
            if (filter.tipo && filter.tipo !== 'all') matches = matches && c.tipoContrato === filter.tipo;
            return matches;
        });
    };

    const getContratoById = (id) => cache.contratos.find(c => c.contratoId === id || c.id === id);
    const getContratosByCliente = (clienteId) => cache.contratos.filter(c => c.clienteId === clienteId);

    const createContrato = async (data) => {
        const res = await SupabaseDataService.createContrato(data);
        if (res.success) {
            const item = normalizeSupabaseData('contratos', res.data);
            cache.contratos.unshift(item);
            LogService.log('contratos', 'create', item.id, `Contrato creado: ${item.contratoId}`, { clienteId: item.clienteId });
            return item;
        }
        throw new Error(res.error || 'Error al crear contrato');
    };

    const updateContrato = async (id, data) => {
        const current = getContratoById(id);
        const uuid = current ? current.id : id;
        const res = await SupabaseDataService.updateContrato(uuid, data);
        if (res.success) {
            const item = normalizeSupabaseData('contratos', res.data);
            const idx = cache.contratos.findIndex(c => c.id === uuid);
            if (idx !== -1) cache.contratos[idx] = { ...cache.contratos[idx], ...item };
            LogService.log('contratos', 'update', uuid, `Contrato actualizado: ${item.contratoId}`);
            return true;
        }
        throw new Error(res.error || 'Error al actualizar contrato');
    };

    const deleteContrato = async (id) => {
        const current = getContratoById(id);
        const uuid = current ? current.id : id;
        const res = await SupabaseDataService.deleteContrato(uuid);
        if (res.success) {
            cache.contratos = cache.contratos.filter(c => c.id !== uuid);
            LogService.log('contratos', 'delete', uuid, `Contrato eliminado: ${current?.contratoId || 'Desconocido'}`);
            return true;
        }
        throw new Error(res.error || 'Error al eliminar contrato');
    };

    const getContratosStats = () => {
        const activos = cache.contratos.filter(c => c.estadoContrato === 'Activo').length;
        const vencidos = cache.contratos.filter(c => c.estadoContrato === 'Vencido').length;
        const now = new Date();
        const porVencer = cache.contratos.filter(c => {
            const fin = new Date(c.fechaFin);
            const diff = (fin - now) / (1000 * 60 * 60 * 24);
            return c.estadoContrato === 'Activo' && diff <= 30 && diff > 0;
        }).length;
        return { activos, vencidos, porVencer, ingresosMensuales: 0 };
    };

    const getContratosProximosAVencer = () => {
        const now = new Date();
        return cache.contratos.filter(c => {
            const fin = new Date(c.fechaFin);
            const diff = (fin - now) / (1000 * 60 * 60 * 24);
            return c.estadoContrato === 'Activo' && diff <= cache.config.diasAnticipacion && diff > 0;
        });
    };

    // ========== CRUD EQUIPOS ==========
    const getEquiposSync = () => [...cache.equipos];
    const getEquiposFiltered = (filter) => {
        return cache.equipos.filter(e => {
            let matches = true;
            if (filter.search) {
                const s = filter.search.toLowerCase();
                matches = (e.nombreEquipo || '').toLowerCase().includes(s) ||
                    (e.marca || '').toLowerCase().includes(s);
            }
            if (filter.clienteId && filter.clienteId !== 'all') matches = matches && e.clienteId === filter.clienteId;
            return matches;
        });
    };
    const getEquipoById = (id) => cache.equipos.find(e => e.equipoId === id || e.id === id);
    const getEquiposByCliente = (clienteId) => cache.equipos.filter(e => e.clienteId === clienteId);

    const createEquipo = async (data) => {
        const res = await SupabaseDataService.createEquipo(data);
        if (res.success) {
            const item = normalizeSupabaseData('equipos', res.data);
            cache.equipos.unshift(item);
            LogService.log('equipos', 'create', item.id, `Equipo creado: ${item.nombreEquipo}`, { codigo: item.equipoId });
            return item;
        }
        throw new Error(res.error || 'Error al crear equipo');
    };

    const updateEquipo = async (id, data) => {
        const current = getEquipoById(id);
        const uuid = current ? current.id : id;
        const res = await SupabaseDataService.updateEquipo(uuid, data);
        if (res.success) {
            const item = normalizeSupabaseData('equipos', res.data);
            const idx = cache.equipos.findIndex(e => e.id === uuid);
            if (idx !== -1) cache.equipos[idx] = { ...cache.equipos[idx], ...item };
            LogService.log('equipos', 'update', uuid, `Equipo actualizado: ${item.nombreEquipo}`);
            return true;
        }
        throw new Error(res.error || 'Error al actualizar equipo');
    };

    const deleteEquipo = async (id) => {
        const current = getEquipoById(id);
        const uuid = current ? current.id : id;
        const res = await SupabaseDataService.deleteEquipo(uuid);
        if (res.success) {
            cache.equipos = cache.equipos.filter(e => e.id !== uuid);
            LogService.log('equipos', 'delete', uuid, `Equipo eliminado: ${current?.nombreEquipo || 'Desconocido'}`);
            return true;
        }
        throw new Error(res.error || 'Error al eliminar equipo');
    };

    const getEquiposStats = () => ({
        operativos: cache.equipos.filter(e => e.estado === 'Operativo').length,
        total: cache.equipos.length,
        enReparacion: 0
    });

    const getHistorialEquipo = () => [];

    // ========== VISITAS ==========
    const getVisitasSync = () => cache.visitas || [];

    const getVisitasFiltered = (filter = {}) => {
        return (cache.visitas || []).filter(v => {
            let matches = true;
            if (filter.search) {
                const s = filter.search.toLowerCase();
                const cliente = getClienteById(v.clienteId);
                const descripcion = (v.descripcionTrabajo || '').toLowerCase();
                matches = descripcion.includes(s) ||
                    (v.visitaId || '').toLowerCase().includes(s) ||
                    (cliente?.empresa || '').toLowerCase().includes(s) ||
                    (cliente?.nombreCliente || '').toLowerCase().includes(s);
            }
            if (filter.tipo && filter.tipo !== 'all') matches = matches && v.tipoVisita === filter.tipo;
            if (filter.hasContrato && filter.hasContrato !== 'all') {
                if (filter.hasContrato === 'with') matches = matches && !!v.contratoId;
                if (filter.hasContrato === 'without') matches = matches && !v.contratoId;
            }
            if (filter.clienteId && filter.clienteId !== 'all') {
                matches = matches && (
                    v.clienteId === filter.clienteId ||
                    v.clienteIdSlug === filter.clienteId ||
                    v.cliente?.id === filter.clienteId
                );
            }
            return matches;
        });
    };

    const getVisitaById = (id) => cache.visitas.find(v => v.visitaId === id || v.id === id);

    // Updated to support searching by UUID or display ID, and handling nulls
    const getVisitasByCliente = (clienteId) => {
        if (!clienteId) return [];
        return (cache.visitas || []).filter(v => v.clienteId === clienteId || v.cliente_id === clienteId || v.cliente?.id === clienteId);
    };

    const getVisitasByMonth = (year, month) => {
        return (cache.visitas || []).filter(v => {
            if (!v.fechaInicio) return false;
            const fecha = new Date(v.fechaInicio);
            return fecha.getFullYear() === year && fecha.getMonth() === month;
        });
    };

    const createVisita = async (data) => {
        // Generar ID local temporal si no existe
        if (!data.visitaId) data.visitaId = `VIS-${Date.now().toString().slice(-6)}`;

        const res = await SupabaseDataService.createVisita(data);
        if (res.success) {
            const newItem = normalizeSupabaseData('visitas', res.data);

            // Re-fetch or link related objects for cache consistency
            if (newItem.clienteId) newItem.cliente = getClienteById(newItem.clienteId);
            if (newItem.equipoId) newItem.equipo = getEquipoById(newItem.equipoId);

            if (!cache.visitas) cache.visitas = [];
            cache.visitas.unshift(newItem);

            LogService.log('visitas', 'create', newItem.id, `Visita creada: ${newItem.visitaId}`);
            return newItem;
        }
        throw new Error(res.error || 'Error al crear visita');
    };

    const updateVisita = async (id, data) => {
        // Find existing to get UUID
        const current = getVisitaById(id);
        const uuid = current ? current.id : id;

        const res = await SupabaseDataService.updateVisita(uuid, data);
        if (res.success) {
            const updatedItem = normalizeSupabaseData('visitas', res.data);

            const idx = cache.visitas.findIndex(v => v.id === uuid || v.visitaId === id);
            if (idx !== -1) {
                // Preserve linked objects if not in update, or update them
                const oldItem = cache.visitas[idx];
                cache.visitas[idx] = { ...oldItem, ...updatedItem };

                // Refresh links if IDs changed
                if (updatedItem.clienteId) cache.visitas[idx].cliente = getClienteById(updatedItem.clienteId);
                if (updatedItem.equipoId) cache.visitas[idx].equipo = getEquipoById(updatedItem.equipoId);
            }

            LogService.log('visitas', 'update', uuid, `Visita actualizada: ${id}`);
            return true;
        }
        throw new Error(res.error || 'Error al actualizar visita');
    };

    const deleteVisita = async (id) => {
        const current = getVisitaById(id);
        const uuid = current ? current.id : id;

        const res = await SupabaseDataService.deleteVisita(uuid);
        if (res.success) {
            cache.visitas = cache.visitas.filter(v => v.id !== uuid && v.visitaId !== id);
            LogService.log('visitas', 'delete', uuid, `Visita eliminada: ${id}`);
            return true;
        }
        throw new Error(res.error || 'Error al eliminar visita');
    };

    const deleteNomina = async (id) => {
        const res = await SupabaseDataService.deleteNomina(id);
        if (res.success) {
            cache.nominas = cache.nominas.filter(n => n.id !== id);
            LogService.log('prestaciones', 'delete', id, `Nómina eliminada: ${id}`);
            return true;
        }
        throw new Error(res.error || 'Error al eliminar nómina');
    };

    // ========== CRUD AUSENCIAS ==========
    const getAllAusencias = () => [...cache.ausencias];
    const getAusenciaById = (id) => cache.ausencias.find(a => a.id === id);

    const createAusencia = async (data) => {
        const res = await SupabaseDataService.createAusencia(data);
        if (res.success) {
            const item = {
                ...normalizeSupabaseData('ausencias', res.data),
                empleadoNombre: getEmpleadoById(data.empleadoId)?.nombre || 'Desconocido'
            };
            cache.ausencias.unshift(item);
            LogService.log('prestaciones', 'create', item.id, `Ausencia creada para: ${item.empleadoNombre}`);
            return item;
        }
        throw new Error(res.error || 'Error al crear ausencia');
    };

    const updateAusencia = async (id, data) => {
        const res = await SupabaseDataService.updateAusencia(id, data);
        if (res.success) {
            const item = {
                ...normalizeSupabaseData('ausencias', res.data),
                empleadoNombre: getEmpleadoById(data.empleadoId || res.data.empleado_id)?.nombre || 'Desconocido'
            };
            const idx = cache.ausencias.findIndex(a => a.id === id);
            if (idx !== -1) cache.ausencias[idx] = { ...cache.ausencias[idx], ...item };
            LogService.log('prestaciones', 'update', id, `Ausencia actualizada`);
            return true;
        }
        throw new Error(res.error || 'Error al actualizar ausencia');
    };

    const deleteAusencia = async (id) => {
        const res = await SupabaseDataService.deleteAusencia(id);
        if (res.success) {
            cache.ausencias = cache.ausencias.filter(a => a.id !== id);
            LogService.log('prestaciones', 'delete', id, `Ausencia eliminada`);
            return true;
        }
        throw new Error(res.error || 'Error al eliminar ausencia');
    };

    const getVisitasStats = () => {
        const now = new Date();
        const thisMonth = now.getMonth();
        const thisYear = now.getFullYear();
        const visitas = cache.visitas || [];

        return {
            esteMes: visitas.filter(v => {
                const d = new Date(v.fechaInicio);
                return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
            }).length,
            completadas: visitas.filter(v => v.trabajoRealizado).length,
            ingresosEventuales: visitas.reduce((sum, v) => sum + (v.costoServicio || 0), 0)
        };
    };

    // ========== HELPERS GENERALES ==========
    const getConfig = () => ({ ...cache.config });
    const updateConfig = (cfg) => {
        cache.config = { ...cache.config, ...cfg };
        LogService.log('configuracion', 'update', 'system', 'Configuración actualizada', cfg);
    };

    const authenticateUser = async (username, password) => {
        // Delegar autenticación por username a SupabaseDataService
        if (typeof SupabaseDataService !== 'undefined' && SupabaseDataService.authenticateUser) {
            return await SupabaseDataService.authenticateUser(username, password);
        }
        return { error: 'Servicio de autenticación no disponible' };
    };
    const getUsers = () => cache.users;
    const getUsersSync = () => cache.users;
    const getUserByUsername = (username) => {
        return cache.users.find(u => u.username === username);
    };

    const createUser = async (data) => {
        // Implementación con Supabase
        const res = await SupabaseDataService.createUser(data);

        if (res.error) {
            return { error: res.error };
        }

        if (res.user) {
            if (!cache.users) cache.users = [];
            // Intentar obtener el username del metadata o usar el nombre
            const newUser = {
                id: res.user.id,
                username: data.username,
                name: data.name,
                email: data.email,
                role: data.role,
                allowedModules: data.allowedModules || []
            };
            cache.users.push(newUser);
            LogService.log('configuracion', 'create', newUser.id, `Usuario creado: ${newUser.username}`);
            return { success: true, user: newUser };
        }
        return { error: 'Error desconocido al crear usuario' };
    };

    const updateUser = async (username, updates) => {
        const user = getUserByUsername(username);
        if (!user) throw new Error('Usuario no encontrado');

        // Call Supabase update if needed
        const res = await SupabaseDataService.updateUser(user.id, updates);

        if (res.success) {
            // Update cache
            const idx = cache.users.findIndex(u => u.username === username);
            if (idx !== -1) {
                cache.users[idx] = { ...cache.users[idx], ...updates };
            }
            LogService.log('configuracion', 'update', user.id, `Usuario actualizado: ${username}`);
            return true;
        } else {
            throw new Error(res.error || 'Error al actualizar usuario');
        }
    };

    const deleteUser = async (username) => {
        const user = getUserByUsername(username);
        if (!user) throw new Error('Usuario no encontrado');

        const res = await SupabaseDataService.deleteUser(user.id);

        if (res.success) {
            cache.users = cache.users.filter(u => u.username !== username);
            LogService.log('configuracion', 'delete', user.id, `Usuario eliminado: ${username}`);
            return true;
        } else {
            throw new Error(res.error || 'Error al eliminar usuario');
        }
    };

    // Permissions
    const getPermissions = () => cache.permissions;
    const getRolePermissions = (role) => cache.permissions[role];
    const updateRolePermissions = (role, permissions) => {
        cache.permissions[role] = permissions;
        LogService.log('configuracion', 'update', role, `Permisos actualizados para rol ${role}`);
        return true;
    };
    const canPerformAction = (role, module, action) => cache.permissions[role]?.[module]?.[action] || false;
    const getAvailableRoles = () => Object.keys(cache.permissions);

    // Dashboard & Reports
    const getDashboardStats = () => {
        // Calcular estadísticas localmente desde el caché
        // Manejar tanto formato legacy como Supabase
        const clientesActivos = cache.clientes.filter(c =>
            (c.estado === 'Activo' || c.status === 'Activo')
        ).length;

        const contratosActivos = cache.contratos.filter(c =>
            (c.estadoContrato === 'Activo' || c.estado_contrato === 'Activo' || c.status === 'Activo')
        ).length;

        // Visitas del mes actual
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        const visitasMes = cache.visitas.filter(v => {
            const visitaDate = new Date(v.fechaInicio || v.fecha_inicio || v.fecha);
            return visitaDate.getMonth() === currentMonth && visitaDate.getFullYear() === currentYear;
        }).length;

        // Calcular ingresos del mes desde contratos activos
        const ingresosMes = cache.contratos
            .filter(c => c.estadoContrato === 'Activo' || c.estado_contrato === 'Activo' || c.status === 'Activo')
            .reduce((sum, c) => {
                const valor = parseFloat(c.valorContrato || c.valor_contrato || c.valor || 0);
                return sum + valor;
            }, 0);

        console.log('📊 Dashboard Stats:', {
            total_clientes: cache.clientes.length,
            clientesActivos,
            total_contratos: cache.contratos.length,
            contratosActivos,
            total_visitas: cache.visitas.length,
            visitasMes,
            ingresosMes
        });

        return {
            clientesActivos: {
                value: clientesActivos || 0,
                trend: clientesActivos > 0 ? 12 : 0,
                trendDirection: 'up'
            },
            serviciosMes: {
                value: visitasMes || 0,
                trend: visitasMes > 0 ? 8 : 0,
                trendDirection: 'up'
            },
            ingresosMes: {
                value: ingresosMes || 0,
                trend: ingresosMes > 0 ? 5 : 0,
                trendDirection: 'up'
            },
            contratosActivos: {
                value: contratosActivos || 0,
                trend: contratosActivos > 0 ? 3 : 0,
                trendDirection: 'up'
            }
        };
    };

    const getRecentActivities = () => {
        // Generar actividades desde las visitas del caché
        return cache.visitas.slice(0, 5).map((v, i) => {
            const cliente = getClienteById(v.clienteId);
            return {
                numero: v.visitaId || `SRV-${String(i + 1).padStart(4, '0')}`,
                cliente: cliente?.nombreCliente || cliente?.empresa || 'Cliente',
                fecha: v.fechaInicio ? new Date(v.fechaInicio).toLocaleDateString('es-NI') : '-',
                estado: v.trabajoRealizado ? 'Completado' : 'Pendiente',
                monto: '$0.00'
            };
        });
    };

    const getChartData = () => ({
        labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
        revenue: [1200, 1800, 1400, 2100, 2800, 1600, 900],
        profit: [800, 1200, 900, 1500, 2000, 1100, 600]
    });

    const getSavingsPlans = () => [
        { id: 1, title: 'Meta Clientes', subtitle: 'Nuevos clientes este mes', target: 50, percent: Math.min(100, (cache.clientes.length / 50) * 100), icon: Icons?.users || '👥' },
        { id: 2, title: 'Meta Contratos', subtitle: 'Contratos activos', target: 20, percent: Math.min(100, (cache.contratos.length / 20) * 100), icon: Icons?.fileText || '📄' }
    ];

    const getBankAccounts = () => [];
    const getReportesStats = (filter = {}) => {
        const today = new Date();
        let startDate, endDate;

        if (filter.periodo === 'custom') {
            startDate = filter.fechaInicio ? new Date(filter.fechaInicio + 'T00:00:00') : null;
            endDate = filter.fechaFin ? new Date(filter.fechaFin + 'T23:59:59') : null;
        } else {
            endDate = new Date();
            startDate = new Date();
            if (filter.periodo === 'week') startDate.setDate(today.getDate() - 7);
            else if (filter.periodo === 'quarter') startDate.setMonth(today.getMonth() - 3);
            else if (filter.periodo === 'year') startDate.setFullYear(today.getFullYear() - 1);
            else startDate.setMonth(today.getMonth() - 1); // default month
        }

        const filteredVisitas = (cache.visitas || []).filter(v => {
            if (!v.fechaInicio && !v.fecha) return false;
            const date = new Date(v.fechaInicio || v.fecha);
            return (!startDate || date >= startDate) && (!endDate || date <= endDate);
        });

        const totalClientes = cache.clientes.length;
        const totalServicios = filteredVisitas.length;

        // Ingresos de contratos activos 
        const ingresosTotales = cache.contratos
            .filter(c => c.estadoContrato === 'Activo' || c.status === 'Activo')
            .reduce((sum, c) => sum + (parseFloat(c.valorContrato || c.valor || 0)), 0);

        const contratosActivos = cache.contratos.filter(c => c.estadoContrato === 'Activo' || c.status === 'Activo').length;

        // Servicios por Técnico
        const tecnicoMap = {};
        filteredVisitas.forEach(v => {
            const t = v.usuarioSoporte || 'Sin asignar';
            tecnicoMap[t] = (tecnicoMap[t] || 0) + 1;
        });
        const serviciosPorTecnico = Object.entries(tecnicoMap)
            .map(([tecnico, count]) => ({ tecnico, count }))
            .sort((a, b) => b.count - a.count);

        // Servicios por Tipo
        const serviciosPorTipo = {
            fisica: filteredVisitas.filter(v => v.tipoVisita === 'Física').length,
            remota: filteredVisitas.filter(v => v.tipoVisita === 'Remota').length
        };

        // Contrato vs Eventual
        const contratoVsEventual = {
            contrato: filteredVisitas.filter(v => !!v.contratoId).length,
            eventual: filteredVisitas.filter(v => !v.contratoId).length
        };

        // Ingresos por Moneda
        const ingresosPorMoneda = {
            usd: ingresosTotales,
            nio: ingresosTotales * (cache.config.tipoCambio || 36.5)
        };

        // Historial por Cliente (Top 5 con más servicios)
        const clienteStats = {};
        cache.clientes.forEach(c => {
            const clientVisits = cache.visitas.filter(v => v.clienteId === c.id || v.clienteId === c.clienteId);
            const lastVisit = clientVisits.length > 0 ?
                clientVisits.sort((a, b) => new Date(b.fechaInicio) - new Date(a.fechaInicio))[0].fechaInicio : null;

            clienteStats[c.id || c.clienteId] = {
                empresa: c.empresa || c.nombreCliente || 'S/N',
                nombreCliente: c.nombreCliente || '',
                totalServicios: clientVisits.length,
                ultimoServicio: lastVisit,
                estado: c.estado || 'Activo'
            };
        });
        const historialClientes = Object.values(clienteStats)
            .sort((a, b) => b.totalServicios - a.totalServicios)
            .slice(0, 5);

        // Estado de Equipos
        const totalEquipos = cache.equipos.length;
        const estadosDefinidos = ['Operativo', 'En Reparación', 'Fuera de Servicio'];
        const estadoEquipos = estadosDefinidos.map(estado => {
            const count = cache.equipos.filter(e => e.estado === estado).length;
            return {
                estado,
                count,
                porcentaje: totalEquipos > 0 ? (count / totalEquipos) * 100 : 0
            };
        });

        return {
            totalClientes,
            totalServicios,
            ingresosTotales,
            contratosActivos,
            serviciosPorTecnico,
            serviciosPorTipo,
            contratoVsEventual,
            ingresosPorMoneda,
            historialClientes,
            estadoEquipos
        };
    };

    // Placeholders para módulos no migrados completamente
    const getReparacionesByEquipo = () => [];
    const getReparacionById = () => null;
    const createReparacion = () => { };
    const updateReparacion = () => { };
    const deleteReparacion = () => { };
    const getProductosSync = () => [...cache.productos];
    const getProductosFiltered = (filter = {}) => {
        return cache.productos.filter(p => {
            let matches = true;
            if (filter.search) {
                const s = filter.search.toLowerCase();
                matches = (p.nombre || '').toLowerCase().includes(s) ||
                    (p.codigo || '').toLowerCase().includes(s) ||
                    (p.descripcion || '').toLowerCase().includes(s) ||
                    (p.categoria || '').toLowerCase().includes(s);
            }
            if (filter.tipo && filter.tipo !== 'all') matches = matches && p.tipo === filter.tipo;
            if (filter.estado && filter.estado !== 'all') matches = matches && p.estado === filter.estado;
            return matches;
        });
    };
    const getProductoById = (id) => cache.productos.find(p => p.productoId === id || p.id === id);

    const createProducto = async (data) => {
        const res = await SupabaseDataService.createProducto(data);
        if (res.success) {
            const item = {
                ...res.data,
                productoId: res.data.id,
                precio: parseFloat(res.data.precio_venta) || 0
            };
            cache.productos.unshift(item);
            LogService.log('productos', 'create', item.id, `Producto creado: ${item.nombre}`, { codigo: item.codigo });
            return item;
        }
        throw new Error(res.error || 'Error al crear producto');
    };

    const updateProducto = async (id, data) => {
        const current = getProductoById(id);
        const uuid = current ? current.id : id;
        const res = await SupabaseDataService.updateProducto(uuid, data);
        if (res.success) {
            const idx = cache.productos.findIndex(p => p.id === uuid || p.productoId === id);
            if (idx !== -1) {
                cache.productos[idx] = {
                    ...cache.productos[idx],
                    ...res.data,
                    precio: parseFloat(res.data.precio_venta) || cache.productos[idx].precio || 0
                };
            }
            LogService.log('productos', 'update', uuid, `Producto actualizado: ${current?.nombre || data.nombre}`);
            return true;
        }
        throw new Error(res.error || 'Error al actualizar producto');
    };

    const deleteProducto = async (id) => {
        const current = getProductoById(id);
        const uuid = current ? current.id : id;
        const res = await SupabaseDataService.deleteProducto(uuid);
        if (res.success) {
            cache.productos = cache.productos.filter(p => p.id !== uuid);
            LogService.log('productos', 'delete', uuid, `Producto eliminado: ${current?.nombre || 'Desconocido'}`);
            return true;
        }
        throw new Error(res.error || 'Error al eliminar producto');
    };
    const getSoftwareFiltered = (filter) => {
        return cache.software.filter(s => {
            let matches = true;
            if (filter.search) {
                const term = filter.search.toLowerCase();
                const clienteNombre = s.cliente?.nombreCliente || s.cliente?.empresa || s.nombreRegistro || '';
                matches = (s.nombreSoftware || '').toLowerCase().includes(term) ||
                    (s.numeroLicencia || '').toLowerCase().includes(term) ||
                    (s.numeroSerie || '').toLowerCase().includes(term) ||
                    clienteNombre.toLowerCase().includes(term);
            }
            if (filter.tipo && filter.tipo !== 'all') matches = matches && s.tipoLicencia === filter.tipo;
            if (filter.activacion && filter.activacion !== 'all') matches = matches && s.modoActivacion === filter.activacion;
            return matches;
        });
    };

    const getSoftwareById = (id) => cache.software.find(s => s.id === id);

    const getSoftwareByRegistro = (registro) => {
        return cache.software.filter(s => {
            const nombre = s.cliente?.nombreCliente || s.cliente?.empresa || s.nombreRegistro || '';
            return nombre === registro;
        });
    };

    const getSoftwareUniqueRegistros = () => {
        const registros = new Set();
        cache.software.forEach(s => {
            const nombre = s.cliente?.nombreCliente || s.cliente?.empresa || s.nombreRegistro;
            if (nombre) registros.add(nombre);
        });
        return Array.from(registros).sort();
    };

    const createSoftware = async (data) => {
        const res = await SupabaseDataService.createSoftware(data);
        if (res.success) {
            // Need to fetch full object including client or manually reconstruct
            // For now, let's normalize what we have. If client is linked, we just have id.
            // Ideally we fetch it back or look it up in cache.
            const newItem = normalizeSupabaseData('software', res.data);
            if (newItem.clienteId) {
                newItem.cliente = getClienteById(newItem.clienteId);
            }
            cache.software.unshift(newItem);
            LogService.log('software', 'create', newItem.id, `Software creado: ${newItem.nombreSoftware}`);
            return newItem;
        }
        throw new Error(res.error || 'Error al crear software');
    };

    const updateSoftware = async (id, data) => {
        const current = getSoftwareById(id);
        const res = await SupabaseDataService.updateSoftware(id, data);
        if (res.success) {
            const updatedItem = normalizeSupabaseData('software', res.data);
            if (updatedItem.clienteId) {
                updatedItem.cliente = getClienteById(updatedItem.clienteId);
            }
            const idx = cache.software.findIndex(s => s.id === id);
            if (idx !== -1) cache.software[idx] = { ...cache.software[idx], ...updatedItem };
            LogService.log('software', 'update', id, `Software actualizado: ${updatedItem.nombreSoftware}`);
            return true;
        }
        throw new Error(res.error || 'Error al actualizar software');
    };

    const deleteSoftware = async (id) => {
        const current = getSoftwareById(id);
        const res = await SupabaseDataService.deleteSoftware(id);
        if (res.success) {
            cache.software = cache.software.filter(s => s.id !== id);
            LogService.log('software', 'delete', id, `Software eliminado: ${current?.nombreSoftware || 'Desconocido'}`);
            return true;
        }
        throw new Error(res.error || 'Error al eliminar software');
    };

    // Proformas (kept for context context)
    const getProformasSync = () => [...cache.proformas];
    const getProformasFiltered = (filter = {}) => {
        return cache.proformas.filter(p => {
            let matches = true;
            if (filter.search) {
                const s = filter.search.toLowerCase();
                const cliente = getClienteById(p.clienteId || p.cliente_id);
                matches = (p.proformaId || p.codigo_proforma || '').toLowerCase().includes(s) ||
                    String(p.numero || p.numero_proforma || '').includes(s) ||
                    (cliente?.empresa || '').toLowerCase().includes(s);
            }
            if (filter.clienteId && filter.clienteId !== 'all') {
                matches = matches && (p.clienteId === filter.clienteId || p.cliente_id === filter.clienteId || p.id === filter.clienteId);
            }
            if (filter.estado && filter.estado !== 'all') matches = matches && p.estado === filter.estado;
            return matches;
        });
    };
    const getProformaById = (id) => cache.proformas.find(p => p.proformaId === id || p.id === id);
    const getProformasByCliente = (clienteId) => cache.proformas.filter(p => p.clienteId === clienteId);
    const getProformasByRango = (inicio, fin) => cache.proformas.filter(p => p.numero >= inicio && p.numero <= fin);
    const getNextProformaNumber = () => {
        if (cache.proformas.length === 0) return 1;
        return Math.max(...cache.proformas.map(p => p.numero || 0)) + 1;
    };
    const createProforma = async (data) => {
        const numero = getNextProformaNumber();
        const fechaEmision = data.fecha || new Date().toISOString().split('T')[0];
        const validezDias = data.validezDias || 15;

        // Calculate expiration date
        const fechaVenc = new Date(fechaEmision);
        fechaVenc.setDate(fechaVenc.getDate() + validezDias);

        // Map to actual DB columns (proformas table)
        const proformaData = {
            codigo_proforma: `PROF-${String(numero).padStart(4, '0')}`,
            numero_proforma: numero,
            cliente_id: data.clienteId,
            fecha_emision: fechaEmision,
            fecha_vencimiento: fechaVenc.toISOString().split('T')[0],
            validez_dias: validezDias,
            moneda: data.moneda || 'USD',
            subtotal: data.items?.reduce((sum, i) => sum + (i.total || 0), 0) || 0,
            total: data.items?.reduce((sum, i) => sum + (i.total || 0), 0) || 0,
            notas: data.notas || '',
            estado: 'Activa'
            // created_by is set automatically by supabase-data-service
        };

        // Items will be inserted separately into proforma_items table
        const items = data.items || [];

        const res = await SupabaseDataService.createProforma(proformaData);
        if (res.success) {
            // Insert items into proforma_items table
            if (items.length > 0) {
                try {
                    await SupabaseDataService.createProformaItems(res.data.id, items);
                } catch (itemErr) {
                    console.error('Error al crear items de proforma:', itemErr);
                }
            }

            const item = {
                ...res.data,
                proformaId: res.data.codigo_proforma,
                clienteId: res.data.cliente_id,
                numero: res.data.numero_proforma,
                items: items
            };
            cache.proformas.unshift(item);
            LogService.log('proformas', 'create', item.id, `Proforma creada: ${item.codigo_proforma}`);
            return item;
        }
        throw new Error(res.error || 'Error al crear proforma');
    };

    const updateProforma = async (id, data) => {
        const current = getProformaById(id);
        const uuid = current ? current.id : id;

        // Map to actual DB columns (only include defined values)
        const updateData = {};
        if (data.clienteId) updateData.cliente_id = data.clienteId;
        if (data.subtotal !== undefined) updateData.subtotal = data.subtotal;
        if (data.total !== undefined) updateData.total = data.total;
        if (data.notas !== undefined) updateData.notas = data.notas;
        if (data.estado) updateData.estado = data.estado;
        if (data.moneda) updateData.moneda = data.moneda;
        if (data.validezDias) updateData.validez_dias = data.validezDias;

        const res = await SupabaseDataService.updateProforma(uuid, updateData);
        if (res.success) {
            const idx = cache.proformas.findIndex(p => p.id === uuid || p.proformaId === id);
            if (idx !== -1) cache.proformas[idx] = { ...cache.proformas[idx], ...res.data };
            LogService.log('proformas', 'update', uuid, `Proforma actualizada: ${current?.proformaId || current?.codigo_proforma || id}`);
            return true;
        }
        throw new Error(res.error || 'Error al actualizar proforma');
    };

    const deleteProforma = async (id) => {
        const current = getProformaById(id);
        const uuid = current ? current.id : id;
        const res = await SupabaseDataService.deleteProforma(uuid);
        if (res.success) {
            cache.proformas = cache.proformas.filter(p => p.id !== uuid);
            LogService.log('proformas', 'delete', uuid, `Proforma eliminada: ${current?.proformaId || id}`);
            return true;
        }
        throw new Error(res.error || 'Error al eliminar proforma');
    };
    const getProformasStats = () => ({
        total: cache.proformas?.length || 0,
        aprobadas: cache.proformas?.filter(p => p.estado === 'Aprobada').length || 0,
        activas: cache.proformas?.filter(p => p.estado === 'Activa').length || 0,
        vencidas: cache.proformas?.filter(p => p.estado === 'Vencida').length || 0,
        valorAprobado: cache.proformas?.filter(p => p.estado === 'Aprobada').reduce((sum, p) => sum + (p.total || 0), 0) || 0
    });

    // ========== PEDIDOS ==========
    const getPedidosSync = () => [...cache.pedidos];
    const getPedidoById = (id) => cache.pedidos.find(p => p.pedidoId === id || p.id === id);
    const getPedidosByCliente = (clienteId) => cache.pedidos.filter(p => p.clienteId === clienteId);
    const getNextPedidoNumber = () => {
        if (cache.pedidos.length === 0) return 1;
        const maxNum = Math.max(...cache.pedidos.map(p => {
            const num = p.numeroPedido?.match(/\d+/);
            return num ? parseInt(num[0]) : 0;
        }));
        return maxNum + 1;
    };
    const createPedido = async (data) => {
        const numero = getNextPedidoNumber();
        const pedidoData = {
            pedido_id: `PED-${String(numero).padStart(5, '0')}`,
            numero_pedido: `PED-${String(numero).padStart(5, '0')}`,
            cliente_id: data.clienteId,
            categoria: data.categoria || '',
            fecha: data.fecha || new Date().toISOString(),
            items: data.items || [],
            total: data.total || 0,
            notas: data.notas || '',
            estado: data.estado || 'Pendiente'
        };

        const res = await SupabaseDataService.createPedido(pedidoData);
        if (res.success) {
            const item = {
                ...res.data,
                pedidoId: res.data.pedido_id,
                numeroPedido: res.data.numero_pedido,
                clienteId: res.data.cliente_id
            };
            cache.pedidos.unshift(item);
            LogService.log('pedidos', 'create', item.id, `Pedido creado: ${item.pedido_id}`);
            return item;
        }
        throw new Error(res.error || 'Error al crear pedido');
    };

    const updatePedido = async (id, data) => {
        const current = getPedidoById(id);
        const uuid = current ? current.id : id;

        const updateData = {
            cliente_id: data.clienteId || current?.cliente_id,
            categoria: data.categoria,
            items: data.items,
            total: data.total,
            notas: data.notas,
            estado: data.estado
        };

        const res = await SupabaseDataService.updatePedido(uuid, updateData);
        if (res.success) {
            const idx = cache.pedidos.findIndex(p => p.id === uuid || p.pedidoId === id);
            if (idx !== -1) cache.pedidos[idx] = { ...cache.pedidos[idx], ...res.data };
            LogService.log('pedidos', 'update', uuid, `Pedido actualizado: ${current?.pedidoId || id}`);
            return true;
        }
        throw new Error(res.error || 'Error al actualizar pedido');
    };

    const deletePedido = async (id) => {
        const current = getPedidoById(id);
        const uuid = current ? current.id : id;
        const res = await SupabaseDataService.deletePedido(uuid);
        if (res.success) {
            cache.pedidos = cache.pedidos.filter(p => p.id !== uuid);
            LogService.log('pedidos', 'delete', uuid, `Pedido eliminado: ${current?.pedidoId || id}`);
            return true;
        }
        throw new Error(res.error || 'Error al eliminar pedido');
    };
    const getPedidosStats = () => ({
        total: cache.pedidos?.length || 0,
        pendientes: cache.pedidos?.filter(p => p.estado === 'Pendiente').length || 0,
        enProceso: cache.pedidos?.filter(p => p.estado === 'En Proceso').length || 0,
        completados: cache.pedidos?.filter(p => p.estado === 'Completado').length || 0,
        valorTotal: cache.pedidos?.reduce((sum, p) => sum + (p.total || 0), 0) || 0
    });

    const getContractTemplates = () => cache.contractTemplates;
    const getContractTemplateById = () => null;
    const saveContractTemplate = () => { };
    const deleteContractTemplate = () => { };

    // ========== EMPLEADOS ==========
    const getEmpleadosSync = () => [...(cache.empleados || [])];

    const getEmpleadosFiltered = (filters = {}) => {
        let filtered = getEmpleadosSync();

        if (filters.estado) {
            filtered = filtered.filter(e => e.estado === filters.estado);
        }
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            filtered = filtered.filter(e =>
                e.nombre?.toLowerCase().includes(searchLower) ||
                e.cedula?.includes(searchLower) ||
                e.cargo?.toLowerCase().includes(searchLower)
            );
        }

        return filtered;
    };

    const getEmpleadoById = (id) => {
        return cache.empleados?.find(e => e.id === id) || null;
    };

    const createEmpleado = async (data) => {
        const res = await SupabaseDataService.createEmpleado?.(data);
        if (res?.success) {
            if (!cache.empleados) cache.empleados = [];
            // Normalizar datos retornados de Supabase
            const normalized = {
                ...res.data,
                fechaAlta: res.data.fecha_alta,
                salarioTotal: parseFloat(res.data.salario_total) || 0,
                tipoSalario: res.data.tipo_salario,
                tipoContrato: res.data.tipo_contrato,
                tiempoContrato: res.data.tiempo_contrato,
                vacacionesTomadas: res.data.vacaciones_tomadas || 0,
                aguinaldoPagado: res.data.aguinaldo_pagado || false
            };
            cache.empleados.push(normalized);
            LogService.log('empleados', 'create', normalized.id, `Empleado creado: ${normalized.nombre}`);
            return normalized;
        }
        throw new Error(res?.error || 'Error al crear empleado');
    };

    const updateEmpleado = async (id, data) => {
        const current = getEmpleadoById(id);
        const uuid = current ? current.id : id;

        const res = await SupabaseDataService.updateEmpleado?.(uuid, data);
        if (res?.success) {
            const idx = cache.empleados.findIndex(e => e.id === uuid);
            if (idx !== -1) {
                const merged = { ...cache.empleados[idx], ...data, updatedAt: new Date().toISOString() };
                // Re-normalizar camelCase
                merged.fechaAlta = merged.fecha_alta || merged.fechaAlta;
                merged.salarioTotal = parseFloat(merged.salario_total || merged.salarioTotal) || 0;
                merged.tipoSalario = merged.tipo_salario || merged.tipoSalario;
                merged.tipoContrato = merged.tipo_contrato || merged.tipoContrato;
                merged.tiempoContrato = merged.tiempo_contrato || merged.tiempoContrato;
                merged.vacacionesTomadas = merged.vacaciones_tomadas ?? merged.vacacionesTomadas ?? 0;
                merged.aguinaldoPagado = merged.aguinaldo_pagado ?? merged.aguinaldoPagado ?? false;
                cache.empleados[idx] = merged;
            }
            LogService.log('empleados', 'update', uuid, `Empleado actualizado: ${current?.nombre || id}`);
            return true;
        }
        throw new Error(res?.error || 'Error al actualizar empleado');
    };

    const deleteEmpleado = async (id) => {
        const current = getEmpleadoById(id);
        const uuid = current ? current.id : id;

        const res = await SupabaseDataService.deleteEmpleado?.(uuid);
        if (res?.success) {
            cache.empleados = cache.empleados.filter(e => e.id !== uuid);
            LogService.log('empleados', 'delete', uuid, `Empleado eliminado: ${current?.nombre || id}`);
            return true;
        }
        throw new Error(res?.error || 'Error al eliminar empleado');
    };

    const resetData = () => location.reload();


    return {
        init,
        refreshData,
        isRefreshing: () => isRefreshing,
        handleRealtimeUpdate,

        // Clientes
        getClientesSync, getClientesFiltered, getClienteById, createCliente, updateCliente, deleteCliente,

        // Contratos
        getContratosSync, getContratosFiltered, getContratoById, getContratosByCliente, createContrato, updateContrato, deleteContrato, getContratosStats, getContratosProximosAVencer,

        // Equipos
        getEquiposSync, getEquiposFiltered, getEquipoById, getEquiposByCliente, createEquipo, updateEquipo, deleteEquipo, getEquiposStats, getHistorialEquipo,

        // Visitas
        getVisitasSync, getVisitasFiltered, getVisitaById, getVisitasByCliente, getVisitasByMonth, createVisita, updateVisita, deleteVisita, getVisitasStats,

        // Config & Auth
        getConfig, updateConfig, getUsers, getUsersSync, getUserByUsername, createUser, updateUser, deleteUser, authenticateUser,
        getPermissions, getRolePermissions, updateRolePermissions, canPerformAction, getAvailableRoles,

        // Dashboard & Others
        getDashboardStats, getRecentActivities, getChartData, getSavingsPlans, getBankAccounts,
        getReportesStats, resetData, exportAllData: () => cache,

        // Placeholders
        getReparacionesByEquipo, getReparacionById, createReparacion, updateReparacion, deleteReparacion,
        getProductosSync, getProductosFiltered, getProductoById, createProducto, updateProducto, deleteProducto,
        getSoftwareFiltered, getSoftwareById, getSoftwareByRegistro, getSoftwareUniqueRegistros, createSoftware, updateSoftware, deleteSoftware,
        getProformasSync, getProformasFiltered, getProformaById, getProformasByCliente, getProformasByRango, getNextProformaNumber, createProforma, updateProforma, deleteProforma, getProformasStats,

        // Pedidos
        getPedidosSync, getPedidoById, getPedidosByCliente, getNextPedidoNumber, createPedido, updatePedido, deletePedido, getPedidosStats,

        // Empleados
        getEmpleadosSync, getEmpleadosFiltered, getEmpleadoById, createEmpleado, updateEmpleado, deleteEmpleado,

        getContractTemplates, getContractTemplateById, saveContractTemplate, deleteContractTemplate,

        // Prestaciones
        getVacacionesByEmpleado: (id) => SupabaseDataService.getVacacionesByEmpleado(id),
        createVacacion: async (data) => {
            const res = await SupabaseDataService.createVacacion(data);
            if (res.success) {
                // Update local cache if needed
                const emp = getEmpleadoById(data.empleadoId);
                if (emp) emp.vacacionesTomadas = (emp.vacacionesTomadas || 0) + data.dias;
                return res.data;
            }
            throw new Error(res.error);
        },
        updateVacacion: async (id, data) => {
            const res = await SupabaseDataService.updateVacacion(id, data);
            if (res.success) return res.data;
            throw new Error(res.error);
        },
        deleteVacacion: async (id) => {
            const res = await SupabaseDataService.deleteVacacion(id);
            if (res.success) return true;
            throw new Error(res.error);
        },

        getAguinaldosByEmpleado: (id) => SupabaseDataService.getAguinaldosByEmpleado(id),
        createAguinaldo: async (data) => {
            const res = await SupabaseDataService.createAguinaldo(data);
            if (res.success) {
                const emp = getEmpleadoById(data.empleadoId);
                if (emp && data.anio === new Date().getFullYear()) emp.aguinaldoPagado = true;
                return res.data;
            }
            throw new Error(res.error);
        },

        getNominasByEmpleado: (id) => SupabaseDataService.getNominasByEmpleado(id),
        createNomina: async (data) => {
            const res = await SupabaseDataService.createNomina(data);
            if (res.success) {
                // Agregar a cache local
                const newNomina = { ...res.data, empleadoNombre: getEmpleadoById(data.empleadoId)?.nombre };
                if (!cache.nominas) cache.nominas = [];
                cache.nominas.unshift(newNomina);
                return res.data;
            }
            throw new Error(res.error);
        },
        getNominasSync: () => [...(cache.nominas || [])],
        getRecentNominas: () => cache.nominas.slice(0, 5), // Assuming 'nominas' is already sorted by date or similar
        getAllNominas: () => SupabaseDataService.getAllNominas(),
        deleteNomina,

        // Ausencias
        getAllAusencias,
        getAusenciaById,
        createAusencia,
        updateAusencia,
        deleteAusencia,

        // Gestión de Técnicos
        getPagosTecnicos: (id) => {
            if (id) return cache.pagosTecnicos.filter(p => p.tecnico_id === id);
            return [...cache.pagosTecnicos];
        },
        createPagoTecnico: async (data, visitaIds) => {
            const res = await SupabaseDataService.createPagoTecnico(data);
            if (res.success) {
                // Marcar visitas como pagadas en DB
                if (visitaIds && visitaIds.length > 0) {
                    await SupabaseDataService.marcarVisitasComoPagadas(res.data.id, visitaIds);
                }

                // Actualizar cache
                const newPago = {
                    ...res.data,
                    tecnicoNombre: cache.users.find(u => u.id === data.tecnico_id)?.name || 'Desconocido'
                };
                cache.pagosTecnicos.unshift(newPago);

                return res.data;
            }
            throw new Error(res.error);
        },
        getVisitasPorTecnico: (id, filter) => SupabaseDataService.getVisitasPorTecnico(id, filter),
        getAntiguedadTecnico: (id) => SupabaseDataService.getAntiguedadTecnico(id),
    };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = DataService; }
