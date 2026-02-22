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
                        <div style="margin-bottom: 20px;">
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

                        <!-- Biometric options -->
                        <div style="margin-bottom: 28px; display:flex; align-items:center; justify-content:space-between;">
                            ${window.PublicKeyCredential ? `
                            <label style="color: #cbd5e1; font-size: 13px; display:flex; align-items:center; cursor:pointer;">
                                <input type="checkbox" id="enableBiometric" style="margin-right: 8px;">
                                Guardar para Huella
                            </label>
                            ` : '<div></div>'}
                            
                            ${hasSavedBiometric() ? `
                            <button type="button" onclick="LoginModule.handleBiometricLogin()" style="background:rgba(26, 115, 232, 0.1); border:1px solid #1a73e8; border-radius: 8px; padding: 6px 12px; color:#60a5fa; font-size:13px; cursor:pointer; font-weight:600; display:flex; align-items:center; transition:all 0.2s;">
                                 <svg style="width:16px; height:16px; margin-right:6px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.092a14.5 14.5 0 00-2.8-5.619m11.536-4.524A14.502 14.502 0 0012 3a14.502 14.502 0 00-6.19 1.39A8.96 8.96 0 004.5 7.5"></path></svg>
                                 Entrar con Huella
                            </button>
                            ` : ''}
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


    // ========== BIOMETRIC LOGIC ==========
    const hasSavedBiometric = () => {
        return !!localStorage.getItem('alltech_bio_username') && !!window.PublicKeyCredential;
    };

    const registerBiometric = async (username, password) => {
        if (!window.PublicKeyCredential) return;
        try {
            const challenge = new Uint8Array(32);
            window.crypto.getRandomValues(challenge);
            const userId = new Uint8Array(16);
            window.crypto.getRandomValues(userId);

            const credential = await navigator.credentials.create({
                publicKey: {
                    challenge: challenge,
                    rp: { name: "ALLTECH" },
                    user: {
                        id: userId,
                        name: username,
                        displayName: username
                    },
                    pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
                    authenticatorSelection: {
                        authenticatorAttachment: "platform",
                        userVerification: "required"
                    },
                    timeout: 60000
                }
            });

            if (credential) {
                localStorage.setItem('alltech_bio_username', btoa(encodeURIComponent(username)));
                localStorage.setItem('alltech_bio_pwd', btoa(encodeURIComponent(password)));
                console.log('✅ Biometric registered locally for Quick Login');
            }
        } catch (e) {
            console.error("❌ Error registering biometric:", e);
        }
    };

    const handleBiometricLogin = async () => {
        if (!window.PublicKeyCredential) return;
        try {
            const challenge = new Uint8Array(32);
            window.crypto.getRandomValues(challenge);

            const assertion = await navigator.credentials.get({
                publicKey: {
                    challenge: challenge,
                    userVerification: "required"
                }
            });

            if (assertion) {
                const uMatch = localStorage.getItem('alltech_bio_username');
                const pMatch = localStorage.getItem('alltech_bio_pwd');
                
                if(uMatch && pMatch) {
                    const u = decodeURIComponent(atob(uMatch));
                    const p = decodeURIComponent(atob(pMatch));
                    
                    document.getElementById('loginUsername').value = u;
                    document.getElementById('loginPassword').value = p;
                    // Procede al login directamente
                    handleLogin(true); // pass skipBiometricCheck if needed but no
                } else {
                    showError("No se encontraron credenciales guardadas. Inicia sesión con contraseña.");
                }
            }
        } catch (e) {
            console.error("❌ Biometric login failed", e);
            showError("La autenticación con huella falló o fue cancelada.");
        }
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

            // Biometric Register Check
            const bioCheck = document.getElementById('enableBiometric');
            if (bioCheck && bioCheck.checked) {
                await registerBiometric(username, password);
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
        handleLogin,
        handleBiometricLogin
    };
})();

// Asegurar disponibilidad global
if (typeof window !== 'undefined') {
    window.LoginModule = LoginModule;
}
