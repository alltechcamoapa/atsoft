/**
 * ALLTECH - WhatsApp Integration Service
 * Maneja el envío de mensajes a través de WhatsApp Web API (wa.me)
 */
const WhatsAppService = (() => {
    // Configuración
    const config = {
        enabled: true,
        defaultCountryCode: '503', // El Salvador by default
        useWebAPI: true // Usar wa.me en lugar de API backend
    };

    /**
     * Limpia y formatea un número de teléfono
     * @param {string} phone - Número a limpiar
     * @returns {string} - Número limpio con código de país
     */
    const formatPhone = (phone) => {
        // Eliminar todos los caracteres no numéricos
        let cleanPhone = phone.replace(/\D/g, '');

        // Si no tiene código de país, agregar el default
        if (cleanPhone.length === 8) {
            cleanPhone = config.defaultCountryCode + cleanPhone;
        }

        return cleanPhone;
    };

    /**
     * Valida un número de teléfono
     * @param {string} phone 
     * @returns {boolean}
     */
    const isValidPhone = (phone) => {
        const cleanPhone = phone.replace(/\D/g, '');
        return cleanPhone.length >= 8 && cleanPhone.length <= 15;
    };

    /**
     * Envía un mensaje de texto por WhatsApp
     * Abre WhatsApp Web con el mensaje pre-llenado
     * @param {string} phone - Número de teléfono (formato E.164 o local)
     * @param {string} message - Contenido del mensaje
     * @param {boolean} autoSend - Si es true, intenta enviar automáticamente (solo funciona en móvil)
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    const sendMessage = async (phone, message) => {
        try {
            if (!config.enabled) {
                console.warn('WhatsApp service is disabled');
                return { success: false, error: 'Servicio deshabilitado' };
            }

            // Validar teléfono
            if (!isValidPhone(phone)) {
                throw new Error('Número de teléfono inválido. Debe tener entre 8 y 15 dígitos.');
            }

            // Limpiar y formatear número
            const cleanPhone = formatPhone(phone);

            // Generar enlace de WhatsApp
            const whatsappLink = generateLink(cleanPhone, message);

            // Abrir WhatsApp en nueva ventana
            const whatsappWindow = window.open(whatsappLink, '_blank');

            if (!whatsappWindow) {
                throw new Error('No se pudo abrir WhatsApp. Verifica que los pop-ups estén permitidos.');
            }

            // Registrar en bitácora
            if (typeof LogService !== 'undefined') {
                LogService.log('comunicaciones', 'create', cleanPhone, 'Mensaje de WhatsApp preparado', {
                    length: message.length,
                    phone: cleanPhone
                });
            }

            console.log(`[WhatsApp] Opened chat with ${cleanPhone}`);

            // Simular delay para dar tiempo a abrir WhatsApp
            await new Promise(resolve => setTimeout(resolve, 500));

            return { success: true, phone: cleanPhone };

        } catch (error) {
            console.error('[WhatsApp] Error:', error);
            if (typeof LogService !== 'undefined') {
                LogService.log('comunicaciones', 'error', phone, 'Fallo envío WhatsApp', {
                    error: error.message
                });
            }
            return { success: false, error: error.message };
        }
    };

    /**
     * Genera un enlace de WhatsApp Click-to-Chat
     * @param {string} phone - Número de teléfono
     * @param {string} text - Texto pre-llenado (opcional)
     * @returns {string} - URL de WhatsApp
     */
    const generateLink = (phone, text = '') => {
        const cleanPhone = formatPhone(phone);
        const encodedText = encodeURIComponent(text);
        return text
            ? `https://wa.me/${cleanPhone}?text=${encodedText}`
            : `https://wa.me/${cleanPhone}`;
    };

    /**
     * Envía un mensaje con template
     * @param {string} phone 
     * @param {string} templateName - Nombre del template
     * @param {object} variables - Variables para reemplazar en el template
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    const sendTemplate = async (phone, templateName, variables = {}) => {
        const templates = {
            'contrato_creado': `¡Hola! 👋\n\nTu contrato *{{contratoId}}* ha sido creado exitosamente.\n\n📋 *Detalles:*\nCliente: {{cliente}}\nFecha inicio: {{fechaInicio}}\nValor: ${{ valor }}\n\n¿Tienes alguna pregunta?`,

            'visita_programada': `¡Hola {{cliente}}! 👋\n\nTe confirmamos que tu visita técnica está programada para:\n\n📅 *Fecha:* {{fecha}}\n⏰ *Hora:* {{hora}}\n🔧 *Técnico:* {{tecnico}}\n📍 *Dirección:* {{direccion}}\n\nNos vemos pronto!`,

            'recordatorio_pago': `Hola {{cliente}},\n\nTe recordamos que tienes un pago pendiente:\n\n💵 *Monto:* ${{ monto }}\n📅 *Vencimiento:* {{fechaVencimiento}}\n📄 *Contrato:* {{contratoId}}\n\n¿Necesitas ayuda?`,

            'proforma_enviada': `¡Hola {{cliente}}! 👋\n\nTe enviamos la proforma #{{proformaId}}:\n\n📋 *Detalles:*\n{{items}}\n\n💰 *Total:* ${{ total }}\n\n¿Deseas proceder con el pedido?`
        };

        let message = templates[templateName] || templateName;

        // Reemplazar variables
        Object.keys(variables).forEach(key => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            message = message.replace(regex, variables[key]);
        });

        return await sendMessage(phone, message);
    };

    /**
     * Configura el código de país por defecto
     * @param {string} countryCode - Código de país (ej: '503' para El Salvador)
     */
    const setDefaultCountryCode = (countryCode) => {
        config.defaultCountryCode = countryCode.replace(/\D/g, '');
    };

    /**
     * Obtiene la configuración actual
     * @returns {object}
     */
    const getConfig = () => ({ ...config });

    return {
        sendMessage,
        sendTemplate,
        generateLink,
        formatPhone,
        isValidPhone,
        setDefaultCountryCode,
        getConfig
    };
})();
