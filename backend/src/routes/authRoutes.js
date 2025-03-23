import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { 
  generateVerificationCode,
  sendVerificationEmail,
  testEmailConnection
} from '../utils/emailService.js';
import {
  CODE_TYPES,
  storeVerificationCode,
  verifyCode,
  hasActiveCode
} from '../utils/verificationStore.js';

const router = express.Router();

// 获取文件路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '../../uploads');
const avatarsDir = path.join(uploadsDir, 'avatars');

// 配置文件存储
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, avatarsDir);
  },
  filename: function (req, file, cb) {
    const userId = req.user.userId;
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${userId}-${uniqueSuffix}${ext}`);
  }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
  // 接受的文件类型
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('不支持的文件类型！'), false);
  }
};

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB
  },
  fileFilter: fileFilter
});

// 工具函数：将相对路径转换为完整URL
const getFullUrl = (req, relativePath) => {
  if (!relativePath) return null;
  if (relativePath.startsWith('http')) return relativePath;
  
  const protocol = req.protocol;
  const host = req.get('host');
  
  if (relativePath.startsWith('/')) {
    return `${protocol}://${host}${relativePath}`;
  } else {
    return `${protocol}://${host}/${relativePath}`;
  }
};

// JWT验证中间件
export const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: '未授权访问' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { userId: decoded.userId };
    next();
  } catch (error) {
    res.status(401).json({ message: '无效的令牌' });
  }
};

// 发送注册验证码
router.post('/send-registration-code', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: '请提供有效的邮箱地址' });
    }
    
    // 检查邮箱是否已被注册
    const [existingUser] = await query('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(400).json({ message: '该邮箱已被注册' });
    }
    
    // 检查是否已经发送过验证码且未过期
    if (hasActiveCode(email, CODE_TYPES.REGISTRATION)) {
      return res.status(400).json({ message: '验证码已发送，请检查您的邮箱或稍后再试' });
    }
    
    // 生成验证码
    const code = generateVerificationCode();
    
    // 发送验证码邮件
    const success = await sendVerificationEmail(email, code, true);
    
    if (!success) {
      return res.status(500).json({ message: '验证码发送失败，请稍后再试' });
    }
    
    // 存储验证码
    storeVerificationCode(email, code, CODE_TYPES.REGISTRATION);
    
    res.json({ message: '验证码已发送至您的邮箱' });
  } catch (error) {
    console.error('发送验证码错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 用户注册（带验证码）
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, verificationCode } = req.body;
    
    // 检查所有字段
    if (!username || !email || !password || !verificationCode) {
      return res.status(400).json({ message: '所有字段都是必填的' });
    }
    
    // 检查用户名是否已存在
    const [existingUsername] = await query('SELECT * FROM users WHERE username = ?', [username]);
    if (existingUsername) {
      return res.status(400).json({ message: '该用户名已被使用' });
    }
    
    // 检查邮箱是否已存在
    const [existingEmail] = await query('SELECT * FROM users WHERE email = ?', [email]);
    if (existingEmail) {
      return res.status(400).json({ message: '该邮箱已被注册' });
    }
    
    // 验证验证码
    const isValid = verifyCode(email, verificationCode, CODE_TYPES.REGISTRATION);
    if (!isValid) {
      return res.status(400).json({ message: '验证码无效或已过期' });
    }

    // 哈希密码
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 创建新用户
    await query(
      'INSERT INTO users (username, email, password, verified) VALUES (?, ?, ?, ?)',
      [username, email, hashedPassword, true]
    );

    res.status(201).json({ message: '用户注册成功' });
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ message: error.sqlMessage || '数据库操作失败' });
  }
});

// 发送重置密码验证码
router.post('/send-reset-code', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: '请提供有效的邮箱地址' });
    }
    
    // 检查邮箱是否存在
    const [user] = await query('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(404).json({ message: '该邮箱未注册' });
    }
    
    // 检查是否已经发送过验证码且未过期
    if (hasActiveCode(email, CODE_TYPES.PASSWORD_RESET)) {
      return res.status(400).json({ message: '验证码已发送，请检查您的邮箱或稍后再试' });
    }
    
    // 生成验证码
    const code = generateVerificationCode();
    
    // 发送验证码邮件
    const success = await sendVerificationEmail(email, code, false);
    
    if (!success) {
      return res.status(500).json({ message: '验证码发送失败，请稍后再试' });
    }
    
    // 存储验证码
    storeVerificationCode(email, code, CODE_TYPES.PASSWORD_RESET);
    
    res.json({ message: '验证码已发送至您的邮箱' });
  } catch (error) {
    console.error('发送重置验证码错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 重置密码
router.post('/reset-password', async (req, res) => {
  try {
    const { email, verificationCode, newPassword } = req.body;
    
    // 检查所有字段
    if (!email || !verificationCode || !newPassword) {
      return res.status(400).json({ message: '所有字段都是必填的' });
    }
    
    // 验证验证码
    const isValid = verifyCode(email, verificationCode, CODE_TYPES.PASSWORD_RESET);
    if (!isValid) {
      return res.status(400).json({ message: '验证码无效或已过期' });
    }
    
    // 检查邮箱是否存在
    const [user] = await query('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(404).json({ message: '该邮箱未注册' });
    }
    
    // 哈希新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // 更新密码
    await query(
      'UPDATE users SET password = ? WHERE email = ?',
      [hashedPassword, email]
    );
    
    res.json({ message: '密码已重置，请使用新密码登录' });
  } catch (error) {
    console.error('重置密码错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 用户登录
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 查找用户
    const [user] = await query('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) return res.status(400).json({ message: '无效的凭证' });

    // 验证密码
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(400).json({ message: '无效的凭证' });

    // 生成JWT
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 处理头像URL
    const avatarUrl = getFullUrl(req, user.avatar);

    // 返回用户信息（不包含密码）
    const userInfo = {
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: avatarUrl
    };

    res.json({ token, user: userInfo });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ message: error.sqlMessage || '数据库操作失败' });
  }
});

// 获取用户个人资料
router.get('/profile', authenticate, async (req, res) => {
  try {
    const [user] = await query(
      'SELECT id, username, email, avatar FROM users WHERE id = ?',
      [req.user.userId]
    );
    
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    
    // 处理头像URL，确保返回完整URL
    user.avatar = getFullUrl(req, user.avatar);
    
    res.json(user);
  } catch (error) {
    console.error('获取个人资料错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 修改密码
router.put('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // 验证当前密码
    const [user] = await query(
      'SELECT password FROM users WHERE id = ?',
      [req.user.userId]
    );
    
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: '当前密码不正确' });
    }
    
    // 加密新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // 更新密码
    await query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, req.user.userId]
    );
    
    res.json({ message: '密码已更新' });
  } catch (error) {
    console.error('修改密码错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 上传头像
router.post('/upload-avatar', authenticate, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '没有选择文件' });
    }
    
    // 获取完整的文件名，包括路径
    const filename = req.file.filename;
    
    // 相对路径
    const relativePath = `/uploads/avatars/${filename}`;
    
    // 构建完整URL
    const avatarUrl = getFullUrl(req, relativePath);
    
    // 更新用户头像URL - 存储相对路径
    await query(
      'UPDATE users SET avatar = ? WHERE id = ?',
      [relativePath, req.user.userId]
    );
    
    res.json({ 
      message: '头像上传成功',
      avatarUrl: avatarUrl
    });
  } catch (error) {
    console.error('上传头像错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

export default router;