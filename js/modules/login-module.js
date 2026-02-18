/**
 * ALLTECH - Login Module v4
 * Corregido para interpretar correctamente result.data
 */

const LoginModule = (() => {
    let isLoading = false;

    // ========== RENDER ==========
    const render = () => {
        return `
            <div class="login-container" style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px;">
                <div class="login-card" style="max-width: 450px; width: 100%; padding: 48px 40px; background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%); border: 1px solid #333333; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.7);">
                    
                    <!-- Header con logo centrado -->
                    <div class="login-header" style="text-align: center; margin-bottom: 40px;">
                        <div style="display: flex; justify-content: center; margin-bottom: 24px;">
                            <img src="assets/logo.png" 
                                 alt="ALLTECH" 
                                 class="login-logo" 
                                 style="max-width: 200px; height: auto; display: block; background: transparent;" 
                                 onerror="this.style.display='none'">
                        </div>
                        <h1 style="color: #ffffff; font-size: 32px; font-weight: 700; margin: 0 0 12px 0; letter-spacing: -0.5px;">ALLTECH</h1>
                        <p style="color: #94a3b8; font-size: 15px; margin: 0;">Sistema de Gestión Empresarial</p>
                    </div>

                    <!-- Formulario -->
                    <form id="loginForm" onsubmit="event.preventDefault(); LoginModule.handleLogin();" style="margin-bottom: 32px;">
                        
                        <!-- Username -->
                        <div style="margin-bottom: 20px;">
                            <label for="loginUsername" style="color: #cbd5e1; font-size: 14px; font-weight: 600; display: block; margin-bottom: 10px;">Nombre de Usuario</label>
                            <input 
                                type="text" 
                                id="loginUsername" 
                                name="username" 
                                required 
                                placeholder="admin"
                                autocomplete="username"
                                style="width: 100%; padding: 14px 16px; background: rgba(255, 255, 255, 0.05); border: 1px solid #444444; border-radius: 10px; color: #ffffff; font-size: 15px; outline: none; transition: all 0.2s; box-sizing: border-box;"
                                onfocus="this.style.borderColor='#1a73e8'; this.style.background='rgba(26, 115, 232, 0.15)'"
                                onblur="this.style.borderColor='#444444'; this.style.background='rgba(255, 255, 255, 0.05)'"
                            />
                        </div>

                        <!-- Password -->
                        <div style="margin-bottom: 28px;">
                            <label for="loginPassword" style="color: #cbd5e1; font-size: 14px; font-weight: 600; display: block; margin-bottom: 10px;">Contraseña</label>
                            <input 
                                type="password" 
                                id="loginPassword" 
                                name="password" 
                                required 
                                placeholder="••••••••"
                                autocomplete="current-password"
                                style="width: 100%; padding: 14px 16px; background: rgba(255, 255, 255, 0.05); border: 1px solid #444444; border-radius: 10px; color: #ffffff; font-size: 15px; outline: none; transition: all 0.2s; box-sizing: border-box;"
                                onfocus="this.style.borderColor='#1a73e8'; this.style.background='rgba(26, 115, 232, 0.15)'"
                                onblur="this.style.borderColor='#444444'; this.style.background='rgba(255, 255, 255, 0.05)'"
                            />
                        </div>

                        <!-- Error message -->
                        <div id="loginError" style="display: none; padding: 14px 16px; background: rgba(220, 38, 38, 0.15); border: 1px solid #dc2626; border-radius: 10px; color: #fca5a5; margin-bottom: 20px; font-size: 14px; line-height: 1.6; white-space: pre-line;"></div>

                        <!-- Submit button -->
                        <button 
                            type="submit" 
                            id="loginBtn" 
                            style="width: 100%; padding: 16px; background: linear-gradient(135deg, #1a73e8 0%, #1557b0 100%); border: none; border-radius: 10px; color: white; font-weight: 600; font-size: 16px; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(26, 115, 232, 0.3);" 
                            onmouseover="if(!this.disabled){this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(26, 115, 232, 0.4)'}" 
                            onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(26, 115, 232, 0.3)'">
                            <span id="loginBtnText">Iniciar Sesión</span>
                            <span id="loginBtnLoader" style="display: none;">⏳ Cargando...</span>
                        </button>
                    </form>

                    <!-- Footer -->
                    <div style="text-align: center; padding-top: 24px; border-top: 1px solid #333333;">
                        <p style="color: #64748b; font-size: 13px; margin: 0 0 4px 0;">Versión 2.0 - Powered by Supabase</p>
                        <p style="color: #475569; font-size: 12px; margin: 0;">Camoapa, Nicaragua</p>
                    </div>
                </div>
            </div>
        `;
    };

    // ========== LOGIN HANDLER ==========
    const handleLogin = async () => {
        if (isLoading) return;

        const username = document.getElementById('loginUsername')?.value.trim();
        const password = document.getElementById('loginPassword')?.value;

        console.log('👤 Login attempt:', username);

        // Validación básica
        if (!username || !password) {
            showError('⚠️ Por favor completa todos los campos');
            return;
        }

        // Verificar que DataService esté disponible
        if (typeof DataService === 'undefined') {
            showError('❌ Error: Sistema no inicializado.\nRecarga la página (Ctrl+F5)');
            console.error('❌ DataService not found');
            return;
        }

        // Iniciar loading
        setLoading(true);
        hideError();

        try {
            console.log('🔐 Autenticando por username...');

            // Autenticar por username usando DataService
            const result = await DataService.authenticateUser(username, password);

            console.log('📊 Resultado completo:', result);

            // Verificar si hay error
            if (result.error) {
                const errorMsg = result.error.message || result.error; // Asegurar mensaje string

                // Mensajes más específicos
                let userFriendlyMsg = '';
                if (typeof errorMsg === 'string' && errorMsg.toLowerCase().includes('invalid')) {
                    userFriendlyMsg = '❌ Contraseña incorrecta o usuario no existe.';
                } else if (typeof errorMsg === 'string' && errorMsg.toLowerCase().includes('not confirmed')) {
                    userFriendlyMsg = '⚠️ Tu cuenta no está confirmada. Revisa tu correo.';
                } else if (typeof errorMsg === 'string' && errorMsg.toLowerCase().includes('not found')) {
                    userFriendlyMsg = '❌ Usuario no encontrado.';
                } else {
                    userFriendlyMsg = '❌ Error: ' + errorMsg;
                }

                // Mostrar error detallado para debug si es admin o localhost
                console.error('❌ Login Error Details:', result);
                alert(`Error de Inicio de Sesión:\n\n${userFriendlyMsg}\n\nDetalle técnico: ${JSON.stringify(result.error)}`);

                showError(userFriendlyMsg);
                setLoading(false);
                return;
            }

            // El resultado exitoso viene como { data: { user, session } }
            if (!result.data || !result.data.user) {
                showError('❌ Error inesperado: respuesta inválida del servidor');
                setLoading(false);
                console.error('❌ Resultado sin data.user:', result);
                return;
            }

            console.log('✅ Autenticación exitosa - Usuario ID:', result.data.user.id);

            // Obtener perfil desde la BD
            const profile = await getCurrentProfile();

            console.log('👤 Perfil obtenido:', profile);

            if (!profile) {
                showError('❌ No tienes perfil creado\n\nEjecuta el SQL para crear tu perfil:\n\nDO $$\nDECLARE v_user_id UUID := \'' + result.data.user.id + '\';\n         v_role_id UUID;\nBEGIN\n  SELECT id INTO v_role_id FROM roles WHERE name = \'Administrador\';\n  INSERT INTO profiles (id, username, full_name, role_id, is_active)\n  VALUES (v_user_id, \'admin\', \'Administrador\', v_role_id, true);\nEND $$;');
                await signOut();
                setLoading(false);
                return;
            }

            console.log('✅ Perfil cargado:', profile.username);

            // Verificar activo
            if (!profile.is_active) {
                showError('⚠️ Cuenta inactiva\n\nContacta al administrador.');
                await signOut();
                setLoading(false);
                return;
            }

            // Crear objeto usuario para State
            const user = {
                id: profile.id,
                username: profile.username,
                name: profile.full_name,
                email: result.data.user.email || '', // Email opcional
                role: profile.role?.name || 'Usuario',
                role_id: profile.role_id
            };

            // Login en State
            State.login(user);

            console.log('✅ Usuario logueado:', user.name);
            showSuccess('✅ ¡Bienvenido ' + user.name + '!');

            // Inicializar DataService y luego renderizar
            setTimeout(async () => {
                try {
                    // Inicializar DataService ANTES de renderizar
                    const dataLoaded = await DataService.init();
                    if (!dataLoaded) {
                        console.warn('⚠️ DataService cargó con datos parciales');
                    }

                    // Inicializar notificaciones
                    if (typeof NotificationService !== 'undefined') {
                        NotificationService.init();
                    }

                    if (typeof App !== 'undefined' && App.render) {
                        // console.log('🎨 Renderizando aplicación...');
                        App.render();

                        // Mostrar toast de bienvenida
                        setTimeout(() => {
                            if (typeof NotificationService !== 'undefined') {
                                NotificationService.showToast(`¡Bienvenido ${user.name}!`, 'success', 3000);
                            }
                        }, 500);
                    } else {
                        console.error('❌ App.render not found');
                        showError('❌ Error al cargar la app\nRecarga la página');
                        setLoading(false);
                    }
                } catch (error) {
                    console.error('❌ Error cargando datos:', error);
                    showError('❌ Error al cargar datos\n' + error.message);
                    setLoading(false);
                }
            }, 500);

        } catch (error) {
            console.error('❌ Error en login:', error);
            showError('❌ Error de conexión\n\n' + error.message + '\n\nVerifica tu internet y recarga.');
            setLoading(false);
        }
    };

    // ========== UI HELPERS ==========
    const setLoading = (loading) => {
        isLoading = loading;
        const btn = document.getElementById('loginBtn');
        const btnText = document.getElementById('loginBtnText');
        const btnLoader = document.getElementById('loginBtnLoader');
        const inputs = document.querySelectorAll('#loginForm input');

        if (btn && btnText && btnLoader) {
            if (loading) {
                btn.disabled = true;
                btn.style.opacity = '0.6';
                btn.style.cursor = 'not-allowed';
                btnText.style.display = 'none';
                btnLoader.style.display = 'inline';
                inputs.forEach(input => input.disabled = true);
            } else {
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
                btnText.style.display = 'inline';
                btnLoader.style.display = 'none';
                inputs.forEach(input => input.disabled = false);
            }
        }
    };

    const showError = (message) => {
        const errorDiv = document.getElementById('loginError');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            errorDiv.style.background = 'rgba(220, 38, 38, 0.15)';
            errorDiv.style.borderColor = '#dc2626';
            errorDiv.style.color = '#fca5a5';
            setTimeout(() => hideError(), 10000);
        } else {
            alert(message);
        }
    };

    const hideError = () => {
        const errorDiv = document.getElementById('loginError');
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
    };

    const showSuccess = (message) => {
        const errorDiv = document.getElementById('loginError');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            errorDiv.style.background = 'rgba(16, 185, 129, 0.15)';
            errorDiv.style.borderColor = '#10b981';
            errorDiv.style.color = '#6ee7b7';
        }
    };

    // ========== PUBLIC API ==========
    return {
        render,
        handleLogin
    };
})();

// Asegurar disponibilidad global
if (typeof window !== 'undefined') {
    window.LoginModule = LoginModule;
}
