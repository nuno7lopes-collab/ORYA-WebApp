-- Acelera a query de agenda semanal/mensal por organização e intervalo temporal.
CREATE INDEX IF NOT EXISTS bookings_org_start_id_idx
  ON app_v3.bookings(organization_id, starts_at, id);

-- Garante lookup rápido de sessões de aula por organização e starts_at.
CREATE INDEX IF NOT EXISTS class_sessions_org_start_idx
  ON app_v3.class_sessions(organization_id, starts_at);
