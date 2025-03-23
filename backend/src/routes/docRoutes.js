import express from 'express';
import { query } from '../db.js';
import authenticateToken from '../middleware/auth.js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { SERVER_CONFIG } from '../config.js';

const router = express.Router();

// 创建新文档
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { title, content } = req.body;
    
    // 执行插入操作并获取插入ID
    const result = await query(
      'INSERT INTO documents (user_id, title, content, created_at, updated_at, last_accessed_at) VALUES (?, ?, ?, NOW(), NOW(), NOW())',
      [userId, title || '未命名文档', content || '']
    );
    
    const newDocId = result.insertId;
    
    // 获取新创建的文档信息
    const [newDoc] = await query(
      'SELECT id, title, content, created_at, updated_at, last_accessed_at FROM documents WHERE id = ?',
      [newDocId]
    );
    
    res.status(201).json({
      message: '文档创建成功',
      id: newDocId,
      ...newDoc
    });
  } catch (error) {
    console.error('创建文档错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取用户所有文档
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const documents = await query(
      'SELECT id, title, content, created_at, updated_at, last_accessed_at FROM documents WHERE user_id = ? ORDER BY updated_at DESC',
      [userId]
    );
    res.json(documents);
  } catch (error) {
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取用户最近打开的文档
router.get('/recent', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit || '5'); // 默认获取5个最近文档，确保转换为数字
    
    console.log(`获取用户 ${userId} 的最近 ${limit} 个文档`);
    
    // 直接使用模板字符串构建SQL语句，避免参数化LIMIT
    const sql = `SELECT id, title, content, created_at, updated_at, last_accessed_at FROM documents WHERE user_id = ? ORDER BY last_accessed_at DESC LIMIT ${limit}`;
    const documents = await query(sql, [userId]);
    
    console.log(`找到 ${documents.length} 个最近文档`);
    
    // 处理文档内容，只返回摘要
    const recentDocs = documents.map(doc => ({
      id: doc.id,
      title: doc.title,
      summary: doc.content ? doc.content.substring(0, 100) + (doc.content.length > 100 ? '...' : '') : '',
      updated_at: doc.updated_at
    }));
    
    res.json(recentDocs);
  } catch (error) {
    console.error('获取最近文档错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 更新文档访问时间（当用户打开文档时）
router.post('/:docId/access', authenticateToken, async (req, res) => {
  try {
    const docId = parseInt(req.params.docId);
    const userId = req.user.userId;
    
    // 验证文档存在且归当前用户所有
    const [document] = await query(
      'SELECT id FROM documents WHERE id = ? AND user_id = ?',
      [docId, userId]
    );
    
    if (!document) {
      return res.status(404).json({ message: '文档不存在或您无权访问' });
    }
    
    // 更新文档的updated_at时间戳
    await query(
      'UPDATE documents SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [docId]
    );
    
    res.json({ message: '文档访问时间已更新' });
  } catch (error) {
    console.error('更新文档访问时间错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取单个文档（可通过分享链接或用户身份访问）
router.get('/:docId', async (req, res) => {
  try {
    const docId = parseInt(req.params.docId);
    const shareToken = req.query.shareToken;

    // 如果提供了分享令牌，则尝试获取共享文档
    if (shareToken) {
      console.log(`尝试通过共享令牌访问文档, ID: ${docId}, Token: ${shareToken.substring(0, 10)}...`);
      
      const sharedDocs = await query(
        'SELECT d.id, d.title, d.content, d.created_at, d.updated_at, d.last_accessed_at, u.username as creator_username ' +
        'FROM documents d ' +
        'JOIN document_shares s ON d.id = s.document_id ' +
        'JOIN users u ON d.user_id = u.id ' +
        'WHERE s.share_token = ? AND d.id = ? AND s.expires_at > NOW()',
        [shareToken, docId]
      );
      
      console.log('共享文档查询结果:', sharedDocs);
      
      if (sharedDocs && sharedDocs.length > 0) {
        return res.json(sharedDocs[0]);
      } else {
        return res.status(404).json({ message: '共享文档不存在或已过期' });
      }
    }
    
    // 如果没有分享令牌，则检查用户是否已登录
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: '未提供授权令牌' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // 验证令牌
    jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
      if (err) {
        return res.status(403).json({ message: '授权令牌无效或已过期' });
      }
      
      const userId = user.userId;
      console.log(`用户 ${userId} 尝试访问文档 ${docId}`);
      
      // 获取用户自己的文档
      const documents = await query(
        'SELECT d.id, d.title, d.content, d.created_at, d.updated_at, d.last_accessed_at, u.username as creator_username ' +
        'FROM documents d ' +
        'JOIN users u ON d.user_id = u.id ' +
        'WHERE d.id = ? AND d.user_id = ?',
        [docId, userId]
      );
      
      console.log('用户文档查询结果:', documents);
      
      if (!documents || documents.length === 0) {
        return res.status(404).json({ message: '文档不存在或您无权访问' });
      }
      
      // 获取文档后异步更新访问时间，但不等待结果
      query(
        'UPDATE documents SET last_accessed_at = CURRENT_TIMESTAMP WHERE id = ?',
        [docId]
      ).catch(error => {
        console.error('更新文档访问时间失败:', error);
      });
      
      res.json(documents[0]);
    });
  } catch (error) {
    console.error('获取文档错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// PDF导出路由
router.post('/:docId/export-pdf', async (req, res) => {
  try {
    const docId = parseInt(req.params.docId);
    const shareToken = req.query.shareToken;
    const { markdownContent } = req.body;

    // 验证文档访问权限
    if (shareToken) {
      const [sharedDoc] = await query(
        'SELECT d.id FROM documents d JOIN document_shares s ON d.id = s.document_id ' +
        'WHERE s.share_token = ? AND d.id = ? AND s.expires_at > NOW()',
        [shareToken, docId]
      );
      if (!sharedDoc) return res.status(403).json({ message: '无效的分享链接' });
    } else {
      const authHeader = req.headers['authorization'];
      if (!authHeader) return res.status(401).json({ message: '需要身份验证' });
      const token = authHeader.split(' ')[1];
      const user = jwt.verify(token, process.env.JWT_SECRET);
      const [userDoc] = await query('SELECT id FROM documents WHERE id = ? AND user_id = ?', [docId, user.userId]);
      if (!userDoc) return res.status(403).json({ message: '无访问权限' });
    }

    // 创建PDF文档
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument();
    const fileName = `document-${docId}-${Date.now()}.pdf`;
    const filePath = path.join(__dirname, '../../uploads/pdfs', fileName);
    
    // 确保PDF目录存在
    if (!fs.existsSync(path.dirname(filePath))) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }

    // 写入文件并设置响应
    doc.pipe(fs.createWriteStream(filePath));
    doc.fontSize(12).text(markdownContent);
    doc.end();

    // 返回文件下载链接
    res.json({ 
      pdfUrl: `/uploads/pdfs/${fileName}`,
      expiresAt: new Date(Date.now() + 3600000).toISOString() // 1小时后过期
    });

  } catch (error) {
    console.error('PDF生成失败:', error);
    res.status(500).json({ 
      message: 'PDF生成失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 更新文档
router.put('/:docId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const docId = parseInt(req.params.docId);
    const { title, content } = req.body;
    
    // 验证文档是否属于当前用户
    const [document] = await query(
      'SELECT id FROM documents WHERE id = ? AND user_id = ?',
      [docId, userId]
    );
    
    if (!document) {
      return res.status(404).json({ message: '文档不存在或您无权修改' });
    }
    
    // 执行更新操作
    await query(
      'UPDATE documents SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [title, content, docId]
    );
    
    res.json({ message: '文档更新成功' });
  } catch (error) {
    console.error('更新文档错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 删除文档
router.delete('/:docId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const docId = parseInt(req.params.docId);
    
    // 首先检查文档是否存在并属于当前用户
    const [document] = await query(
      'SELECT id FROM documents WHERE id = ? AND user_id = ?',
      [docId, userId]
    );
    
    if (!document) {
      return res.status(404).json({ message: '文档不存在或您无权删除' });
    }
    
    // 执行删除操作
    await query('DELETE FROM documents WHERE id = ?', [docId]);
    
    res.json({ message: '文档删除成功' });
  } catch (error) {
    console.error('删除文档错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 创建文档分享链接
router.post('/:docId/share', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const docId = parseInt(req.params.docId);
    
    console.log(`用户 ${userId} 尝试创建文档 ${docId} 的分享链接`);
    
    // 验证文档所有权
    const rows = await query(
      'SELECT id FROM documents WHERE id = ? AND user_id = ?',
      [docId, userId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ message: '文档不存在或无权访问' });
    }
    
    // 先检查是否已存在未过期的分享链接
    const existingShares = await query(
      'SELECT share_token FROM document_shares WHERE document_id = ? AND expires_at > NOW()',
      [docId]
    );
    
    let shareToken;
    
    // 检查是否有现有的分享链接
    if (existingShares && existingShares.length > 0) {
      // 使用现有的分享链接
      shareToken = existingShares[0].share_token;
      console.log(`使用现有分享链接: ${shareToken.substring(0, 10)}...`);
    } else {
      // 创建新的分享链接
      shareToken = crypto.randomBytes(32).toString('hex');
      console.log(`创建新分享链接: ${shareToken.substring(0, 10)}...`);
      
      // 设置过期时间（7天后）
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      
      await query(
        'INSERT INTO document_shares (document_id, share_token, created_at, expires_at) VALUES (?, ?, NOW(), ?)',
        [docId, shareToken, expiresAt]
      );
    }
    
    // 构建分享链接
    const protocol = req.protocol;
    
    // 使用配置获取前端URL
    const frontendUrl = SERVER_CONFIG.getFrontendUrl(req);
    
    // 构建包含令牌的URL
    const shareLink = `${frontendUrl}/shared-doc/${docId}?shareToken=${shareToken}`;
    
    console.log(`生成的分享链接: ${shareLink}`);
    res.json({ shareLink });
  } catch (error) {
    console.error('创建分享链接失败:', error);
    res.status(500).json({ message: '创建分享链接失败' });
  }
});

export default router;