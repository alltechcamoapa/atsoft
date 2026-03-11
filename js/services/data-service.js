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
        recepciones: [],
        empresas: [],
        bodegas: [],
        proveedores: [],
        // Datos Financieros
        finIngresos: [],
        finGastos: [],
        finCategorias: [],
        finFacturas: [],
        finCuentasCobrar: [],
        finCuentasPagar: [],
        finPresupuestos: [],
        finBancos: [],
        finConciliaciones: [],
        config: {
            monedaPrincipal: 'USD',
            tipoCambio: 36.5,
            alertasContratos: true,
            diasAnticipacion: 30,
            recordatoriosVisitas: true,
            // Configuración financiera
            ivaRate: 0.15,
            irRetencionServicios: 0.10,
            irRetencionBienes: 0.02,
            pagoMinimoDefinitivo: 0.01
        },
        permissions: {},
        contractTemplates: []
    };

    let isInitialized = false;
    let isRefreshing = false;
    let realtimeSubscription = null;
    let lastEmpresaId = null; // Track empresa to force re-init on switch

    // ========== UTILS: NORMALIZACIÓN DE DATOS ==========
    // Convierte snake_case de DB a camelCase de App y mapea IDs
    const toCamelCase = (str) => str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());

    const normalizeSupabaseData = (table, data) => {
        if (!data) return null;
        const normalized = {};
        for (const key in data) {
            const camelKey = toCamelCase(key.toLowerCase());
            normalized[camelKey] = data[key];
            normalized[key] = data[key]; // Preserve original key for compatibility
        }

        // Mapeos crticos de compatibilidad
        if (table === 'clientes') normalized.clienteId = data.codigo_cliente || data.id;
        if (table === 'contratos') normalized.contratoId = data.codigo_contrato || data.id;
        if (table === 'equipos') normalized.equipoId = data.codigo_equipo || data.id;
        if (table === 'productos') {
            normalized.productoId = data.id;
            normalized.nombre = data.nombre;
            normalized.codigo = data.codigo;
            normalized.precio = parseFloat(data.precio_venta || data.precio) || 0;
        }
        if (table === 'proformas') {
            normalized.proformaId = data.codigo_proforma || data.id;
            normalized.numero = data.numero_proforma || data.numero;
            normalized.clienteId = data.cliente_id;
        }
        if (table === 'pedidos') {
            normalized.pedidoId = data.pedido_id || data.id;
            normalized.numeroPedido = data.numero_pedido || data.numero;
            normalized.clienteId = data.cliente_id;
        }
        if (table === 'recepciones_equipos') {
            normalized.recepcionId = data.codigo_recepcion || data.id;
        }

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
        // Detect empresa change: force re-init if different empresa
        const currentEmpresaId = (typeof State !== 'undefined' && State.getCurrentUser) 
            ? State.getCurrentUser()?.empresa_id || null 
            : null;
        
        if (isInitialized && lastEmpresaId === currentEmpresaId) return true;
        
        // If empresa changed, reset the cache to avoid cross-contamination
        if (isInitialized && lastEmpresaId !== currentEmpresaId) {
            console.log('🔄 Empresa cambió de', lastEmpresaId, 'a', currentEmpresaId, '- recargando datos...');
            isInitialized = false;
            // Reset cache
            cache.clientes = []; cache.contratos = []; cache.visitas = [];
            cache.equipos = []; cache.reparaciones = []; cache.software = [];
            cache.productos = []; cache.proformas = []; cache.pedidos = [];
            cache.empleados = []; cache.recepciones = []; cache.proveedores = [];
        }
        
        lastEmpresaId = currentEmpresaId;

        // console.log('☁️ DataService: Sincronizando desde Supabase...');

        try {
            // Asegurar que el cliente de Supabase esté inicializado
            if (typeof SupabaseDataService !== 'undefined' && SupabaseDataService.init) {
                SupabaseDataService.init();
            }

            const [
                clientes, contratos, equipos, visitas, productos, proformas, pedidos,
                empleados, nominas, software, users, pagosTecnicos, ausencias,
                horasExtras, bonificaciones, adelantos, feriadosTrabajados, prestamosEmpleados, abonosPrestamos,
                recepciones, empresas, bodegas, proveedores
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
                SupabaseDataService.getAllAusencias?.() || Promise.resolve([]),
                SupabaseDataService.getHorasExtrasSync?.() || Promise.resolve([]),
                SupabaseDataService.getBonificacionesSync?.() || Promise.resolve([]),
                SupabaseDataService.getAdelantosSync?.() || Promise.resolve([]),
                SupabaseDataService.getFeriadosTrabajadosSync?.() || Promise.resolve([]),
                SupabaseDataService.getPrestamosSync?.() || Promise.resolve([]),
                SupabaseDataService.getAbonosPrestamosSync?.() || Promise.resolve([]),
                SupabaseDataService.getRecepcionesSync?.() || Promise.resolve([]),
                SupabaseDataService.getEmpresasSync?.() || Promise.resolve([]),
                SupabaseDataService.getBodegasSync?.() || Promise.resolve([]),
                SupabaseDataService.getProveedoresSync?.() || Promise.resolve([])
            ]);

            // Normalizar y almacenar en caché
            cache.empresas = empresas || [];
            cache.bodegas = bodegas || [];
            cache.proveedores = (proveedores || []).map(p => normalizeSupabaseData('proveedores', p));
            cache.clientes = (clientes || []).map(c => normalizeSupabaseData('clientes', c));
            cache.contratos = (contratos || []).map(c => ({ ...normalizeSupabaseData('contratos', c), cliente: normalizeSupabaseData('clientes', c.cliente) }));
            cache.equipos = (equipos || []).map(e => ({ ...normalizeSupabaseData('equipos', e), cliente: normalizeSupabaseData('clientes', e.cliente) }));
            cache.visitas = (visitas || []).map(v => normalizeSupabaseData('visitas', v));
            cache.software = (software || []).map(s => ({
                ...normalizeSupabaseData('software', s),
                cliente: s.cliente ? normalizeSupabaseData('clientes', s.cliente) : null
            }));
            cache.productos = (productos || []).map(p => normalizeSupabaseData('productos', p));
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

            cache.recepciones = (recepciones || []).map(r => ({
                ...r,
                recepcionId: r.codigo_recepcion,
                numero: r.numero_recepcion,
                clienteId: r.cliente_id,
                equipoId: r.equipo_id,
                cliente: r.cliente ? normalizeSupabaseData('clientes', r.cliente) : null,
                equipo: r.equipo ? normalizeSupabaseData('equipos', r.equipo) : null
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

            // Assign raw records
            cache.horasExtras = horasExtras || [];
            cache.bonificaciones = bonificaciones || [];
            cache.adelantos = adelantos || [];
            cache.feriadosTrabajados = feriadosTrabajados || [];
            cache.prestamosEmpleados = prestamosEmpleados || [];
            cache.abonosPrestamos = abonosPrestamos || [];

            // Cargar permisos por defecto (hardcoded por seguridad)
            cache.permissions = loadDefaultPermissions();

            isInitialized = true;
            console.log(`✅ DataService: Sincronización completa (${cache.clientes.length} Clientes, ${cache.contratos.length} Contratos, ${cache.productos.length} Productos)`);

            // Sincronizar configuracion POS si está disponible
            await syncPOSConfig();

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
            const [
                clientes, contratos, equipos, visitas, productos, proformas, pedidos,
                empleados, nominas, software, users, pagosTecnicos, ausencias,
                horasExtras, bonificaciones, adelantos, feriadosTrabajados, prestamosEmpleados, abonosPrestamos,
                recepciones, empresas, bodegas
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
                SupabaseDataService.getAllAusencias?.() || Promise.resolve([]),
                SupabaseDataService.getHorasExtrasSync?.() || Promise.resolve([]),
                SupabaseDataService.getBonificacionesSync?.() || Promise.resolve([]),
                SupabaseDataService.getAdelantosSync?.() || Promise.resolve([]),
                SupabaseDataService.getFeriadosTrabajadosSync?.() || Promise.resolve([]),
                SupabaseDataService.getPrestamosSync?.() || Promise.resolve([]),
                SupabaseDataService.getAbonosPrestamosSync?.() || Promise.resolve([]),
                SupabaseDataService.getRecepcionesSync?.() || Promise.resolve([]),
                SupabaseDataService.getEmpresasSync?.() || Promise.resolve([]),
                SupabaseDataService.getBodegasSync?.() || Promise.resolve([])
            ]);

            cache.empresas = smartMerge(cache.empresas, empresas || []);
            cache.bodegas = smartMerge(cache.bodegas, bodegas || []);

            // Helper function for Smart Merge to preserve recent local additions
            const smartMerge = (localCache, fetchedData) => {
                const missingLocals = (localCache || []).filter(localItem => {
                    if (!localItem.id) return false;
                    const isFound = fetchedData.some(fetchedItem => fetchedItem.id === localItem.id);
                    if (!isFound) {
                        const localAge = new Date() - new Date(localItem.created_at || Date.now());
                        return localAge < 30000;
                    }
                    return false;
                });
                return [...missingLocals, ...fetchedData];
            };

            // Actualizar caché preservando creaciones nuevas
            const fetchedClientes = (clientes || []).map(c => normalizeSupabaseData('clientes', c));
            cache.clientes = smartMerge(cache.clientes, fetchedClientes);

            const fetchedContratos = (contratos || []).map(c => ({ ...normalizeSupabaseData('contratos', c), cliente: normalizeSupabaseData('clientes', c.cliente) }));
            cache.contratos = smartMerge(cache.contratos, fetchedContratos);

            const fetchedEquipos = (equipos || []).map(e => ({ ...normalizeSupabaseData('equipos', e), cliente: normalizeSupabaseData('clientes', e.cliente) }));
            cache.equipos = smartMerge(cache.equipos, fetchedEquipos);
            cache.visitas = (visitas || []).map(v => normalizeSupabaseData('visitas', v));
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
            const fetchedRecepciones = (recepciones || []).map(r => ({
                ...r,
                recepcionId: r.codigo_recepcion,
                numero: r.numero_recepcion,
                clienteId: r.cliente_id,
                equipoId: r.equipo_id,
                cliente: r.cliente ? normalizeSupabaseData('clientes', r.cliente) : null,
                equipo: r.equipo ? normalizeSupabaseData('equipos', r.equipo) : null
            }));

            // Smart Merge: Preserve new local items that might not have synced via Supabase replicate yet
            cache.recepciones = smartMerge(cache.recepciones, fetchedRecepciones);
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

            cache.software = (software || []).map(s => ({
                ...normalizeSupabaseData('software', s),
                cliente: s.cliente ? normalizeSupabaseData('clientes', s.cliente) : null
            }));

            cache.ausencias = (ausencias || []).map(a => ({
                ...normalizeSupabaseData('ausencias', a),
                empleadoNombre: a.empleado?.nombre || 'Desconocido'
            }));

            console.log(`✅ DataService: Refresh completo (${cache.proformas.length} Proformas, ${cache.clientes.length} Clientes)`);

            // Sincronizar configuracion POS si está disponible
            await syncPOSConfig();

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
            "recepciones": { create: true, read: true, update: true, delete: true },
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
            "recepciones": { create: false, read: true, update: false, delete: false },
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
    let _realtimeTimeout = null;
    const handleRealtimeUpdate = (payload) => {
        try {
            const { table, eventType } = payload;
            console.log(`🔄 Realtime: ${eventType} detectado en ${table}. Sincronizando sistema...`);

            // Evitar múltiples llamadas al cargar muchos datos juntos (debounce)
            if (_realtimeTimeout) clearTimeout(_realtimeTimeout);

            _realtimeTimeout = setTimeout(async () => {
                // Hacer un refresco global de todos los datos y actualizar UI
                const success = await refreshData();
                if (success && typeof App !== 'undefined' && App.refreshCurrentModule) {
                    App.refreshCurrentModule();
                }
            }, 1500); // 1.5s delay permite que múltiples inserts de la app móvil terminen de llegar

        } catch (e) {
            console.error('Realtime Sync Error:', e);
        }
    };

    // ========== SYNC POS CONFIG ==========
    const syncPOSConfig = async () => {
        try {
            if(typeof SupabaseDataService !== 'undefined' && SupabaseDataService.getConfiguracionPosSync) {
                const posConfigs = await SupabaseDataService.getConfiguracionPosSync();
                
                // Multi-Empresa: sufijo para aislar config POS en localStorage
                const empresaSuffix = (() => {
                    try {
                        const user = typeof State !== 'undefined' && State.getCurrentUser ? State.getCurrentUser() : null;
                        return user?.empresa_id ? '_' + user.empresa_id.substring(0, 8) : '';
                    } catch { return ''; }
                })();
                
                if(posConfigs && posConfigs.length > 0) {
                    const grouped = {
                        pos_divisas: [],
                        pos_transferencias: [],
                        pos_tarjetas: [],
                        pos_tarjetas_asumir: [],
                        pos_extrafinanciamiento: [],
                        pos_lista_precios: []
                    };
                    posConfigs.forEach(c => {
                        if(grouped[c.tipo]) {
                            const dataWithId = { ...c.datos, id: c.id };
                            grouped[c.tipo].push(dataWithId);
                        }
                    });
                    for(const key in grouped) {
                        localStorage.setItem(key + empresaSuffix, JSON.stringify(grouped[key]));
                    }
                } else {
                    // Sin configs, limpiar las claves para esta empresa
                    const keys = ['pos_divisas', 'pos_transferencias', 'pos_tarjetas', 'pos_tarjetas_asumir', 'pos_extrafinanciamiento', 'pos_lista_precios'];
                    keys.forEach(key => localStorage.setItem(key + empresaSuffix, '[]'));
                }
            }
        } catch(e) {
            console.error('Error syncing POS config:', e);
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
                    (c.correo || '').toLowerCase().includes(s) ||
                    (c.clienteId || '').toLowerCase().includes(s);
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
                    (c.numero_contrato || '').toLowerCase().includes(s) ||
                    (cliente?.empresa || '').toLowerCase().includes(s) ||
                    (cliente?.nombreCliente || '').toLowerCase().includes(s) ||
                    (cliente?.clienteId || '').toLowerCase().includes(s);
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
        const activos = cache.contratos.filter(c => (c.estadoContrato || '').toUpperCase() === 'ACTIVO').length;
        const vencidos = cache.contratos.filter(c => (c.estadoContrato || '').toUpperCase() === 'VENCIDO').length;
        const now = new Date();
        const porVencer = cache.contratos.filter(c => {
            const fin = new Date(c.fechaFin);
            const diff = (fin - now) / (1000 * 60 * 60 * 24);
            return (c.estadoContrato || '').toUpperCase() === 'ACTIVO' && diff <= 30 && diff > 0;
        }).length;
        return { activos, vencidos, porVencer, ingresosMensuales: 0 };
    };

    const getContratosProximosAVencer = () => {
        const now = new Date();
        return cache.contratos.filter(c => {
            const fin = new Date(c.fechaFin);
            const diff = (fin - now) / (1000 * 60 * 60 * 24);
            return (c.estadoContrato || '').toUpperCase() === 'ACTIVO' && diff <= cache.config.diasAnticipacion && diff > 0;
        });
    };

    // ========== CRUD EQUIPOS ==========
    const getEquiposSync = () => [...cache.equipos];
    const getEquiposFiltered = (filter) => {
        return cache.equipos.filter(e => {
            let matches = true;
            if (filter.search) {
                const s = filter.search.toLowerCase();
                const cliente = getClienteById(e.clienteId);
                matches = (e.nombreEquipo || '').toLowerCase().includes(s) ||
                    (e.marca || '').toLowerCase().includes(s) ||
                    (e.modelo || '').toLowerCase().includes(s) ||
                    (e.serie || '').toLowerCase().includes(s) ||
                    (e.numeroSerie || '').toLowerCase().includes(s) ||
                    (e.numero_serie || '').toLowerCase().includes(s) ||
                    (e.equipoId || '').toLowerCase().includes(s) ||
                    (cliente?.empresa || '').toLowerCase().includes(s) ||
                    (cliente?.nombreCliente || '').toLowerCase().includes(s);
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
        operativos: cache.equipos.filter(e => (e.estado || '').toUpperCase() === 'OPERATIVO').length,
        total: cache.equipos.length,
        enReparacion: cache.equipos.filter(e => (e.estado || '').toUpperCase() === 'EN REPARACIÓN' || (e.estado || '').toUpperCase() === 'EN REPARACION').length
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
                    (v.numero_visita || '').toLowerCase().includes(s) ||
                    (cliente?.empresa || '').toLowerCase().includes(s) ||
                    (cliente?.nombreCliente || '').toLowerCase().includes(s) ||
                    (cliente?.clienteId || '').toLowerCase().includes(s);
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

    const getVisitasByContrato = (contratoId) => {
        if (!contratoId) return [];
        return (cache.visitas || []).filter(v => v.contratoId === contratoId || v.contrato_id === contratoId || v.contrato?.id === contratoId || v.contrato?.contratoId === contratoId);
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
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        
        // Mes anterior para comparación
        const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

        // Calcular estadísticas localmente desde el caché
        const clientesActivos = cache.clientes.filter(c => {
            const estado = (c.estado || c.status || '').toUpperCase();
            return estado === 'ACTIVO';
        }).length;

        // Clientes del mes actual y anterior
        const clientesEsteMes = cache.clientes.filter(c => {
            const fecha = new Date(c.fechaCreacion || c.fecha_creacion || c.created_at || c.createdAt);
            return fecha.getMonth() === currentMonth && fecha.getFullYear() === currentYear;
        }).length;
        
        const clientesMesAnterior = cache.clientes.filter(c => {
            const fecha = new Date(c.fechaCreacion || c.fecha_creacion || c.created_at || c.createdAt);
            return fecha.getMonth() === prevMonth && fecha.getFullYear() === prevYear;
        }).length;

        const equiposActivos = cache.equipos.length;

        const recepcionesActivas = cache.recepciones?.filter(r => r.estado !== 'Entregado').length || 0;

        const proformasActivas = cache.proformas?.filter(p => p.estado === 'Activa' || p.estado === 'Aprobada').length || 0;

        const contratosActivos = cache.contratos.filter(c => {
            const estado = (c.estadoContrato || c.estado_contrato || c.status || '').toUpperCase();
            return estado === 'ACTIVO';
        }).length;

        // Visitas del mes actual
        const visitasMes = cache.visitas.filter(v => {
            const visitaDate = new Date(v.fechaInicio || v.fecha_inicio || v.fecha);
            return visitaDate.getMonth() === currentMonth && visitaDate.getFullYear() === currentYear;
        }).length;

        // Visitas del mes anterior
        const visitasMesAnterior = cache.visitas.filter(v => {
            const visitaDate = new Date(v.fechaInicio || v.fecha_inicio || v.fecha);
            return visitaDate.getMonth() === prevMonth && visitaDate.getFullYear() === prevYear;
        }).length;

        // Calcular ingresos del mes desde contratos activos
        const ingresosMes = cache.contratos
            .filter(c => {
                const estado = (c.estadoContrato || c.estado_contrato || c.status || '').toUpperCase();
                return estado === 'ACTIVO';
            })
            .reduce((sum, c) => {
                const valor = parseFloat(c.valorContrato || c.valor_contrato || c.valor || 0);
                return sum + valor;
            }, 0);

        // Función para calcular tendencia
        const calcTrend = (current, previous) => {
            if (previous === 0) return current > 0 ? 100 : 0;
            return Math.round(((current - previous) / previous) * 100 * 10) / 10;
        };

        const serviciosTrend = calcTrend(visitasMes, visitasMesAnterior);
        const clientesTrend = calcTrend(clientesEsteMes, clientesMesAnterior);

        return {
            clientesActivos: {
                value: clientesActivos || 0,
                trend: clientesTrend || 0,
                trendDirection: clientesTrend >= 0 ? 'up' : 'down',
                newThisMonth: clientesEsteMes
            },
            equiposActivos: {
                value: equiposActivos || 0,
                trend: equiposActivos > 0 ? 5 : 0,
                trendDirection: 'up'
            },
            recepcionesActivas: {
                value: recepcionesActivas || 0,
                trend: recepcionesActivas > 0 ? 8 : 0,
                trendDirection: 'up'
            },
            proformasActivas: {
                value: proformasActivas || 0,
                trend: proformasActivas > 0 ? 10 : 0,
                trendDirection: 'up'
            },
            serviciosMes: {
                value: visitasMes || 0,
                trend: serviciosTrend || 0,
                trendDirection: serviciosTrend >= 0 ? 'up' : 'down'
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
            },
            // Datos adicionales para analytics
            comparacion: {
                visitasActual: visitasMes,
                visitasAnterior: visitasMesAnterior,
                clientesActual: clientesEsteMes,
                clientesAnterior: clientesMesAnterior
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
        let startDate, endDate, prevStartDate, prevEndDate;

        // Calcular período actual
        if (filter.periodo === 'custom') {
            startDate = filter.fechaInicio ? new Date(filter.fechaInicio + 'T00:00:00') : null;
            endDate = filter.fechaFin ? new Date(filter.fechaFin + 'T23:59:59') : null;
            // Período anterior (misma duración)
            if (startDate && endDate) {
                const diffTime = endDate - startDate;
                prevEndDate = new Date(startDate.getTime() - 1);
                prevStartDate = new Date(prevEndDate.getTime() - diffTime);
            }
        } else {
            endDate = new Date();
            startDate = new Date();
            if (filter.periodo === 'week') {
                startDate.setDate(today.getDate() - 7);
                prevEndDate = new Date(startDate.getTime() - 1);
                prevStartDate = new Date(today.getTime() - 14);
            } else if (filter.periodo === 'quarter') {
                startDate.setMonth(today.getMonth() - 3);
                prevEndDate = new Date(startDate.getTime() - 1);
                prevStartDate = new Date(today.getFullYear(), today.getMonth() - 6, 1);
            } else if (filter.periodo === 'year') {
                startDate.setFullYear(today.getFullYear() - 1);
                prevEndDate = new Date(startDate.getTime() - 1);
                prevStartDate = new Date(today.getFullYear() - 2, today.getMonth(), 1);
            } else { // month
                startDate.setMonth(today.getMonth() - 1);
                prevEndDate = new Date(startDate.getTime() - 1);
                prevStartDate = new Date(today.getFullYear(), today.getMonth() - 2, 1);
            }
        }

        const filterVisitas = (start, end) => (cache.visitas || []).filter(v => {
            if (!v.fechaInicio && !v.fecha) return false;
            const date = new Date(v.fechaInicio || v.fecha);
            return (!start || date >= start) && (!end || date <= end);
        });

        // Período actual
        const currentVisitas = filterVisitas(startDate, endDate);
        // Período anterior para comparación
        const prevVisitas = prevStartDate && prevEndDate ? filterVisitas(prevStartDate, prevEndDate) : [];

        const totalClientes = cache.clientes.length;
        const totalServicios = currentVisitas.length;
        const prevServicios = prevVisitas.length;

        // Calcular tendencia real
        const calculateTrend = (current, previous) => {
            if (previous === 0) return current > 0 ? 100 : 0;
            const change = ((current - previous) / previous) * 100;
            return Math.round(change * 10) / 10;
        };

        // Ingresos de contratos activos 
        const ingresosTotales = cache.contratos
            .filter(c => {
                const estado = (c.estadoContrato || c.status || '').toUpperCase();
                return estado === 'ACTIVO';
            })
            .reduce((sum, c) => sum + (parseFloat(c.valorContrato || c.valor || 0)), 0);

        const contratosActivos = cache.contratos.filter(c => {
            const estado = (c.estadoContrato || c.status || '').toUpperCase();
            return estado === 'ACTIVO';
        }).length;

        // Servicios por Técnico
        const tecnicoMap = {};
        currentVisitas.forEach(v => {
            const techObj = cache.users.find(u => u.id === v.usuarioSoporte);
            const t = techObj ? (techObj.name || techObj.username) : (v.usuarioSoporte || 'SIN ASIGNAR');
            tecnicoMap[t] = (tecnicoMap[t] || 0) + 1;
        });
        const serviciosPorTecnico = Object.entries(tecnicoMap)
            .map(([tecnico, count]) => ({ tecnico, count }))
            .sort((a, b) => b.count - a.count);

        // Servicios por Tipo
        const serviciosPorTipo = {
            fisica: currentVisitas.filter(v => (v.tipoVisita || '').toUpperCase() === 'FÍSICA').length,
            remota: currentVisitas.filter(v => (v.tipoVisita || '').toUpperCase() === 'REMOTA').length
        };

        // Contrato vs Eventual
        const contratoVsEventual = {
            contrato: currentVisitas.filter(v => !!v.contratoId).length,
            eventual: currentVisitas.filter(v => !v.contratoId).length
        };

        // Ingresos por Moneda
        const ingresosPorMoneda = {
            usd: ingresosTotales,
            nio: ingresosTotales * (cache.config.tipoCambio || 36.5)
        };

        // Tendencias mensuales para gráfico (últimos 6 meses)
        const monthlyTrends = [];
        for (let i = 5; i >= 0; i--) {
            const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const monthEnd = new Date(today.getFullYear(), today.getMonth() - i + 1, 0);
            const monthVisitas = filterVisitas(monthDate, monthEnd);
            monthlyTrends.push({
                mes: monthDate.toLocaleDateString('es', { month: 'short' }),
                servicios: monthVisitas.length,
                ingresos: monthVisitas.reduce((sum, v) => sum + (parseFloat(v.costoServicio || v.costo || 0)), 0)
            });
        }

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
            estadoEquipos,
            // Nuevas métricas de tendencias
            tendencias: {
                servicios: {
                    actual: totalServicios,
                    anterior: prevServicios,
                    cambio: calculateTrend(totalServicios, prevServicios)
                },
                ingresos: {
                    actual: ingresosTotales,
                    cambio: ingresosTotales > 0 ? 5 : 0
                }
            },
            monthlyTrends
        };
    };

    // Placeholders para módulos no migrados completamente
    const getReparacionesByEquipo = () => [];
    const getReparacionById = () => null;
    const createReparacion = () => { };
    const updateReparacion = () => { };
    const deleteReparacion = () => { };
    const getProductosSync = () => cache.productos.map(p => ({
        ...p,
        nombre: p.nombre || '',
        codigo: p.codigo || '',
        sku: p.sku || p.codigo || '',
        inventario: p.stock ?? p.stockActual ?? p.stock_actual ?? 0,
        precioCompra: p.precioCompra || parseFloat(p.precio_costo) || 0,
        precioVenta: p.precioVenta || parseFloat(p.precio_venta) || p.precio || 0,
        precioVentaA: p.precioVentaA || p.precioVenta || parseFloat(p.precio_venta) || 0,
        stock: p.stock ?? p.stockActual ?? p.stock_actual ?? 0,
        inventarioMinimo: p.inventarioMinimo || p.stock_minimo || 0,
        inventarioMaximo: p.inventarioMaximo || p.inventario_maximo || 0,
        codigoAlt: p.codigoAlt || p.codigo_alternativo || '',
        ventaGranel: p.ventaGranel || (p.venta_granel ? 'true' : 'false'),
        usaSeriales: p.usaSeriales || (p.usa_seriales ? 'true' : 'false'),
        tipoSeguimiento: p.tipoSeguimiento || p.tipo_seguimiento || '',
        descMaxTipo: p.descMaxTipo || p.descuento_max_tipo || 'porcentaje',
        descMaxValor: parseFloat(p.descMaxValor || p.descuento_max_valor || 0)
    }));
    const getProductosFiltered = (filter = {}) => {
        return cache.productos.filter(p => {
            let matches = true;
            if (filter.search) {
                const s = filter.search.toLowerCase();
                matches = (p.nombre || '').toLowerCase().includes(s) ||
                    (p.codigo || '').toLowerCase().includes(s) ||
                    (p.descripcion || '').toLowerCase().includes(s) ||
                    (p.categoria || '').toLowerCase().includes(s) ||
                    (p.productoId || '').toLowerCase().includes(s);
            }
            if (filter.tipo && filter.tipo !== 'all') matches = matches && p.tipo === filter.tipo;
            if (filter.estado && filter.estado !== 'all') matches = matches && p.estado === filter.estado;
            return matches;
        });
    };
    const getProductoById = (id) => {
        const p = cache.productos.find(x => x.productoId === id || x.id === id);
        if (!p) return null;
        return {
            ...p,
            precioCompra: p.precioCompra || parseFloat(p.precio_costo) || 0,
            precioVenta: p.precioVenta || parseFloat(p.precio_venta) || p.precio || 0,
            stock: p.stock ?? p.stock_actual ?? 0,
            inventarioMinimo: p.inventarioMinimo || p.stock_minimo || 0,
            inventarioMaximo: p.inventarioMaximo || p.inventario_maximo || 0,
            codigoAlt: p.codigoAlt || p.codigo_alternativo || '',
            ventaGranel: p.ventaGranel || (p.venta_granel ? 'true' : 'false'),
            usaSeriales: p.usaSeriales || (p.usa_seriales ? 'true' : 'false'),
            tipoSeguimiento: p.tipoSeguimiento || p.tipo_seguimiento || '',
            descMaxTipo: p.descMaxTipo || p.descuento_max_tipo || 'porcentaje',
            descMaxValor: parseFloat(p.descMaxValor || p.descuento_max_valor || 0)
        };
    };

    const createProducto = async (data) => {
        const res = await SupabaseDataService.createProducto(data);
        if (res.success) {
            const item = {
                ...res.data,
                productoId: res.data.id,
                precio: parseFloat(res.data.precio_venta) || 0,
                precioCompra: parseFloat(res.data.precio_costo) || 0,
                precioVenta: parseFloat(res.data.precio_venta) || 0,
                stock: parseInt(res.data.stock_actual) || 0,
                inventarioMinimo: parseInt(res.data.stock_minimo) || 0,
                inventarioMaximo: parseInt(res.data.inventario_maximo) || 0,
                codigoAlt: res.data.codigo_alternativo || '',
                ventaGranel: res.data.venta_granel ? 'true' : 'false',
                usaSeriales: res.data.usa_seriales ? 'true' : 'false',
                tipoSeguimiento: res.data.tipo_seguimiento || '',
                descMaxTipo: res.data.descuento_max_tipo || 'porcentaje',
                descMaxValor: parseFloat(res.data.descuento_max_valor || 0)
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
        const res = await SupabaseDataService.updateProducto(id, data);
        if (res.success) {
            const idx = cache.productos.findIndex(p => p.id === id || p.productoId === id);
            if (idx >= 0) {
                const udData = res.data ? res.data[0] || res.data : data;
                cache.productos[idx] = {
                    ...cache.productos[idx],
                    ...udData,
                    precioCompra: parseFloat(udData.precio_costo || udData.precioCompra || cache.productos[idx].precioCompra) || 0,
                    precioVenta: parseFloat(udData.precio_venta || udData.precioVenta || cache.productos[idx].precioVenta) || 0,
                    stock: parseInt(udData.stock_actual || udData.stock || cache.productos[idx].stock) || 0,
                    inventarioMinimo: parseInt(udData.stock_minimo || udData.inventarioMinimo || cache.productos[idx].inventarioMinimo) || 0,
                    inventarioMaximo: parseInt(udData.inventario_maximo || udData.inventarioMaximo || cache.productos[idx].inventarioMaximo) || 0,
                    codigoAlt: udData.codigo_alternativo || udData.codigoAlt || cache.productos[idx].codigoAlt || '',
                    ventaGranel: udData.venta_granel ? 'true' : (udData.ventaGranel || cache.productos[idx].ventaGranel || 'false'),
                    usaSeriales: udData.usa_seriales ? 'true' : (udData.usaSeriales || cache.productos[idx].usaSeriales || 'false'),
                    tipoSeguimiento: udData.tipo_seguimiento || udData.tipoSeguimiento || cache.productos[idx].tipoSeguimiento || '',
                    descMaxTipo: udData.descuento_max_tipo || udData.descMaxTipo || cache.productos[idx].descMaxTipo || 'porcentaje',
                    descMaxValor: parseFloat(udData.descuento_max_valor || udData.descMaxValor || cache.productos[idx].descMaxValor || 0)
                };
                LogService.log('productos', 'update', id, `Producto actualizado: ${cache.productos[idx].nombre}`);
            }
            return res.success;
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
                    (s.softwareId || '').toLowerCase().includes(term) ||
                    clienteNombre.toLowerCase().includes(term) ||
                    (s.cliente?.clienteId || '').toLowerCase().includes(term);
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
                    (cliente?.empresa || '').toLowerCase().includes(s) ||
                    (cliente?.nombreCliente || '').toLowerCase().includes(s) ||
                    (cliente?.clienteId || '').toLowerCase().includes(s);
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

        const userState = typeof State !== 'undefined' ? State.get('user') : null;

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
            estado: 'Activa',
            creado_por_nombre: userState?.name || 'Sistema'
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
    // ========== RECEPCIONES DE EQUIPOS ==========
    const getRecepcionesSync = () => [...(cache.recepciones || [])];

    const getRecepcionesFiltered = (filter = {}) => {
        let list = getRecepcionesSync();
        if (filter.search) {
            const q = filter.search.toLowerCase();
            list = list.filter(r =>
                (r.numero_recepcion && r.numero_recepcion.toString().includes(q)) ||
                (r.codigo_recepcion && r.codigo_recepcion.toLowerCase().includes(q)) ||
                (r.cliente?.nombre_cliente?.toLowerCase().includes(q)) ||
                (r.equipo?.nombre_equipo?.toLowerCase().includes(q)) ||
                (r.equipo?.numero_serie?.toLowerCase().includes(q))
            );
        }
        if (filter.estado && filter.estado !== 'all') {
            list = list.filter(r => r.estado === filter.estado);
        }
        return list;
    };

    const getRecepcionById = (id) => cache.recepciones?.find(r => r.id === id || r.recepcionId === id);
    const getRecepcionesByCliente = (clienteId) => cache.recepciones?.filter(r => r.clienteId === clienteId || r.cliente?.id === clienteId || r.cliente?.clienteId === clienteId);
    const getRecepcionesByEquipo = (equipoId) => cache.recepciones?.filter(r => r.equipoId === equipoId || r.equipo_id === equipoId || r.equipo?.id === equipoId || r.equipo?.equipoId === equipoId) || [];

    const createRecepcion = async (data) => {
        const res = await SupabaseDataService.createRecepcion(data);
        if (res.success) {
            const item = { ...res.data };
            item.recepcionId = item.codigo_recepcion;
            item.numero = item.numero_recepcion;
            item.clienteId = item.cliente_id;
            item.equipoId = item.equipo_id;

            // Attach relationships manually for immediate cache availability
            item.cliente = getClienteById(item.clienteId) || null;
            item.equipo = getEquipoById(item.equipoId) || null;

            if (!cache.recepciones) cache.recepciones = [];

            // Remove any potential locally duplicated row with same ID
            cache.recepciones = cache.recepciones.filter(r => r.id !== item.id);
            cache.recepciones.unshift(item);

            // No triggeramos refreshData inmediatamente para evitar race conditions con Supabase Realtime
            // refreshData();

            return item;
        }
        throw new Error(res.error || 'Error al crear recepción');
    };

    const updateRecepcion = async (id, data) => {
        const current = getRecepcionById(id);
        const uuid = current ? current.id : id;
        const res = await SupabaseDataService.updateRecepcion(uuid, data);
        if (res.success) {
            if (cache.recepciones) {
                const idx = cache.recepciones.findIndex(r => r.id === uuid || r.recepcionId === id);
                if (idx !== -1) {
                    const updated = { ...cache.recepciones[idx], ...res.data };
                    // Ensure core fields are mirrored if they changed
                    updated.clienteId = updated.cliente_id || updated.clienteId;
                    updated.equipoId = updated.equipo_id || updated.equipoId;
                    updated.cliente = getClienteById(updated.clienteId) || updated.cliente;
                    updated.equipo = getEquipoById(updated.equipoId) || updated.equipo;
                    cache.recepciones[idx] = updated;
                }
            }
            refreshData();
            return true;
        }
        throw new Error(res.error || 'Error al actualizar recepción');
    };

    const deleteRecepcion = async (id) => {
        const current = getRecepcionById(id);
        const uuid = current ? current.id : id;
        const res = await SupabaseDataService.deleteRecepcion(uuid);
        if (res.success) {
            cache.recepciones = cache.recepciones.filter(r => r.id !== uuid);
            return true;
        }
        throw new Error(res.error || 'Error al eliminar recepción');
    };

    const getRecepcionesStats = () => ({
        total: cache.recepciones?.length || 0,
        pendientes: cache.recepciones?.filter(r => r.estado === 'Recibido').length || 0,
        enRevision: cache.recepciones?.filter(r => r.estado === 'En Revisión').length || 0,
        esperandoAprobacion: cache.recepciones?.filter(r => r.estado === 'Esperando Aprobación').length || 0,
        diagnosticado: cache.recepciones?.filter(r => r.estado === 'Diagnosticado').length || 0,
        entregado: cache.recepciones?.filter(r => r.estado === 'Entregado').length || 0
    });

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

    // ========== CONTRACT TEMPLATES ==========
    const getContractTemplates = () => {
        try {
            if (!cache.contractTemplates || cache.contractTemplates.length === 0) {
                const stored = localStorage.getItem('alltech_contract_templates');
                if (stored) cache.contractTemplates = JSON.parse(stored);
            }
        } catch (e) { }
        return cache.contractTemplates || [];
    };

    const getContractTemplateById = (id) => {
        const templates = getContractTemplates();
        return templates.find(t => t.id === id);
    };

    const saveContractTemplate = (template) => {
        const templates = getContractTemplates();
        const idx = templates.findIndex(t => t.id === template.id);
        if (idx !== -1) templates[idx] = template;
        else templates.push(template);
        cache.contractTemplates = templates;
        try { localStorage.setItem('alltech_contract_templates', JSON.stringify(templates)); } catch (e) { }
        return true;
    };

    const deleteContractTemplate = (id) => {
        let templates = getContractTemplates();
        templates = templates.filter(t => t.id !== id);
        cache.contractTemplates = templates;
        try { localStorage.setItem('alltech_contract_templates', JSON.stringify(templates)); } catch (e) { }
        return true;
    };

    const resetData = () => location.reload();


    
    // ========== CRUD PROVEEDORES ==========
    const getProveedoresSync = () => [...cache.proveedores];
    const getProveedorById = (id) => cache.proveedores.find(p => p.id === id);
    const createProveedor = async (prov) => {
        const created = await SupabaseDataService.createProveedor(prov);
        const norm = normalizeSupabaseData('proveedores', created);
        cache.proveedores.push(norm);
        notifySubscribers();
        return norm;
    };
    const updateProveedor = async (id, prov) => {
        const updated = await SupabaseDataService.updateProveedor(id, prov);
        const norm = normalizeSupabaseData('proveedores', updated);
        const idx = cache.proveedores.findIndex(p => p.id === id);
        if (idx !== -1) {
            cache.proveedores[idx] = { ...cache.proveedores[idx], ...norm };
            notifySubscribers();
        }
        return norm;
    };
    const deleteProveedor = async (id) => {
        await SupabaseDataService.deleteProveedor(id);
        cache.proveedores = cache.proveedores.filter(p => p.id !== id);
        notifySubscribers();
        return true;
    };
return {

        init,
        refreshData,
        isRefreshing: () => isRefreshing,
        handleRealtimeUpdate,

        // Clientes
        getClientesSync, getClientesFiltered, getClienteById, createCliente, updateCliente, deleteCliente,

        // Contratos
        getContratosSync, getContratosFiltered, getContratoById, getContratosByCliente, createContrato, updateContrato, deleteContrato, getContratosStats, getContratosProximosAVencer,
        getContractTemplates, getContractTemplateById, saveContractTemplate, deleteContractTemplate,

        // Equipos
        getEquiposSync, getEquiposFiltered, getEquipoById, getEquiposByCliente, createEquipo, updateEquipo, deleteEquipo, getEquiposStats, getHistorialEquipo,

        // Recepciones
        getRecepcionesSync, getRecepcionesFiltered, getRecepcionById, getRecepcionesByCliente, getRecepcionesByEquipo, createRecepcion, updateRecepcion, deleteRecepcion, getRecepcionesStats,

        // Visitas
        getVisitasSync, getVisitasFiltered, getVisitaById, getVisitasByCliente, getVisitasByContrato, getVisitasByMonth, createVisita, updateVisita, deleteVisita, getVisitasStats,

        // Config & Auth
        getConfig, updateConfig, getUsers, getUsersSync, getUserByUsername, createUser, updateUser, deleteUser, authenticateUser,
        getPermissions, getRolePermissions, updateRolePermissions, canPerformAction, getAvailableRoles,

        // Dashboard & Others
        getDashboardStats, getRecentActivities, getChartData, getSavingsPlans, getBankAccounts,
        getReportesStats, resetData, exportAllData: () => cache,

        // Placeholders
        getReparacionesByEquipo, getReparacionById, createReparacion, updateReparacion, deleteReparacion,
        getProductosSync, getProductosFiltered, getProductoById,
        getProductoByCodigoAndEmpresa: async (codigo, codigoAlt, empresaId, nombre = null) => {
            if (typeof SupabaseDataService !== 'undefined' && SupabaseDataService.getProductoByCodigoAndEmpresa) {
                return await SupabaseDataService.getProductoByCodigoAndEmpresa(codigo, codigoAlt, empresaId, nombre);
            }
            return null;
        },
        createProducto, updateProducto, deleteProducto,
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
        createPagoTecnico: async (data, visitaIds = [], recepcionIds = []) => {
            const res = await SupabaseDataService.createPagoTecnico(data);
            if (res.success) {
                const pagoId = res.data.id;
                // 1. Marcar visitas como pagadas en DB
                if (visitaIds && visitaIds.length > 0) {
                    await SupabaseDataService.marcarVisitasComoPagadas(pagoId, visitaIds);
                    // Actualizar cache local de visitas
                    visitaIds.forEach(vId => {
                        const visita = cache.visitas.find(v => v.id === vId);
                        if (visita) visita.pago_id = pagoId;
                    });
                }

                // 2. Marcar recepciones como pagadas en DB
                if (recepcionIds && recepcionIds.length > 0) {
                    await SupabaseDataService.marcarRecepcionesComoPagadas(pagoId, recepcionIds);
                    // Actualizar cache local de recepciones
                    recepcionIds.forEach(rId => {
                        const recepcion = cache.recepciones.find(r => r.id === rId);
                        if (recepcion) recepcion.pago_id = pagoId;
                    });
                }

                // Actualizar cache de pagos
                const newPago = {
                    ...res.data,
                    tecnico: cache.users.find(u => u.id === data.tecnico_id) || null,
                    tecnicoNombre: cache.users.find(u => u.id === data.tecnico_id)?.name || 'Desconocido'
                };
                cache.pagosTecnicos.unshift(newPago);

                return res.data;
            }
            throw new Error(res.error);
        },
        deletePagoTecnico: async (pagoId) => {
            const res = await SupabaseDataService.deletePagoTecnico(pagoId);
            if (res.success) {
                // Restaurar pago_id en cache de visitas y recepciones
                cache.visitas.forEach(v => {
                    if (v.pago_id === pagoId) v.pago_id = null;
                });
                cache.recepciones.forEach(r => {
                    if (r.pago_id === pagoId) r.pago_id = null;
                });
                // Eliminar el pago del cache
                cache.pagosTecnicos = cache.pagosTecnicos.filter(p => p.id !== pagoId);
                return true;
            }
            throw new Error(res.error || 'Error al eliminar pago');
        },
        getVisitasPorTecnico: (id, filter) => SupabaseDataService.getVisitasPorTecnico(id, filter),
        getAntiguedadTecnico: (id) => SupabaseDataService.getAntiguedadTecnico(id),

        // Prestaciones Complementos
        getHorasExtrasSync: () => [...(cache.horasExtras || [])],
        createHoraExtra: async (data) => {
            const res = await SupabaseDataService.createHoraExtra(data);
            if (res.success) { cache.horasExtras.unshift(res.data); return res.data; }
            throw new Error(res.error);
        },
        updateHoraExtra: async (id, data) => {
            const res = await SupabaseDataService.updateHoraExtra(id, data);
            if (res.success) {
                const idx = cache.horasExtras.findIndex(x => x.id === id);
                if (idx !== -1) cache.horasExtras[idx] = { ...cache.horasExtras[idx], ...res.data };
                return res.data;
            }
            throw new Error(res.error);
        },
        deleteHoraExtra: async (id) => {
            const res = await SupabaseDataService.deleteHoraExtra(id);
            if (res.success) { cache.horasExtras = cache.horasExtras.filter(x => x.id !== id); return true; }
            throw new Error(res.error);
        },

        getBonificacionesSync: () => [...(cache.bonificaciones || [])],
        createBonificacion: async (data) => {
            const res = await SupabaseDataService.createBonificacion(data);
            if (res.success) { cache.bonificaciones.unshift(res.data); return res.data; }
            throw new Error(res.error);
        },
        updateBonificacion: async (id, data) => {
            const res = await SupabaseDataService.updateBonificacion(id, data);
            if (res.success) {
                const idx = cache.bonificaciones.findIndex(x => x.id === id);
                if (idx !== -1) cache.bonificaciones[idx] = { ...cache.bonificaciones[idx], ...res.data };
                return res.data;
            }
            throw new Error(res.error);
        },
        deleteBonificacion: async (id) => {
            const res = await SupabaseDataService.deleteBonificacion(id);
            if (res.success) { cache.bonificaciones = cache.bonificaciones.filter(x => x.id !== id); return true; }
            throw new Error(res.error);
        },

        getAdelantosSync: () => [...(cache.adelantos || [])],
        createAdelanto: async (data) => {
            const res = await SupabaseDataService.createAdelanto(data);
            if (res.success) { cache.adelantos.unshift(res.data); return res.data; }
            throw new Error(res.error);
        },
        updateAdelanto: async (id, data) => {
            const res = await SupabaseDataService.updateAdelanto(id, data);
            if (res.success) {
                const idx = cache.adelantos.findIndex(x => x.id === id);
                if (idx !== -1) cache.adelantos[idx] = { ...cache.adelantos[idx], ...res.data };
                return res.data;
            }
            throw new Error(res.error);
        },
        deleteAdelanto: async (id) => {
            const res = await SupabaseDataService.deleteAdelanto(id);
            if (res.success) { cache.adelantos = cache.adelantos.filter(x => x.id !== id); return true; }
            throw new Error(res.error);
        },

        getFeriadosTrabajadosSync: () => [...(cache.feriadosTrabajados || [])],
        createFeriadoTrabajado: async (data) => {
            const res = await SupabaseDataService.createFeriadoTrabajado(data);
            if (res.success) { cache.feriadosTrabajados.unshift(res.data); return res.data; }
            throw new Error(res.error);
        },
        updateFeriadoTrabajado: async (id, data) => {
            const res = await SupabaseDataService.updateFeriadoTrabajado(id, data);
            if (res.success) {
                const idx = cache.feriadosTrabajados.findIndex(x => x.id === id);
                if (idx !== -1) cache.feriadosTrabajados[idx] = { ...cache.feriadosTrabajados[idx], ...res.data };
                return res.data;
            }
            throw new Error(res.error);
        },
        deleteFeriadoTrabajado: async (id) => {
            const res = await SupabaseDataService.deleteFeriadoTrabajado(id);
            if (res.success) { cache.feriadosTrabajados = cache.feriadosTrabajados.filter(x => x.id !== id); return true; }
            throw new Error(res.error);
        },

        getPrestamosSync: () => [...(cache.prestamosEmpleados || [])],
        createPrestamo: async (data) => {
            const res = await SupabaseDataService.createPrestamo(data);
            if (res.success) { cache.prestamosEmpleados.unshift(res.data); return res.data; }
            throw new Error(res.error);
        },
        updatePrestamo: async (id, data) => {
            const res = await SupabaseDataService.updatePrestamo(id, data);
            if (res.success) {
                const idx = cache.prestamosEmpleados.findIndex(x => x.id === id);
                if (idx !== -1) cache.prestamosEmpleados[idx] = { ...cache.prestamosEmpleados[idx], ...res.data };
                return res.data;
            }
            throw new Error(res.error);
        },
        deletePrestamo: async (id) => {
            const res = await SupabaseDataService.deletePrestamo(id);
            if (res.success) { cache.prestamosEmpleados = cache.prestamosEmpleados.filter(x => x.id !== id); return true; }
            throw new Error(res.error);
        },

        getAbonosPrestamosSync: () => [...(cache.abonosPrestamos || [])],
        createAbonoPrestamo: async (data) => {
            const res = await SupabaseDataService.createAbonoPrestamo(data);
            if (res.success) { cache.abonosPrestamos.unshift(res.data); return res.data; }
            throw new Error(res.error);
        },
        updateAbonoPrestamo: async (id, data) => {
            const res = await SupabaseDataService.updateAbonoPrestamo(id, data);
            if (res.success) {
                const idx = cache.abonosPrestamos.findIndex(x => x.id === id);
                if (idx !== -1) cache.abonosPrestamos[idx] = { ...cache.abonosPrestamos[idx], ...res.data };
                return res.data;
            }
            throw new Error(res.error);
        },
        deleteAbonoPrestamo: async (id) => {
            const res = await SupabaseDataService.deleteAbonoPrestamo(id);
            if (res.success) { cache.abonosPrestamos = cache.abonosPrestamos.filter(x => x.id !== id); return true; }
            throw new Error(res.error);
        },

        // Storage
        uploadImage: async (bucket, file) => {
            if (typeof SupabaseDataService !== 'undefined' && SupabaseDataService.uploadImage) {
                return await SupabaseDataService.uploadImage(bucket, file);
            }
            throw new Error('Supabase no disponible para subir imagenes');
        },

        // Empresas y Bodegas
        getEmpresasSync: () => [...(cache.empresas || [])],
        getBodegasSync: () => [...(cache.bodegas || [])],
        createEmpresa: async (data) => {
            const res = await SupabaseDataService.createEmpresa(data);
            if (res.success) { cache.empresas.push(res.data); return res.data; }
            throw new Error(res.error);
        },
        createBodega: async (data) => {
            const res = await SupabaseDataService.createBodega(data);
            if (res.success) { cache.bodegas.push(res.data); return res.data; }
            throw new Error(res.error);
        },
        updateEmpresa: async (id, dataObj) => {
            const res = await SupabaseDataService.updateEmpresa(id, dataObj);
            if (res.success) {
                const idx = cache.empresas.findIndex(e => e.id === id);
                if (idx >= 0) cache.empresas[idx] = { ...cache.empresas[idx], ...dataObj };
                return res.data;
            }
            throw new Error(res.error);
        },
        updateBodega: async (id, dataObj) => {
            const res = await SupabaseDataService.updateBodega(id, dataObj);
            if (res.success) {
                const idx = cache.bodegas.findIndex(b => b.id === id);
                if (idx >= 0) cache.bodegas[idx] = { ...cache.bodegas[idx], ...dataObj };
                return res.data;
            }
            throw new Error(res.error);
        },
        deleteBodega: async (id) => {
            const res = await SupabaseDataService.deleteBodega(id);
            if (res.success) {
                cache.bodegas = cache.bodegas.filter(b => b.id !== id);
                return true;
            }
            throw new Error(res.error);
        },

        // Multi-Empresa Helper
        getActiveEmpresaId: () => {
            if (typeof SupabaseDataService !== 'undefined' && SupabaseDataService.getActiveEmpresaId) {
                return SupabaseDataService.getActiveEmpresaId();
            }
            if (typeof State !== 'undefined' && State.getCurrentUser) {
                return State.getCurrentUser()?.empresa_id || null;
            }
            return null;
        },

        // ========== EXPORTACIÓN PDF/EXCEL ==========
        exportToExcel: (data, filename, sheetName = 'Datos') => {
            try {
                // Convert data to worksheet
                const headers = Object.keys(data[0] || {});
                const csvContent = [
                    headers.join(','),
                    ...data.map(row => headers.map(h => {
                        let val = row[h];
                        if (val === null || val === undefined) val = '';
                        if (typeof val === 'string' && val.includes(',')) val = `"${val}"`;
                        return val;
                    }).join(','))
                ].join('\n');

                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
                link.click();
                return { success: true };
            } catch (error) {
                console.error('Error exportando Excel:', error);
                return { success: false, error: error.message };
            }
        },

        exportReportToPDF: async (reportType, filters = {}) => {
            try {
                const stats = DataService.getReportesStats(filters);
                const user = State.get('user');
                const fecha = new Date().toLocaleDateString('es-NI');

                let htmlContent = `
                    <html>
                    <head>
                        <title>Reporte ${reportType} - ALLTECH</title>
                        <style>
                            body { font-family: Arial, sans-serif; padding: 20px; }
                            h1 { color: #1a73e8; }
                            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                            th { background: #1a73e8; color: white; }
                            .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 20px 0; }
                            .stat-box { border: 1px solid #ddd; padding: 15px; text-align: center; border-radius: 8px; }
                            .stat-value { font-size: 24px; font-weight: bold; }
                            .stat-label { color: #666; font-size: 12px; }
                        </style>
                    </head>
                    <body>
                        <h1>ALLTECH - Reporte de ${reportType}</h1>
                        <p>Fecha: ${fecha} | Usuario: ${user?.name || user?.username || 'N/A'}</p>
                        <div class="stat-grid">
                            <div class="stat-box"><div class="stat-value">${stats.totalClientes}</div><div class="stat-label">Total Clientes</div></div>
                            <div class="stat-box"><div class="stat-value">${stats.totalServicios}</div><div class="stat-label">Servicios</div></div>
                            <div class="stat-box"><div class="stat-value">$${stats.ingresosTotales?.toFixed(2) || 0}</div><div class="stat-label">Ingresos</div></div>
                            <div class="stat-box"><div class="stat-value">${stats.contratosActivos}</div><div class="stat-label">Contratos Activos</div></div>
                        </div>
                        <h2>Servicios por Técnico</h2>
                        <table>
                            <tr><th>Técnico</th><th>Servicios</th></tr>
                            ${(stats.serviciosPorTecnico || []).map(t => `<tr><td>${t.tecnico}</td><td>${t.count}</td></tr>`).join('')}
                        </table>
                    </body>
                    </html>
                `;

                const printWindow = window.open('', '_blank');
                printWindow.document.write(htmlContent);
                printWindow.document.close();
                printWindow.print();
                return { success: true };
            } catch (error) {
                console.error('Error exportando PDF:', error);
                return { success: false, error: error.message };
            }
        },

        // ========== RESUMEN SEMANAL ==========
        getWeeklySummary: () => {
            const today = new Date();
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay());
            weekStart.setHours(0, 0, 0, 0);

            const lastWeekStart = new Date(weekStart);
            lastWeekStart.setDate(weekStart.getDate() - 7);

            const thisWeekVisitas = cache.visitas.filter(v => {
                const date = new Date(v.fechaInicio || v.fecha);
                return date >= weekStart;
            });

            const lastWeekVisitas = cache.visitas.filter(v => {
                const date = new Date(v.fechaInicio || v.fecha);
                return date >= lastWeekStart && date < weekStart;
            });

            const thisWeekIngresos = thisWeekVisitas.reduce((sum, v) => sum + (parseFloat(v.costoServicio || v.costo || 0)), 0);
            const lastWeekIngresos = lastWeekVisitas.reduce((sum, v) => sum + (parseFloat(v.costoServicio || v.costo || 0)), 0);

            return {
                servicios: {
                    actual: thisWeekVisitas.length,
                    anterior: lastWeekVisitas.length,
                    cambio: lastWeekVisitas.length > 0 ? Math.round(((thisWeekVisitas.length - lastWeekVisitas.length) / lastWeekVisitas.length) * 100) : 0
                },
                ingresos: {
                    actual: thisWeekIngresos,
                    anterior: lastWeekIngresos,
                    cambio: lastWeekIngresos > 0 ? Math.round(((thisWeekIngresos - lastWeekIngresos) / lastWeekIngresos) * 100) : 0
                },
                periodo: {
                    inicio: weekStart.toLocaleDateString('es-NI'),
                    fin: today.toLocaleDateString('es-NI')
                }
            };
        },

        // ========== AUDIT LOG ==========
        addAuditLog: (action, tableName, recordId, oldData = null, newData = null, description = '') => {
            const user = State.get('user');
            const logEntry = {
                id: crypto.randomUUID(),
                action: action, // CREATE, UPDATE, DELETE
                tableName: tableName,
                recordId: recordId,
                oldData: oldData ? JSON.stringify(oldData) : null,
                newData: newData ? JSON.stringify(newData) : null,
                description: description,
                userId: user?.id || null,
                userName: user?.name || user?.username || 'Sistema',
                timestamp: new Date().toISOString()
            };

            if (!cache.auditLog) cache.auditLog = [];
            cache.auditLog.unshift(logEntry);
            if (cache.auditLog.length > 500) cache.auditLog = cache.auditLog.slice(0, 500);

            console.log('📋 Audit Log:', logEntry);
            return logEntry;
        },

        getAuditLog: (filters = {}) => {
            let logs = cache.auditLog || [];

            if (filters.tableName) {
                logs = logs.filter(l => l.tableName === filters.tableName);
            }
            if (filters.action) {
                logs = logs.filter(l => l.action === filters.action);
            }
            if (filters.userId) {
                logs = logs.filter(l => l.userId === filters.userId);
            }
            if (filters.fechaInicio) {
                const start = new Date(filters.fechaInicio);
                logs = logs.filter(l => new Date(l.timestamp) >= start);
            }
            if (filters.fechaFin) {
                const end = new Date(filters.fechaFin);
                end.setHours(23, 59, 59);
                logs = logs.filter(l => new Date(l.timestamp) <= end);
            }

            return logs.slice(0, filters.limit || 100);
        },

        // ========== BACKUP MANUAL ==========
        createManualBackup: () => {
            const backupData = {
                version: '1.0',
                timestamp: new Date().toISOString(),
                user: State.get('user')?.username || 'unknown',
                data: {
                    clientes: cache.clientes,
                    contratos: cache.contratos,
                    visitas: cache.visitas,
                    equipos: cache.equipos,
                    productos: cache.productos,
                    proformas: cache.proformas,
                    pedidos: cache.pedidos,
                    empleados: cache.empleados,
                    recepciones: cache.recepciones,
                    software: cache.software,
                    config: cache.config,
                    auditLog: cache.auditLog || []
                }
            };

            const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `alltech_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
            link.click();

            DataService.addAuditLog('BACKUP', 'system', 'manual', null, { filename: link.download }, 'Creación de backup manual');
            return { success: true, filename: link.download };
        },

        // ========== LIMPIEZA DE DATOS ==========
        findDuplicateRecords: (tableName) => {
            const data = cache[tableName] || [];
            const duplicates = [];
            const seen = new Map();

            const keyFields = {
                clientes: 'correo',
                contratos: ['clienteId', 'fechaInicio'],
                equipos: ['serie', 'clienteId'],
                productos: 'codigo',
                visitas: ['clienteId', 'fechaInicio']
            };

            const keys = keyFields[tableName] || ['id'];
            const isArray = Array.isArray(keys);

            data.forEach((record, index) => {
                const key = isArray ? keys.map(k => record[k]).join('|') : record[keys];
                if (!key) return;

                if (seen.has(key)) {
                    duplicates.push({
                        originalIndex: seen.get(key),
                        duplicateIndex: index,
                        record: record,
                        key: key
                    });
                } else {
                    seen.set(key, index);
                }
            });

            return duplicates;
        },

        findOrphanRecords: () => {
            const orphans = {
                visitas: [],
                equipos: [],
                contratos: []
            };

            // Visitas sin cliente
            cache.visitas?.forEach(v => {
                if (!v.clienteId && !v.cliente_id) {
                    orphans.visitas.push({ ...v, reason: 'Sin cliente asignado' });
                }
            });

            // Equipos sin cliente
            cache.equipos?.forEach(e => {
                if (!e.clienteId && !e.cliente_id) {
                    orphans.equipos.push({ ...e, reason: 'Sin cliente asignado' });
                }
            });

            // Contratos sin cliente
            cache.contratos?.forEach(c => {
                if (!c.clienteId && !c.cliente_id) {
                    orphans.contratos.push({ ...c, reason: 'Sin cliente asignado' });
                }
            });

            return orphans;
        },

        cleanOrphanRecords: (tableName, recordIds) => {
            const originalLength = cache[tableName]?.length || 0;
            cache[tableName] = cache[tableName].filter(r => !recordIds.includes(r.id));

            DataService.addAuditLog('CLEAN', tableName, 'batch', { deleted: originalLength - cache[tableName].length }, null, `Eliminados ${originalLength - cache[tableName].length} registros huérfanos`);

            return {
                success: true,
                deleted: originalLength - cache[tableName].length,
                remaining: cache[tableName].length
            };
        },

        // ========== KPIs PRODUCTIVIDAD TÉCNICOS ==========
        getTecnicoProductividad: (periodo = 'month') => {
            const today = new Date();
            let startDate = new Date();

            if (periodo === 'week') startDate.setDate(today.getDate() - 7);
            else if (periodo === 'month') startDate.setMonth(today.getMonth() - 1);
            else if (periodo === 'quarter') startDate.setMonth(today.getMonth() - 3);
            else startDate.setFullYear(today.getFullYear() - 1);

            const tecnicosMap = {};

            cache.users?.forEach(u => {
                if (u.role === 'Tecnico' || u.role === 'Técnico') {
                    tecnicosMap[u.id] = {
                        id: u.id,
                        nombre: u.name || u.username,
                        servicios: 0,
                        ingresos: 0,
                        horasPromedio: 0,
                        rating: 0
                    };
                }
            });

            const filteredVisitas = cache.visitas.filter(v => {
                const date = new Date(v.fechaInicio || v.fecha);
                return date >= startDate && v.usuarioSoporte;
            });

            filteredVisitas.forEach(v => {
                const tecnicoId = v.usuarioSoporte;
                if (tecnicosMap[tecnicoId]) {
                    tecnicosMap[tecnicoId].servicios++;
                    tecnicosMap[tecnicoId].ingresos += parseFloat(v.costoServicio || v.costo || 0);
                }
            });

            const tecnicos = Object.values(tecnicosMap);
            const maxServicios = Math.max(...tecnicos.map(t => t.servicios), 1);

            return tecnicos.map(t => ({
                ...t,
                productividad: Math.round((t.servicios / maxServicios) * 100),
                ingresosPromedio: t.servicios > 0 ? Math.round(t.ingresos / t.servicios) : 0
            })).sort((a, b) => b.servicios - a.servicios);
        },

        // ========== CONTRATOS POR VENCER ==========
        getContratosPorVencer: (dias = 30) => {
            const today = new Date();
            const fechaLimite = new Date();
            fechaLimite.setDate(today.getDate() + dias);

            return cache.contratos.filter(c => {
                const estado = (c.estadoContrato || c.estado_contrato || '').toUpperCase();
                if (estado !== 'ACTIVO') return false;

                const fechaFin = new Date(c.fechaFin || c.fecha_fin);
                return fechaFin >= today && fechaFin <= fechaLimite;
            }).map(c => {
                const fechaFin = new Date(c.fechaFin || c.fecha_fin);
                const diasRestantes = Math.ceil((fechaFin - today) / (1000 * 60 * 60 * 24));
                const cliente = cache.clientes.find(cl => cl.id === c.clienteId);

                return {
                    ...c,
                    clienteNombre: cliente?.nombreCliente || cliente?.empresa || 'N/A',
                    diasRestantes,
                    urgencia: diasRestantes <= 7 ? 'critica' : diasRestantes <= 15 ? 'alta' : 'normal'
                };
            }).sort((a, b) => a.diasRestantes - b.diasRestantes);
        },

        // ============================================================
        // GESTIÓN FINANCIERA - QUICKBOOKS STYLE
        // ============================================================

        // ---- Métricas financieras completas ----
        getFinMetrics: (periodo = 'month') => {
            const today = new Date();
            let startDate = new Date();
            let yearStart = new Date(today.getFullYear(), 0, 1);
            
            if (periodo === 'week') startDate.setDate(today.getDate() - 7);
            else if (periodo === 'month') startDate.setMonth(today.getMonth() - 1);
            else if (periodo === 'quarter') startDate.setMonth(today.getMonth() - 3);
            else if (periodo === 'year') startDate.setFullYear(today.getFullYear() - 1);
            else startDate.setMonth(today.getMonth() - 1);

            // Ingresos de caché financiero
            const ingresos = (cache.finIngresos || []).filter(i => {
                const d = new Date(i.fecha);
                return d >= startDate;
            });
            
            const gastos = (cache.finGastos || []).filter(g => {
                const d = new Date(g.fecha);
                return d >= startDate;
            });

            // Métricas básicas
            const ingresosMes = ingresos.reduce((s, i) => s + (parseFloat(i.monto) || 0), 0);
            const gastosMes = gastos.reduce((s, g) => s + (parseFloat(g.monto) || 0), 0);
            
            // IVA
            const ivaVentas = ingresos.reduce((s, i) => s + (parseFloat(i.iva) || 0), 0);
            const ivaCompras = gastos.filter(g => g.iva_credito).reduce((s, g) => s + (parseFloat(g.iva_credito) || 0), 0);
            
            // Cuentas por cobrar/pagar
            const cxc = (cache.finCuentasCobrar || []).filter(c => c.estado === 'pendiente');
            const cxp = (cache.finCuentasPagar || []).filter(c => c.estado === 'pendiente');
            
            // Bancos
            const bancos = (cache.finBancos || []).reduce((s, b) => s + (parseFloat(b.saldo_actual) || 0), 0);

            // Anual
            const ingresosAnio = (cache.finIngresos || []).filter(i => new Date(i.fecha) >= yearStart).reduce((s, i) => s + (parseFloat(i.monto) || 0), 0);
            const gastosAnio = (cache.finGastos || []).filter(g => new Date(g.fecha) >= yearStart).reduce((s, g) => s + (parseFloat(g.monto) || 0), 0);

            // Período anterior para tendencias
            const prevStart = new Date(startDate);
            const prevEnd = new Date(today);
            prevStart.setTime(startDate.getTime() - (today.getTime() - startDate.getTime()));
            
            const prevIngresos = (cache.finIngresos || []).filter(i => {
                const d = new Date(i.fecha);
                return d >= prevStart && d < startDate;
            }).reduce((s, i) => s + (parseFloat(i.monto) || 0), 0);
            
            const prevGastos = (cache.finGastos || []).filter(g => {
                const d = new Date(g.fecha);
                return d >= prevStart && d < startDate;
            }).reduce((s, g) => s + (parseFloat(g.monto) || 0), 0);

            const calcTrend = (curr, prev) => prev > 0 ? Math.round(((curr - prev) / prev) * 100 * 10) / 10 : 0;

            return {
                // Período actual
                ingresos: ingresosMes,
                gastos: gastosMes,
                utilidad: ingresosMes - gastosMes,
                margen: ingresosMes > 0 ? ((ingresosMes - gastosMes) / ingresosMes) * 100 : 0,
                ivaPorPagar: ivaVentas - ivaCompras,
                ivaVentas,
                ivaCompras,
                // Cuentas
                cuentasCobrar: { total: cxc.reduce((s, c) => s + (parseFloat(c.monto) || 0), 0), count: cxc.length },
                cuentasPagar: { total: cxp.reduce((s, c) => s + (parseFloat(c.monto) || 0), 0), count: cxp.length },
                bancos,
                // Anual
                ingresosAnio,
                gastosAnio,
                utilidadAnio: ingresosAnio - gastosAnio,
                // Tendencias
                tendencias: {
                    ingresos: { actual: ingresosMes, anterior: prevIngresos, cambio: calcTrend(ingresosMes, prevIngresos) },
                    gastos: { actual: gastosMes, anterior: prevGastos, cambio: calcTrend(gastosMes, prevGastos) }
                }
            };
        },

        // ---- Obtener ingresos vinculados a otros módulos ----
        getFinIngresosFromModules: () => {
            const ingresos = [];
            const iva = cache.config.ivaRate || 0.15;

            // De contratos activos
            cache.contratos?.forEach(c => {
                if ((c.estadoContrato || '').toUpperCase() === 'ACTIVO') {
                    const cliente = cache.clientes.find(cl => cl.id === c.clienteId);
                    ingresos.push({
                        fuente: 'contrato',
                        fuenteId: c.id,
                        fecha: c.fechaInicio || c.fecha_creacion || new Date().toISOString(),
                        categoria: 'Contratos de Mantenimiento',
                        descripcion: `Contrato: ${cliente?.empresa || cliente?.nombreCliente || 'N/A'}`,
                        cliente: cliente?.empresa || cliente?.nombreCliente || 'N/A',
                        subtotal: parseFloat(c.valorContrato || c.valor || 0),
                        iva: parseFloat(c.valorContrato || c.valor || 0) * iva,
                        monto: parseFloat(c.valorContrato || c.valor || 0) * (1 + iva),
                        metodo_pago: 'Transferencia'
                    });
                }
            });

            // De ventas (tomar últimas 50)
            (cache.proformas || []).filter(p => p.estado === 'Aprobada').slice(0, 50).forEach(p => {
                const cliente = cache.clientes.find(cl => cl.id === p.clienteId);
                const total = parseFloat(p.total || p.monto || 0);
                ingresos.push({
                    fuente: 'venta',
                    fuenteId: p.id,
                    fecha: p.fechaAprobacion || p.fecha_creacion || new Date().toISOString(),
                    categoria: 'Ventas de Productos',
                    descripcion: `Proforma #${p.numero || p.id}`,
                    cliente: cliente?.empresa || cliente?.nombreCliente || 'N/A',
                    subtotal: total / 1.15,
                    iva: total - (total / 1.15),
                    monto: total,
                    metodo_pago: p.metodo_pago || 'Efectivo'
                });
            });

            return ingresos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        },

        // ---- Obtener gastos vinculados a otros módulos ----
        getFinGastosFromModules: () => {
            const gastos = [];

            // De nóminas/empleados
            (cache.nominas || []).forEach(n => {
                const empleado = cache.empleados?.find(e => e.id === n.empleadoId);
                gastos.push({
                    fuente: 'nomina',
                    fuenteId: n.id,
                    fecha: n.fecha_pago || n.fecha_creacion || new Date().toISOString(),
                    categoria: 'Salarios',
                    descripcion: `Nómina: ${empleado?.nombre || 'Empleado'}`,
                    proveedor: 'Nómina de Empleados',
                    monto: parseFloat(n.monto_neto || n.total || 0),
                    subtotal: parseFloat(n.monto_neto || n.total || 0),
                    iva_credito: 0,
                    comprobante: n.numero || n.id
                });
            });

            // De pedidos (compras a proveedores)
            (cache.pedidos || []).filter(p => p.estado === 'Recibido' || p.estado === 'completado').forEach(p => {
                const proveedor = cache.proveedores?.find(pr => pr.id === p.proveedorId);
                const total = parseFloat(p.total || p.monto || 0);
                gastos.push({
                    fuente: 'pedido',
                    fuenteId: p.id,
                    fecha: p.fecha_recibido || p.fecha_creacion || new Date().toISOString(),
                    categoria: 'Compra de Inventario',
                    descripcion: `Pedido #${p.numero || p.id}`,
                    proveedor: proveedor?.nombre || 'Proveedor',
                    monto: total,
                    subtotal: total / 1.15,
                    iva_credito: total - (total / 1.15),
                    comprobante: p.numero || p.id
                });
            });

            return gastos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        },

        // ---- Importar desde otros módulos ----
        syncFinFromModules: () => {
            // Obtener ingresos de contratos
            const ingresosContratos = DataService.getFinIngresosFromModules();
            
            // Marcar como importados
            ingresosContratos.forEach(i => {
                const existe = (cache.finIngresos || []).some(fi => fi.fuente === i.fuente && fi.fuenteId === i.fuenteId);
                if (!existe && cache.finIngresos) {
                    cache.finIngresos.push({ ...i, imported_at: new Date().toISOString() });
                }
            });

            // Obtener gastos de nóminas y pedidos
            const gastosModules = DataService.getFinGastosFromModules();
            gastosModules.forEach(g => {
                const existe = (cache.finGastos || []).some(fg => fg.fuente === g.fuente && fg.fuenteId === g.fuenteId);
                if (!existe && cache.finGastos) {
                    cache.finGastos.push({ ...g, imported_at: new Date().toISOString() });
                }
            });

            return {
                ingresosImportados: ingresosContratos.length,
                gastosImportados: gastosModules.length
            };
        },

        // ---- Estados Financieros ----
        getEstadoResultados: (periodo = 'month') => {
            const today = new Date();
            let startDate = new Date();
            if (periodo === 'month') startDate.setMonth(today.getMonth() - 1);
            else if (periodo === 'quarter') startDate.setMonth(today.getMonth() - 3);
            else startDate.setFullYear(today.getFullYear() - 1);

            const ingresos = (cache.finIngresos || []).filter(i => new Date(i.fecha) >= startDate);
            const gastos = (cache.finGastos || []).filter(g => new Date(g.fecha) >= startDate);

            // Agrupar por categoría
            const ingresosPorCategoria = {};
            ingresos.forEach(i => {
                const cat = i.categoria || 'Otros';
                if (!ingresosPorCategoria[cat]) ingresosPorCategoria[cat] = 0;
                ingresosPorCategoria[cat] += parseFloat(i.monto || 0);
            });

            const gastosPorCategoria = {};
            gastos.forEach(g => {
                const cat = g.categoria || 'Otros';
                if (!gastosPorCategoria[cat]) gastosPorCategoria[cat] = 0;
                gastosPorCategoria[cat] += parseFloat(g.monto || 0);
            });

            const totalIngresos = Object.values(ingresosPorCategoria).reduce((s, v) => s + v, 0);
            const totalGastos = Object.values(gastosPorCategoria).reduce((s, v) => s + v, 0);
            const iva = ingresos.reduce((s, i) => s + (parseFloat(i.iva) || 0), 0);

            return {
                periodo: periodo,
                ingresos: ingresosPorCategoria,
                gastos: gastosPorCategoria,
                totalIngresos,
                totalGastos,
                utilidadBruta: totalIngresos - totalGastos,
                iva,
                utilidadNeta: totalIngresos - totalGastos - iva,
                margenNeto: totalIngresos > 0 ? ((totalIngresos - totalGastos - iva) / totalIngresos) * 100 : 0
            };
        },

        getBalanceGeneral: () => {
            // Activos
            const bancos = (cache.finBancos || []).reduce((s, b) => s + (parseFloat(b.saldo_actual) || 0), 0);
            const cxc = (cache.finCuentasCobrar || []).filter(c => c.estado === 'pendiente').reduce((s, c) => s + (parseFloat(c.monto) || 0), 0);
            
            // Pasivos
            const cxp = (cache.finCuentasPagar || []).filter(c => c.estado === 'pendiente').reduce((s, c) => s + (parseFloat(c.monto) || 0), 0);
            
            // Patrimonio
            const ingresosAnio = (cache.finIngresos || []).reduce((s, i) => s + (parseFloat(i.monto) || 0), 0);
            const gastosAnio = (cache.finGastos || []).reduce((s, g) => s + (parseFloat(g.monto) || 0), 0);
            const utilidad = ingresosAnio - gastosAnio;

            return {
                activos: {
                    bancos,
                    cuentasCobrar: cxc,
                    total: bancos + cxc
                },
                pasivos: {
                    cuentasPagar: cxp,
                    total: cxp
                },
                patrimonio: {
                    capital: 0,
                    utilidadAcumulada: utilidad,
                    total: utilidad
                }
            };
        },

        // ---- Proyección de flujo de caja ----
        getProyeccionFlujo: (meses = 3) => {
            const today = new Date();
            const projection = [];

            for (let i = 0; i < meses; i++) {
                const monthDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
                const monthEnd = new Date(today.getFullYear(), today.getMonth() + i + 1, 0);
                
                const ingresos = (cache.finIngresos || []).filter(x => {
                    const d = new Date(x.fecha);
                    return d >= monthDate && d <= monthEnd;
                }).reduce((s, x) => s + (parseFloat(x.monto) || 0), 0);

                const gastos = (cache.finGastos || []).filter(x => {
                    const d = new Date(x.fecha);
                    return d >= monthDate && d <= monthEnd;
                }).reduce((s, x) => s + (parseFloat(x.monto) || 0), 0);

                // Contratos que vencen este mes (ingresos esperados)
                const contratosVencen = (cache.contratos || []).filter(c => {
                    const fc = new Date(c.fechaFin);
                    return fc.getMonth() === monthDate.getMonth() && fc.getFullYear() === monthDate.getFullYear();
                }).reduce((s, c) => s + (parseFloat(c.valorContrato || c.valor || 0) * 1.15), 0);

                projection.push({
                    mes: monthDate.toLocaleDateString('es', { month: 'long', year: 'numeric' }),
                    ingresos,
                    gastos,
                    neto: ingresos - gastos,
                    ingresosEsperados: contratosVencen,
                    flujoProyectado: ingresos + contratosVencen - gastos
                });
            }

            return projection;
        },

        // ---- Alertas financieras ----
        getFinAlertas: () => {
            const alertas = [];
            const metrics = DataService.getFinMetrics('month');

            // Alerta de flujo negativo
            if (metrics.utilidad < 0) {
                alertas.push({
                    tipo: 'danger',
                    titulo: 'Utilidad Negativa',
                    mensaje: `El período actual tiene pérdida de C$${Math.abs(metrics.utilidad).toFixed(2)}`
                });
            }

            // Alerta de cuentas por cobrar vencidas
            const cxcVencidas = (cache.finCuentasCobrar || []).filter(c => {
                return c.estado === 'pendiente' && new Date(c.fecha_vencimiento) < new Date();
            });
            if (cxcVencidas.length > 0) {
                const total = cxcVencidas.reduce((s, c) => s + (parseFloat(c.monto) || 0), 0);
                alertas.push({
                    tipo: 'warning',
                    titulo: 'Cuentas por Cobrar Vencidas',
                    mensaje: `${cxcVencidas.length} facturas vencidas por C$${total.toFixed(2)}`
                });
            }

            // Alerta de cuentas por pagar próximas
            const cxpProximas = (cache.finCuentasPagar || []).filter(c => {
                if (c.estado !== 'pendiente') return false;
                const v = new Date(c.fecha_vencimiento);
                const dias = Math.ceil((v - new Date()) / (1000 * 60 * 60 * 24));
                return dias <= 7 && dias > 0;
            });
            if (cxpProximas.length > 0) {
                const total = cxpProximas.reduce((s, c) => s + (parseFloat(c.monto) || 0), 0);
                alertas.push({
                    tipo: 'warning',
                    titulo: 'Pagos Próximos',
                    mensaje: `${cxpProximas.length} pagos por C$${total.toFixed(2)} vencen en 7 días`
                });
            }

            // Alerta de bajo saldo en bancos
            const bancos = (cache.finBancos || []).filter(b => (parseFloat(b.saldo_actual) || 0) < 1000);
            if (bancos.length > 0) {
                alertas.push({
                    tipo: 'warning',
                    titulo: 'Saldo Bajo en Bancos',
                    mensaje: `${bancos.length} cuenta(s) con saldo menor a C$1,000`
                });
            }

            // Alerta de presupuesto excedido
            (cache.finPresupuestos || []).forEach(p => {
                const gastado = (cache.finGastos || []).filter(g => 
                    g.categoria === p.categoria && new Date(g.fecha) >= new Date(p.fecha_inicio || new Date().getFullYear() + '-01-01')
                ).reduce((s, g) => s + (parseFloat(g.monto) || 0), 0);
                
                if (gastado > parseFloat(p.monto)) {
                    alertas.push({
                        tipo: 'danger',
                        titulo: 'Presupuesto Excedido',
                        mensaje: `${p.categoria}: gastado C$${gastado.toFixed(2)} de C$${parseFloat(p.monto).toFixed(2)}`
                    });
                }
            });

            return alertas;
        },

        // ---- Centros de costo ----
        getCentrosCosto: () => {
            const centros = {};
            
            // Por cliente
            cache.clientes?.forEach(c => {
                const key = c.empresa || c.nombreCliente || 'Sin cliente';
                const visitas = (cache.visitas || []).filter(v => v.clienteId === c.id);
                const ingresos = visitas.reduce((s, v) => s + (parseFloat(v.costoServicio) || 0), 0);
                
                if (!centros[key]) centros[key] = { nombre: key, servicios: 0, ingresos: 0, costos: 0 };
                centros[key].servicios += visitas.length;
                centros[key].ingresos += ingresos;
            });

            // Por tipo de servicio
            (cache.visitas || []).forEach(v => {
                const tipo = v.tipoVisita || 'Otro';
                if (!centros[tipo]) centros[tipo] = { nombre: tipo, servicios: 0, ingresos: 0, costos: 0 };
                centros[tipo].servicios++;
                centros[tipo].ingresos += parseFloat(v.costoServicio) || 0;
            });

            return Object.values(centros).map(c => ({
                ...c,
                rentabilidad: c.ingresos > 0 ? ((c.ingresos - c.costos) / c.ingresos) * 100 : 0
            })).sort((a, b) => b.ingresos - a.ingresos);
        },

        // ---- CRUD básico financiero ----
        addFinIngreso: (data) => {
            const ingreso = {
                id: crypto.randomUUID(),
                ...data,
                iva: data.subtotal ? data.subtotal * (cache.config.ivaRate || 0.15) : 0,
                monto: data.subtotal ? data.subtotal * 1.15 : 0,
                created_at: new Date().toISOString()
            };
            cache.finIngresos = cache.finIngresos || [];
            cache.finIngresos.unshift(ingreso);
            DataService.addAuditLog('CREATE', 'finIngresos', ingreso.id, null, ingreso, 'Ingreso registrado');
            return ingreso;
        },

        addFinGasto: (data) => {
            const gasto = {
                id: crypto.randomUUID(),
                ...data,
                iva_credito: data.subtotal ? data.subtotal * (cache.config.ivaRate || 0.15) : 0,
                monto: data.subtotal ? data.subtotal * 1.15 : data.monto || 0,
                created_at: new Date().toISOString()
            };
            cache.finGastos = cache.finGastos || [];
            cache.finGastos.unshift(gasto);
            DataService.addAuditLog('CREATE', 'finGastos', gasto.id, null, gasto, 'Gasto registrado');
            return gasto;
        },

        getFinIngresos: () => cache.finIngresos || [],
        getFinGastos: () => cache.finGastos || [],
        getFinCategorias: () => cache.finCategorias || [],
        
        // ---- Exportar reportes financieros ----
        exportReporteFinanciero: (tipo, formato = 'csv') => {
            let data = [];
            let filename = '';

            if (tipo === 'estado_resultados') {
                const er = DataService.getEstadoResultados('month');
                data = [
                    { concepto: 'Ingresos', monto: er.totalIngresos },
                    ...Object.entries(er.ingresos).map(([k, v]) => ({ concepto: k, monto: v })),
                    { concepto: '', monto: '' },
                    { concepto: 'Gastos', monto: er.totalGastos },
                    ...Object.entries(er.gastos).map(([k, v]) => ({ concepto: k, monto: v })),
                    { concepto: '', monto: '' },
                    { concepto: 'IVA', monto: er.iva },
                    { concepto: 'UTILIDAD NETA', monto: er.utilidadNeta }
                ];
                filename = 'estado_resultados';
            } else if (tipo === 'balance') {
                const bg = DataService.getBalanceGeneral();
                data = [
                    { concepto: 'ACTIVOS', monto: bg.activos.total },
                    { concepto: 'Bancos', monto: bg.activos.bancos },
                    { concepto: 'Cuentas por Cobrar', monto: bg.activos.cuentasCobrar },
                    { concepto: '', monto: '' },
                    { concepto: 'PASIVOS', monto: bg.pasivos.total },
                    { concepto: 'Cuentas por Pagar', monto: bg.pasivos.cuentasPagar },
                    { concepto: '', monto: '' },
                    { concepto: 'PATRIMONIO', monto: bg.patrimonio.total },
                    { concepto: 'Utilidad Acumulada', monto: bg.patrimonio.utilidadAcumulada }
                ];
                filename = 'balance_general';
            } else if (tipo === 'flujo') {
                const flujo = DataService.getProyeccionFlujo(6);
                data = flujo;
                filename = 'flujo_caja';
            }

            // Exportar a CSV
            const headers = Object.keys(data[0] || {});
            const csv = [
                headers.join(','),
                ...data.map(row => headers.map(h => row[h]).join(','))
            ].join('\n');

            const blob = new Blob([csv], { type: 'text/csv' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();

            return { success: true, filename };
        },

        // ============================================================
        // ANÁLISIS DE PRODUCTOS Y PEDIDOS
        // ============================================================

        // ---- Productos en inventario mínimo ----
        getProductosInventarioMinimo: () => {
            const productos = DataService.getProductosSync();
            return productos.filter(p => {
                const stock = parseFloat(p.stock || p.inventario || 0);
                const minimo = parseFloat(p.inventarioMinimo || p.stock_minimo || 0);
                return minimo > 0 && stock <= minimo;
            }).map(p => ({
                ...p,
                stockActual: parseFloat(p.stock || p.inventario || 0),
                stockMinimo: parseFloat(p.inventarioMinimo || p.stock_minimo || 0),
                deficit: Math.max(0, parseFloat(p.inventarioMinimo || p.stock_minimo || 0) - (parseFloat(p.stock || p.inventario || 0)))
            })).sort((a, b) => a.stockActual - b.stockActual);
        },

        // ---- Productos de alta rotación (más vendidos) ----
        getProductosMasVendidos: (limite = 20, periodo = 'month') => {
            const today = new Date();
            let startDate = new Date();
            if (periodo === 'week') startDate.setDate(today.getDate() - 7);
            else if (periodo === 'month') startDate.setMonth(today.getMonth() - 1);
            else if (periodo === 'quarter') startDate.setMonth(today.getMonth() - 3);
            else startDate.setFullYear(today.getFullYear() - 1);

            const ventasMap = {};

            // De ventas (proformas aprobadas)
            (cache.proformas || []).filter(p => {
                if (p.estado !== 'Aprobada' && p.estado !== 'aprobada') return false;
                const fecha = new Date(p.fechaAprobacion || p.fecha_creacion || p.created_at);
                return fecha >= startDate;
            }).forEach(p => {
                (p.items || []).forEach(item => {
                    const prodId = item.productoId || item.product_id || item.id;
                    if (!ventasMap[prodId]) {
                        ventasMap[prodId] = { 
                            productoId: prodId, 
                            nombre: item.nombre || item.name || 'Producto',
                            cantidad: 0, 
                            ingresos: 0 
                        };
                    }
                    ventasMap[prodId].cantidad += parseFloat(item.cantidad || 1);
                    ventasMap[prodId].ingresos += parseFloat(item.precio || item.subtotal || 0) * (item.cantidad || 1);
                });
            });

            // De pedidos
            (cache.pedidos || []).filter(p => {
                const fecha = new Date(p.fecha || p.fecha_creacion || p.created_at);
                return fecha >= startDate;
            }).forEach(p => {
                (p.items || []).forEach(item => {
                    const prodId = item.productoId || item.product_id || item.id;
                    if (!ventasMap[prodId]) {
                        ventasMap[prodId] = { 
                            productoId: prodId, 
                            nombre: item.nombre || item.name || 'Producto',
                            cantidad: 0, 
                            ingresos: 0 
                        };
                    }
                    ventasMap[prodId].cantidad += parseFloat(item.cantidad || 1);
                    ventasMap[prodId].ingresos += parseFloat(item.precio || item.subtotal || 0) * (item.cantidad || 1);
                });
            });

            return Object.values(ventasMap)
                .sort((a, b) => b.cantidad - a.cantidad)
                .slice(0, limite);
        },

        // ---- Productos de baja rotación (menos vendidos) ----
        getProductosMenosVendidos: (limite = 20, periodo = 'year') => {
            const masVendidos = DataService.getProductosMasVendidos(100, periodo);
            const productos = DataService.getProductosSync();
            
            // Productos que no están en los más vendidos o tienen ventas muy bajas
            const productoIdsConVentas = new Set(masVendidos.map(p => p.productoId));
            
            return productos
                .filter(p => !productoIdsConVentas.has(p.id))
                .map(p => ({
                    ...p,
                    cantidadVendida: 0,
                    ingresosGenerados: 0,
                    ultimaVenta: null
                }))
                .slice(0, limite);
        },

        // ---- Sugerencias de compra basadas en rotación ----
        getSugerenciasCompra: () => {
            const inventarioMinimo = DataService.getProductosInventarioMinimo();
            const masVendidos = DataService.getProductosMasVendidos(30, 'month');
            const productoIdsAltaRotacion = new Set(masVendidos.map(p => p.productoId));

            const sugerencias = [];

            // Productos en inventario mínimo
            inventarioMinimo.forEach(p => {
                sugerencias.push({
                    producto: p,
                    tipo: 'inventario_minimo',
                    prioridad: 'alta',
                    cantidadSugerida: Math.max(p.deficit, p.stockMinimo * 2),
                    razon: `Stock actual (${p.stockActual}) está por debajo del mínimo (${p.stockMinimo})`
                });
            });

            // Productos de alta rotación no en inventario mínimo
            masVendidos.slice(0, 10).forEach(p => {
                const producto = (cache.productos || []).find(pr => pr.id === p.productoId);
                if (producto && producto.stock <= producto.inventarioMinimo) {
                    // Ya incluido en inventario mínimo
                } else if (producto && producto.stock < 10) {
                    sugerencias.push({
                        producto: producto || { id: p.productoId, nombre: p.nombre, stock: 0, inventarioMinimo: 5 },
                        tipo: 'alta_rotacion',
                        prioridad: 'media',
                        cantidadSugerida: Math.ceil(p.cantidad * 1.5),
                        razon: `Alta rotación: ${p.cantidad} unidades vendidas este mes`
                    });
                }
            });

            return sugerencias.sort((a, b) => {
                const prioridadOrder = { alta: 0, media: 1, baja: 2 };
                return prioridadOrder[a.prioridad] - prioridadOrder[b.prioridad];
            });
        },

        // ---- Análisis de rentabilidad por producto ----
        getAnalisisRentabilidad: () => {
            const masVendidos = DataService.getProductosMasVendidos(50, 'month');
            
            return masVendidos.map(p => {
                const producto = (cache.productos || []).find(pr => pr.id === p.productoId);
                const costo = parseFloat(producto?.precioCompra || producto?.precio_costo || 0);
                const precioVenta = p.ingresos / p.cantidad;
                const ganancia = precioVenta - costo;
                const margen = precioVenta > 0 ? (ganancia / precioVenta) * 100 : 0;

                return {
                    ...p,
                    costo,
                    precioVenta,
                    ganancia,
                    margen,
                    rentabilidad: margen > 30 ? 'alta' : margen > 15 ? 'media' : 'baja'
                };
            }).sort((a, b) => b.margen - a.margen);
        },

        // ---- Pedidos por proveedor ----
        getPedidosPorProveedor: (proveedorId = null) => {
            let pedidos = cache.pedidos || [];
            
            if (proveedorId) {
                pedidos = pedidos.filter(p => p.proveedorId === proveedorId);
            }

            // Agrupar por proveedor
            const porProveedor = {};
            pedidos.forEach(p => {
                const prov = p.proveedor || p.proveedorNombre || 'Sin proveedor';
                if (!porProveedor[prov]) {
                    porProveedor[prov] = { nombre: prov, pedidos: [], total: 0 };
                }
                porProveedor[prov].pedidos.push(p);
                porProveedor[prov].total += parseFloat(p.total || p.monto || 0);
            });

            return Object.values(porProveedor);
        },

        // ---- Órdenes de compra ----
        getOrdenesCompra: () => cache.ordenesCompra || [],
        
        createOrdenCompra: (data) => {
            const orden = {
                id: crypto.randomUUID(),
                ...data,
                estado: 'pendiente',
                created_at: new Date().toISOString()
            };
            cache.ordenesCompra = cache.ordenesCompra || [];
            cache.ordenesCompra.unshift(orden);
            return orden;
        },

        updateOrdenCompra: (id, updates) => {
            const idx = (cache.ordenesCompra || []).findIndex(o => o.id === id);
            if (idx >= 0) {
                cache.ordenesCompra[idx] = { ...cache.ordenesCompra[idx], ...updates, updated_at: new Date().toISOString() };
                return cache.ordenesCompra[idx];
            }
            return null;
        },

        // ---- Cotizador por proveedor ----
        getCotizacionProveedor: (productoId) => {
            const producto = (cache.productos || []).find(p => p.id === productoId);
            if (!producto) return null;

            // Buscar proveedores que tengan el producto
            const proveedores = cache.proveedores || [];
            
            // Simular cotizaciones basadas en datos existentes
            const cotizaciones = [
                { proveedor: 'Proveedor Principal', precio: parseFloat(producto.precioCompra || producto.precio_costo || 0), tiempoEntrega: '24-48h', confiable: 95 },
                { proveedor: 'Proveedor Alternativo 1', precio: (parseFloat(producto.precioCompra || 0) * 1.05), tiempoEntrega: '3-5 días', confiable: 85 },
                { proveedor: 'Proveedor Alternativo 2', precio: (parseFloat(producto.precioCompra || 0) * 0.95), tiempoEntrega: '7-10 días', confiable: 70 }
            ].filter(c => c.precio > 0);

            return {
                producto,
                cotizaciones: cotizaciones.sort((a, b) => a.precio - b.precio)
            };
        },

        // ---- Estadísticas de productos ----
        getEstadisticasProductos: (periodo = 'month') => {
            const masVendidos = DataService.getProductosMasVendidos(20, periodo);
            const menosVendidos = DataService.getProductosMenosVendidos(20, periodo);
            const inventarioMinimo = DataService.getProductosInventarioMinimo();
            const sugerencias = DataService.getSugerenciasCompra();

            const totalUnidadesVendidas = masVendidos.reduce((s, p) => s + p.cantidad, 0);
            const totalIngresos = masVendidos.reduce((s, p) => s + p.ingresos, 0);
            const promedioVentaDia = totalUnidadesVendidas / 30;

            return {
                periodo,
                masVendidos,
                menosVendidos,
                inventarioMinimo,
                sugerencias,
                totales: {
                    unidadesVendidas: totalUnidadesVendidas,
                    ingresosGenerados: totalIngresos,
                    promedioVentaDia: promedioVentaDia.toFixed(1),
                    productosEnMinimo: inventarioMinimo.length,
                    sugerenciasCompra: sugerencias.length
                }
            };
        },

        // ---- Historial de pedidos ----
        getHistorialPedidos: (filtros = {}) => {
            let pedidos = [...(cache.pedidos || [])];

            if (filtros.proveedorId) {
                pedidos = pedidos.filter(p => p.proveedorId === filtros.proveedorId);
            }
            if (filtros.estado) {
                pedidos = pedidos.filter(p => p.estado === filtros.estado);
            }
            if (filtros.fechaInicio) {
                pedidos = pedidos.filter(p => new Date(p.fecha) >= new Date(filtros.fechaInicio));
            }
            if (filtros.fechaFin) {
                pedidos = pedidos.filter(p => new Date(p.fecha) <= new Date(filtros.fechaFin));
            }
            if (filtros.buscar) {
                const busq = filtros.buscar.toLowerCase();
                pedidos = pedidos.filter(p => 
                    (p.numero || '').toLowerCase().includes(busq) ||
                    (p.cliente || '').toLowerCase().includes(busq) ||
                    (p.proveedor || '').toLowerCase().includes(busq)
                );
            }

            return pedidos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        },

        // ---- Generar orden de compra desde sugerencias ----
        generarOrdenDesdeSugerencias: (sugerencias) => {
            const proveedorPrincipal = 'Proveedor Principal'; // Por ahora simulado
            
            const items = sugerencias.map(s => ({
                productoId: s.producto.id,
                nombre: s.producto.nombre,
                cantidad: s.cantidadSugerida,
                precioUnitario: s.producto.precioCompra || s.producto.precio_costo || 0,
                subtotal: s.cantidadSugerida * (s.producto.precioCompra || s.producto.precio_costo || 0)
            }));

            const total = items.reduce((s, i) => s + i.subtotal, 0);

            const orden = DataService.createOrdenCompra({
                proveedor: proveedorPrincipal,
                items,
                total,
                fecha_esperada: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                notas: `Orden generada automáticamente desde sugerencias de inventario`
            });

            return orden;
        },

        // ---- Obtener caché interno ----
        getCache: () => cache
    };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = DataService; }
