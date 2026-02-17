# Schema Baseline Snapshot

- GeneratedAtUTC: 2026-02-17T10:12:22.397Z
- Schemas: app_v3, auth
- PrismaSchemaPath: prisma/schema.prisma

## Inventory Counts

- app_v3 tables: 225
- auth tables: 20
- app_v3 prisma models: 224
- auth prisma models: 1
- app_v3 views: 0
- auth views: 0
- app_v3 functions: 1
- auth functions: 4
- app_v3 triggers: 0
- auth triggers: 1
- app_v3 enums: 200
- auth enums: 9

## Drift Summary

- Prisma models missing in DB: 0
- Prisma models blocked missing (approved exceptions): 0
- DB tables without Prisma model: 20

## app_v3 Chat Namespace Inventory

- chat_* tables present: 10
- chat_access_grants
- chat_conversation_attachments
- chat_conversation_members
- chat_conversation_messages
- chat_conversations
- chat_message_pins
- chat_message_reactions
- chat_message_reports
- chat_user_blocks
- chat_user_presence

- chat_* functions remaining: 0
(none)

- chat_* triggers remaining: 0
(none)

## auth Tables

- audit_log_entries
- flow_state
- identities
- instances
- mfa_amr_claims
- mfa_challenges
- mfa_factors
- oauth_authorizations
- oauth_client_states
- oauth_clients
- oauth_consents
- one_time_tokens
- refresh_tokens
- saml_providers
- saml_relay_states
- schema_migrations
- sessions
- sso_domains
- sso_providers
- users

## Notes

- `blocked_missing` refers to explicit do-not-touch exceptions requested by product owner.
- Full matrix is in the CSV artifact.
