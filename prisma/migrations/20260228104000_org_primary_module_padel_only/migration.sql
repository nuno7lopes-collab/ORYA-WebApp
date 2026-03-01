-- Padel-only: clubes com módulo primário legado EVENTOS passam para TORNEIOS.
UPDATE app_v3.organizations
SET primary_module = 'TORNEIOS'
WHERE status = 'ACTIVE'
  AND primary_module = 'EVENTOS';
