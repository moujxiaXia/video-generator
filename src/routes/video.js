import express from 'express';
import videoPipeline from '../pipeline/video.js';
import db from '../database/init.js';

const router = express.Router();

/**
 * POST /api/video/generate
 * 创建视频生成任务
 */
router.post('/generate', async (req, res) => {
  try {
    const { userInput, userId } = req.body;
    
    if (!userInput || userInput.trim() === '') {
      return res.status(400).json({
        error: '请提供视频描述'
      });
    }
    
    const task = await videoPipeline.createTask(userInput, userId);
    
    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    console.error('创建任务失败:', error);
    res.status(500).json({
      error: '任务创建失败',
      message: error.message
    });
  }
});

/**
 * GET /api/video/status/:taskId
 * 查询任务状态
 */
router.get('/status/:taskId', (req, res) => {
  try {
    const { taskId } = req.params;
    const task = videoPipeline.getTaskStatus(taskId);
    
    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    console.error('查询任务失败:', error);
    res.status(404).json({
      error: '任务不存在',
      message: error.message
    });
  }
});

/**
 * GET /api/video/list
 * 获取任务列表
 */
router.get('/list', (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    
    const stmt = db.prepare(`
      SELECT * FROM video_tasks 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `);
    
    const tasks = stmt.all(limit, offset);
    
    res.json({
      success: true,
      data: tasks
    });
  } catch (error) {
    console.error('获取任务列表失败:', error);
    res.status(500).json({
      error: '获取列表失败',
      message: error.message
    });
  }
});

export default router;
