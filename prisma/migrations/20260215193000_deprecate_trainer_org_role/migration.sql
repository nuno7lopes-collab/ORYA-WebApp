-- Depreca role topo TRAINER no contexto organizacional.
-- Converte legado para STAFF + role_pack COACH.

UPDATE app_v3.organization_group_members
SET role = 'STAFF',
    role_pack = 'COACH',
    updated_at = now()
WHERE role = 'TRAINER';

UPDATE app_v3.organization_member_overrides
SET role_override = 'STAFF',
    updated_at = now()
WHERE role_override = 'TRAINER';

UPDATE app_v3.organization_member_invites
SET role = 'STAFF',
    role_pack = COALESCE(role_pack, 'COACH'::app_v3."OrganizationRolePack"),
    updated_at = now()
WHERE role = 'TRAINER';
