import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initDatabase } from './database/init.js';
import videoRoutes from './routes/video.js';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 静态文件
app.use(express.static(join(__dirname, '../public')));
app.use('/output', express.static(join(__dirname, '../output')));

// 路由
app.use('/api/video', videoRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 初始化数据库
initDatabase();

// 启动服务器
const server = app.listen(PORT, () => {
  console.log(`🚀 视频生成服务器启动成功！`);
  console.log(`📡 服务地址: http://localhost:${PORT}`);
  console.log(`📊 API文档: http://localhost:${PORT}/api/docs`);
});

// WebSocket 支持（用于实时进度推送）
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('📱 WebSocket 客户端已连接');
  
  ws.on('message', (message) => {
    console.log('收到消息:', message.toString());
  });
  
  ws.on('close', () => {
    console.log('📱 WebSocket 客户端已断开');
  });
});

// 导出 WebSocket 服务器供其他模块使用
export { wss };
