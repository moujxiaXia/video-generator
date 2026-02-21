import Database from 'better-sqlite3';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = process.env.DATABASE_PATH || join(__dirname, '../../database/videos.db');
const dbDir = dirname(dbPath);

// 确保数据库目录存在
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

export function initDatabase() {
  console.log('🗄️  初始化数据库...');
  
  // 创建视频任务表
  db.exec(`
    CREATE TABLE IF NOT EXISTS video_tasks (
      id TEXT PRIMARY KEY,
      user_input TEXT NOT NULL,
      script TEXT,
      status TEXT DEFAULT 'pending',
      progress INTEGER DEFAULT 0,
      output_url TEXT,
      error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // 创建场景表
  db.exec(`
    CREATE TABLE IF NOT EXISTS scenes (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      scene_number INTEGER NOT NULL,
      description TEXT NOT NULL,
      visual_prompt TEXT NOT NULL,
      duration INTEGER NOT NULL,
      video_url TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES video_tasks(id)
    )
  `);
  
  // 创建用户表
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      tier TEXT DEFAULT 'free',
      daily_usage INTEGER DEFAULT 0,
      total_usage INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  console.log('✅ 数据库初始化完成');
}

export default db;
