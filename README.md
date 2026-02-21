# AI 视频生成器 🎬

> 一句话生成连续视频的 AI 应用

使用阿里云通义千问和通义万相，将文字描述自动转换为连续的视频内容。

## ✨ 功能特点

- 🤖 **智能脚本生成**：使用通义千问自动将一句话扩展为完整的视频分镜脚本
- 🎥 **AI 视频生成**：集成通义万相视频生成 API，自动生成各场景视频
- 📊 **实时进度推送**：使用 WebSocket 实时显示视频生成进度
- ☁️ **云存储集成**：支持阿里云 OSS 存储生成的视频
- 🎨 **现代化 UI**：响应式 Web 界面，简洁易用
- 🧪 **完整测试**：使用 Playwright 进行 E2E 测试

## 🏗️ 技术栈

### 后端
- **Node.js** + **Express** - 服务器框架
- **SQLite** (better-sqlite3) - 数据库
- **WebSocket** - 实时通信

### AI 模型
- **通义千问** (qwen-max) - 脚本生成
- **通义万相** - 视频生成
- **通义语音** - 语音合成（可选）

### 云服务
- **阿里云 OSS** - 对象存储

### 测试
- **Playwright** - E2E 自动化测试

### MCP 服务器
- Filesystem MCP - 文件管理
- Database MCP - 数据库操作
- Git MCP - 版本控制
- Fetch MCP - HTTP 请求
- Playwright MCP - 浏览器自动化

## 📦 安装

### 1. 克隆项目

```bash
git clone https://github.com/your-username/video-generator.git
cd video-generator
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制 `.env.example` 为 `.env` 并填写配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 通义千问 API（必需）
DASHSCOPE_API_KEY=your-dashscope-api-key-here

# 阿里云 OSS 配置（必需）
ALIYUN_OSS_REGION=oss-cn-hangzhou
ALIYUN_OSS_ACCESS_KEY_ID=your-access-key-id
ALIYUN_OSS_ACCESS_KEY_SECRET=your-access-key-secret
ALIYUN_OSS_BUCKET=video-generator-bucket

# 服务器配置
PORT=3000
NODE_ENV=development
```

### 4. 获取 API 密钥

#### 通义千问 API Key
1. 访问 [阿里云百炼平台](https://bailian.console.aliyun.com/)
2. 开通 DashScope 服务
3. 创建 API Key

#### 阿里云 OSS
1. 访问 [阿里云 OSS 控制台](https://oss.console.aliyun.com/)
2. 创建 Bucket
3. 创建 AccessKey（RAM 用户）

## 🚀 运行

### 开发模式

```bash
npm run dev
```

### 生产模式

```bash
npm start
```

服务将在 `http://localhost:3000` 启动。

## 🧪 测试

### 安装 Playwright 浏览器

```bash
npm run playwright:install
```

### 运行测试

```bash
# 无头模式运行测试
npm test

# 有界面模式运行测试
npm run test:headed

# 使用 UI 模式
npm run test:ui
```

## 📖 使用方法

### Web 界面

1. 打开浏览器访问 `http://localhost:3000`
2. 在输入框中描述你想生成的视频内容，例如：
   - "一个关于春天来临的短视频，展现花朵绽放、小鸟歌唱、春风拂面的美好画面"
   - "科技感十足的产品展示视频，展示智能手机的各项功能"
3. 点击"开始生成视频"按钮
4. 等待 AI 生成脚本和视频（可能需要几分钟）
5. 生成完成后可以直接在线观看或下载

### API 接口

#### 1. 创建视频生成任务

```bash
POST /api/video/generate
Content-Type: application/json

{
  "userInput": "一个关于春天的短视频",
  "userId": "user_123"
}
```

响应：
```json
{
  "success": true,
  "data": {
    "taskId": "uuid",
    "status": "pending"
  }
}
```

#### 2. 查询任务状态

```bash
GET /api/video/status/:taskId
```

响应：
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "user_input": "一个关于春天的短视频",
    "script": {...},
    "status": "completed",
    "progress": 100,
    "output_url": "https://...",
    "scenes": [...]
  }
}
```

#### 3. 获取任务列表

```bash
GET /api/video/list?limit=20&offset=0
```

## 📁 项目结构

```
video-generator/
├── config/                      # 配置文件
│   ├── models.json             # AI 模型配置
│   └── rules/                  # 业务规则
│       ├── video_generation_rules.json
│       └── user_rules.json
├── src/
│   ├── index.js                # 服务器入口
│   ├── database/
│   │   └── init.js            # 数据库初始化
│   ├── services/
│   │   ├── tongyi.js          # 通义 API 服务
│   │   └── oss.js             # OSS 存储服务
│   ├── pipeline/
│   │   └── video.js           # 视频生成流水线
│   └── routes/
│       └── video.js           # API 路由
├── public/
│   └── index.html             # Web 界面
├── tests/
│   └── e2e.spec.js           # E2E 测试
├── database/                  # SQLite 数据库
├── output/                    # 生成的视频输出
├── temp/                      # 临时文件
├── mcp-config.json           # MCP 服务器配置
├── playwright.config.js      # Playwright 配置
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

## 🔧 配置说明

### 视频生成规则

编辑 `config/rules/video_generation_rules.json` 可以配置：

- 视频时长限制
- 场景数量限制
- 视频质量参数
- 内容过滤规则

### MCP 服务器

MCP 服务器配置在 `mcp-config.json`，提供以下能力：

- **Filesystem MCP**：管理本地文件
- **Database MCP**：数据库操作
- **Git MCP**：版本控制
- **Fetch MCP**：HTTP 请求
- **Playwright MCP**：浏览器自动化

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🔗 相关链接

- [通义千问文档](https://help.aliyun.com/zh/dashscope/)
- [通义万相文档](https://help.aliyun.com/zh/dashscope/developer-reference/tongyi-wanxiang/)
- [阿里云 OSS 文档](https://help.aliyun.com/product/31815.html)
- [Playwright 文档](https://playwright.dev/)

## ⚠️ 注意事项

1. **API 费用**：使用阿里云服务会产生费用，请注意成本控制
2. **生成时间**：视频生成需要一定时间（通常 30 秒 - 5 分钟），请耐心等待
3. **内容审核**：生成的内容需遵守相关法律法规，系统包含基础内容过滤
4. **并发限制**：根据 API 配额合理控制并发任务数

## 🐛 故障排除

### 问题：视频生成失败

1. 检查 `.env` 配置是否正确
2. 确认 API Key 有效且有足够配额
3. 查看服务器日志获取详细错误信息

### 问题：WebSocket 连接失败

1. 检查防火墙设置
2. 确认端口 3000 未被占用
3. 检查浏览器控制台错误信息

### 问题：测试失败

1. 确保已安装 Playwright 浏览器：`npm run playwright:install`
2. 检查服务器是否正常运行
3. 查看测试报告：`npx playwright show-report`

## 📞 联系方式

如有问题，请提交 Issue 或联系开发者。

---

⭐ 如果这个项目对你有帮助，请给一个 Star！
