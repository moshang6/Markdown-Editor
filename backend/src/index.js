import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { testEmailConnection } from './utils/emailService.js';
import os from 'os';
import config, { SERVER_CONFIG } from './config.js';

const app = express();
const port = SERVER_CONFIG.PORT;
const host = SERVER_CONFIG.HOST;

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 创建上传目录
const uploadsDir = SERVER_CONFIG.UPLOADS_DIR;
const avatarsDir = SERVER_CONFIG.AVATARS_DIR;
const imagesDir = SERVER_CONFIG.IMAGES_DIR;

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
  console.log('已创建上传目录:', uploadsDir);
}

if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir);
  console.log('已创建头像目录:', avatarsDir);
}

if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir);
  console.log('已创建图片目录:', imagesDir);
}

// 中间件
app.use(cors({
  origin: ['http://192.168.31.73:5173', 'http://localhost:5173', 'http://my.moshang.site:5173', 'https://my.moshang.site:90', 'https://my.moshang.site'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json());

// 设置静态文件目录
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 测试数据库连接
import db from './db.js';
db.getConnection((err, connection) => {
  if (err) {
    console.error('数据库连接失败:', err);
    return;
  }
  console.log('成功连接到MySQL数据库');
  connection.release();
});

// 测试邮件服务连接
testEmailConnection()
  .then(success => {
    if (success) {
      console.log('邮件服务连接成功');
    } else {
      console.warn('邮件服务连接失败，请检查配置');
    }
  })
  .catch(error => {
    console.error('邮件服务连接错误:', error);
  });

import authRoutes from './routes/authRoutes.js';
import docRoutes from './routes/docRoutes.js';

// 路由中间件
app.use('/api/auth', authRoutes);
app.use('/api/docs', docRoutes);

// 健康检查端点 - 确保这个端点定义在其他路由之前
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('全局错误:', err);
  res.status(500).json({ 
    message: '服务器内部错误',
    error: SERVER_CONFIG.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 基础路由
app.get('/', (req, res) => {
  res.send('Markdown编辑器后端服务运行中');
});

// 处理前端路由 - 当客户端直接访问前端路由时提供支持
app.get('/shared-doc/:docId', (req, res) => {
  try {
    // 保留所有查询参数
    const docId = req.params.docId;
    const shareToken = req.query.shareToken;
    
    if (!shareToken) {
      return res.status(400).send('分享链接无效：缺少必要的分享令牌');
    }
    
    // 使用环境变量中配置的前端URL
    const frontendUrl = SERVER_CONFIG.getFrontendUrl(req);
    
    const redirectUrl = `${frontendUrl}/shared-doc/${docId}?shareToken=${shareToken}`;
    console.log(`重定向到: ${redirectUrl}`);
    
    return res.redirect(redirectUrl);
  } catch (error) {
    console.error('重定向错误:', error);
    return res.status(500).send('重定向过程中发生错误');
  }
});

// 配置文件上传
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, avatarsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'avatar-' + uniqueSuffix + ext);
  }
});

// 配置图片上传存储
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, imagesDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'img-' + uniqueSuffix + ext);
  }
});

const uploadAvatar = multer({ 
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件 (jpeg, jpg, png, gif)!'));
    }
  }
});

const uploadImage = multer({ 
  storage: imageStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件 (jpeg, jpg, png, gif, webp, svg)!'));
    }
  }
});

// multer错误处理中间件
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: '文件大小不能超过2MB' });
    }
    return res.status(400).json({ message: err.message });
  } else if (err) {
    console.error('服务器错误:', err);
    return res.status(500).json({ message: err.message || '服务器内部错误' });
  }
  next();
});

// 添加图片上传路由
app.post('/api/upload/image', uploadImage.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '没有上传文件' });
    }
    
    // 使用配置生成图片URL
    const fileUrl = SERVER_CONFIG.getImageUrl(req.file.filename, req);
    
    res.status(200).json({
      url: fileUrl,
      filename: req.file.filename,
      success: true
    });
  } catch (error) {
    console.error('图片上传错误:', error);
    res.status(500).json({ message: '图片上传失败', error: error.message });
  }
});

// 添加SSL证书配置
const sslOptions = {
  cert: fs.readFileSync('E:/phpstudy_pro/WWW/个人网站证书/full_chain.pem'),
  key: fs.readFileSync('E:/phpstudy_pro/WWW/个人网站证书/private.key')
};

// 启动服务器 - 修改为HTTPS服务器
const server = https.createServer(sslOptions, app);
server.listen(port, host, () => {
  console.log(`HTTPS服务器运行在 https://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
  console.log(`服务器域名: ${SERVER_CONFIG.API_DOMAIN}`);
  console.log(`服务器IP: ${SERVER_CONFIG.API_IP}`);
  console.log(`默认API URL: ${SERVER_CONFIG.getApiUrl()}`);
  
  try {
    // 使用ES模块兼容的方式获取网络接口信息
    const networkInterfaces = os.networkInterfaces();
    const localIps = Object.values(networkInterfaces)
      .flat()
      .filter(item => !item.internal && item.family === 'IPv4')
      .map(item => item.address);
    
    if (localIps && localIps.length > 0) {
      console.log(`您也可以通过以下地址访问: https://${SERVER_CONFIG.API_DOMAIN}:${port}`);
    }
  } catch (error) {
    console.error('获取网络接口信息失败:', error);
  }
});