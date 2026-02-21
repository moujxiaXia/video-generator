import OSS from 'ali-oss';
import axios from 'axios';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { pipeline } from 'stream/promises';
import { join, dirname as pathDirname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class OSSService {
  constructor() {
    // 检查必要的环境变量
    this.validateConfig();
    
    this.client = new OSS({
      region: process.env.ALIYUN_OSS_REGION,
      accessKeyId: process.env.ALIYUN_OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.ALIYUN_OSS_ACCESS_KEY_SECRET,
      bucket: process.env.ALIYUN_OSS_BUCKET
    });
    
    // 确保临时目录存在
    this.tempDir = join(dirname(dirname(__dirname)), 'temp');
    if (!existsSync(this.tempDir)) {
      mkdirSync(this.tempDir, { recursive: true });
    }
  }
  
  /**
   * 验证 OSS 配置
   */
  validateConfig() {
    const requiredEnvs = [
      'ALIYUN_OSS_REGION',
      'ALIYUN_OSS_ACCESS_KEY_ID',
      'ALIYUN_OSS_ACCESS_KEY_SECRET',
      'ALIYUN_OSS_BUCKET'
    ];
    
    const missingEnvs = requiredEnvs.filter(env => !process.env[env]);
    
    if (missingEnvs.length > 0) {
      console.warn(`⚠️  OSS 配置缺失: ${missingEnvs.join(', ')}`);
      console.warn('⚠️  OSS 上传功能将不可用，将使用原始视频 URL');
    }
  }
  
  /**
   * 检查 OSS 是否已配置
   * @returns {boolean}
   */
  isConfigured() {
    return !!(
      process.env.ALIYUN_OSS_REGION &&
      process.env.ALIYUN_OSS_ACCESS_KEY_ID &&
      process.env.ALIYUN_OSS_ACCESS_KEY_SECRET &&
      process.env.ALIYUN_OSS_BUCKET
    );
  }
  
  /**
   * 从 URL 下载视频到本地
   * @param {string} videoUrl - 视频 URL
   * @param {string} filename - 本地文件名
   * @returns {Promise<string>} - 本地文件路径
   */
  async downloadVideo(videoUrl, filename) {
    try {
      console.log(`📥 开始下载视频: ${videoUrl}`);

      const localPath = join(this.tempDir, filename);

      // 确保目录存在
      const dir = pathDirname(localPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      const response = await axios({
        method: 'GET',
        url: videoUrl,
        responseType: 'stream'
      });

      await pipeline(response.data, createWriteStream(localPath));

      console.log(`✅ 视频下载完成: ${localPath}`);
      return localPath;
    } catch (error) {
      console.error('❌ 视频下载失败:', error);
      throw error;
    }
  }

  /**
   * 上传文件到 OSS
   * @param {string} objectName - OSS 对象名称
   * @param {string|Buffer} file - 文件路径或 Buffer
   * @returns {Promise<Object>} - 返回 OSS URL 和公网访问 URL
   */
  async uploadFile(objectName, file) {
    try {
      console.log(`📤 开始上传文件到 OSS: ${objectName}`);
      
      const result = await this.client.put(objectName, file);
      
      // 生成公网访问 URL
      const publicUrl = this.getPublicUrl(objectName);
      
      console.log(`✅ 文件已上传到 OSS: ${publicUrl}`);
      
      return {
        ossUrl: result.url,      // OSS 内部 URL
        publicUrl: publicUrl,    // 公网访问 URL
        name: result.name
      };
    } catch (error) {
      console.error('❌ OSS 上传失败:', error);
      throw error;
    }
  }
  
  /**
   * 生成 OSS 公网访问 URL
   * @param {string} objectName - OSS 对象名称
   * @returns {string} - 公网访问 URL
   */
  getPublicUrl(objectName) {
    const region = process.env.ALIYUN_OSS_REGION;
    const bucket = process.env.ALIYUN_OSS_BUCKET;
    return `https://${bucket}.${region}.aliyuncs.com/${objectName}`;
  }
  
  /**
   * 从 URL 下载视频并上传到 OSS
   * @param {string} videoUrl - 视频 URL
   * @param {string} objectName - OSS 对象名称
   * @returns {Promise<Object>} - 返回 OSS URL
   */
  async downloadAndUpload(videoUrl, objectName) {
    try {
      console.log(`🔄 开始下载并上传视频到 OSS...`);
      
      // 1. 下载视频到本地
      const filename = `${Date.now()}-${objectName}`;
      const localPath = await this.downloadVideo(videoUrl, filename);
      
      // 2. 上传到 OSS
      const result = await this.uploadFile(objectName, localPath);
      
      console.log(`✅ 视频已成功上传到 OSS: ${result.publicUrl}`);
      
      return result;
    } catch (error) {
      console.error('❌ 下载并上传失败:', error);
      throw error;
    }
  }

  /**
   * 下载文件从 OSS
   * @param {string} objectName - OSS 对象名称
   * @param {string} localPath - 本地保存路径
   */
  async downloadFile(objectName, localPath) {
    try {
      await this.client.get(objectName, localPath);
      console.log(`✅ 文件已从 OSS 下载到: ${localPath}`);
    } catch (error) {
      console.error('❌ OSS 下载失败:', error);
      throw error;
    }
  }

  /**
   * 删除 OSS 文件
   * @param {string} objectName - OSS 对象名称
   */
  async deleteFile(objectName) {
    try {
      await this.client.delete(objectName);
      console.log(`✅ 已从 OSS 删除文件: ${objectName}`);
    } catch (error) {
      console.error('❌ OSS 删除失败:', error);
      throw error;
    }
  }

  /**
   * 获取文件签名 URL
   * @param {string} objectName - OSS 对象名称
   * @param {number} expires - 过期时间（秒）
   * @returns {string} - 签名 URL
   */
  async getSignedUrl(objectName, expires = 3600) {
    try {
      const url = this.client.signatureUrl(objectName, { expires });
      return url;
    } catch (error) {
      console.error('❌ 获取签名 URL 失败:', error);
      throw error;
    }
  }
}

export default new OSSService();
