import axios from 'axios';

class TongyiService {
  constructor() {
    this.apiKey = process.env.DASHSCOPE_API_KEY;
    this.baseUrl = 'https://dashscope.aliyuncs.com/api/v1';
  }

  /**
   * 调用通义千问生成脚本
   * @param {string} userInput - 用户输入的一句话描述
   * @returns {Promise<Object>} - 生成的脚本对象
   */
  async generateScript(userInput) {
    try {
      console.log('🤖 调用通义千问生成脚本...');
      
      const prompt = `你是一个专业的视频脚本创作专家。用户给出了一个视频创意，你需要将它转换为详细的视频分镜脚本。

用户输入: "${userInput}"

请生成一个包含3-8个连续场景的视频脚本，每个场景包含：
1. scene_number: 场景编号（1, 2, 3...）
2. description: 场景描述（50-200字，描述场景内容、氛围、情感）
3. visual_prompt: 视觉提示词（20-100字，用于AI视频生成，描述画面细节、镜头运动、光线、色彩）
4. duration: 建议时长（3-15秒）

要求：
- 场景之间要有连贯性和叙事性
- 视觉提示词要具体、生动，适合AI理解
- 总时长控制在30-180秒
- 使用JSON格式返回

返回格式示例：
{
  "title": "视频标题",
  "total_duration": 60,
  "scenes": [
    {
      "scene_number": 1,
      "description": "场景描述",
      "visual_prompt": "视觉提示词",
      "duration": 5
    }
  ]
}`;

      const response = await axios.post(
        `${this.baseUrl}/services/aigc/text-generation/generation`,
        {
          model: 'qwen-max',
          input: {
            messages: [
              {
                role: 'system',
                content: '你是一个专业的视频脚本创作专家，擅长将创意转换为详细的视频分镜脚本。'
              },
              {
                role: 'user',
                content: prompt
              }
            ]
          },
          parameters: {
            result_format: 'message',
            temperature: 0.7,
            max_tokens: 2000
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const content = response.data.output.choices[0].message.content;
      console.log('✅ 脚本生成完成');
      
      // 尝试解析 JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      throw new Error('无法解析脚本 JSON');
    } catch (error) {
      console.error('❌ 脚本生成失败:', error.message);
      throw error;
    }
  }

  /**
   * 调用通义万相生成视频
   * @param {string} prompt - 视频生成提示词
   * @param {number} duration - 视频时长（秒）
   * @returns {Promise<string>} - 视频 URL
   */
  async generateVideo(prompt, duration = 5) {
    try {
      console.log(`🎬 调用通义万相生成视频: ${prompt.substring(0, 50)}...`);
      
      // 注意：这里使用的是模拟实现
      // 实际需要根据阿里云通义万相的具体 API 文档调整
      const response = await axios.post(
        `${this.baseUrl}/services/aigc/video-generation/generation`,
        {
          model: 'wanx-video-generation',
          input: {
            prompt: prompt
          },
          parameters: {
            duration: duration,
            resolution: '1280x720',
            fps: 30
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // 获取任务 ID
      const taskId = response.data.output.task_id;
      console.log(`⏳ 视频生成任务已提交，任务ID: ${taskId}`);
      
      // 轮询任务状态
      return await this.pollVideoTask(taskId);
    } catch (error) {
      console.error('❌ 视频生成失败:', error.message);
      throw error;
    }
  }

  /**
   * 轮询视频生成任务状态
   * @param {string} taskId - 任务 ID
   * @returns {Promise<string>} - 视频 URL
   */
  async pollVideoTask(taskId, maxRetries = 60) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await axios.get(
          `${this.baseUrl}/tasks/${taskId}`,
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`
            }
          }
        );

        const status = response.data.output.task_status;
        
        if (status === 'SUCCEEDED') {
          const videoUrl = response.data.output.video_url;
          console.log(`✅ 视频生成成功: ${videoUrl}`);
          return videoUrl;
        } else if (status === 'FAILED') {
          throw new Error('视频生成失败');
        }
        
        console.log(`⏳ 等待视频生成... (${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 5000)); // 等待5秒
      } catch (error) {
        if (i === maxRetries - 1) throw error;
      }
    }
    
    throw new Error('视频生成超时');
  }

  /**
   * 文本转语音
   * @param {string} text - 文本内容
   * @returns {Promise<Buffer>} - 音频数据
   */
  async textToSpeech(text) {
    try {
      console.log('🎤 调用语音合成...');
      
      const response = await axios.post(
        `${this.baseUrl}/services/aigc/text2speech/synthesis`,
        {
          model: 'sambert-zhichu-v1',
          input: {
            text: text
          },
          parameters: {
            voice: 'zhixiaoxia',
            format: 'mp3',
            sample_rate: 48000
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          responseType: 'arraybuffer'
        }
      );

      console.log('✅ 语音合成完成');
      return response.data;
    } catch (error) {
      console.error('❌ 语音合成失败:', error.message);
      throw error;
    }
  }
}

export default new TongyiService();
