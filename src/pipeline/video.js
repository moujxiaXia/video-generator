import { v4 as uuidv4 } from 'uuid';
import db from '../database/init.js';
import tongyiService from '../services/tongyi.js';
import ossService from '../services/oss.js';
import videoComposer from '../services/videoComposer.js';
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
      let hasSuccessfulVideo = false;

      for (let i = 0; i < totalScenes; i++) {
        const scene = script.scenes[i];
        const progress = 20 + Math.floor((i / totalScenes) * 50);

        this.updateTaskStatus(taskId, 'generating_videos', progress);
        this.broadcastProgress(taskId, progress, `正在生成场景 ${i + 1}/${totalScenes}...`);

        try {
          // 调用通义万相生成视频
          const videoUrl = await tongyiService.generateVideo(
            scene.visual_prompt,
            scene.duration
          );

          videoUrls.push(videoUrl);
          hasSuccessfulVideo = true;

          // 更新场景状态
          const updateScene = db.prepare('UPDATE scenes SET video_url = ?, status = ? WHERE task_id = ? AND scene_number = ?');
          updateScene.run(videoUrl, 'completed', taskId, scene.scene_number);
        } catch (error) {
          console.error(`场景 ${i + 1} 生成失败:`, error);
          videoUrls.push(null);
          // 更新场景状态为失败
          const updateScene = db.prepare('UPDATE scenes SET status = ? WHERE task_id = ? AND scene_number = ?');
          updateScene.run('failed', taskId, scene.scene_number);
        }
      }

      // 检查是否至少有一个视频生成成功
      if (!hasSuccessfulVideo) {
        throw new Error('所有场景视频生成失败，无法完成视频合成');
      }

      // 4. 合成视频（使用 MP4Box 或 FFmpeg 拼接多个场景）
      this.updateTaskStatus(taskId, 'compositing', 75);
      this.broadcastProgress(taskId, 75, '正在合成最终视频...');

      let finalVideoPath = null;

      // 过滤掉失败的视频
      const validVideoUrls = videoUrls.filter(url => url !== null);

      if (validVideoUrls.length === 0) {
        throw new Error('没有可用的视频片段');
      }

      // 强制下载所有视频到本地并拼接
      try {
        console.log(`🎬 开始下载并拼接 ${validVideoUrls.length} 个视频片段...`);
        finalVideoPath = await videoComposer.composeVideos(validVideoUrls, taskId);
        console.log(`✅ 视频拼接完成: ${finalVideoPath}`);
      } catch (error) {
        console.error('⚠️ 视频拼接失败:', error.message);
        throw new Error(`视频拼接失败: ${error.message}`);
      }

      // 5. 上传到 OSS
      this.updateTaskStatus(taskId, 'uploading', 85);
      this.broadcastProgress(taskId, 85, '正在上传到云存储...');

      let ossUrl = null;
      if (ossService.isConfigured()) {
        try {
          // 上传拼接后的本地视频到 OSS
          const objectName = `videos/${taskId}/final_composed.mp4`;
          const result = await ossService.uploadFile(objectName, finalVideoPath);
          ossUrl = result.publicUrl;
          console.log(`✅ 视频已上传到 OSS: ${ossUrl}`);
        } catch (error) {
          console.error('⚠️  OSS 上传失败:', error.message);
          throw new Error(`OSS 上传失败: ${error.message}`);
        }
      } else {
        // OSS 未配置，使用本地文件路径
        ossUrl = finalVideoPath;
        console.log('ℹ️  OSS 未配置，使用本地视频文件');
      }

      // 6. 完成
      this.updateTaskStatus(taskId, 'completed', 100, ossUrl);
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
