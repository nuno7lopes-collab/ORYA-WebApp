-- Rename notification types from friend to follow
ALTER TYPE app_v3."NotificationType" RENAME VALUE 'FRIEND_REQUEST' TO 'FOLLOW_REQUEST';
ALTER TYPE app_v3."NotificationType" RENAME VALUE 'FRIEND_ACCEPT' TO 'FOLLOW_ACCEPT';

-- Rename visibility enum value
ALTER TYPE app_v3."Visibility" RENAME VALUE 'FRIENDS' TO 'FOLLOWERS';

-- Rename notification preference column
ALTER TABLE app_v3.notification_preferences
  RENAME COLUMN allow_friend_requests TO allow_follow_requests;
