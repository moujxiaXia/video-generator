import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class VideoComposer {
  constructor() {
    this.tempDir = join(__dirname, '../../temp');
    this.outputDir = join(__dirname, '../../output');

    // 确保目录存在
    if (!existsSync(this.tempDir)) {
      mkdirSync(this.tempDir, { recursive: true });
    }
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * 下载视频到本地
   * @param {string} videoUrl - 视频 URL
   * @param {string} outputPath - 输出路径
   */
  async downloadVideo(videoUrl, outputPath) {
    try {
      console.log(`📥 下载视频: ${videoUrl.substring(0, 60)}...`);

      const response = await axios({
        method: 'GET',
        url: videoUrl,
        responseType: 'arraybuffer',
        timeout: 60000
      });

      writeFileSync(outputPath, Buffer.from(response.data));
      console.log(`✅ 下载完成: ${outputPath}`);
      return outputPath;
    } catch (error) {
      console.error('❌ 下载失败:', error.message);
      throw error;
    }
  }

  /**
   * 使用 FFmpeg 拼接多个视频
   * @param {string[]} videoPaths - 视频文件路径数组
   * @param {string} outputPath - 输出文件路径
   */
  async concatVideos(videoPaths, outputPath) {
    try {
      if (videoPaths.length === 0) {
        throw new Error('没有视频文件可拼接');
      }

      if (videoPaths.length === 1) {
        // 只有一个视频，直接复制
        const fs = await import('fs');
        fs.copyFileSync(videoPaths[0], outputPath);
        return outputPath;
      }

      console.log(`🎬 开始拼接 ${videoPaths.length} 个视频...`);

      // 直接使用 FFmpeg 拼接
      return await this.concatWithFFmpeg(videoPaths, outputPath);
    } catch (error) {
      console.error('❌ 视频拼接失败:', error.message);
      throw error;
    }
  }

  /**
   * 使用 ffmpeg 拼接视频（备用方案）
   */
  async concatWithFFmpeg(videoPaths, outputPath) {
    // 创建 concat 列表文件
    const listFile = join(this.tempDir, `concat_list_${Date.now()}.txt`);
    const listContent = videoPaths.map(p => `file '${p}'`).join('\n');
    writeFileSync(listFile, listContent);

    // 先尝试使用 -c copy 快速拼接
    let cmd = `ffmpeg -f concat -safe 0 -i "${listFile}" -c copy "${outputPath}"`;

    console.log(`执行 ffmpeg: ${cmd}`);

    try {
      execSync(cmd, {
        cwd: this.tempDir,
        timeout: 300000,
        stdio: 'pipe'
      });
      console.log(`✅ ffmpeg 拼接完成（直接复制流）: ${outputPath}`);
    } catch (error) {
      console.log('⚠️  直接复制失败（视频编码/分辨率/帧率可能不一致），尝试重新编码...');
      
      // 删除失败的输出文件（如果存在）
      try {
        unlinkSync(outputPath);
      } catch (e) {}

      // 重新编码拼接，统一编码格式和参数
      cmd = `ffmpeg -f concat -safe 0 -i "${listFile}" -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k "${outputPath}"`;
      console.log(`执行 ffmpeg (重新编码): ${cmd}`);
      
      execSync(cmd, {
        cwd: this.tempDir,
        timeout: 300000,
        stdio: 'pipe'
      });
      console.log(`✅ ffmpeg 拼接完成（重新编码）: ${outputPath}`);
    }

    // 清理列表文件
    try {
      unlinkSync(listFile);
    } catch (e) {}

    return outputPath;
  }

  /**
   * 拼接多个视频 URL
   * @param {string[]} videoUrls - 视频 URL 数组
   * @param {string} taskId - 任务 ID
   * @returns {Promise<string>} - 本地输出文件路径
   */
  async composeVideos(videoUrls, taskId) {
    const validUrls = videoUrls.filter(url => url !== null && url !== undefined);

    if (validUrls.length === 0) {
      throw new Error('没有有效的视频 URL');
    }

    console.log(`🎬 开始处理 ${validUrls.length} 个视频片段...`);

    // 创建任务临时目录（使用 scenes 子目录保存各段视频）
    const taskTempDir = join(this.tempDir, `compose_${taskId}`);
    const scenesDir = join(taskTempDir, 'scenes');
    if (!existsSync(scenesDir)) {
      mkdirSync(scenesDir, { recursive: true });
    }

    // 下载所有视频到本地 scenes 目录
    const localPaths = [];
    for (let i = 0; i < validUrls.length; i++) {
      const localPath = join(scenesDir, `scene_${String(i + 1).padStart(2, '0')}.mp4`);
      try {
        console.log(`📥 下载场景 ${i + 1}/${validUrls.length}...`);
        await this.downloadVideo(validUrls[i], localPath);
        localPaths.push(localPath);
        console.log(`✅ 场景 ${i + 1} 下载完成: ${localPath}`);
      } catch (error) {
        console.error(`❌ 场景 ${i + 1} 下载失败:`, error.message);
        throw new Error(`场景 ${i + 1} 下载失败: ${error.message}`);
      }
    }

    if (localPaths.length === 0) {
      throw new Error('所有视频下载失败');
    }

    console.log(`📁 所有视频已下载到: ${scenesDir}`);
    console.log(`📊 成功下载 ${localPaths.length}/${validUrls.length} 个视频片段`);

    // 拼接视频到输出目录
    const outputPath = join(this.outputDir, `${taskId}_final.mp4`);
    await this.concatVideos(localPaths, outputPath);

    console.log(`✅ 拼接完成，输出文件: ${outputPath}`);

    // 保留原始视频片段，不清理（可用于调试或备份）
    console.log(`ℹ️  原始视频片段保留在: ${scenesDir}`);

    return outputPath;
  }
}

export default new VideoComposer();
