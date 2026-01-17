-- Expand OrganizationModule enum with ORYA Business modules
ALTER TYPE app_v3."OrganizationModule" ADD VALUE IF NOT EXISTS 'EVENTOS';
ALTER TYPE app_v3."OrganizationModule" ADD VALUE IF NOT EXISTS 'RESERVAS';
ALTER TYPE app_v3."OrganizationModule" ADD VALUE IF NOT EXISTS 'TORNEIOS';
ALTER TYPE app_v3."OrganizationModule" ADD VALUE IF NOT EXISTS 'STAFF';
ALTER TYPE app_v3."OrganizationModule" ADD VALUE IF NOT EXISTS 'FINANCEIRO';
ALTER TYPE app_v3."OrganizationModule" ADD VALUE IF NOT EXISTS 'MENSAGENS';
ALTER TYPE app_v3."OrganizationModule" ADD VALUE IF NOT EXISTS 'MARKETING';
ALTER TYPE app_v3."OrganizationModule" ADD VALUE IF NOT EXISTS 'ANALYTICS';
ALTER TYPE app_v3."OrganizationModule" ADD VALUE IF NOT EXISTS 'DEFINICOES';
ALTER TYPE app_v3."OrganizationModule" ADD VALUE IF NOT EXISTS 'PERFIL_PUBLICO';
