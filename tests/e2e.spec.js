import { test, expect } from '@playwright/test';

test.describe('视频生成器 E2E 测试', () => {
  test('应该成功加载首页', async ({ page }) => {
    await page.goto('/');
    
    // 检查标题
    await expect(page.locator('h1')).toContainText('AI 视频生成器');
    
    // 检查输入框和按钮
    await expect(page.locator('#userInput')).toBeVisible();
    await expect(page.locator('#generateBtn')).toBeVisible();
  });

  test('输入为空时应该显示错误', async ({ page }) => {
    await page.goto('/');
    
    // 点击生成按钮但不输入内容
    await page.click('#generateBtn');
    
    // 检查是否显示错误消息
    const errorMessage = page.locator('#errorMessage');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('请输入视频描述');
  });

  test('应该能够提交视频生成请求', async ({ page }) => {
    await page.goto('/');
    
    // 输入视频描述
    await page.fill('#userInput', '一个关于春天的短视频');
    
    // 点击生成按钮
    await page.click('#generateBtn');
    
    // 检查进度条是否显示
    await expect(page.locator('#progressSection')).toBeVisible();
    
    // 检查按钮是否被禁用
    await expect(page.locator('#generateBtn')).toBeDisabled();
  });

  test('健康检查端点应该返回正常状态', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(data.timestamp).toBeTruthy();
  });

  test('API 应该能够创建视频生成任务', async ({ request }) => {
    const response = await request.post('/api/video/generate', {
      data: {
        userInput: '测试视频生成',
        userId: 'test_user'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.taskId).toBeTruthy();
    expect(data.data.status).toBe('pending');
  });

  test('API 应该能够查询任务状态', async ({ request }) => {
    // 首先创建一个任务
    const createResponse = await request.post('/api/video/generate', {
      data: {
        userInput: '测试任务状态查询'
      }
    });
    
    const createData = await createResponse.json();
    const taskId = createData.data.taskId;
    
    // 查询任务状态
    const statusResponse = await request.get(`/api/video/status/${taskId}`);
    expect(statusResponse.ok()).toBeTruthy();
    
    const statusData = await statusResponse.json();
    expect(statusData.success).toBe(true);
    expect(statusData.data.id).toBe(taskId);
  });

  test('API 应该能够获取任务列表', async ({ request }) => {
    const response = await request.get('/api/video/list?limit=10&offset=0');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
  });

  test('WebSocket 连接应该能够建立', async ({ page }) => {
    await page.goto('/');
    
    // 等待 WebSocket 连接建立
    await page.waitForTimeout(1000);
    
    // 检查控制台日志
    const logs = [];
    page.on('console', msg => logs.push(msg.text()));
    
    await page.waitForTimeout(500);
    
    // 应该有 WebSocket 连接日志
    expect(logs.some(log => log.includes('WebSocket'))).toBeTruthy();
  });
});
