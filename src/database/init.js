import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 使用 JSON 文件作为简单数据存储（替代 SQLite）
const dbPath = process.env.DATABASE_PATH || join(__dirname, '../../database/data.json');
const dbDir = dirname(dbPath);

// 确保数据库目录存在
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

// 初始化数据结构
let db = {
  video_tasks: [],
  scenes: [],
  users: []
};

// 读取现有数据
if (existsSync(dbPath)) {
  try {
    const data = readFileSync(dbPath, 'utf8');
    db = JSON.parse(data);
  } catch (error) {
    console.log('⚠️  无法读取数据库文件，使用空数据');
  }
}

// 保存数据函数
function saveDB() {
  writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
}

// 模拟 SQL 接口
const dbWrapper = {
  prepare: (sql) => {
    return {
      run: (...params) => {
        const sqlLower = sql.toLowerCase();
        
        if (sqlLower.includes('insert into video_tasks')) {
          const [id, user_input, status, progress] = params;
          db.video_tasks.push({
            id,
            user_input,
            script: null,
            status,
            progress,
            output_url: null,
            error: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
          saveDB();
        } else if (sqlLower.includes('update video_tasks') && sqlLower.includes('set script')) {
          const [script, id] = params;
          const task = db.video_tasks.find(t => t.id === id);
          if (task) {
            task.script = script;
            task.updated_at = new Date().toISOString();
            saveDB();
          }
        } else if (sqlLower.includes('update video_tasks')) {
          const [status, progress, output_url, error, id] = params;
          const task = db.video_tasks.find(t => t.id === id);
          if (task) {
            task.status = status;
            task.progress = progress;
            if (output_url) task.output_url = output_url;
            if (error) task.error = error;
            task.updated_at = new Date().toISOString();
            saveDB();
          }
        } else if (sqlLower.includes('insert into scenes')) {
          const [id, task_id, scene_number, description, visual_prompt, duration, status] = params;
          db.scenes.push({
            id,
            task_id,
            scene_number,
            description,
            visual_prompt,
            duration,
            video_url: null,
            status,
            created_at: new Date().toISOString()
          });
          saveDB();
        } else if (sqlLower.includes('update scenes')) {
          const [video_url, status, task_id, scene_number] = params;
          const scene = db.scenes.find(s => s.task_id === task_id && s.scene_number === scene_number);
          if (scene) {
            scene.video_url = video_url;
            scene.status = status;
            saveDB();
          }
        }
      },
      get: (id) => {
        if (sql.toLowerCase().includes('video_tasks')) {
          return db.video_tasks.find(t => t.id === id);
        }
        return null;
      },
      all: (...params) => {
        const sqlLower = sql.toLowerCase();
        
        if (sqlLower.includes('from scenes')) {
          const [task_id] = params;
          return db.scenes.filter(s => s.task_id === task_id).sort((a, b) => a.scene_number - b.scene_number);
        } else if (sqlLower.includes('from video_tasks')) {
          const [limit, offset] = params;
          return db.video_tasks
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(offset, offset + limit);
        }
        return [];
      }
    };
  }
};

export function initDatabase() {
  console.log('🗄️  初始化数据库（JSON 存储）...');
  saveDB();
  console.log('✅ 数据库初始化完成');
}

export default dbWrapper;
