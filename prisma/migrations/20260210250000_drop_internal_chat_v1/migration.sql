-- Drop legacy internal chat V1 tables (superseded by chat_conversations)
DROP TABLE IF EXISTS app_v3.internal_chat_messages;
DROP TABLE IF EXISTS app_v3.internal_chat_channels;
