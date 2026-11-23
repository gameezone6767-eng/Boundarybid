import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(process.env.DATABASE_FILE || path.join(here, '../boundarybid.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,name TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS rooms(id TEXT PRIMARY KEY,code TEXT UNIQUE NOT NULL,name TEXT NOT NULL,visibility TEXT NOT NULL DEFAULT 'public',status TEXT NOT NULL DEFAULT 'lobby',owner_id TEXT NOT NULL,budget INTEGER NOT NULL DEFAULT 10000,min_bid INTEGER NOT NULL DEFAULT 20,bid_increment INTEGER NOT NULL DEFAULT 20,created_at TEXT DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(owner_id) REFERENCES users(id));
CREATE TABLE IF NOT EXISTS teams(id TEXT PRIMARY KEY,room_id TEXT NOT NULL,user_id TEXT,name TEXT NOT NULL,short_name TEXT NOT NULL,purse INTEGER NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(room_id) REFERENCES rooms(id),FOREIGN KEY(user_id) REFERENCES users(id));
CREATE TABLE IF NOT EXISTS players(id TEXT PRIMARY KEY,room_id TEXT NOT NULL,name TEXT NOT NULL,role TEXT NOT NULL,country TEXT DEFAULT 'India',base_price INTEGER NOT NULL DEFAULT 20,status TEXT NOT NULL DEFAULT 'available',sold_team_id TEXT,sold_price INTEGER,FOREIGN KEY(room_id) REFERENCES rooms(id));
CREATE TABLE IF NOT EXISTS bids(id TEXT PRIMARY KEY,room_id TEXT NOT NULL,player_id TEXT NOT NULL,team_id TEXT NOT NULL,amount INTEGER NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS matches(id TEXT PRIMARY KEY,room_id TEXT NOT NULL,home_team_id TEXT NOT NULL,away_team_id TEXT NOT NULL,overs INTEGER NOT NULL DEFAULT 20,status TEXT NOT NULL DEFAULT 'scheduled',winner_team_id TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS innings(id TEXT PRIMARY KEY,match_id TEXT NOT NULL,innings_no INTEGER NOT NULL,batting_team_id TEXT NOT NULL,runs INTEGER NOT NULL DEFAULT 0,wickets INTEGER NOT NULL DEFAULT 0,balls INTEGER NOT NULL DEFAULT 0,extras INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS deliveries(id TEXT PRIMARY KEY,innings_id TEXT NOT NULL,over_no INTEGER NOT NULL,ball_no INTEGER NOT NULL,runs INTEGER NOT NULL DEFAULT 0,extras INTEGER NOT NULL DEFAULT 0,extra_type TEXT,wicket INTEGER NOT NULL DEFAULT 0,note TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);
export default db;
