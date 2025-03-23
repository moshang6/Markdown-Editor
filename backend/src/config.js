import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 加载环境变量
dotenv.config();

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 服务器配置
export const SERVER_CONFIG = {
  PORT: process.env.PORT || 5000,
  HOST: process.env.HOST || '0.0.0.0',
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // API域名配置
  API_DOMAIN: process.env.API_DOMAIN || 'my.moshang.site',
  API_IP: process.env.API_IP || '192.168.31.73',
  API_PROTOCOL: process.env.API_PROTOCOL || 'https',
  FRONTEND_PORT: 443,
  
  // 获取请求的主机名
  getRequestHost(req) {
    // 从请求中获取主机名
    if (req) {
      const origin = req.get('Origin') || req.get('Referer') || '';
      if (origin.includes(this.API_DOMAIN)) {
        return this.API_DOMAIN;
      }
    }
    return this.API_IP;
  },
  
  // 前端URL - 根据请求动态生成
  getFrontendUrl(req) {
    const host = this.getRequestHost(req);
    return `${this.API_PROTOCOL}://${host}:${this.FRONTEND_PORT}`;
  },
  
  // 路径配置
  UPLOADS_DIR: path.join(__dirname, '../uploads'),
  AVATARS_DIR: path.join(__dirname, '../uploads/avatars'),
  IMAGES_DIR: path.join(__dirname, '../uploads/img'),
  
  // API地址构建函数
  getApiUrl(req) {
    const port = this.PORT;
    const host = this.getRequestHost(req);
    return `${this.API_PROTOCOL}://${host}:${port}`;
  },
  
  // 图片URL构建函数
  getImageUrl(filename, req) {
    return `${this.getApiUrl(req)}/uploads/img/${filename}`;
  }
};

// 数据库配置
export const DB_CONFIG = {
  HOST: process.env.DB_HOST || 'localhost',
  PORT: process.env.DB_PORT || 3306,
  USER: process.env.DB_USER || 'root',
  PASSWORD: process.env.DB_PASSWORD || 'root',
  DATABASE: process.env.DB_NAME || 'markdown_editor'
};

// JWT配置
export const JWT_CONFIG = {
  SECRET: process.env.JWT_SECRET || '151946',
  EXPIRES_IN: '7d' // 7天过期
};

// 邮件配置
export const EMAIL_CONFIG = {
  HOST: process.env.EMAIL_HOST || 'smtp.qq.com',
  PORT: process.env.EMAIL_PORT || 465,
  USER: process.env.EMAIL_USER || '',
  PASS: process.env.EMAIL_PASS || '',
  FROM: process.env.EMAIL_USER || 'noreply@example.com'
};

// 默认导出所有配置
export default {
  server: SERVER_CONFIG,
  db: DB_CONFIG,
  jwt: JWT_CONFIG,
  email: EMAIL_CONFIG
}; 