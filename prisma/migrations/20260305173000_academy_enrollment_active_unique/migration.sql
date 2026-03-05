-- Garante inscrição única ativa por utilizador/sessão (PENDING ou CONFIRMED)
CREATE UNIQUE INDEX IF NOT EXISTS academy_enrollments_session_user_active_uq
ON app_v3.academy_enrollments (class_session_id, user_id)
WHERE user_id IS NOT NULL AND status IN ('PENDING', 'CONFIRMED');
