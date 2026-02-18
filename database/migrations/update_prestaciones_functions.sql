-- Función RPC para incrementar vacaciones tomadas de forma atómica
CREATE OR REPLACE FUNCTION increment_vacaciones_tomadas(p_empleado_id UUID, p_dias NUMERIC)
RETURNS VOID AS $$
BEGIN
  UPDATE empleados
  SET vacaciones_tomadas = COALESCE(vacaciones_tomadas, 0) + p_dias,
      updated_at = NOW()
  WHERE id = p_empleado_id;
END;
$$ LANGUAGE plpgsql;
