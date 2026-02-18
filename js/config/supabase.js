/**
 * ALLTECH SUPPORT - Supabase Configuration v2
 * Configuración del cliente de Supabase con debug mejorado
 */

// ========== CONFIGURACIÓN ==========
// Credenciales reales del proyecto de Supabase
const SUPABASE_CONFIG = {
    url: 'https://jadusmuinpzmmpffybez.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphZHVzbXVpbnB6bW1wZmZ5YmV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwODYwMzcsImV4cCI6MjA4NTY2MjAzN30.L7EXSEnoSLfpn4MYeaZholV15WubEeflvM1qyvbqFfM'
};


// ========== CLIENTE DE SUPABASE ==========
let supabaseClient = null;

/**
 * Inicializa el cliente de Supabase
 */
const initSupabase = () => {
    if (typeof supabase === 'undefined') {
        console.error('❌ Supabase library not loaded');
        return null;
    }

    if (!supabaseClient) {
        supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
        // console.log('✅ Supabase client initialized');
    }

    return supabaseClient;
};

/**
 * Obtiene el cliente de Supabase (singleton)
 */
const getSupabaseClient = () => {
    if (!supabaseClient) {
        return initSupabase();
    }
    return supabaseClient;
};

/**
 * Verifica si el usuario está autenticado
 * @returns {Promise<boolean>} true si hay sesión activa
 */
const isAuthenticated = async () => {
    try {
        const client = getSupabaseClient();
        if (!client) {
            console.warn('⚠️ Supabase client no disponible');
            return false;
        }

        const { data: { session }, error } = await client.auth.getSession();

        if (error) {
            console.error('❌ Error verificando sesión:', error.message);
            return false;
        }

        return !!session;
    } catch (error) {
        console.error('❌ Error en isAuthenticated:', error);
        return false;
    }
};

/**
 * Obtiene el usuario actual
 */
const getCurrentUser = async () => {
    const client = getSupabaseClient();
    if (!client) return null;

    const { data: { user } } = await client.auth.getUser();
    return user;
};

/**
 * Obtiene el perfil del usuario actual
 */
const getCurrentProfile = async () => {
    const client = getSupabaseClient();
    if (!client) {
        console.error('❌ Supabase client not available');
        return null;
    }

    const user = await getCurrentUser();
    if (!user) {
        console.error('❌ No authenticated user');
        return null;
    }

    console.log('🔍 Buscando perfil para usuario:', user.id);

    // Query 1: Obtener perfil
    const { data: profileData, error: profileError } = await client
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (profileError) {
        console.error('❌ Error al obtener perfil:', profileError);
        console.error('Código:', profileError.code);
        console.error('Mensaje:', profileError.message);
        return null;
    }

    if (!profileData) {
        console.error('❌ No se encontró perfil');
        return null;
    }

    console.log('✅ Perfil encontrado:', profileData);

    // Query 2: Obtener rol
    if (profileData.role_id) {
        const { data: roleData, error: roleError } = await client
            .from('roles')
            .select('*')
            .eq('id', profileData.role_id)
            .single();

        if (!roleError && roleData) {
            profileData.role = roleData;
            profileData.role_name = roleData.name;
            console.log('✅ Rol encontrado:', roleData.name);
        } else {
            console.warn('⚠️ No se pudo obtener el rol:', roleError);
            profileData.role_name = 'Sin Rol';
        }
    }

    // Agregar email del usuario autenticado
    profileData.email = user.email;

    console.log('✅ Perfil completo:', profileData);

    return profileData;
};

/**
 * Sign in con email y password
 */
const signIn = async (email, password) => {
    const client = getSupabaseClient();
    if (!client) return { error: 'Supabase not initialized' };

    const { data, error } = await client.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        console.error('Sign in error:', error);
        return { error: error.message };
    }

    return { data };
};

/**
 * Sign out
 */
const signOut = async () => {
    const client = getSupabaseClient();
    if (!client) return { error: 'Supabase not initialized' };

    const { error } = await client.auth.signOut();

    if (error) {
        console.error('Sign out error:', error);
        return { error: error.message };
    }

    return { success: true };
};

/**
 * Crear nuevo usuario con Supabase Auth
 */
const createUser = async (userData) => {
    const client = getSupabaseClient();
    if (!client) return { error: 'Supabase not initialized' };

    try {
        // 1. Crear usuario en Supabase Auth
        const { data: authData, error: authError } = await client.auth.admin.createUser({
            email: userData.email,
            password: userData.password,
            email_confirm: true,
            user_metadata: {
                full_name: userData.name,
                username: userData.username
            }
        });

        if (authError) {
            console.error('Error creating auth user:', authError);
            return { error: authError.message };
        }

        // 2. Buscar el role_id basado en el nombre del rol
        const { data: roleData, error: roleError } = await client
            .from('roles')
            .select('id')
            .eq('name', userData.role)
            .single();

        if (roleError) {
            console.error('Error fetching role:', roleError);
            // Si no se encuentra el rol, usar un rol por defecto o null
        }

        // 3. Crear perfil en la tabla profiles
        const { data: profileData, error: profileError } = await client
            .from('profiles')
            .insert([{
                id: authData.user.id,
                full_name: userData.name,
                username: userData.username,
                email: userData.email,
                role_id: roleData?.id || null,
                allowed_modules: userData.allowedModules || []
            }])
            .select()
            .single();

        if (profileError) {
            console.error('Error creating profile:', profileError);
            return { error: profileError.message };
        }

        console.log('✅ Usuario creado exitosamente:', profileData);
        return { data: profileData, success: true };
    } catch (error) {
        console.error('Error in createUser:', error);
        return { error: error.message };
    }
};

/**
 * Escuchar cambios en el estado de autenticación
 */
const onAuthStateChange = (callback) => {
    const client = getSupabaseClient();
    if (!client) return () => { };

    const { data: { subscription } } = client.auth.onAuthStateChange(callback);

    return () => subscription.unsubscribe();
};

// ========== HELPER PARA MANEJO DE ERRORES ==========
const handleSupabaseError = (error, context = '') => {
    console.error(`❌ Supabase Error${context ? ` (${context})` : ''}:`, error);

    // Errores comunes
    if (error.code === 'PGRST116') {
        return 'No se encontraron registros';
    }
    if (error.code === '23505') {
        return 'Ya existe un registro con estos datos';
    }
    if (error.code === '23503') {
        return 'No se puede eliminar porque tiene datos relacionados';
    }
    if (error.message.includes('JWT')) {
        return 'Sesión expirada. Por favor inicia sesión nuevamente';
    }

    return error.message || 'Error desconocido';
};

// ========== EXPORTAR ==========
// Make functions globally available for browser
if (typeof window !== 'undefined') {
    window.initSupabase = initSupabase;
    window.getSupabaseClient = getSupabaseClient;
    window.isAuthenticated = isAuthenticated;
    window.getCurrentUser = getCurrentUser;
    window.getCurrentProfile = getCurrentProfile;
    window.signIn = signIn;
    window.signOut = signOut;
    window.createUser = createUser;
    window.onAuthStateChange = onAuthStateChange;
    window.handleSupabaseError = handleSupabaseError;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initSupabase,
        getSupabaseClient,
        isAuthenticated,
        getCurrentUser,
        getCurrentProfile,
        signIn,
        signOut,
        createUser,
        onAuthStateChange,
        handleSupabaseError
    };
}
