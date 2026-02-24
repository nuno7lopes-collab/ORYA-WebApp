# Auth Schema Audit (Read-Only)

- GeneratedAtUTC: 2026-02-24T14:51:52.917Z
- Scope: inventory and risk classification only (no DDL executed)

## Summary

- auth tables: 20
- auth functions: 4
- auth triggers: 1
- auth enums: 9
- classified as supabase_managed: 16
- classified as custom_or_unknown: 4

## Table Classification

| table | category | risk | columns | prisma_modeled |
| --- | --- | --- | ---: | --- |
| audit_log_entries | supabase_managed | low | 5 | no |
| flow_state | supabase_managed | low | 17 | no |
| identities | supabase_managed | low | 9 | no |
| instances | supabase_managed | low | 5 | no |
| mfa_amr_claims | supabase_managed | low | 5 | no |
| mfa_challenges | supabase_managed | low | 7 | no |
| mfa_factors | supabase_managed | low | 13 | no |
| oauth_authorizations | custom_or_unknown | review | 17 | no |
| oauth_client_states | custom_or_unknown | review | 4 | no |
| oauth_clients | custom_or_unknown | review | 13 | no |
| oauth_consents | custom_or_unknown | review | 6 | no |
| one_time_tokens | supabase_managed | low | 7 | no |
| refresh_tokens | supabase_managed | low | 9 | no |
| saml_providers | supabase_managed | low | 9 | no |
| saml_relay_states | supabase_managed | low | 8 | no |
| schema_migrations | supabase_managed | low | 1 | no |
| sessions | supabase_managed | low | 15 | no |
| sso_domains | supabase_managed | low | 5 | no |
| sso_providers | supabase_managed | low | 5 | no |
| users | supabase_managed | low | 35 | yes |

## Risk Notes

- `supabase_managed`: expected Auth provider internals; avoid structural changes outside vendor guidance.
- `custom_or_unknown`: requires explicit review before any DDL, but this execution remains read-only as requested.
