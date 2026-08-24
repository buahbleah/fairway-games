-- Fairway Games — database schema.
-- Run once against a fresh Postgres (Neon) database, then set DATABASE_URL.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------- accounts

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  name text NOT NULL,
  password_hash text NOT NULL,        -- scrypt$<salt hex>$<key hex>
  handicap_index numeric(4,1),        -- only the owner may change this
  color_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Addresses are compared case-insensitively everywhere.
CREATE UNIQUE INDEX users_email_key ON users (lower(email));

CREATE TABLE sessions (
  token text PRIMARY KEY,             -- 32 random bytes, base64url
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

-- ----------------------------------------------------------------- friends
-- A request is stored against an email address, not a user, so it can be sent
-- to somebody who has not signed up yet and attach itself when they do.

CREATE TABLE friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_email text NOT NULL,
  addressee_id uuid REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);
CREATE UNIQUE INDEX friendships_pair_key ON friendships (requester_id, lower(addressee_email));
CREATE INDEX friendships_addressee_idx ON friendships (lower(addressee_email));

-- ----------------------------------------------------------------- leagues

CREATE TABLE leagues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  join_code text NOT NULL UNIQUE,     -- 6 chars, no vowels or look-alikes
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE league_members (
  league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (league_id, user_id)
);

-- ------------------------------------------------------------------ rounds
-- `version` is bumped on every write and is what the client polls on, so a
-- 4-second poll costs one indexed row read when nothing has changed.

CREATE TABLE rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid REFERENCES leagues(id) ON DELETE SET NULL,
  host_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id text NOT NULL,
  title text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','finished')),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  course jsonb NOT NULL DEFAULT '{}'::jsonb,
  game_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_hole int NOT NULL DEFAULT 1,
  version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rounds_league_idx ON rounds (league_id, created_at DESC);
CREATE INDEX rounds_host_idx ON rounds (host_id, created_at DESC);

-- A seat in a round. user_id is null for guests somebody else scores for.
CREATE TABLE round_players (
  round_id uuid NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  player_id text NOT NULL,            -- the id the game engine uses
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  name text NOT NULL,
  handicap_index numeric(4,1),
  color_index int NOT NULL DEFAULT 0,
  seat int NOT NULL DEFAULT 0,
  PRIMARY KEY (round_id, player_id)
);
CREATE INDEX round_players_user_idx ON round_players (user_id);

-- One row per hole. `scores` is merged key by key on write, which is what stops
-- two phones scoring the same hole from overwriting each other.
CREATE TABLE hole_entries (
  round_id uuid NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  hole int NOT NULL,
  scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  game jsonb NOT NULL DEFAULT '{}'::jsonb,
  complete boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (round_id, hole)
);

CREATE TABLE round_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  email text NOT NULL,
  invited_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX round_invites_key ON round_invites (round_id, lower(email));
CREATE INDEX round_invites_email_idx ON round_invites (lower(email), status);

-- ---------------------------------------------------------------- versioning

CREATE OR REPLACE FUNCTION bump_round_version() RETURNS trigger AS $$
BEGIN
  UPDATE rounds SET version = version + 1, updated_at = now()
  WHERE id = COALESCE(NEW.round_id, OLD.round_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER hole_entries_bump
  AFTER INSERT OR UPDATE OR DELETE ON hole_entries
  FOR EACH ROW EXECUTE FUNCTION bump_round_version();

CREATE TRIGGER round_players_bump
  AFTER INSERT OR UPDATE OR DELETE ON round_players
  FOR EACH ROW EXECUTE FUNCTION bump_round_version();
