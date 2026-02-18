/**
 * ALLTECH - Email Service
 * Maneja el envío de correos electrónicos usando EmailJS
 * Docs: https://www.emailjs.com/docs/
 */
const EmailService = (() => {

    // Configuración de EmailJS
    // IMPORTANTE: Reemplazar con tus credenciales de EmailJS
    const config = {
        serviceId: 'service_alltech', // Tu Service ID de EmailJS
        publicKey: 'YOUR_PUBLIC_KEY', // Tu Public Key de EmailJS
        templateId: 'template_default', // Template ID por defecto
        enabled: true,
        useMailto: true // Fallback a mailto: si EmailJS falla
    };

    /**
     * Inicializa EmailJS con la clave pública
     */
    const init = () => {
        if (typeof emailjs !== 'undefined' && config.publicKey !== 'YOUR_PUBLIC_KEY') {
            emailjs.init(config.publicKey);
            console.log('[Email] EmailJS initialized');
        } else {
            console.warn('[Email] EmailJS not loaded or not configured. Using mailto fallback.');
        }
    };

    /**
     * Valida un email
     * @param {string} email 
     * @returns {boolean}
     */
    const isValidEmail = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    /**
     * Envía un correo electrónico usando EmailJS
     * @param {string} toEmail - Destinatario
     * @param {string} subject - Asunto
     * @param {string} body - Cuerpo del mensaje (puede ser HTML)
     * @param {object} options - Opciones adicionales
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    const sendEmail = async (toEmail, subject, body, options = {}) => {
        try {
            console.log(`[Email] Sending to ${toEmail} | Subject: ${subject}`);

            // Validación básica
            if (!isValidEmail(toEmail)) {
                throw new Error('Email inválido');
            }

            if (!subject || subject.trim().length === 0) {
                throw new Error('El asunto es requerido');
            }

            if (!body || body.trim().length === 0) {
                throw new Error('El cuerpo del mensaje es requerido');
            }

            // Si EmailJS está disponible y configurado
            if (typeof emailjs !== 'undefined' && config.publicKey !== 'YOUR_PUBLIC_KEY' && config.enabled) {

                const templateParams = {
                    to_email: toEmail,
                    to_name: options.toName || toEmail.split('@')[0],
                    subject: subject,
                    message: body,
                    from_name: options.fromName || 'ALLTECH',
                    reply_to: options.replyTo || 'no-reply@alltech.com',
                    ...options.extraParams
                };

                // Usar template específico si se proporciona
                const templateToUse = options.templateId || config.templateId;

                const response = await emailjs.send(
                    config.serviceId,
                    templateToUse,
                    templateParams
                );

                if (response.status === 200) {
                    // Registrar en bitácora
                    if (typeof LogService !== 'undefined') {
                        LogService.log('comunicaciones', 'create', toEmail, 'Email enviado via EmailJS', {
                            subject,
                            messageLength: body.length
                        });
                    }

                    console.log('[Email] Email sent successfully via EmailJS');
                    return { success: true, messageId: response.text };
                } else {
                    throw new Error(`EmailJS returned status ${response.status}`);
                }

            } else if (config.useMailto) {
                // Fallback: Abrir cliente de correo del usuario
                console.log('[Email] Using mailto fallback');
                openMailTo(toEmail, subject, body);

                if (typeof LogService !== 'undefined') {
                    LogService.log('comunicaciones', 'create', toEmail, 'Email abierto via mailto', { subject });
                }

                return { success: true, method: 'mailto' };
            } else {
                throw new Error('EmailJS no configurado y mailto deshabilitado');
            }

        } catch (error) {
            console.error('[Email] Error:', error);

            if (typeof LogService !== 'undefined') {
                LogService.log('comunicaciones', 'error', toEmail, 'Fallo envío Email', {
                    error: error.message
                });
            }

            return { success: false, error: error.message || error.text };
        }
    };

    /**
     * Envía un email usando un template pre-definido
     * @param {string} toEmail 
     * @param {string} templateName - Nombre del template
     * @param {object} variables - Variables para el template
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    const sendTemplate = async (toEmail, templateName, variables = {}) => {
        const templates = {
            'contrato_creado': {
                subject: '✅ Contrato Creado - {{contratoId}}',
                body: `
                    <h2>¡Contrato Creado Exitosamente!</h2>
                    <p>Estimado/a cliente,</p>
                    <p>Su contrato <strong>{{contratoId}}</strong> ha sido creado correctamente.</p>
                    <h3>Detalles del Contrato:</h3>
                    <ul>
                        <li><strong>Cliente:</strong> {{cliente}}</li>
                        <li><strong>Fecha de inicio:</strong> {{fechaInicio}}</li>
                        <li><strong>Valor:</strong> ${{ valor }}</li>
                        <li><strong>Estado:</strong> {{estado}}</li>
                    </ul>
                    <p>Si tiene alguna pregunta, no dude en contactarnos.</p>
                    <br>
                    <p>Saludos cordiales,<br><strong>ALLTECH</strong></p>
                `
            },
            'visita_programada': {
                subject: '📅 Visita Técnica Programada',
                body: `
                    <h2>¡Visita Programada!</h2>
                    <p>Hola {{cliente}},</p>
                    <p>Le confirmamos que su visita técnica ha sido programada.</p>
                    <h3>Detalles de la Visita:</h3>
                    <ul>
                        <li><strong>Fecha:</strong> {{fecha}}</li>
                        <li><strong>Hora:</strong> {{hora}}</li>
                        <li><strong>Técnico asignado:</strong> {{tecnico}}</li>
                        <li><strong>Dirección:</strong> {{direccion}}</li>
                        <li><strong>Motivo:</strong> {{motivo}}</li>
                    </ul>
                    <p>Nos vemos pronto!</p>
                    <br>
                    <p>Saludos,<br><strong>ALLTECH</strong></p>
                `
            },
            'proforma_enviada': {
                subject: '💼 Proforma #{{proformaId}}',
                body: `
                    <h2>Proforma de Servicios</h2>
                    <p>Estimado/a {{cliente}},</p>
                    <p>Adjuntamos la proforma solicitada:</p>
                    <h3>Proforma #{{proformaId}}</h3>
                    <div style="margin: 20px 0;">
                        {{items}}
                    </div>
                    <h3 style="color: #1a73e8;">Total: ${{ total }}</h3>
                    <p>¿Desea proceder con este pedido? Responda este correo para confirmar.</p>
                    <br>
                    <p>Atentamente,<br><strong>ALLTECH</strong></p>
                `
            },
            'recordatorio_pago': {
                subject: '💵 Recordatorio de Pago',
                body: `
                    <h2>Recordatorio de Pago Pendiente</h2>
                    <p>Hola {{cliente}},</p>
                    <p>Le recordamos que tiene un pago pendiente:</p>
                    <ul>
                        <li><strong>Monto:</strong> ${{ monto }}</li>
                        <li><strong>Fecha de vencimiento:</strong> {{fechaVencimiento}}</li>
                        <li><strong>Contrato:</strong> {{contratoId}}</li>
                    </ul>
                    <p>Por favor, realice el pago a la brevedad posible para evitar interrupciones en el servicio.</p>
                    <p>¿Necesita ayuda? Contáctenos.</p>
                    <br>
                    <p>Saludos,<br><strong>ALLTECH</strong></p>
                `
            }
        };

        const template = templates[templateName];
        if (!template) {
            return { success: false, error: `Template '${templateName}' no encontrado` };
        }

        // Reemplazar variables en subject y body
        let subject = template.subject;
        let body = template.body;

        Object.keys(variables).forEach(key => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            subject = subject.replace(regex, variables[key]);
            body = body.replace(regex, variables[key]);
        });

        return await sendEmail(toEmail, subject, body, {
            fromName: 'ALLTECH',
            extraParams: variables
        });
    };

    /**
     * Abre el cliente de correo por defecto del usuario
     * @param {string} to - Destinatario
     * @param {string} subject - Asunto
     * @param {string} body - Cuerpo (texto plano)
     */
    const openMailTo = (to, subject, body) => {
        const href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.open(href, '_blank');
    };

    /**
     * Configura EmailJS con credenciales
     * @param {string} serviceId 
     * @param {string} publicKey 
     * @param {string} defaultTemplateId 
     */
    const configure = (serviceId, publicKey, defaultTemplateId = null) => {
        config.serviceId = serviceId;
        config.publicKey = publicKey;
        if (defaultTemplateId) {
            config.templateId = defaultTemplateId;
        }
        init();
    };

    /**
     * Obtiene la configuración actual
     * @returns {object}
     */
    const getConfig = () => ({ ...config });

    /**
     * Habilita o deshabilita el servicio
     * @param {boolean} enabled 
     */
    const setEnabled = (enabled) => {
        config.enabled = enabled;
    };

    // Auto-inicialización si EmailJS está disponible
    if (typeof emailjs !== 'undefined') {
        // Esperar a que el DOM esté listo
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }
    }

    return {
        sendEmail,
        sendTemplate,
        openMailTo,
        configure,
        getConfig,
        setEnabled,
        isValidEmail
    };
})();
