-- ============================================
-- MIGRACIÓN: Login por Username usando tabla profiles
-- Fecha: 2026-02-10
-- Descripción: Permite login con nombre de usuario en vez de email
-- NOTA: Esta migración ya fue aplicada. Este archivo es referencia.
-- ============================================

-- 1. Agregar columna email a profiles si no existe
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Backfill: Sincronizar emails desde auth.users
UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;

-- 3. Función RPC para obtener email por username (usa tabla profiles)
CREATE OR REPLACE FUNCTION get_email_by_username(p_username TEXT)
RETURNS TABLE(email TEXT, id UUID) AS $$
BEGIN
    RETURN QUERY
    SELECT p.email, p.id
    FROM profiles p
    WHERE p.username = p_username AND p.is_active = true
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Permisos para la función
GRANT EXECUTE ON FUNCTION get_email_by_username(TEXT) TO anon, authenticated, service_role;

-- 5. Trigger para sincronizar email cuando se actualiza en auth.users
CREATE OR REPLACE FUNCTION public.handle_user_email_update()
RETURNS trigger AS $$
BEGIN
  UPDATE public.profiles
  SET email = new.email,
      updated_at = now()
  WHERE id = new.id;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_user_email_update();

-- 6. Trigger para crear perfil automáticamente al crear usuario en auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_role_id UUID;
BEGIN
  SELECT id INTO v_role_id FROM roles WHERE name = 'Usuario' LIMIT 1;
  
  INSERT INTO public.profiles (id, username, full_name, role_id, is_active, email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    v_role_id,
    true,
    new.email
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
