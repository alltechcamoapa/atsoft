# 📧 Guía de Configuración de Email y WhatsApp

Esta guía te ayudará a configurar los servicios de Email y WhatsApp en ALLTECH SUPPORT.

---

## 📱 WhatsApp Service

### ✅ Estado Actual
**COMPLETAMENTE FUNCIONAL** - No requiere configuración adicional.

### 🚀 Funcionalidades

El servicio de WhatsApp usa la API web de WhatsApp (wa.me) que funciona sin necesidad de backend o credenciales.

#### Funciones Disponibles:

1. **`sendMessage(phone, message)`**
   - Abre WhatsApp Web con el mensaje pre-llenado
   - Formatea automáticamente el número con código de país
   - Código de país por defecto: `503` (El Salvador)

2. **`sendTemplate(phone, templateName, variables)`**
   - Envía mensajes usando templates pre-definidos
   - Templates disponibles:
     - `contrato_creado`
     - `visita_programada`
     - `recordatorio_pago`
     - `proforma_enviada`

3. **`generateLink(phone, text)`**
   - Genera un enlace de WhatsApp directo

4. **`formatPhone(phone)`**
   - Formatea número de teléfono con código de país

5. **`setDefaultCountryCode(code)`**
   - Cambia el código de país por defecto

### 💡 Ejemplos de Uso

```javascript
// Envío simple
await WhatsAppService.sendMessage('77778888', '¡Hola! Tu pedido está listo.');

// Con template
await WhatsAppService.sendTemplate('77778888', 'visita_programada', {
    cliente: 'Juan Pérez',
    fecha: '25/02/2026',
    hora: '10:00 AM',
   tecnico: 'Carlos López',
    direccion: 'San Salvador Centro',
    motivo: 'Mantenimiento preventivo'
});

// Cambiar código de país
WhatsAppService.setDefaultCountryCode('52'); // México
```

### 🌎 Códigos de País Comunes

- **El Salvador:** 503
- **Guatemala:** 502
- **Honduras:** 504
- **México:** 52
- **Estados Unidos:** 1
- **España:** 34

---

## 📧 Email Service (EmailJS)

### ⚠️ Requiere Configuración

El servicio de Email usa **EmailJS** para enviar correos desde el frontend sin necesidad de backend.

### 📝 Paso 1: Crear Cuenta en EmailJS

1. Ve a [https://www.emailjs.com/](https://www.emailjs.com/)
2. Crea una cuenta gratuita (permite 200 emails/mes)
3. Verifica tu correo electrónico

### 📝 Paso 2: Configurar un Servicio de Email

1. En el dashboard de EmailJS, ve a **"Email Services"**
2. Haz clic en **"Add New Service"**
3. Selecciona tu proveedor de email (Gmail, Outlook, etc.)
4. Sigue las instrucciones para conectar tu cuenta
5. Copia el **Service ID** (ej: `service_abc123`)

### 📝 Paso 3: Crear un Template

1. Ve a **"Email Templates"**
2. Haz clic en **"Create New Template"**
3. Usa esta plantilla base:

```html
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; }
        h2 { color: #1a73e8; }
    </style>
</head>
<body>
    <h2>{{subject}}</h2>
    <p>Para: {{to_name}}</p>
    <div>
        {{message}}
    </div>
    <br><br>
    <p>---</p>
    <p><strong>{{from_name}}</strong></p>
</body>
</html>
```

4. Guarda el template y copia el **Template ID** (ej: `template_xyz789`)

### 📝 Paso 4: Obtener tu Public Key

1. Ve a **"Account" → "General"**
2. Copia tu **Public Key** (ej: `x7Yz_9AbCdEfGhIj`)

### 📝 Paso 5: Agregar EmailJS a tu Proyecto

1. Abre `index.html`
2. Agrega este script en el `<head>`:

```html
<!-- EmailJS SDK -->
<script type="text/javascript" src="https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js"></script>
```

### 📝 Paso 6: Configurar el Servicio en la App

Abre `js/services/email-service.js` y actualiza la configuración:

```javascript
const config = {
    serviceId: 'TU_SERVICE_ID',      // Reemplazar
    publicKey: 'TU_PUBLIC_KEY',       // Reemplazar
    templateId: 'TU_TEMPLATE_ID',     // Reemplazar
    enabled: true,
    useMailto: true
};
```

O configura dinámicamente desde el código:

```javascript
EmailService.configure(
    'service_abc123',    // Service ID
    'x7Yz_9AbCdEfGhIj',  // Public Key
    'template_xyz789'    // Template ID
);
```

### 💡 Ejemplos de Uso

```javascript
// Envío simple
await EmailService.sendEmail(
    'cliente@example.com',
    'Confirmación de Servicio',
    '<h2>¡Gracias por tu pedido!</h2><p>Tu servicio ha sido programado.</p>'
);

// Con template
await EmailService.sendTemplate('cliente@example.com', 'contrato_creado', {
    contratoId: 'C-2026-001',
    cliente: 'ABC Company',
    fechaInicio: '01/03/2026',
    valor: '1,500.00',
    estado: 'Activo'
});

// Fallback a mailto (si EmailJS no está configurado)
EmailService.openMailTo(
    'cliente@example.com',
    'Asunto del correo',
    'Contenido del mensaje'
);
```

### 📋 Templates Disponibles

1. **`contrato_creado`** - Notifica creación de contrato
2. **`visita_programada`** - Confirma visita técnica
3. **`proforma_enviada`** - Envía proforma al cliente
4. **`recordatorio_pago`** - Recordatorio de pago pendiente

### 🔐 Variables de Template

Cada template soporta diferentes variables. Ejemplo para `visita_programada`:

```javascript
{
    cliente: 'Nombre del cliente',
    fecha: 'DD/MM/AAAA',
    hora: 'HH:MM AM/PM',
    tecnico: 'Nombre del técnico',
    direccion: 'Dirección completa',
    motivo: 'Motivo de la visita'
}
```

---

## 🔄 Fallback Modes

Ambos servicios tienen modos de respaldo:

### WhatsApp
- Si el navegador bloquea pop-ups, se muestra un mensaje de error
- El usuario puede habilitar pop-ups manualmente

### Email
- **Modo EmailJS:** Envío directo desde el cliente (recomendado)
- **Modo Mailto:** Abre el cliente de correo del usuario (fallback automático)
- Configurable con `useMailto: true/false`

---

## 🧪 Pruebas

### Probar WhatsApp:
```javascript
// En la consola del navegador
await WhatsAppService.sendMessage('77778888', 'Mensaje de prueba');
```

### Probar Email:
```javascript
// En la consola del navegador
await EmailService.sendEmail(
    'tu-email@example.com',
    'Prueba',
    'Este es un email de prueba desde ALLTECH SUPPORT'
);
```

---

## 📊 Límites y Costos

### WhatsApp (wa.me)
- ✅ **Gratuito e ilimitado**
- ✅ No requiere cuenta Business API
- ⚠️ El usuario debe confirmar manualmente el envío

### EmailJS
- **Plan Gratuito:** 200 emails/mes
- **Plan Personal:** $7/mes - 1,000 emails
- **Plan Pro:** $15/mes - 10,000 emails
- [Ver precios completos](https://www.emailjs.com/pricing/)

---

## ❓ Troubleshooting

### WhatsApp no se abre
- Verifica que los pop-ups estén permitidos en el navegador
- Asegúrate de que el número tenga el formato correcto

### Email no se envía
1. Verifica que EmailJS esté cargado: `typeof emailjs !== 'undefined'`
2. Comprueba las credenciales en `email-service.js`
3. Revisa la consola del navegador para errores
4. Verifica el límite de emails en tu cuenta EmailJS

### Error "Invalid template"
- Asegúrate de que el Template ID sea correcto
- Verifica que las variables del template coincidan

---

## 🚀 Próximos Pasos

1. **Configurar EmailJS** siguiendo los pasos anteriores
2. **Personalizar templates** según las necesidades
3. **Probar ambos servicios** antes de producción
4. **Documentar** cualquier configuración específica de tu empresa

---

## 📞 Soporte

Para más ayuda:
- **EmailJS Docs:** https://www.emailjs.com/docs/
- **WhatsApp API:** https://faq.whatsapp.com/general/chats/how-to-use-click-to-chat/

¡Listo! Tus servicios de comunicación están configurados y listos para usar. 🎉
