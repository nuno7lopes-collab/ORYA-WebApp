BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'PadelTeamRole' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."PadelTeamRole" AS ENUM (
      'CAPTAIN',
      'PLAYER',
      'COACH',
      'MANAGER'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'PadelTeamMemberStatus' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."PadelTeamMemberStatus" AS ENUM (
      'ACTIVE',
      'INVITED',
      'REMOVED'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'PadelTeamEntryStatus' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."PadelTeamEntryStatus" AS ENUM (
      'PENDING',
      'CONFIRMED',
      'CANCELLED'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'PadelCommunityPostKind' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."PadelCommunityPostKind" AS ENUM (
      'ANNOUNCEMENT',
      'HIGHLIGHT',
      'QUESTION'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'PadelCommunityVisibility' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."PadelCommunityVisibility" AS ENUM (
      'CLUB_MEMBERS',
      'PUBLIC'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS app_v3.padel_teams (
  id SERIAL PRIMARY KEY,
  env TEXT NOT NULL DEFAULT 'prod',
  organization_id INT NOT NULL,
  padel_club_id INT,
  category_id INT,
  name TEXT NOT NULL,
  level TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT padel_teams_org_fk
    FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE,
  CONSTRAINT padel_teams_club_fk
    FOREIGN KEY (padel_club_id) REFERENCES app_v3.padel_clubs(id) ON DELETE SET NULL,
  CONSTRAINT padel_teams_category_fk
    FOREIGN KEY (category_id) REFERENCES app_v3.padel_categories(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS padel_teams_org_idx
  ON app_v3.padel_teams (organization_id);
CREATE INDEX IF NOT EXISTS padel_teams_club_idx
  ON app_v3.padel_teams (padel_club_id);

CREATE TABLE IF NOT EXISTS app_v3.padel_team_members (
  id SERIAL PRIMARY KEY,
  env TEXT NOT NULL DEFAULT 'prod',
  team_id INT NOT NULL,
  user_id UUID NOT NULL,
  role app_v3."PadelTeamRole" NOT NULL DEFAULT 'PLAYER',
  status app_v3."PadelTeamMemberStatus" NOT NULL DEFAULT 'ACTIVE',
  joined_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT padel_team_members_team_fk
    FOREIGN KEY (team_id) REFERENCES app_v3.padel_teams(id) ON DELETE CASCADE,
  CONSTRAINT padel_team_members_user_fk
    FOREIGN KEY (user_id) REFERENCES app_v3.profiles(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS padel_team_members_team_user_uq
  ON app_v3.padel_team_members (team_id, user_id);
CREATE INDEX IF NOT EXISTS padel_team_members_team_idx
  ON app_v3.padel_team_members (team_id);
CREATE INDEX IF NOT EXISTS padel_team_members_user_idx
  ON app_v3.padel_team_members (user_id);

CREATE TABLE IF NOT EXISTS app_v3.padel_team_entries (
  id SERIAL PRIMARY KEY,
  env TEXT NOT NULL DEFAULT 'prod',
  event_id INT NOT NULL,
  team_id INT NOT NULL,
  category_id INT,
  status app_v3."PadelTeamEntryStatus" NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT padel_team_entries_event_fk
    FOREIGN KEY (event_id) REFERENCES app_v3.events(id) ON DELETE CASCADE,
  CONSTRAINT padel_team_entries_team_fk
    FOREIGN KEY (team_id) REFERENCES app_v3.padel_teams(id) ON DELETE CASCADE,
  CONSTRAINT padel_team_entries_category_fk
    FOREIGN KEY (category_id) REFERENCES app_v3.padel_categories(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS padel_team_entries_event_team_category_uq
  ON app_v3.padel_team_entries (event_id, team_id, category_id);
CREATE INDEX IF NOT EXISTS padel_team_entries_event_idx
  ON app_v3.padel_team_entries (event_id);
CREATE INDEX IF NOT EXISTS padel_team_entries_team_idx
  ON app_v3.padel_team_entries (team_id);

CREATE TABLE IF NOT EXISTS app_v3.padel_community_posts (
  id SERIAL PRIMARY KEY,
  env TEXT NOT NULL DEFAULT 'prod',
  organization_id INT NOT NULL,
  padel_club_id INT,
  author_user_id UUID,
  title TEXT,
  body TEXT NOT NULL,
  kind app_v3."PadelCommunityPostKind" NOT NULL DEFAULT 'ANNOUNCEMENT',
  visibility app_v3."PadelCommunityVisibility" NOT NULL DEFAULT 'CLUB_MEMBERS',
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT padel_community_posts_org_fk
    FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE,
  CONSTRAINT padel_community_posts_club_fk
    FOREIGN KEY (padel_club_id) REFERENCES app_v3.padel_clubs(id) ON DELETE SET NULL,
  CONSTRAINT padel_community_posts_author_fk
    FOREIGN KEY (author_user_id) REFERENCES app_v3.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS padel_community_posts_org_idx
  ON app_v3.padel_community_posts (organization_id);
CREATE INDEX IF NOT EXISTS padel_community_posts_club_idx
  ON app_v3.padel_community_posts (padel_club_id);

CREATE TABLE IF NOT EXISTS app_v3.padel_community_reactions (
  id SERIAL PRIMARY KEY,
  env TEXT NOT NULL DEFAULT 'prod',
  post_id INT NOT NULL,
  user_id UUID NOT NULL,
  reaction TEXT NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT padel_community_reactions_post_fk
    FOREIGN KEY (post_id) REFERENCES app_v3.padel_community_posts(id) ON DELETE CASCADE,
  CONSTRAINT padel_community_reactions_user_fk
    FOREIGN KEY (user_id) REFERENCES app_v3.profiles(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS padel_community_reactions_post_user_uq
  ON app_v3.padel_community_reactions (post_id, user_id, reaction);
CREATE INDEX IF NOT EXISTS padel_community_reactions_post_idx
  ON app_v3.padel_community_reactions (post_id);
CREATE INDEX IF NOT EXISTS padel_community_reactions_user_time_idx
  ON app_v3.padel_community_reactions (user_id, created_at);

CREATE TABLE IF NOT EXISTS app_v3.padel_community_comments (
  id SERIAL PRIMARY KEY,
  env TEXT NOT NULL DEFAULT 'prod',
  post_id INT NOT NULL,
  author_user_id UUID,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT padel_community_comments_post_fk
    FOREIGN KEY (post_id) REFERENCES app_v3.padel_community_posts(id) ON DELETE CASCADE,
  CONSTRAINT padel_community_comments_author_fk
    FOREIGN KEY (author_user_id) REFERENCES app_v3.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS padel_community_comments_post_idx
  ON app_v3.padel_community_comments (post_id);
CREATE INDEX IF NOT EXISTS padel_community_comments_author_time_idx
  ON app_v3.padel_community_comments (author_user_id, created_at);

COMMIT;
