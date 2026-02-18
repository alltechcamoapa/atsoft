/**
 * ALLTECH - Session Sync v3
 * Versión más robusta y compatible con navegadores móviles
 * Fixed: Manejo mejorado de errores y timeout
 */

const SessionSync = (() => {
    // Timeout para prevenir que la app se bloquee si Supabase no responde
    const SYNC_TIMEOUT_MS = 8000;

    /**
     * Verifica y sincroniza la sesión al iniciar
     * @returns {Promise} Siempre resuelve (nunca rechaza) para no bloquear la app
     */
    const checkAndSync = () => {
        return new Promise((resolve) => {
            // console.log('🔍 SessionSync: Verificando sesión...');

            // Verificar si estamos en protocolo file:// (local)
            if (window.location.protocol === 'file:') {
                console.warn('⚠️ SessionSync: Protocolo file:// detectado - Supabase no funcionará');
                console.warn('ℹ️ Para desarrollo local, usa un servidor HTTP (ej: npx serve)');
                // Limpiar cualquier estado guardado ya que no podemos verificar
                State.logout();
                resolve();
                return;
            }

            // Timeout de seguridad
            const timeoutId = setTimeout(() => {
                console.warn('⏳ SessionSync: Timeout alcanzado, continuando sin sincronización');
                resolve();
            }, SYNC_TIMEOUT_MS);

            try {
                // Verificar si hay funciones de Supabase disponibles
                if (typeof isAuthenticated !== 'function' || typeof getCurrentProfile !== 'function') {
                    console.warn('⚠️ SessionSync: Funciones de Supabase no disponibles');
                    clearTimeout(timeoutId);
                    resolve();
                    return;
                }

                // Verificar sesión de Supabase
                isAuthenticated()
                    .then(hasSupabaseSession => {
                        clearTimeout(timeoutId);
                        const stateIsAuthenticated = State.get('isAuthenticated');

                        // console.log('📊 Sesión Supabase:', hasSupabaseSession);
                        // console.log('📊 State isAuthenticated:', stateIsAuthenticated);

                        // Caso 1: State dice logueado pero Supabase no tiene sesión
                        if (stateIsAuthenticated && !hasSupabaseSession) {
                            console.warn('⚠️ State desincronizado - Limpiando...');
                            State.logout();
                            resolve();
                            return;
                        }

                        // Caso 2: Supabase tiene sesión pero State no
                        if (hasSupabaseSession && !stateIsAuthenticated) {
                            // console.log('✅ Restaurando sesión desde Supabase...');

                            getCurrentProfile()
                                .then(profile => {
                                    if (profile) {
                                        const user = {
                                            id: profile.id,
                                            username: profile.username,
                                            name: profile.full_name,
                                            email: profile.email,
                                            role: profile.role?.name || 'Usuario',
                                            role_id: profile.role_id
                                        };
                                        State.login(user);
                                        // console.log('✅ Usuario restaurado:', user.name);
                                    } else {
                                        console.warn('⚠️ Sesión sin perfil - Cerrando sesión');
                                        safeSignOut();
                                        State.logout();
                                    }
                                    resolve();
                                })
                                .catch(error => {
                                    console.error('❌ Error restaurando perfil:', error);
                                    safeSignOut();
                                    State.logout();
                                    resolve();
                                });
                            return;
                        }

                        // Caso 3: Ambos sincronizados
                        if (hasSupabaseSession && stateIsAuthenticated) {
                            // console.log('✅ Sesión sincronizada correctamente');
                            resolve();
                            return;
                        }

                        // Caso 4: Ambos deslogueados (normal - mostrará login)
                        // console.log('ℹ️ Sin sesión activa - Mostrando login');
                        resolve();
                    })
                    .catch(error => {
                        clearTimeout(timeoutId);
                        console.error('❌ Error verificando sesión:', error);
                        // En caso de error, mostrar login
                        State.logout();
                        resolve();
                    });

            } catch (error) {
                clearTimeout(timeoutId);
                console.error('❌ Error crítico en SessionSync:', error);
                State.logout();
                resolve();
            }
        });
    };

    /**
     * Helper para cerrar sesión de forma segura
     */
    const safeSignOut = () => {
        if (typeof signOut === 'function') {
            signOut().catch(err => console.warn('Error en signOut:', err));
        }
    };

    return {
        checkAndSync
    };
})();

// Hacer disponible globalmente
if (typeof window !== 'undefined') {
    window.SessionSync = SessionSync;
}
