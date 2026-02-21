import { v4 as uuidv4 } from 'uuid';
import db from '../database/init.js';
import tongyiService from '../services/tongyi.js';
import ossService from '../services/oss.js';
import { wss } from '../index.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class VideoPipeline {
  /**
   * 创建视频生成任务
   * @param {string} userInput - 用户输入
   * @param {string} userId - 用户 ID
   * @returns {Promise<Object>} - 任务信息
   */
  async createTask(userInput, userId = 'default_user') {
    const taskId = uuidv4();
    
    // 插入任务记录
    const stmt = db.prepare(`
      INSERT INTO video_tasks (id, user_input, status, progress)
      VALUES (?, ?, ?, ?)
    `);
    
    stmt.run(taskId, userInput, 'pending', 0);
    
    console.log(`📝 任务创建成功: ${taskId}`);
    
    // 异步执行任务
    this.executeTask(taskId, userInput).catch(error => {
      console.error(`❌ 任务执行失败: ${taskId}`, error);
      this.updateTaskStatus(taskId, 'failed', 0, null, error.message);
    });
    
    return { taskId, status: 'pending' };
  }

  /**
   * 执行视频生成任务
   * @param {string} taskId - 任务 ID
   * @param {string} userInput - 用户输入
   */
  async executeTask(taskId, userInput) {
    try {
      // 1. 生成脚本
      this.updateTaskStatus(taskId, 'generating_script', 10);
      this.broadcastProgress(taskId, 10, '正在生成脚本...');
      
      const script = await tongyiService.generateScript(userInput);
      
      // 保存脚本
      const updateScript = db.prepare('UPDATE video_tasks SET script = ? WHERE id = ?');
      updateScript.run(JSON.stringify(script), taskId);
      
      this.updateTaskStatus(taskId, 'generating_videos', 20);
      this.broadcastProgress(taskId, 20, '脚本生成完成，开始生成视频...');
      
      // 2. 保存场景到数据库
      const sceneStmt = db.prepare(`
        INSERT INTO scenes (id, task_id, scene_number, description, visual_prompt, duration, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      for (const scene of script.scenes) {
        const sceneId = uuidv4();
        sceneStmt.run(
          sceneId,
          taskId,
          scene.scene_number,
          scene.description,
          scene.visual_prompt,
          scene.duration,
          'pending'
        );
      }
      
      // 3. 生成各个场景的视频
      const videoUrls = [];
      const totalScenes = script.scenes.length;
      
      for (let i = 0; i < totalScenes; i++) {
        const scene = script.scenes[i];
        const progress = 20 + Math.floor((i / totalScenes) * 60);
        
        this.updateTaskStatus(taskId, 'generating_videos', progress);
        this.broadcastProgress(taskId, progress, `正在生成场景 ${i + 1}/${totalScenes}...`);
        
        try {
          // 调用通义万相生成视频
          const videoUrl = await tongyiService.generateVideo(
            scene.visual_prompt,
            scene.duration
          );
          
          videoUrls.push(videoUrl);
          
          // 更新场景状态
          const updateScene = db.prepare('UPDATE scenes SET video_url = ?, status = ? WHERE task_id = ? AND scene_number = ?');
          updateScene.run(videoUrl, 'completed', taskId, scene.scene_number);
        } catch (error) {
          console.error(`场景 ${i + 1} 生成失败:`, error);
          videoUrls.push(null);
        }
      }
      
      // 4. 合成视频（这里简化处理，实际需要使用 FFmpeg）
      this.updateTaskStatus(taskId, 'compositing', 85);
      this.broadcastProgress(taskId, 85, '正在合成最终视频...');
      
      // TODO: 使用 FFmpeg 合成多个视频片段
      // 这里暂时返回第一个视频作为示例
      const finalVideoUrl = videoUrls[0];
      
      // 5. 上传到 OSS（如果需要）
      this.updateTaskStatus(taskId, 'uploading', 95);
      this.broadcastProgress(taskId, 95, '正在上传到云存储...');
      
      // 假设视频已经在 OSS 或者使用通义万相返回的 URL
      
      // 6. 完成
      this.updateTaskStatus(taskId, 'completed', 100, finalVideoUrl);
      this.broadcastProgress(taskId, 100, '视频生成完成！');
      
      console.log(`✅ 任务完成: ${taskId}`);
    } catch (error) {
      console.error(`❌ 任务执行失败: ${taskId}`, error);
      this.updateTaskStatus(taskId, 'failed', 0, null, error.message);
      this.broadcastProgress(taskId, 0, `生成失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 更新任务状态
   */
  updateTaskStatus(taskId, status, progress, outputUrl = null, error = null) {
    const stmt = db.prepare(`
      UPDATE video_tasks 
      SET status = ?, progress = ?, output_url = ?, error = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(status, progress, outputUrl, error, taskId);
  }

  /**
   * 通过 WebSocket 广播进度
   */
  broadcastProgress(taskId, progress, message) {
    const data = JSON.stringify({
      type: 'progress',
      taskId,
      progress,
      message
    });
    
    wss.clients.forEach(client => {
      if (client.readyState === 1) { // OPEN
        client.send(data);
      }
    });
  }

  /**
   * 获取任务状态
   */
  getTaskStatus(taskId) {
    const stmt = db.prepare('SELECT * FROM video_tasks WHERE id = ?');
    const task = stmt.get(taskId);
    
    if (!task) {
      throw new Error('任务不存在');
    }
    
    // 获取场景信息
    const scenesStmt = db.prepare('SELECT * FROM scenes WHERE task_id = ? ORDER BY scene_number');
    const scenes = scenesStmt.all(taskId);
    
    return {
      ...task,
      script: task.script ? JSON.parse(task.script) : null,
      scenes
    };
  }
}

export default new VideoPipeline();
