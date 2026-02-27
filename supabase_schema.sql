-- Run this SQL in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  avatar_url TEXT,
  mmr INTEGER DEFAULT 1000,
  games_played INTEGER DEFAULT 0,
  role TEXT DEFAULT 'player', -- 'player' or 'admin'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lobbies Table
CREATE TABLE IF NOT EXISTS lobbies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  admin_id UUID NOT NULL REFERENCES profiles(id),
  status TEXT DEFAULT 'open', -- 'open', 'full', 'completed'
  qr_payload TEXT UNIQUE NOT NULL
);

-- Lobby Players Junction Table
CREATE TABLE IF NOT EXISTS lobby_players (
  id SERIAL PRIMARY KEY,
  lobby_id UUID NOT NULL REFERENCES lobbies(id),
  profile_id UUID NOT NULL REFERENCES profiles(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lobby_id, profile_id)
);

-- Matches Table
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lobby_id UUID NOT NULL REFERENCES lobbies(id),
  winner_team TEXT, -- 'A' or 'B'
  score TEXT,
  mmr_delta INTEGER,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);
