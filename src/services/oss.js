import OSS from 'ali-oss';

class OSSService {
  constructor() {
    this.client = new OSS({
      region: process.env.ALIYUN_OSS_REGION,
      accessKeyId: process.env.ALIYUN_OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.ALIYUN_OSS_ACCESS_KEY_SECRET,
      bucket: process.env.ALIYUN_OSS_BUCKET
    });
  }

  /**
   * 上传文件到 OSS
   * @param {string} objectName - OSS 对象名称
   * @param {string|Buffer} file - 文件路径或 Buffer
   * @returns {Promise<string>} - 文件 URL
   */
  async uploadFile(objectName, file) {
    try {
      const result = await this.client.put(objectName, file);
      console.log(`✅ 文件已上传到 OSS: ${result.url}`);
      return result.url;
    } catch (error) {
      console.error('❌ OSS 上传失败:', error);
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
