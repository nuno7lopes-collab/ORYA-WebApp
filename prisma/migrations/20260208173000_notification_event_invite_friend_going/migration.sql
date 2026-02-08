-- Add new notification types
ALTER TYPE app_v3."NotificationType" ADD VALUE IF NOT EXISTS 'EVENT_INVITE';
ALTER TYPE app_v3."NotificationType" ADD VALUE IF NOT EXISTS 'FRIEND_GOING_TO_EVENT';
