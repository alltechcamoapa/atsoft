import re

path = r'c:\Users\ALLTECH\Documents\PROYECTOS APPS\ALLTECH SUPPORT\js\modules\login-module.js'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# Replace render to add Biometric checkbox and button
old_html = r"""                        <!-- Password -->
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
                        </div>"""

new_html = r"""                        <!-- Password -->
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
                        </div>"""

text = text.replace(old_html, new_html)

# Add Biometric logic functions
bio_logic = """
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

    // ========== LOGIN HANDLER =========="""

text = text.replace("    // ========== LOGIN HANDLER ==========", bio_logic)

# In handleLogin, after successful login:
success_logic_old = """            // Crear objeto usuario para State
            const user = {"""

success_logic_new = """            // Biometric Register Check
            const bioCheck = document.getElementById('enableBiometric');
            if (bioCheck && bioCheck.checked) {
                await registerBiometric(username, password);
            }

            // Crear objeto usuario para State
            const user = {"""

text = text.replace(success_logic_old, success_logic_new)

# Export API
api_old = """    // ========== PUBLIC API ==========
    return {
        render,
        handleLogin
    };"""

api_new = """    // ========== PUBLIC API ==========
    return {
        render,
        handleLogin,
        handleBiometricLogin
    };"""

text = text.replace(api_old, api_new)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print('Updated login file')
