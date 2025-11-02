import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATABASE_PATH = process.env.DATABASE_PATH || join(__dirname, '../../data/media_library.db');
const dataDir = dirname(DATABASE_PATH);

// Ensure data directory exists
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// Database schema
const SCHEMA = `
-- Media Items
CREATE TABLE IF NOT EXISTS media_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT CHECK(type IN ('movie', 'tv_show', 'episode')),
  title TEXT NOT NULL,
  year INTEGER,
  duration INTEGER,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  source_type TEXT CHECK(source_type IN ('local', 'ftp', 'smb', 'upnp')),
  source_config_id INTEGER,
  imdb_id TEXT,
  tmdb_id INTEGER,
  poster_url TEXT,
  backdrop_url TEXT,
  overview TEXT,
  rating REAL,
  genres TEXT,
  cast TEXT,
  director TEXT,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(source_config_id) REFERENCES network_sources(id)
);

-- TV Show specific
CREATE TABLE IF NOT EXISTS tv_shows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  media_item_id INTEGER UNIQUE,
  number_of_seasons INTEGER,
  number_of_episodes INTEGER,
  status TEXT,
  FOREIGN KEY(media_item_id) REFERENCES media_items(id)
);

CREATE TABLE IF NOT EXISTS episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tv_show_id INTEGER,
  season_number INTEGER,
  episode_number INTEGER,
  media_item_id INTEGER,
  FOREIGN KEY(tv_show_id) REFERENCES tv_shows(id),
  FOREIGN KEY(media_item_id) REFERENCES media_items(id)
);

-- Network Sources
CREATE TABLE IF NOT EXISTS network_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  protocol TEXT CHECK(protocol IN ('ftp', 'smb', 'upnp', 'local')),
  host TEXT,
  port INTEGER,
  username TEXT,
  password TEXT,
  base_path TEXT,
  enabled BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Watch History
CREATE TABLE IF NOT EXISTS watch_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  media_item_id INTEGER,
  user_id INTEGER,
  current_time REAL DEFAULT 0,
  duration REAL DEFAULT 0,
  progress REAL DEFAULT 0,
  completed BOOLEAN DEFAULT 0,
  watch_count INTEGER DEFAULT 1,
  last_watched DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(media_item_id) REFERENCES media_items(id),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- Users (basic auth)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_media_type ON media_items(type);
CREATE INDEX IF NOT EXISTS idx_media_title ON media_items(title);
CREATE INDEX IF NOT EXISTS idx_watch_history_user ON watch_history(user_id, media_item_id);
`;

class Database {
  constructor() {
    this.db = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DATABASE_PATH, (err) => {
        if (err) {
          console.error('Database connection error:', err);
          reject(err);
        } else {
          console.log(`✅ Connected to database: ${DATABASE_PATH}`);
          resolve();
        }
      });
    });
  }

  async initialize() {
    if (!this.db) {
      await this.connect();
    }

    return new Promise((resolve, reject) => {
      this.db.exec(SCHEMA, async (err) => {
        if (err) {
          console.error('Database initialization error:', err);
          reject(err);
        } else {
          console.log('✅ Database schema initialized');

          // Run migrations
          try {
            await this.runMigrations();
            resolve();
          } catch (migrationErr) {
            console.error('Migration error:', migrationErr);
            reject(migrationErr);
          }
        }
      });
    });
  }

  async runMigrations() {
    // Migration: Add missing columns to watch_history table
    try {
      // Check if columns exist
      const tableInfo = await this.all("PRAGMA table_info(watch_history)");
      const columnNames = tableInfo.map(col => col.name);

      // Add missing columns
      if (!columnNames.includes('current_time')) {
        await this.run("ALTER TABLE watch_history ADD COLUMN current_time REAL DEFAULT 0");
        console.log('  ✓ Added current_time column to watch_history');
      }

      if (!columnNames.includes('duration')) {
        await this.run("ALTER TABLE watch_history ADD COLUMN duration REAL DEFAULT 0");
        console.log('  ✓ Added duration column to watch_history');
      }

      if (!columnNames.includes('watch_count')) {
        await this.run("ALTER TABLE watch_history ADD COLUMN watch_count INTEGER DEFAULT 1");
        console.log('  ✓ Added watch_count column to watch_history');
      }

      if (!columnNames.includes('created_at')) {
        await this.run("ALTER TABLE watch_history ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP");
        console.log('  ✓ Added created_at column to watch_history');
      }

      // Migrate data: convert progress from 0-100 to 0-1 if needed
      // This is safe to run multiple times
      await this.run("UPDATE watch_history SET progress = progress / 100.0 WHERE progress > 1");

    } catch (err) {
      console.error('Migration error:', err.message);
      // Don't fail if migrations have issues
    }

    // Migration: Add missing columns to tv_shows table
    try {
      const tvShowsInfo = await this.all("PRAGMA table_info(tv_shows)");
      const tvColumnNames = tvShowsInfo.map(col => col.name);

      if (!tvColumnNames.includes('tmdb_id')) {
        await this.run("ALTER TABLE tv_shows ADD COLUMN tmdb_id INTEGER");
        console.log('  ✓ Added tmdb_id column to tv_shows');
      }

      if (!tvColumnNames.includes('title')) {
        await this.run("ALTER TABLE tv_shows ADD COLUMN title TEXT");
        console.log('  ✓ Added title column to tv_shows');
      }

      if (!tvColumnNames.includes('overview')) {
        await this.run("ALTER TABLE tv_shows ADD COLUMN overview TEXT");
        console.log('  ✓ Added overview column to tv_shows');
      }

      if (!tvColumnNames.includes('first_air_date')) {
        await this.run("ALTER TABLE tv_shows ADD COLUMN first_air_date TEXT");
        console.log('  ✓ Added first_air_date column to tv_shows');
      }

      if (!tvColumnNames.includes('poster_path')) {
        await this.run("ALTER TABLE tv_shows ADD COLUMN poster_path TEXT");
        console.log('  ✓ Added poster_path column to tv_shows');
      }

      if (!tvColumnNames.includes('backdrop_path')) {
        await this.run("ALTER TABLE tv_shows ADD COLUMN backdrop_path TEXT");
        console.log('  ✓ Added backdrop_path column to tv_shows');
      }

      if (!tvColumnNames.includes('genres')) {
        await this.run("ALTER TABLE tv_shows ADD COLUMN genres TEXT");
        console.log('  ✓ Added genres column to tv_shows');
      }
    } catch (err) {
      console.error('TV shows migration error:', err.message);
    }

    // Migration: Add missing columns to episodes table
    try {
      const episodesInfo = await this.all("PRAGMA table_info(episodes)");
      const epColumnNames = episodesInfo.map(col => col.name);

      if (!epColumnNames.includes('title')) {
        await this.run("ALTER TABLE episodes ADD COLUMN title TEXT");
        console.log('  ✓ Added title column to episodes');
      }

      if (!epColumnNames.includes('overview')) {
        await this.run("ALTER TABLE episodes ADD COLUMN overview TEXT");
        console.log('  ✓ Added overview column to episodes');
      }

      if (!epColumnNames.includes('air_date')) {
        await this.run("ALTER TABLE episodes ADD COLUMN air_date TEXT");
        console.log('  ✓ Added air_date column to episodes');
      }

      if (!epColumnNames.includes('still_path')) {
        await this.run("ALTER TABLE episodes ADD COLUMN still_path TEXT");
        console.log('  ✓ Added still_path column to episodes');
      }
    } catch (err) {
      console.error('Episodes migration error:', err.message);
    }

    // Migration: Add missing columns to media_items table
    try {
      const mediaInfo = await this.all("PRAGMA table_info(media_items)");
      const mediaColumnNames = mediaInfo.map(col => col.name);

      if (!mediaColumnNames.includes('poster_path')) {
        await this.run("ALTER TABLE media_items ADD COLUMN poster_path TEXT");
        console.log('  ✓ Added poster_path column to media_items');
      }

      if (!mediaColumnNames.includes('backdrop_path')) {
        await this.run("ALTER TABLE media_items ADD COLUMN backdrop_path TEXT");
        console.log('  ✓ Added backdrop_path column to media_items');
      }

      if (!mediaColumnNames.includes('release_date')) {
        await this.run("ALTER TABLE media_items ADD COLUMN release_date TEXT");
        console.log('  ✓ Added release_date column to media_items');
      }

      if (!mediaColumnNames.includes('runtime')) {
        await this.run("ALTER TABLE media_items ADD COLUMN runtime INTEGER");
        console.log('  ✓ Added runtime column to media_items');
      }

      if (!mediaColumnNames.includes('quality')) {
        await this.run("ALTER TABLE media_items ADD COLUMN quality TEXT");
        console.log('  ✓ Added quality column to media_items');
      }
    } catch (err) {
      console.error('Media items migration error:', err.message);
    }

    // Migration: Create subtitles table
    try {
      await this.run(`
        CREATE TABLE IF NOT EXISTS subtitles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          media_item_id INTEGER NOT NULL,
          language TEXT NOT NULL,
          label TEXT NOT NULL,
          file_path TEXT NOT NULL,
          format TEXT CHECK(format IN ('srt', 'vtt', 'ass')),
          is_default BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(media_item_id) REFERENCES media_items(id) ON DELETE CASCADE
        )
      `);
      console.log('  ✓ Created subtitles table');

      // Create index for faster subtitle lookups
      await this.run("CREATE INDEX IF NOT EXISTS idx_subtitles_media ON subtitles(media_item_id)");
      console.log('  ✓ Created subtitles index');
    } catch (err) {
      // Table might already exist, that's okay
      if (!err.message.includes('already exists')) {
        console.error('Subtitles table migration error:', err.message);
      }
    }

    // Migration: Add is_admin column to users table
    try {
      const usersInfo = await this.all("PRAGMA table_info(users)");
      const userColumnNames = usersInfo.map(col => col.name);

      if (!userColumnNames.includes('is_admin')) {
        await this.run("ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0");
        console.log('  ✓ Added is_admin column to users');
      }
    } catch (err) {
      console.error('Admin migration error:', err.message);
    }
  }

  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  async get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

// Export singleton instance
const database = new Database();
export default database;
