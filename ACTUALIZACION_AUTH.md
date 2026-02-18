# 🔄 ACTUALIZACIÓN DE AUTENTICACIÓN

## 📋 CAMBIOS REALIZADOS

### 1. 🔑 Login con Nombre de Usuario
- Ahora se puede iniciar sesión usando **Usuario** en lugar de Email.
- Backend: La función RPC `get_email_by_username` busca el email en la tabla `profiles`.
- Frontend: Formulario actualizado con campo "Nombre de Usuario".

### 2. ➕ Creación Directa de Usuarios
- Se habilitó la creación de usuarios desde **Configuración > Usuarios**.
- **Nota Importante:** Al crear un usuario, Supabase inicia sesión automáticamente con la nueva cuenta (limitación de seguridad client-side). Se muestra una advertencia antes de proceder.

---

## ⚙️ CONFIGURACIÓN DE BASE DE DATOS (YA APLICADA)

La migración ya fue ejecutada directamente en Supabase. El archivo de referencia es:

**Archivo:** `database/migrations/enable_username_login.sql`

Este script:
1. Agrega columna `email` a `profiles`.
2. Crea función RPC `get_email_by_username` (necesaria para el login).
3. Crea triggers para sincronizar emails automáticamente.
4. Crea trigger `handle_new_user` para perfiles automáticos.

---

## 🚀 CÓMO USAR

1. **Login:** Ingresa tu nombre de usuario (ej: `admin`) y contraseña.
2. **Crear Usuario:** Ve a Configuración > Nuevo Usuario. Llena los datos y confirma la advertencia.

---

## 🔧 CORRECCIONES APLICADAS (2026-02-10)

### Problema Original
El login por username no funcionaba porque:
- La función RPC referenciaba tabla `user_profiles` (inexistente)
- La tabla real es `profiles`
- No existía la columna `email` en `profiles`
- `DataService.authenticateUser` era un placeholder que retornaba `null`

### Solución
1. ✅ Agregada columna `email` a tabla `profiles`
2. ✅ Sincronizado email del admin desde `auth.users`
3. ✅ Función RPC `get_email_by_username` apunta a `profiles` (no `user_profiles`)
4. ✅ `DataService.authenticateUser` delega a `SupabaseDataService.authenticateUser`
5. ✅ `createUser` en supabase-data-service usa tabla `profiles` (no `user_profiles`)
6. ✅ Triggers de sincronización de email creados

---

## ⚠️ NOTAS DE SEGURIDAD

- La función `get_email_by_username` es `SECURITY DEFINER` para permitir buscar emails sin exponer toda la tabla de usuarios.
- La creación de usuarios client-side tiene limitaciones. Para una solución empresarial robusta sin cerrar sesión, se recomienda usar **Supabase Edge Functions** en el futuro.
