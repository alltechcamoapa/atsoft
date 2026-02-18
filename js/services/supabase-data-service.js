/**
 * ALLTECH - Supabase Data Service
 * Servicio de datos usando Supabase como backend
 * Mantiene la misma interfaz que data-service.js para compatibilidad
 */

const SupabaseDataService = (() => {
    let client = null;

    // ========== INICIALIZACIÓN ==========
    const init = () => {
        client = getSupabaseClient();
        if (!client) {
            console.error('❌ No se pudo inicializar Supabase');
            return false;
        }
        // console.log('✅ SupabaseDataService initialized');
        return true;
    };

    // ========== HELPER PARA GENERAR CÓDIGOS ==========
    const generateCode = async (tableName, prefix = '', padding = 5, column = null) => {
        if (!client) return null;

        // Determinar columna por defecto si no se provee
        if (!column) {
            if (tableName === 'clientes') column = 'codigo_cliente';
            else if (tableName === 'contratos') column = 'codigo_contrato';
            else if (tableName === 'visitas') column = 'codigo_visita';
            else if (tableName === 'productos') column = 'codigo';
            else column = 'codigo';
        }

        try {
            // Intentar obtener el último registro para esta secuencia/tabla
            let query = client
                .from(tableName)
                .select(column)
                .order(column, { ascending: false })
                .limit(1);

            if (prefix) {
                query = query.like(column, `${prefix}%`);
            }

            const { data, error } = await query;

            if (error) {
                console.error(`Error querying max code for ${tableName}:`, error);
                throw error;
            }

            let nextNumber = 1;
            if (data && data.length > 0) {
                const lastCode = data[0][column];
                if (lastCode) {
                    // Extraer los dígitos del final del string
                    const matches = String(lastCode).match(/\d+$/);
                    if (matches) {
                        nextNumber = parseInt(matches[0]) + 1;
                    }
                }
            }

            // Formatear el nuevo código
            return prefix + String(nextNumber).padStart(padding, '0');
        } catch (error) {
            console.error(`Error generating sequential code for ${tableName}:`, error);
            // Fallback: usar timestamp si todo falla para evitar errores de creación
            return (prefix || 'TEMP-') + Date.now().toString().slice(-padding);
        }
    };

    // ========== CLIENTES ==========
    const getClientesSync = async () => {
        if (!client) return [];

        const { data, error } = await client
            .from('clientes')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching clientes:', error);
            return [];
        }

        return data || [];
    };

    const getClientesFiltered = async (filter) => {
        if (!client) return [];

        let query = client.from('clientes').select('*');

        // Aplicar filtros
        if (filter.search) {
            query = query.or(`nombre_cliente.ilike.%${filter.search}%,empresa.ilike.%${filter.search}%,correo.ilike.%${filter.search}%`);
        }

        if (filter.status && filter.status !== 'all') {
            query = query.eq('estado', filter.status);
        }

        query = query.order('created_at', { ascending: false });

        const { data, error } = await query;

        if (error) {
            console.error('Error filtering clientes:', error);
            return [];
        }

        return data || [];
    };

    const getClienteById = async (id) => {
        if (!client) return null;

        const { data, error } = await client
            .from('clientes')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching cliente:', error);
            return null;
        }

        return data;
    };

    const createCliente = async (clienteData) => {
        if (!client) return { error: 'Not initialized' };

        // Generar código secuencial si no existe (Formato: CLI-0001)
        if (!clienteData.codigo_cliente) {
            const codigo = await generateCode('clientes', 'CLI-', 4, 'codigo_cliente');
            clienteData.codigo_cliente = codigo;
        }

        // Agregar usuario actual
        const user = await getCurrentUser();
        if (user) {
            clienteData.created_by = user.id;
        }

        console.log('📤 Creando cliente con datos:', clienteData);

        const { data, error } = await client
            .from('clientes')
            .insert([clienteData])
            .select()
            .single();

        if (error) {
            console.error('❌ Error en createCliente:', error);
            return { error: handleSupabaseError(error, 'createCliente') };
        }

        console.log('✅ Cliente creado:', data);
        return { data, success: true };
    };

    const updateCliente = async (id, updates) => {
        if (!client) return { error: 'Not initialized' };

        const { data, error } = await client
            .from('clientes')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return { error: handleSupabaseError(error, 'updateCliente') };
        }

        return { data, success: true };
    };

    const deleteCliente = async (id) => {
        if (!client) return { error: 'Not initialized' };

        const { error } = await client
            .from('clientes')
            .delete()
            .eq('id', id);

        if (error) {
            return { error: handleSupabaseError(error, 'deleteCliente') };
        }

        return { success: true };
    };

    // ========== CONTRATOS ==========
    const getContratosSync = async () => {
        if (!client) return [];

        const { data, error } = await client
            .from('contratos')
            .select(`
                *,
                cliente:clientes(*)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching contratos:', error);
            return [];
        }

        return data || [];
    };

    const getContratosFiltered = async (filter) => {
        if (!client) return [];

        let query = client
            .from('contratos')
            .select(`
                *,
                cliente:clientes(*)
            `);

        if (filter.search) {
            query = query.or(`codigo_contrato.ilike.%${filter.search}%`);
        }

        if (filter.status && filter.status !== 'all') {
            query = query.eq('estado_contrato', filter.status);
        }

        if (filter.tipo && filter.tipo !== 'all') {
            query = query.eq('tipo_contrato', filter.tipo);
        }

        query = query.order('created_at', { ascending: false });

        const { data, error } = await query;

        if (error) {
            console.error('Error filtering contratos:', error);
            return [];
        }

        return data || [];
    };

    const getContratoById = async (id) => {
        if (!client) return null;

        const { data, error } = await client
            .from('contratos')
            .select(`
                *,
                cliente:clientes(*)
            `)
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching contrato:', error);
            return null;
        }

        return data;
    };

    const createContrato = async (contratoData) => {
        if (!client) return { error: 'Not initialized' };

        // Generar código secuencial si no existe (Formato: CTTO-0001)
        if (!contratoData.codigo_contrato) {
            const codigo = await generateCode('contratos', 'CTTO-', 4, 'codigo_contrato');
            contratoData.codigo_contrato = codigo;
        }

        // Agregar usuario actual
        const user = await getCurrentUser();
        if (user) {
            contratoData.created_by = user.id;
        }

        console.log('📤 Creando contrato con datos:', contratoData);

        const { data, error } = await client
            .from('contratos')
            .insert([contratoData])
            .select()
            .single();

        if (error) {
            console.error('❌ Error en createContrato:', error);
            return { error: handleSupabaseError(error, 'createContrato') };
        }

        console.log('✅ Contrato creado:', data);
        return { data, success: true };
    };

    const updateContrato = async (id, updates) => {
        if (!client) return { error: 'Not initialized' };

        const { data, error } = await client
            .from('contratos')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return { error: handleSupabaseError(error, 'updateContrato') };
        }

        return { data, success: true };
    };

    const deleteContrato = async (id) => {
        if (!client) return { error: 'Not initialized' };

        const { error } = await client
            .from('contratos')
            .delete()
            .eq('id', id);

        if (error) {
            return { error: handleSupabaseError(error, 'deleteContrato') };
        }

        return { success: true };
    };

    // ========== EQUIPOS ==========
    const getEquiposSync = async () => {
        if (!client) return [];

        const { data, error } = await client
            .from('equipos')
            .select(`
                *,
                cliente:clientes(*)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching equipos:', error);
            return [];
        }

        return data || [];
    };

    const getEquiposFiltered = async (filter) => {
        if (!client) return [];

        let query = client
            .from('equipos')
            .select(`
                *,
                cliente:clientes(*)
            `);

        if (filter.search) {
            query = query.or(`nombre_equipo.ilike.%${filter.search}%,marca.ilike.%${filter.search}%,modelo.ilike.%${filter.search}%`);
        }

        if (filter.clienteId && filter.clienteId !== 'all') {
            query = query.eq('cliente_id', filter.clienteId);
        }

        if (filter.estado && filter.estado !== 'all') {
            query = query.eq('estado', filter.estado);
        }

        query = query.order('created_at', { ascending: false });

        const { data, error } = await query;

        if (error) {
            console.error('Error filtering equipos:', error);
            return [];
        }

        return data || [];
    };

    const getEquipoById = async (id) => {
        if (!client) return null;

        const { data, error } = await client
            .from('equipos')
            .select(`
                *,
                cliente:clientes(*)
            `)
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching equipo:', error);
            return null;
        }

        return data;
    };

    const createEquipo = async (equipoData) => {
        if (!client) return { error: 'Not initialized' };

        // Generar código si no existe
        if (!equipoData.codigo_equipo) {
            let codigo = await generateCode('equipos');

            // Fallback (RPC falló)
            if (!codigo) {
                console.warn('⚠️ RPC generateCode falló para equipos, usando fallback local');
                codigo = 'EQU' + Date.now().toString().slice(-6);
            }
            equipoData.codigo_equipo = codigo;
        }

        // Agregar usuario actual
        const user = await getCurrentUser();
        if (user) {
            equipoData.created_by = user.id;
        }

        console.log('📤 Creando equipo con datos:', equipoData);

        const { data, error } = await client
            .from('equipos')
            .insert([equipoData])
            .select()
            .single();

        if (error) {
            console.error('❌ Error en createEquipo:', error);
            console.error('❌ Detalles del error:', JSON.stringify(error, null, 2));
            return { error: handleSupabaseError(error, 'createEquipo') };
        }

        console.log('✅ Equipo creado exitosamente:', data);
        return { data, success: true };
    };

    const updateEquipo = async (id, updates) => {
        if (!client) return { error: 'Not initialized' };

        const { data, error } = await client
            .from('equipos')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return { error: handleSupabaseError(error, 'updateEquipo') };
        }

        return { data, success: true };
    };

    const deleteEquipo = async (id) => {
        if (!client) return { error: 'Not initialized' };

        const { error } = await client
            .from('equipos')
            .delete()
            .eq('id', id);

        if (error) {
            return { error: handleSupabaseError(error, 'deleteEquipo') };
        }

        return { success: true };
    };

    // ========== VISITAS ==========
    const getVisitasSync = async () => {
        if (!client) return [];

        const { data, error } = await client
            .from('visitas')
            .select(`
                *,
                cliente:clientes(*),
                contrato:contratos(*),
                tecnico:profiles!tecnico_id(*)
            `)
            .order('fecha_inicio', { ascending: false });

        if (error) {
            console.error('Error fetching visitas:', error);
            return [];
        }

        return data || [];
    };

    const createVisita = async (visitaData) => {
        if (!client) return { error: 'Not initialized' };

        // 0. Generar codigo si no existe (Formato: VIS-0001)
        if (!visitaData.codigo_visita) {
            const codigo = await generateCode('visitas', 'VIS-', 4, 'codigo_visita');
            visitaData.codigo_visita = codigo;
        }

        // 1. Map camelCase to snake_case for DB
        const dbData = {
            codigo_visita: visitaData.codigo_visita,
            cliente_id: visitaData.clienteId,
            contrato_id: visitaData.contratoId,
            equipo_id: visitaData.equipoId,
            tipo_visita: visitaData.tipoVisita,
            usuario_soporte: visitaData.usuarioSoporte,
            tecnico_id: visitaData.usuarioSoporte, // Mapear usuarioSoporte a tecnico_id por constraint
            fecha_inicio: visitaData.fechaInicio,
            fecha_fin: visitaData.fechaFin,
            descripcion_trabajo: visitaData.descripcionTrabajo,
            costo_servicio: visitaData.costoServicio,
            moneda: visitaData.moneda,
            trabajo_realizado: visitaData.trabajoRealizado
        };

        // 2. Insert into 'visitas' table
        const { data, error } = await client
            .from('visitas')
            .insert([dbData])
            .select()
            .single();

        if (error) {
            return { error: handleSupabaseError(error, 'createVisita') };
        }

        return { data, success: true };
    };

    const updateVisita = async (id, updates) => {
        if (!client) return { error: 'Not initialized' };

        // 1. Map updates to snake_case
        const dbUpdates = {};
        if (updates.clienteId) dbUpdates.cliente_id = updates.clienteId;
        if (updates.contratoId !== undefined) dbUpdates.contrato_id = updates.contratoId;
        if (updates.equipoId !== undefined) dbUpdates.equipo_id = updates.equipoId;

        if (updates.tipoVisita) dbUpdates.tipo_visita = updates.tipoVisita;
        if (updates.usuarioSoporte) {
            dbUpdates.usuario_soporte = updates.usuarioSoporte;
            dbUpdates.tecnico_id = updates.usuarioSoporte;
        }
        if (updates.fechaInicio) dbUpdates.fecha_inicio = updates.fechaInicio;
        if (updates.fechaFin) dbUpdates.fecha_fin = updates.fechaFin;
        if (updates.descripcionTrabajo) dbUpdates.descripcion_trabajo = updates.descripcionTrabajo;
        if (updates.costoServicio !== undefined) dbUpdates.costo_servicio = updates.costoServicio;
        if (updates.moneda) dbUpdates.moneda = updates.moneda;
        if (updates.trabajoRealizado !== undefined) dbUpdates.trabajo_realizado = updates.trabajoRealizado;

        // 2. Update record
        const { data, error } = await client
            .from('visitas')
            .update(dbUpdates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return { error: handleSupabaseError(error, 'updateVisita') };
        }

        return { data, success: true };
    };

    const deleteVisita = async (id) => {
        if (!client) return { error: 'Not initialized' };

        const { error } = await client
            .from('visitas')
            .delete()
            .eq('id', id);

        if (error) {
            return { error: handleSupabaseError(error, 'deleteVisita') };
        }

        return { success: true };
    };

    // ========== DASHBOARD STATS ==========
    const getDashboardStats = async () => {
        if (!client) return {};

        const { data, error } = await client.rpc('get_dashboard_stats');

        if (error) {
            console.error('Error fetching dashboard stats:', error);
            return {
                clientes_activos: 0,
                contratos_activos: 0,
                visitas_mes: 0,
                equipos_operativos: 0
            };
        }

        return data || {};
    };

    // ========== AUTHENTICACIÓN ==========
    // ========== AUTHENTICACIÓN ==========
    const authenticateUser = async (username, password) => {
        if (!client) return { error: 'Not initialized' };

        console.log('🔄 Buscando email para usuario:', username);

        // 1. Buscar email por username usando RPC
        const { data: userData, error: lookError } = await client
            .rpc('get_email_by_username', { p_username: username });

        if (lookError) {
            console.error('❌ Error buscando usuario:', lookError);

            // INTENTO DE RECUPERACIÓN (FALLBACK)
            if (!username.includes('@')) {
                const tryEmail = `${username}@alltech.local`;
                const res = await signIn(tryEmail, password);
                if (!res.error) return res;
            }

            // Fallback: intentar login directo asumiendo que username es email (si tiene @)
            if (username.includes('@')) {
                return await signIn(username, password);
            }
            return { error: 'Error al buscar usuario' };
        }

        // Si no encuentra datos o array vacío
        if (!userData || userData.length === 0) {
            console.warn('⚠️ Usuario no encontrado:', username);

            // INTENTO DE RECUPERACIÓN INTELIGENTE
            // Si el nombre de usuario no tiene @, probamos con el dominio local
            if (!username.includes('@')) {
                const tryEmail = `${username}@alltech.local`;
                console.log('🔄 Intentando login con email autogenerado:', tryEmail);
                const res = await signIn(tryEmail, password);
                if (!res.error) return res;
            }

            // Último intento: probar directo (quizás es email aunque no se encontró por username)
            if (username.includes('@')) {
                return await signIn(username, password);
            }
            return { error: 'Usuario no encontrado' };
        }

        const emailToLogin = userData[0].email;
        console.log('✅ Email encontrado:', emailToLogin);

        // 2. Hacer login con el email encontrado
        return await signIn(emailToLogin, password);
    };

    const createUser = async (userData) => {
        if (!client) return { error: 'Not initialized' };

        console.log('🆕 Creando usuario en Supabase:', userData.username);

        // 1. SignUp en Supabase Auth
        // Nota: Esto iniciará sesión automáticamente con el nuevo usuario si el email no requiere confirmación
        const { data, error } = await client.auth.signUp({
            email: userData.email,
            password: userData.password,
            options: {
                data: {
                    username: userData.username,
                    full_name: userData.name
                }
            }
        });

        if (error) {
            console.error('❌ Error en signUp:', error);
            return { error: error.message };
        }

        if (data.user) {
            // Actualizar rol y campos laborales si se proveyeron
            const roleName = userData.role || 'Usuario';

            // Buscar ID del rol
            const { data: roleData } = await client
                .from('roles')
                .select('id')
                .eq('name', roleName)
                .single();

            if (roleData) {
                // Actualizar o Crear profiles con rol y campos laborales
                // Usamos UPSERT para manejar caso donde el trigger falló o no existe
                const profilePayload = {
                    id: data.user.id,
                    username: userData.username,
                    full_name: userData.name,
                    role_id: roleData.id,
                    email: userData.email,
                    is_active: true,
                    allowed_modules: userData.allowedModules || null
                };

                const { error: profileError } = await client
                    .from('profiles')
                    .upsert(profilePayload, { onConflict: 'id' });

                if (profileError) {
                    console.error('⚠️ Error al upsert perfil:', profileError);
                }
            }

            return { success: true, user: data.user, session: data.session };
        }

        return { error: 'No se pudo crear el usuario' };
    };

    // ========== REALTIME SUBSCRIPCIONES ==========

    const subscribeToChanges = (callback) => {
        if (!client) return null;

        console.log('🔌 Iniciando suscripción a Realtime...');

        // Suscribirse a cambios en todas las tablas relevantes
        const subscription = client
            .channel('db-changes')
            .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
                console.log('🔔 Cambio detectado en DB:', payload);
                if (callback) callback(payload);
            })
            .subscribe((status) => {
                console.log('📡 Estado de suscripción:', status);
            });

        return subscription;
    };

    // ========== PRODUCTOS ==========
    const getProductosSync = async () => {
        if (!client) return [];

        const { data, error } = await client
            .from('productos')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching productos:', error);
            return [];
        }



        return data || [];
    };

    const getProductoById = async (id) => {
        if (!client) return null;

        const { data, error } = await client
            .from('productos')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching producto:', error);
            return null;
        }

        return data;
    };

    const createProducto = async (productoData) => {
        if (!client) return { error: 'Not initialized' };

        // Generar código secuencial si no existe (Formato: PO-0001 para Producto, SO-0001 para Servicio)
        if (!productoData.codigo) {
            const prefix = productoData.tipo === 'Servicio' ? 'SO-' : 'PO-';
            const codigo = await generateCode('productos', prefix, 4, 'codigo');
            productoData.codigo = codigo;
        }

        const user = await getCurrentUser();
        if (user && !productoData.created_by) {
            productoData.created_by = user.id;
        }

        console.log('📤 Creando producto con datos:', productoData);

        // Mapear directamente a las columnas reales del schema
        const dataToInsert = {
            codigo: productoData.codigo,
            nombre: productoData.nombre,
            descripcion: productoData.descripcion || null,
            tipo: productoData.tipo || 'Producto',
            categoria: productoData.categoria || null,
            subcategoria: productoData.subcategoria || null,
            marca: productoData.marca || null,
            modelo: productoData.modelo || null,
            unidad_medida: productoData.unidadMedida || productoData.unidad_medida || 'Unidad',
            precio_costo: parseFloat(productoData.precioCosto || productoData.precio_costo) || 0,
            precio_venta: parseFloat(productoData.precioVenta || productoData.precio_venta || productoData.precio) || 0,
            moneda: productoData.moneda || 'USD',
            stock_actual: parseInt(productoData.stockActual || productoData.stock_actual) || 0,
            stock_minimo: parseInt(productoData.stockMinimo || productoData.stock_minimo) || 0,
            proveedor: productoData.proveedor || null,
            tiempo_entrega_dias: productoData.tiempoEntregaDias || productoData.tiempo_entrega_dias || null,
            garantia_meses: productoData.garantiaMeses || productoData.garantia_meses || null,
            imagen_url: productoData.imagenUrl || productoData.imagen_url || null,
            estado: productoData.estado || 'Activo',
            es_inventariable: productoData.esInventariable ?? productoData.es_inventariable ?? true,
            impuesto_iva: parseFloat(productoData.impuestoIva || productoData.impuesto_iva) || 0,
            notas: productoData.notas || null,
            created_by: productoData.created_by || null
        };

        const { data, error } = await client
            .from('productos')
            .insert([dataToInsert])
            .select()
            .single();

        if (error) {
            console.error('❌ Error creando producto:', error);
            return { error: handleSupabaseError(error, 'createProducto') };
        }

        console.log('✅ Producto creado:', data);
        return { data, success: true };
    };

    const updateProducto = async (id, updates) => {
        if (!client) return { error: 'Not initialized' };

        // Mapear campos de frontend a columnas reales del schema
        const dataToUpdate = { updated_at: new Date().toISOString() };

        if (updates.nombre !== undefined) dataToUpdate.nombre = updates.nombre;
        if (updates.descripcion !== undefined) dataToUpdate.descripcion = updates.descripcion;
        if (updates.tipo !== undefined) dataToUpdate.tipo = updates.tipo;
        if (updates.codigo !== undefined) dataToUpdate.codigo = updates.codigo;
        if (updates.categoria !== undefined) dataToUpdate.categoria = updates.categoria;
        if (updates.subcategoria !== undefined) dataToUpdate.subcategoria = updates.subcategoria;
        if (updates.marca !== undefined) dataToUpdate.marca = updates.marca;
        if (updates.modelo !== undefined) dataToUpdate.modelo = updates.modelo;
        if (updates.estado !== undefined) dataToUpdate.estado = updates.estado;
        if (updates.notas !== undefined) dataToUpdate.notas = updates.notas;
        if (updates.moneda !== undefined) dataToUpdate.moneda = updates.moneda;
        if (updates.proveedor !== undefined) dataToUpdate.proveedor = updates.proveedor;

        // Mapeo de precio: el UI envía "precio", la DB usa "precio_venta"
        if (updates.precio !== undefined) dataToUpdate.precio_venta = parseFloat(updates.precio) || 0;
        if (updates.precioVenta !== undefined) dataToUpdate.precio_venta = parseFloat(updates.precioVenta) || 0;
        if (updates.precio_venta !== undefined) dataToUpdate.precio_venta = parseFloat(updates.precio_venta) || 0;
        if (updates.precioCosto !== undefined) dataToUpdate.precio_costo = parseFloat(updates.precioCosto) || 0;
        if (updates.precio_costo !== undefined) dataToUpdate.precio_costo = parseFloat(updates.precio_costo) || 0;

        // Campos numéricos opcionales
        if (updates.stockActual !== undefined || updates.stock_actual !== undefined) {
            dataToUpdate.stock_actual = parseInt(updates.stockActual || updates.stock_actual) || 0;
        }
        if (updates.stockMinimo !== undefined || updates.stock_minimo !== undefined) {
            dataToUpdate.stock_minimo = parseInt(updates.stockMinimo || updates.stock_minimo) || 0;
        }
        if (updates.unidadMedida !== undefined || updates.unidad_medida !== undefined) {
            dataToUpdate.unidad_medida = updates.unidadMedida || updates.unidad_medida;
        }
        if (updates.impuestoIva !== undefined || updates.impuesto_iva !== undefined) {
            dataToUpdate.impuesto_iva = parseFloat(updates.impuestoIva || updates.impuesto_iva) || 0;
        }

        const { data, error } = await client
            .from('productos')
            .update(dataToUpdate)
            .eq('id', id)
            .select()
            .single();

        if (error) return { error: handleSupabaseError(error, 'updateProducto') };
        return { data, success: true };
    };

    const deleteProducto = async (id) => {
        if (!client) return { error: 'Not initialized' };

        const { error } = await client
            .from('productos')
            .delete()
            .eq('id', id);

        if (error) {
            return { error: handleSupabaseError(error, 'deleteProducto') };
        }

        return { success: true };
    };

    // ========== PROFORMAS ==========
    const getProformasSync = async () => {
        if (!client) return [];

        const { data, error } = await client
            .from('proformas')
            .select(`
                *,
                cliente:clientes(*)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching proformas:', error);
            return [];
        }

        return data || [];
    };

    const getProformaById = async (id) => {
        if (!client) return null;

        const { data, error } = await client
            .from('proformas')
            .select(`
                *,
                cliente:clientes(*)
            `)
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching proforma:', error);
            return null;
        }

        return data;
    };

    const createProforma = async (proformaData) => {
        if (!client) return { error: 'Not initialized' };

        // Generar codigo si no existe
        if (!proformaData.codigo_proforma) {
            proformaData.codigo_proforma = 'PROF' + Date.now().toString().slice(-6);
        }

        const user = await getCurrentUser();
        if (user) {
            proformaData.created_by = user.id;
        }

        console.log('📤 Creando proforma con datos:', proformaData);

        const { data, error } = await client
            .from('proformas')
            .insert([proformaData])
            .select()
            .single();

        if (error) {
            console.error('❌ Error en createProforma:', error);
            return { error: handleSupabaseError(error, 'createProforma') };
        }

        console.log('✅ Proforma creada:', data);
        return { data, success: true };
    };

    const createProformaItems = async (proformaId, items) => {
        if (!client) return { error: 'Not initialized' };

        const itemsToInsert = items.map((item, index) => ({
            proforma_id: proformaId,
            producto_id: item.productoId || null,
            orden: index + 1,
            codigo: item.codigo || null,
            descripcion: item.descripcion,
            cantidad: parseFloat(item.cantidad) || 1,
            precio_unitario: parseFloat(item.precioUnitario) || 0,
            total: parseFloat(item.total) || 0,
            notas: item.notas || null
        }));

        console.log('📤 Insertando items de proforma:', itemsToInsert);

        const { data, error } = await client
            .from('proforma_items')
            .insert(itemsToInsert)
            .select();

        if (error) {
            console.error('❌ Error en createProformaItems:', error);
            return { error: handleSupabaseError(error, 'createProformaItems') };
        }

        console.log('✅ Items de proforma creados:', data);
        return { data, success: true };
    };

    const updateProforma = async (id, updates) => {
        if (!client) return { error: 'Not initialized' };

        const { data, error } = await client
            .from('proformas')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return { error: handleSupabaseError(error, 'updateProforma') };
        }

        return { data, success: true };
    };

    const deleteProforma = async (id) => {
        if (!client) return { error: 'Not initialized' };

        const { error } = await client
            .from('proformas')
            .delete()
            .eq('id', id);

        if (error) {
            return { error: handleSupabaseError(error, 'deleteProforma') };
        }

        return { success: true };
    };

    // ========== PEDIDOS ==========
    const getPedidosSync = async () => {
        if (!client) return [];

        const { data, error } = await client
            .from('pedidos')
            .select(`
                *,
                cliente:clientes(*)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching pedidos:', error);
            return [];
        }

        return data || [];
    };

    const getPedidoById = async (id) => {
        if (!client) return null;

        const { data, error } = await client
            .from('pedidos')
            .select(`
                *,
                cliente:clientes(*)
            `)
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching pedido:', error);
            return null;
        }

        return data;
    };

    const createPedido = async (pedidoData) => {
        if (!client) return { error: 'Not initialized' };

        // Generar IDs si no existen
        if (!pedidoData.pedido_id) {
            pedidoData.pedido_id = 'PED' + Date.now().toString().slice(-6);
        }
        if (!pedidoData.numero_pedido) {
            pedidoData.numero_pedido = pedidoData.pedido_id;
        }

        const user = await getCurrentUser();
        if (user) {
            pedidoData.created_by = user.id;
        }

        console.log('📤 Creando pedido con datos:', pedidoData);

        const { data, error } = await client
            .from('pedidos')
            .insert([pedidoData])
            .select()
            .single();

        if (error) {
            console.error('❌ Error en createPedido:', error);
            return { error: handleSupabaseError(error, 'createPedido') };
        }

        console.log('✅ Pedido creado:', data);
        return { data, success: true };
    };

    const updatePedido = async (id, updates) => {
        if (!client) return { error: 'Not initialized' };

        const { data, error } = await client
            .from('pedidos')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return { error: handleSupabaseError(error, 'updatePedido') };
        }

        return { data, success: true };
    };

    const deletePedido = async (id) => {
        if (!client) return { error: 'Not initialized' };

        const { error } = await client
            .from('pedidos')
            .delete()
            .eq('id', id);

        if (error) {
            return { error: handleSupabaseError(error, 'deletePedido') };
        }

        return { success: true };
    };

    // ========== EMPLEADOS ==========
    const getEmpleadosSync = async () => {
        if (!client) return [];

        const { data, error } = await client
            .from('empleados')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching empleados:', error);
            return [];
        }

        return data || [];
    };

    const getEmpleadoById = async (id) => {
        if (!client) return null;

        const { data, error } = await client
            .from('empleados')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching empleado:', error);
            return null;
        }

        return data;
    };

    const createEmpleado = async (empleadoData) => {
        if (!client) return { error: 'Not initialized' };

        // Preparar datos para Supabase
        const dataToInsert = {
            nombre: empleadoData.nombre,
            cedula: empleadoData.cedula,
            email: empleadoData.email || null,
            telefono: empleadoData.telefono || null,
            cargo: empleadoData.cargo,
            fecha_alta: empleadoData.fechaAlta,
            tipo_salario: empleadoData.tipoSalario,
            salario_total: empleadoData.salarioTotal,
            tipo_contrato: empleadoData.tipoContrato,
            tiempo_contrato: empleadoData.tiempoContrato || null,
            estado: empleadoData.estado || 'Activo',
            vacaciones_tomadas: empleadoData.vacacionesTomadas || 0,
            aguinaldo_pagado: empleadoData.aguinaldoPagado || false,
            observaciones: empleadoData.observaciones || null
        };

        const { data, error } = await client
            .from('empleados')
            .insert([dataToInsert])
            .select()
            .single();

        if (error) {
            return { error: handleSupabaseError(error, 'createEmpleado') };
        }

        return { success: true, data };
    };

    const updateEmpleado = async (id, empleadoData) => {
        if (!client) return { error: 'Not initialized' };

        // Preparar datos para actualizar
        const dataToUpdate = {};
        if (empleadoData.nombre) dataToUpdate.nombre = empleadoData.nombre;
        if (empleadoData.cedula) dataToUpdate.cedula = empleadoData.cedula;
        if (empleadoData.email !== undefined) dataToUpdate.email = empleadoData.email;
        if (empleadoData.telefono !== undefined) dataToUpdate.telefono = empleadoData.telefono;
        if (empleadoData.cargo) dataToUpdate.cargo = empleadoData.cargo;
        if (empleadoData.fechaAlta) dataToUpdate.fecha_alta = empleadoData.fechaAlta;
        if (empleadoData.tipoSalario) dataToUpdate.tipo_salario = empleadoData.tipoSalario;
        if (empleadoData.salarioTotal !== undefined) dataToUpdate.salario_total = empleadoData.salarioTotal;
        if (empleadoData.tipoContrato) dataToUpdate.tipo_contrato = empleadoData.tipoContrato;
        if (empleadoData.tiempoContrato !== undefined) dataToUpdate.tiempo_contrato = empleadoData.tiempoContrato;
        if (empleadoData.estado) dataToUpdate.estado = empleadoData.estado;
        if (empleadoData.vacacionesTomadas !== undefined) dataToUpdate.vacaciones_tomadas = empleadoData.vacacionesTomadas;
        if (empleadoData.aguinaldoPagado !== undefined) dataToUpdate.aguinaldo_pagado = empleadoData.aguinaldoPagado;
        if (empleadoData.observaciones !== undefined) dataToUpdate.observaciones = empleadoData.observaciones;

        dataToUpdate.updated_at = new Date().toISOString();

        const { error } = await client
            .from('empleados')
            .update(dataToUpdate)
            .eq('id', id);

        if (error) {
            return { error: handleSupabaseError(error, 'updateEmpleado') };
        }

        return { success: true };
    };

    const deleteEmpleado = async (id) => {
        if (!client) return { error: 'Not initialized' };

        const { error } = await client
            .from('empleados')
            .delete()
            .eq('id', id);

        if (error) {
            return { error: handleSupabaseError(error, 'deleteEmpleado') };
        }

        return { success: true };
    };


    // ========== PRESTACIONES: VACACIONES ==========
    const getVacacionesByEmpleado = async (empleadoId) => {
        if (!client) return [];

        const { data, error } = await client
            .from('vacaciones_historial')
            .select('*')
            .eq('empleado_id', empleadoId)
            .order('fecha_inicio', { ascending: false });

        if (error) {
            console.error('Error fetching vacaciones:', error);
            return [];
        }
        return data || [];
    };

    const createVacacion = async (vacacionData) => {
        if (!client) return { error: 'Not initialized' };

        // Insertar en historial
        const { data, error } = await client
            .from('vacaciones_historial')
            .insert([{
                empleado_id: vacacionData.empleadoId,
                fecha_inicio: vacacionData.fechaInicio,
                fecha_fin: vacacionData.fechaFin,
                dias: vacacionData.dias,
                anio_correspondiente: vacacionData.anioCorrespondiente,
                observaciones: vacacionData.observaciones
            }])
            .select()
            .single();

        if (error) {
            return { error: handleSupabaseError(error, 'createVacacion') };
        }

        // Actualizar contador en empleados
        // Nota: esto debería ser una transacción o trigger, pero por simplicidad lo hacemos aquí
        const { error: updateError } = await client.rpc('increment_vacaciones_tomadas', {
            p_empleado_id: vacacionData.empleadoId,
            p_dias: vacacionData.dias
        });

        // Fallback si RPC no existe: lectura y actualización manual
        if (updateError) {
            console.warn('⚠️ RPC increment_vacaciones_tomadas falló, usando actualización manual');
            const emp = await getEmpleadoById(vacacionData.empleadoId);
            if (emp) {
                await updateEmpleado(emp.id, {
                    vacacionesTomadas: (emp.vacaciones_tomadas || 0) + vacacionData.dias
                });
            }
        }

        return { success: true, data };
    };

    const updateVacacion = async (id, updates) => {
        // Pendiente: manejar recalculo de días tomados si se cambian los días
        if (!client) return { error: 'Not initialized' };

        const { data, error } = await client
            .from('vacaciones_historial')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) return { error: handleSupabaseError(error, 'updateVacacion') };
        return { success: true, data };
    };

    const deleteVacacion = async (id) => {
        if (!client) return { error: 'Not initialized' };

        // Primero obtener para descontar días
        const { data: vacacion } = await client
            .from('vacaciones_historial')
            .select('*')
            .eq('id', id)
            .single();

        const { error } = await client
            .from('vacaciones_historial')
            .delete()
            .eq('id', id);

        if (error) return { error: handleSupabaseError(error, 'deleteVacacion') };

        // Revertir días tomados
        if (vacacion) {
            const emp = await getEmpleadoById(vacacion.empleado_id);
            if (emp) {
                await updateEmpleado(emp.id, {
                    vacacionesTomadas: Math.max(0, (emp.vacaciones_tomadas || 0) - vacacion.dias)
                });
            }
        }

        return { success: true };
    };

    // ========== PRESTACIONES: AGUINALDOS ==========
    const getAguinaldosByEmpleado = async (empleadoId) => {
        if (!client) return [];
        const { data, error } = await client
            .from('aguinaldos_historial')
            .select('*')
            .eq('empleado_id', empleadoId)
            .order('anio', { ascending: false });

        if (error) {
            console.error('Error fetching aguinaldos:', error);
            return [];
        }
        return data || [];
    };

    const createAguinaldo = async (aguinaldoData) => {
        if (!client) return { error: 'Not initialized' };

        const { data, error } = await client
            .from('aguinaldos_historial')
            .insert([{
                empleado_id: aguinaldoData.empleadoId,
                anio: aguinaldoData.anio,
                monto: aguinaldoData.monto,
                dias_calculados: aguinaldoData.diasCalculados,
                fecha_pago: aguinaldoData.fechaPago || new Date(),
                observaciones: aguinaldoData.observaciones
            }])
            .select()
            .single();

        if (error) return { error: handleSupabaseError(error, 'createAguinaldo') };

        // Marcar como pagado en perfil empleado si es del año actual
        if (aguinaldoData.anio === new Date().getFullYear()) {
            await updateEmpleado(aguinaldoData.empleadoId, { aguinaldoPagado: true });
        }

        return { success: true, data };
    };

    const deleteAguinaldo = async (id) => {
        if (!client) return { error: 'Not initialized' };
        const { error } = await client
            .from('aguinaldos_historial')
            .delete()
            .eq('id', id);
        if (error) return { error: handleSupabaseError(error, 'deleteAguinaldo') };
        return { success: true };
    };

    // ========== PRESTACIONES: NÓMINAS ==========
    const getNominasByEmpleado = async (empleadoId) => {
        if (!client) return [];
        const { data, error } = await client
            .from('nominas')
            .select('*')
            .eq('empleado_id', empleadoId)
            .order('periodo_fin', { ascending: false });

        if (error) {
            console.error('Error fetching nominas:', error);
            return [];
        }
        return data || [];
    };

    const createNomina = async (nominaData) => {
        if (!client) return { error: 'Not initialized' };

        const { data, error } = await client
            .from('nominas')
            .insert([{
                empleado_id: nominaData.empleadoId,
                periodo_inicio: nominaData.periodoInicio,
                periodo_fin: nominaData.periodoFin,
                tipo_periodo: nominaData.tipoPeriodo,
                salario_base: nominaData.salarioBase,
                ingresos_extras: (nominaData.ingresosExtras || 0) + (nominaData.horas_extras || 0) + (nominaData.bonificaciones || 0),
                deduccion_inss: nominaData.deduccionInss || 0,
                deduccion_ir: nominaData.deduccionIr || 0,
                otras_deducciones: (nominaData.otrasDeducciones || 0) + (nominaData.adelantos || 0),
                total_neto: nominaData.totalNeto,
                estado: nominaData.estado || 'Pagado',
                fecha_pago: nominaData.fechaPago || new Date(),
                notas: nominaData.notas
            }])
            .select()
            .single();

        if (error) return { error: handleSupabaseError(error, 'createNomina') };
        return { success: true, data };
    };

    const getRecentNominas = async (limit = 50) => {
        if (!client) return [];
        const { data, error } = await client
            .from('nominas')
            .select(`
                *,
                empleado:empleados(nombre, cargo)
            `)
            .order('periodo_fin', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching recent nominas:', error);
            return [];
        }
        return data || [];
    };

    // ========== PRESTACIONES: AUSENCIAS ==========
    const getAusenciasByEmpleado = async (empleadoId) => {
        if (!client) return [];
        const { data, error } = await client
            .from('ausencias')
            .select('*')
            .eq('empleado_id', empleadoId)
            .order('fecha_inicio', { ascending: false });

        if (error) {
            console.error('Error fetching ausencias:', error);
            return [];
        }
        return data || [];
    };

    const getAllAusencias = async (limit = 50) => {
        if (!client) return [];
        const { data, error } = await client
            .from('ausencias')
            .select(`
                *,
                empleado:empleados(nombre, cargo)
            `)
            .order('fecha_inicio', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching all ausencias:', error);
            return [];
        }
        return data || [];
    };

    const createAusencia = async (ausenciaData) => {
        if (!client) return { error: 'Not initialized' };

        const { data, error } = await client
            .from('ausencias')
            .insert([{
                empleado_id: ausenciaData.empleadoId,
                fecha_inicio: ausenciaData.fechaInicio,
                fecha_fin: ausenciaData.fechaFin,
                dias: ausenciaData.dias,
                tipo_descuento: ausenciaData.tipoDescuento,
                motivo: ausenciaData.motivo || null,
                observaciones: ausenciaData.observaciones || null
            }])
            .select()
            .single();

        if (error) return { error: handleSupabaseError(error, 'createAusencia') };

        // Si se descuenta de vacaciones, actualizar contador
        if (ausenciaData.tipoDescuento === 'vacaciones') {
            const emp = await getEmpleadoById(ausenciaData.empleadoId);
            if (emp) {
                await updateEmpleado(emp.id, {
                    vacacionesTomadas: (emp.vacaciones_tomadas || 0) + ausenciaData.dias
                });
            }
        }

        return { success: true, data };
    };

    const updateAusencia = async (id, updates) => {
        if (!client) return { error: 'Not initialized' };

        const { data, error } = await client
            .from('ausencias')
            .update({
                empleado_id: updates.empleadoId,
                fecha_inicio: updates.fechaInicio,
                fecha_fin: updates.fechaFin,
                dias: updates.dias,
                tipo_descuento: updates.tipoDescuento,
                motivo: updates.motivo,
                observaciones: updates.observaciones
            })
            .eq('id', id)
            .select()
            .single();

        if (error) return { error: handleSupabaseError(error, 'updateAusencia') };
        return { success: true, data };
    };

    const deleteAusencia = async (id) => {
        if (!client) return { error: 'Not initialized' };

        // Obtener primero para revertir días si era de vacaciones
        const { data: ausencia } = await client
            .from('ausencias')
            .select('*')
            .eq('id', id)
            .single();

        const { error } = await client
            .from('ausencias')
            .delete()
            .eq('id', id);

        if (error) return { error: handleSupabaseError(error, 'deleteAusencia') };

        // Revertir días de vacaciones si aplica
        if (ausencia && ausencia.tipo_descuento === 'vacaciones') {
            const emp = await getEmpleadoById(ausencia.empleado_id);
            if (emp) {
                await updateEmpleado(emp.id, {
                    vacacionesTomadas: Math.max(0, (emp.vacaciones_tomadas || 0) - ausencia.dias)
                });
            }
        }

        return { success: true };
    };

    // ========== ALL NOMINAS (for history) ==========
    const getAllNominas = async (limit = 100) => {
        if (!client) return [];
        const { data, error } = await client
            .from('nominas')
            .select(`
                *,
                empleado:empleados(nombre, cargo)
            `)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching all nominas:', error);
            return [];
        }
        return data || [];
    };

    const deleteNomina = async (id) => {
        if (!client) return { error: 'Not initialized' };
        const { error } = await client
            .from('nominas')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting nomina:', error);
            return { error: handleSupabaseError(error, 'deleteNomina') };
        }
        return { success: true };
    };

    // ========== PUBLIC API ==========
    // ========== SOFTWARE ==========
    const getSoftwareSync = async () => {
        if (!client) return [];

        const { data, error } = await client
            .from('software')
            .select(`
                *,
                cliente:clientes(id, nombre_cliente, empresa)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching software:', error);
            return [];
        }

        return data || [];
    };

    const getSoftwareFiltered = async (filter) => {
        if (!client) return [];

        let query = client
            .from('software')
            .select(`
                *,
                cliente:clientes(id, nombre_cliente, empresa)
            `);

        if (filter.search) {
            query = query.or(`nombre_software.ilike.%${filter.search}%,numero_licencia.ilike.%${filter.search}%,numero_serie.ilike.%${filter.search}%`);
        }

        if (filter.tipo && filter.tipo !== 'all') {
            query = query.eq('tipo_licencia', filter.tipo);
        }

        if (filter.activacion && filter.activacion !== 'all') {
            query = query.eq('modo_activacion', filter.activacion);
        }

        query = query.order('created_at', { ascending: false });

        const { data, error } = await query;

        if (error) {
            console.error('Error filtering software:', error);
            return [];
        }

        return data || [];
    };

    const getSoftwareById = async (id) => {
        if (!client) return null;

        const { data, error } = await client
            .from('software')
            .select(`
                *,
                cliente:clientes(*)
            `)
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching software item:', error);
            return null;
        }

        return data;
    };

    const createSoftware = async (softwareData) => {
        if (!client) return { error: 'Not initialized' };

        // Generar código si no existe
        if (!softwareData.codigoSoftware) {
            // Intento básico de generación de código único
            softwareData.codigoSoftware = 'SOFT' + Date.now().toString().slice(-6);
        }

        const user = await getCurrentUser();
        if (user) {
            softwareData.created_by = user.id;
        }

        // Mapear campos de frontend a columnas de DB
        const dataToInsert = {
            codigo_software: softwareData.codigoSoftware,
            nombre_software: softwareData.nombreSoftware,
            tipo_software: softwareData.tipoSoftware,
            numero_licencia: softwareData.numeroLicencia,
            numero_serie: softwareData.numeroSerie,
            cliente_id: softwareData.clienteId || softwareData.cliente_id,
            nombre_registro: softwareData.nombreRegistro,
            tipo_licencia: softwareData.tipoLicencia,
            modo_activacion: softwareData.modoActivacion,
            fecha_inicio_poliza: softwareData.fechaInicioPoliza,
            fecha_fin_poliza: softwareData.fechaFinPoliza || null,
            created_by: softwareData.created_by
        };

        const { data, error } = await client
            .from('software')
            .insert([dataToInsert])
            .select()
            .single();

        if (error) {
            console.error('❌ Error creando software:', error);
            return { error: handleSupabaseError(error, 'createSoftware') };
        }

        return { data, success: true };
    };

    const updateSoftware = async (id, updates) => {
        if (!client) return { error: 'Not initialized' };

        const dataToUpdate = { updated_at: new Date().toISOString() };

        if (updates.nombreSoftware !== undefined) dataToUpdate.nombre_software = updates.nombreSoftware;
        if (updates.tipoSoftware !== undefined) dataToUpdate.tipo_software = updates.tipoSoftware;
        if (updates.numeroLicencia !== undefined) dataToUpdate.numero_licencia = updates.numeroLicencia;
        if (updates.numeroSerie !== undefined) dataToUpdate.numero_serie = updates.numeroSerie;
        if (updates.clienteId !== undefined) dataToUpdate.cliente_id = updates.clienteId;
        if (updates.nombreRegistro !== undefined) dataToUpdate.nombre_registro = updates.nombreRegistro;
        if (updates.tipoLicencia !== undefined) dataToUpdate.tipo_licencia = updates.tipoLicencia;
        if (updates.modoActivacion !== undefined) dataToUpdate.modo_activacion = updates.modoActivacion;
        if (updates.fechaInicioPoliza !== undefined) dataToUpdate.fecha_inicio_poliza = updates.fechaInicioPoliza;
        if (updates.fechaFinPoliza !== undefined) dataToUpdate.fecha_fin_poliza = updates.fechaFinPoliza;

        const { data, error } = await client
            .from('software')
            .update(dataToUpdate)
            .eq('id', id)
            .select()
            .single();

        if (error) return { error: handleSupabaseError(error, 'updateSoftware') };
        return { data, success: true };
    };

    const getUsersSync = async () => {
        if (!client) return [];

        const { data, error } = await client
            .from('profiles')
            .select(`
                *,
                roles (name)
            `);

        if (error) {
            console.error('Error fetching users:', error);
            return [];
        }

        return data.map(u => ({
            id: u.id,
            username: u.username,
            name: u.full_name,
            email: u.email,
            role: u.roles?.name || 'Usuario',
            role_id: u.role_id,
            allowedModules: u.allowed_modules || [] // Si existe
        }));
    };

    const updateUser = async (userId, updates) => {
        if (!client) return { error: 'Not initialized' };

        // Map updates to profile columns
        const profileUpdates = {
            updated_at: new Date().toISOString()
        };

        if (updates.name) profileUpdates.full_name = updates.name;
        if (updates.role) {
            const { data: roleData } = await client.from('roles').select('id').eq('name', updates.role).single();
            if (roleData) profileUpdates.role_id = roleData.id;
        }
        if (updates.allowedModules) profileUpdates.allowed_modules = updates.allowedModules;
        if (updates.email) profileUpdates.email = updates.email;

        const { error } = await client
            .from('profiles')
            .update(profileUpdates)
            .eq('id', userId);

        if (error) return { error: handleSupabaseError(error, 'updateUser') };
        return { success: true };
    };

    const deleteUser = async (userId) => {
        if (!client) return { error: 'Not initialized' };
        // We can only delete from profiles, auth.users is protected
        const { error } = await client
            .from('profiles')
            .delete()
            .eq('id', userId);

        if (error) return { error: handleSupabaseError(error, 'deleteUser') };
        return { success: true };
    };

    const deleteSoftware = async (id) => {
        if (!client) return { error: 'Not initialized' };

        const { error } = await client
            .from('software')
            .delete()
            .eq('id', id);

        if (error) {
            return { error: handleSupabaseError(error, 'deleteSoftware') };
        }

        return { success: true };
    };

    // ========== GESTIÓN DE TÉCNICOS ==========
    const getPagosTecnicos = async (tecnicoId = null) => {
        if (!client) return [];
        let query = client.from('pagos_tecnicos').select('*, tecnico:profiles(*)');
        if (tecnicoId) query = query.eq('tecnico_id', tecnicoId);
        query = query.order('fecha_pago', { ascending: false });

        const { data, error } = await query;
        if (error) {
            console.error('Error fetching pagos tecnicos:', error);
            return [];
        }
        return data || [];
    };

    const createPagoTecnico = async (pagoData) => {
        if (!client) return { error: 'Not initialized' };

        // Generar número de recibo si no existe
        if (!pagoData.numero_recibo) {
            pagoData.numero_recibo = await generateCode('pagos_tecnicos', 'RCP-', 5, 'numero_recibo');
        }

        const user = await getCurrentUser();
        if (user) pagoData.created_by = user.id;

        const { data, error } = await client
            .from('pagos_tecnicos')
            .insert([pagoData])
            .select()
            .single();

        if (error) return { error: handleSupabaseError(error, 'createPagoTecnico') };
        return { data, success: true };
    };

    const marcarVisitasComoPagadas = async (pagoId, visitaIds) => {
        if (!client) return { error: 'Not initialized' };

        const { error } = await client
            .from('visitas')
            .update({ pago_id: pagoId })
            .in('id', visitaIds);

        if (error) return { error: handleSupabaseError(error, 'marcarVisitasComoPagadas') };
        return { success: true };
    };

    const getVisitasPorTecnico = async (tecnicoId, filter = {}) => {
        if (!client) return [];
        let query = client
            .from('visitas')
            .select('*, cliente:clientes(*), equipo:equipos(*)')
            .eq('tecnico_id', tecnicoId);

        if (filter.pendientesPago) {
            console.log('🔍 getVisitasPorTecnico: Filtering pending payments (RELAXED FILTER)');
            // Relaxed filter: Show all visits without payment, regardless of 'trabajo_realizado' status for now
            // This is to debug if visits are not marked as realized but are completed
            query = query.is('pago_id', null);
        }
        if (filter.fechaInicio) query = query.gte('fecha_inicio', filter.fechaInicio);
        if (filter.fechaFin) query = query.lte('fecha_inicio', filter.fechaFin);

        query = query.order('fecha_inicio', { ascending: false });

        console.log('🔍 Executing query for techId:', tecnicoId);
        const { data, error } = await query;
        if (error) {
            console.error('❌ Error fetching visitas por tecnico:', error);
            return [];
        }
        console.log(`✅ Found ${data?.length || 0} visits for tech ${tecnicoId}`);
        return data || [];
    };

    const getAntiguedadTecnico = async (tecnicoId) => {
        if (!client) return null;
        const { data, error } = await client
            .from('profiles')
            .select('fecha_alta, created_at')
            .eq('id', tecnicoId)
            .single();

        if (error) return null;
        return data.fecha_alta || data.created_at;
    };

    // ========== PUBLIC API ==========
    return {
        // Inicialización
        init,
        subscribeToChanges, // Exportar función

        // Auth
        authenticateUser,
        createUser, // Exportar createUser
        updateUser,
        deleteUser,
        getCurrentUser,
        getCurrentProfile,
        getUsersSync,
        signIn,
        signOut,
        isAuthenticated,

        // Dashboard
        getDashboardStats,

        // Clientes
        getClientesSync,
        getClientesFiltered,
        getClienteById,
        createCliente,
        updateCliente,
        deleteCliente,

        // Contratos
        getContratosSync,
        getContratosFiltered,
        getContratoById,
        createContrato,
        updateContrato,
        deleteContrato,

        // Software
        getSoftwareSync,
        getSoftwareFiltered,
        getSoftwareById,
        createSoftware,
        updateSoftware,
        deleteSoftware,

        // Equipos
        getEquiposSync,
        getEquiposFiltered,
        getEquipoById,
        createEquipo,
        updateEquipo,
        deleteEquipo,

        // Visitas
        getVisitasSync,
        createVisita,
        updateVisita,
        deleteVisita,

        // Productos
        getProductosSync,
        getProductoById,
        createProducto,
        updateProducto,
        deleteProducto,

        // Proformas
        getProformasSync,
        getProformaById,
        createProforma,
        createProformaItems,
        updateProforma,
        deleteProforma,

        // Pedidos
        getPedidosSync,
        getPedidoById,
        createPedido,
        updatePedido,
        deletePedido,

        // Empleados
        getEmpleadosSync,
        getEmpleadoById,
        createEmpleado,
        updateEmpleado,
        deleteEmpleado,

        // Prestaciones
        getVacacionesByEmpleado,
        createVacacion,
        updateVacacion,
        deleteVacacion,

        getAguinaldosByEmpleado,
        createAguinaldo,
        deleteAguinaldo,

        getNominasByEmpleado,
        createNomina,
        getRecentNominas,
        getAllNominas,
        deleteNomina,

        // Ausencias
        getAusenciasByEmpleado,
        getAllAusencias,
        createAusencia,
        deleteAusencia,

        // Gestión de Técnicos
        getPagosTecnicos,
        createPagoTecnico,
        marcarVisitasComoPagadas,
        getVisitasPorTecnico,
        getAntiguedadTecnico,

        // Helpers
        generateCode
    };
})();

// Auto-inicializar cuando se carga
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        SupabaseDataService.init();
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SupabaseDataService;
}

