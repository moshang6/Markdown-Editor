import { useState, useEffect, useRef, useCallback } from 'react';
import MDEditor from '@uiw/react-md-editor';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import config from '../config';

// 从config对象中获取需要的配置
const API_CONFIG = config.api;
const AUTH_CONFIG = config.auth;
const EDITOR_CONFIG = config.editor;

export default function Editor() {
  const { docId } = useParams();
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [isLocalFile, setIsLocalFile] = useState(false);
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState('');
  const [shareLink, setShareLink] = useState('');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const previewRef = useRef(null); // 用于PDF生成
  const editorRef = useRef(null); // 用于获取编辑器DOM元素

  useEffect(() => {
    const token = localStorage.getItem(AUTH_CONFIG.TOKEN_KEY);
    
    // 如果没有token，重定向到登录页面
    if (!token) {
      navigate('/login');
      return;
    }
    
    // 获取用户信息
    const userInfo = JSON.parse(localStorage.getItem(AUTH_CONFIG.USER_INFO_KEY) || '{}');
    if (userInfo.username) {
      setUsername(userInfo.username);
    }
    if (userInfo.avatar) {
      setAvatar(userInfo.avatar);
    }
    
    // 检查是否是本地文件
    const query = new URLSearchParams(location.search);
    const isLocal = query.get('local') === 'true';
    
    if (isLocal && docId === 'new') {
      setIsLocalFile(true);
      // 从localStorage获取临时文档
      const tempDoc = JSON.parse(localStorage.getItem(EDITOR_CONFIG.TEMP_DOC_KEY) || '{"title":"","content":""}');
      setTitle(tempDoc.title || '');
      setContent(tempDoc.content || '');
      return;
    }

    // 如果不是本地文件，则从服务器获取文档
    const fetchDocument = async () => {
      try {
        console.log(`正在获取文档 ID: ${docId}`);
        // 获取文档内容
        const res = await axios.get(`/api/docs/${docId}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        console.log('获取到文档数据:', res.data);
        
        if (!res.data || typeof res.data !== 'object') {
          console.error('返回的文档数据无效:', res.data);
          alert('获取文档失败：服务器返回了无效的数据格式');
          navigate('/docs');
          return;
        }
        
        setTitle(res.data.title || '未命名文档');
        // 修复图片URL
        const fixedContent = fixImageUrls(res.data.content || '');
        setContent(fixedContent);
        
        // 更新文档访问时间
        try {
          await axios.post(`/api/docs/${docId}/access`, {}, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
        } catch (accessError) {
          console.error('更新文档访问时间失败:', accessError);
        }
      } catch (error) {
        console.error('文档加载失败:', error);
        if (error.response) {
          console.error('错误响应状态:', error.response.status);
          console.error('错误响应数据:', error.response.data);
          alert(`文档加载失败: ${error.response.data.message || '未知错误'}`);
        } else if (error.request) {
          console.error('请求发送但没有收到响应:', error.request);
          alert('文档加载失败: 服务器没有响应');
        } else {
          console.error('请求配置错误:', error.message);
          alert(`文档加载失败: ${error.message}`);
        }
        navigate('/docs');
      }
    };

    if (docId !== 'new') {
      fetchDocument();
    }
  }, [docId, navigate, location.search]);

  // 修复图片URL的函数
  const fixImageUrls = (contentText) => {
    if (!contentText) return '';
    
    // 使用配置中的域名和协议
    const apiDomain = config.api.domain;
    const apiProtocol = config.api.protocol;
    
    // 替换所有指向特定IP地址的图片URL
    return contentText
      // 替换10.8.0.6的链接
      .replace(
        /(\!\[.*?\]\(http:\/\/)10\.8\.0\.6(:5000\/uploads\/img\/.*?\))/g, 
        `$1${apiDomain}$2`
      )
      // 替换192.168.31.73的链接
      .replace(
        /(\!\[.*?\]\(http:\/\/)192\.168\.31\.73(:5000\/uploads\/img\/.*?\))/g, 
        `$1${apiDomain}$2`
      )
      // 替换所有http为https（如果配置为https）
      .replace(
        /(\!\[.*?\]\()http(:.+?\))/g,
        (match, p1, p2) => apiProtocol === 'https' ? `${p1}https${p2}` : match
      );
  };

  const handleSave = async () => {
    const token = localStorage.getItem(AUTH_CONFIG.TOKEN_KEY);
    
    // 在保存前修复图片URL
    const fixedContent = fixImageUrls(content);
    
    try {
      if (isLocalFile) {
        // 保存本地文件到服务器
        const res = await axios.post('/api/docs', { 
          userId: JSON.parse(localStorage.getItem(AUTH_CONFIG.USER_INFO_KEY) || '{}').id, 
          title, 
          content: fixedContent 
        }, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        setIsLocalFile(false); // 保存后不再是本地文件
        localStorage.removeItem(EDITOR_CONFIG.TEMP_DOC_KEY); // 清除临时存储
        navigate(`/editor/${res.data.id}`); // 导航到新保存的文档
      } else if (docId === 'new') {
        await axios.post('/api/docs', { 
          userId: JSON.parse(localStorage.getItem(AUTH_CONFIG.USER_INFO_KEY) || '{}').id, 
          title, 
          content: fixedContent 
        }, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        navigate('/docs');
      } else {
        await axios.put(`/api/docs/${docId}`, { title, content: fixedContent }, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        alert('文档保存成功');
      }
      
      // 如果内容已被修复，更新编辑区内容
      if (fixedContent !== content) {
        setContent(fixedContent);
      }
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败');
    }
  };

  // 导出为Markdown文件
  const exportToMarkdown = () => {
    // 修复内容中的图片URL
    const fixedContent = fixImageUrls(content);
    
    // 创建Blob对象
    const blob = new Blob([fixedContent], { type: 'text/markdown' });
    // 创建URL
    const url = URL.createObjectURL(blob);
    // 创建下载链接
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || '未命名文档'}.md`;
    // 触发下载
    document.body.appendChild(a);
    a.click();
    // 清理
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    setExportMenuOpen(false);
    
    // 如果内容已被修复，更新编辑区内容
    if (fixedContent !== content) {
      setContent(fixedContent);
    }
  };

  // 导出为PDF
  const exportToPDF = async () => {
    try {
      // 显示加载状态
      setExportMenuOpen(false);
      alert('即将生成PDF，请点击“确认”开始生成');
      
      // 修复内容中的图片URL
      const fixedContent = fixImageUrls(content);
      
      // 如果内容已被修复，更新编辑区内容
      if (fixedContent !== content) {
        setContent(fixedContent);
      }
      
      // 使用React的渲染能力创建预览内容
      // 创建一个临时div用于渲染Markdown内容
      const tempDiv = document.createElement('div');
      tempDiv.className = 'md-preview-wrapper';
      document.body.appendChild(tempDiv);
      
      // 创建样式元素
      const styleEl = document.createElement('style');
      styleEl.textContent = `
        .md-preview-wrapper {
          background: white;
          padding: 30px;
          width: 210mm;
          box-sizing: border-box;
          font-family: 'Arial', sans-serif;
          position: fixed;
          left: -9999px;
          top: 0;
        }
        .pdf-header {
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 1px solid #eaeaea;
        }
        .pdf-header h1 {
          font-size: 24px;
          margin: 0;
          color: #333;
        }
        .markdown-body {
          font-size: 14px;
          line-height: 1.6;
        }
        .markdown-body h1 { font-size: 22px; margin-top: 28px; margin-bottom: 10px; }
        .markdown-body h2 { font-size: 20px; margin-top: 24px; margin-bottom: 10px; }
        .markdown-body h3 { font-size: 18px; margin-top: 20px; margin-bottom: 10px; }
        .markdown-body p { margin-bottom: 16px; }
        .markdown-body ul, .markdown-body ol { margin-bottom: 16px; padding-left: 20px; }
        .markdown-body code { background-color: #f0f0f0; padding: 2px 4px; border-radius: 3px; }
        .markdown-body pre { background-color: #f6f8fa; border-radius: 3px; padding: 16px; overflow: auto; }
        .markdown-body blockquote { border-left: 4px solid #ddd; padding-left: 16px; color: #666; }
        .markdown-body img { max-width: 100%; }
        .markdown-body table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
        .markdown-body table th, .markdown-body table td { border: 1px solid #ddd; padding: 8px; }
        .markdown-body table tr:nth-child(2n) { background-color: #f6f8fa; }
      `;
      document.head.appendChild(styleEl);
      
      // 创建标题元素
      const headerDiv = document.createElement('div');
      headerDiv.className = 'pdf-header';
      headerDiv.innerHTML = `<h1>${title || '未命名文档'}</h1>`;
      tempDiv.appendChild(headerDiv);
      
      // 创建内容元素
      const contentDiv = document.createElement('div');
      contentDiv.className = 'markdown-body';
      tempDiv.appendChild(contentDiv);
      
      // 使用MDEditor.Markdown组件渲染内容
      // 由于我们不能直接在这里使用React组件，所以需要找替代方法
      // 这里使用React的jsx语法会在运行时出错，因此我们需要手动解析markdown
      
      // 方法1: 使用简单的正则表达式处理常见的Markdown语法
      let htmlContent = fixedContent
        .replace(/^# (.*$)/gm, '<h1>$1</h1>')
        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
        .replace(/^### (.*$)/gm, '<h3>$1</h3>')
        .replace(/^\> (.*$)/gm, '<blockquote>$1</blockquote>')
        .replace(/\*\*(.*)\*\*/gm, '<strong>$1</strong>')
        .replace(/\*(.*)\*/gm, '<em>$1</em>')
        .replace(/!\[(.*?)\]\((.*?)\)/gm, '<img alt="$1" src="$2" />')
        .replace(/\[(.*?)\]\((.*?)\)/gm, '<a href="$2">$1</a>')
        .replace(/\n$/gm, '<br />')
        .replace(/^```([\s\S]*?)```$/gm, '<pre><code>$1</code></pre>')
        .replace(/`([^`]+)`/gm, '<code>$1</code>')
        .replace(/^\* (.*$)/gm, '<ul><li>$1</li></ul>')
        .replace(/^[0-9]+\. (.*$)/gm, '<ol><li>$1</li></ol>');
        
      // 将处理后的HTML内容设置到内容元素
      contentDiv.innerHTML = htmlContent;
      
      // 给足够的时间加载样式和渲染内容
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 使用html2canvas捕获内容
      const canvas = await html2canvas(tempDiv, {
        scale: 2,
        useCORS: true,
        logging: false
      });
      
      // 移除临时元素
      document.body.removeChild(tempDiv);
      document.head.removeChild(styleEl);
      
      // 创建PDF
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      // 计算图像高度
      const imgWidth = pdfWidth;
      const imgHeight = canvas.height * imgWidth / canvas.width;
      
      // 如果内容太长需要分页
      let heightLeft = imgHeight;
      let position = 0;
      let pageNumber = 1;
      
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
      
      // 添加更多页面，如果需要
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
        pageNumber++;
      }
      
      // 保存PDF
      pdf.save(`${title || '未命名文档'}.pdf`);
      alert('PDF导出成功！');
    } catch (error) {
      console.error('PDF导出失败:', error);
      alert('PDF导出失败，请稍后再试: ' + error.message);
    }
  };

  // 创建/获取分享链接
  const handleShare = async () => {
    if (docId === 'new' || isLocalFile) {
      alert('请先保存文档才能分享');
      return;
    }
    
    try {
      const token = localStorage.getItem(AUTH_CONFIG.TOKEN_KEY);
      const res = await axios.post(`/api/docs/${docId}/share`, {}, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      setShareLink(res.data.shareLink);
      setShareModalOpen(true);
    } catch (error) {
      console.error('生成分享链接失败:', error);
      alert('生成分享链接失败');
    }
  };

  // 复制分享链接
  const copyShareLink = () => {
    // 检测是否移动设备
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    console.log('复制分享链接 - 设备类型:', isMobile ? '移动设备' : '桌面设备');
    
    // 在移动设备上提供视觉反馈
    const copyButton = document.querySelector('.share-copy-button');
    if (copyButton) {
      copyButton.classList.add('active');
      setTimeout(() => copyButton.classList.remove('active'), 300);
    }
    
    // 尝试使用现代Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareLink)
        .then(() => {
          alert('分享链接已复制到剪贴板');
          setShareModalOpen(false);
        })
        .catch(err => {
          console.error('Clipboard API失败:', err);
          fallbackCopyLink();
        });
    } else {
      // 降级复制方法
      fallbackCopyLink();
    }
  };
  
  // 降级的复制链接方法
  const fallbackCopyLink = () => {
    try {
      // 创建临时文本区域
      const textArea = document.createElement('textarea');
      textArea.value = shareLink;
      // 使文本区域在移动设备上正确定位
      textArea.style.position = 'fixed';
      textArea.style.left = '0';
      textArea.style.top = '0';
      textArea.style.width = '100%';
      textArea.style.height = '100px';
      textArea.style.opacity = '0';
      textArea.style.zIndex = '-1';
      document.body.appendChild(textArea);
      
      // 确保在iOS上正常工作
      textArea.contentEditable = true;
      textArea.readOnly = false;
      
      // 确保文本区域可见和可交互（对移动设备特别重要）
      const range = document.createRange();
      range.selectNodeContents(textArea);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      textArea.setSelectionRange(0, 999999);
      
      // 执行复制命令
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        alert('分享链接已复制到剪贴板');
        setShareModalOpen(false);
      } else {
        alert('复制失败，请手动选择链接并复制');
      }
    } catch (err) {
      console.error('降级复制失败:', err);
      alert('复制失败，请手动选择链接并复制');
    }
  };

  // 获取工具的中文提示
  const getChineseTitle = (title) => {
    const titleMap = {
      'Bold': '粗体',
      'Italic': '斜体',
      'Strikethrough': '删除线',
      'Header': '标题',
      'Divider': '分割线',
      'Quote': '引用',
      'Code': '代码',
      'Link': '链接',
      'Image': '图片',
      'Unordered List': '无序列表',
      'Ordered List': '有序列表',
      'Task List': '任务列表',
      'Preview': '预览',
      'Help': '帮助'
    };
    return titleMap[title] || title;
  };

  // 退出登录
  const handleLogout = () => {
    localStorage.removeItem(AUTH_CONFIG.TOKEN_KEY);
    localStorage.removeItem(AUTH_CONFIG.USER_INFO_KEY);
    navigate('/login');
  };

  // 处理图片拖拽上传
  const handleImageUpload = useCallback(async (file) => {
    try {
      setIsUploading(true);
      setSelectedFile(file.name);
      
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await axios.post(API_CONFIG.UPLOAD_PATH, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${localStorage.getItem(AUTH_CONFIG.TOKEN_KEY)}`
        }
      });
      
      if (response.data.url) {
        // 获取编辑器文本区域元素
        const editorTextarea = document.querySelector('.w-md-editor-text-input');
        
        if (editorTextarea) {
          // 获取当前光标位置
          const startPos = editorTextarea.selectionStart;
          const endPos = editorTextarea.selectionEnd;
          
          // 在光标位置插入图片Markdown
          const imageMarkdown = `![${file.name.replace(/\.[^/.]+$/, "")}](${response.data.url})`;
          const newContent = content.substring(0, startPos) + 
                            imageMarkdown + 
                            content.substring(endPos);
          
          // 更新内容
          setContent(newContent);
          
          // 恢复光标位置 (在图片后)
          setTimeout(() => {
            const newPosition = startPos + imageMarkdown.length;
            editorTextarea.focus();
            editorTextarea.setSelectionRange(newPosition, newPosition);
          }, 0);
        } else {
          // 如果无法获取到编辑器元素，则在内容末尾追加
          const imageMarkdown = `![${file.name.replace(/\.[^/.]+$/, "")}](${response.data.url})`;
          const newContent = content + '\n' + imageMarkdown + '\n';
          setContent(newContent);
        }
        
        return response.data.url;
      }
    } catch (error) {
      console.error('上传图片失败:', error);
      alert('图片上传失败，请重试。');
    } finally {
      setIsUploading(false);
      setTimeout(() => {
        setSelectedFile(null);
      }, 1500);
    }
    
    return null;
  }, [content]);
  
  // 处理拖拽事件
  const handleDrop = useCallback(async (event) => {
    event.preventDefault();
    event.stopPropagation();
    
    // 移除拖拽高亮样式
    const editorElement = document.querySelector('.w-md-editor-text-input');
    if (editorElement) {
      editorElement.classList.remove('drag-over');
    }
    
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      
      // 检查是否为图片文件
      if (file.type.startsWith('image/')) {
        await handleImageUpload(file);
      } else {
        alert('只能上传图片文件');
      }
    }
  }, [handleImageUpload]);
  
  // 注册拖拽事件监听
  useEffect(() => {
    const editorElement = document.querySelector('.w-md-editor-text-input');
    
    if (editorElement) {
      const handleDragOver = (event) => {
        event.preventDefault();
        event.stopPropagation();
        // 添加拖拽高亮样式
        editorElement.classList.add('drag-over');
      };
      
      const handleDragLeave = (event) => {
        event.preventDefault();
        event.stopPropagation();
        // 移除拖拽高亮样式
        editorElement.classList.remove('drag-over');
      };
      
      editorElement.addEventListener('dragover', handleDragOver);
      editorElement.addEventListener('dragleave', handleDragLeave);
      editorElement.addEventListener('drop', handleDrop);
      
      return () => {
        editorElement.removeEventListener('dragover', handleDragOver);
        editorElement.removeEventListener('dragleave', handleDragLeave);
        editorElement.removeEventListener('drop', handleDrop);
      };
    }
  }, [handleDrop]);

  // 文件粘贴上传支持
  useEffect(() => {
    const handlePaste = async (event) => {
      const items = (event.clipboardData || event.originalEvent.clipboardData).items;
      
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            event.preventDefault();
            await handleImageUpload(file);
            break;
          }
        }
      }
    };
    
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [handleImageUpload]);

  // 处理图片上传按钮点击
  const handleImageButtonClick = () => {
    fileInputRef.current.click();
  };

  return (
    <div className="editor-container">
      <div className="top-bar">
        <div className="user-avatar-small" onClick={() => navigate('/profile')}>
          {avatar ? 
            <img src={avatar} alt={username} className="avatar-img" /> : 
            <div className="avatar-placeholder">{username.charAt(0).toUpperCase()}</div>
          }
        </div>
        <button onClick={handleLogout} className="logout-button">
          退出登录
        </button>
      </div>
      
      <div className="editor-header">
        <div className="editor-nav">
          <button onClick={() => navigate('/docs')} className="back-button">
            返回文档列表
          </button>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="文档标题"
            className="title-input"
          />
        </div>
        
        <div className="editor-actions">
          <div className="export-dropdown">
            <button onClick={() => setExportMenuOpen(!exportMenuOpen)} className="export-button">
              导出<span className="dropdown-arrow">▼</span>
            </button>
            {exportMenuOpen && (
              <div className="export-menu">
                <button onClick={exportToMarkdown}>导出为MD</button>
                <button onClick={exportToPDF}>导出为PDF</button>
              </div>
            )}
          </div>
          <button onClick={handleShare} className="share-button">
            分享链接
          </button>
          <button onClick={handleSave} className="save-button">
            保存文档
          </button>
          <div className="image-upload-button-container">
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*"
              id="image-upload" 
              className="image-upload-input force-hide" 
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleImageUpload(e.target.files[0]);
                  e.target.value = ''; // 重置input值
                }
              }}
              style={{display: "none"}}
            />
            <button 
              className="image-upload-button" 
              title="上传图片"
              onClick={handleImageButtonClick}
            >
              <svg className="button-icon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
                <path d="M19 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V5C21 3.89543 20.1046 3 19 3Z"></path>
                <path d="M8.5 10C9.32843 10 10 9.32843 10 8.5C10 7.67157 9.32843 7 8.5 7C7.67157 7 7 7.67157 7 8.5C7 9.32843 7.67157 10 8.5 10Z"></path>
                <path d="M21 15L16 10L5 21"></path>
              </svg>
              <span className="button-text">{selectedFile ? '已选择' : '导入图片'}</span>
            </button>
            {selectedFile && <div className="file-selection-info">{selectedFile}</div>}
          </div>
        </div>
      </div>
      {/* 分享模态框 */}
      {shareModalOpen && (
        <div className="modal-overlay">
          <div className="modal share-modal">
            <div className="modal-header">
              <h3>文档分享链接</h3>
            </div>
            <div className="share-link-container">
              复制以下链接分享给他人：&emsp;
              <input 
                type="text" 
                value={shareLink} 
                readOnly 
                className="share-link-input"
              />&emsp;
              <button 
                onClick={copyShareLink} 
                className="share-copy-button"
              >
                复制
              </button>
            </div>
            <div className="modal-actions">
              <button 
                onClick={() => setShareModalOpen(false)} 
                className="share-copy-button"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="editor-toolbar-wrapper">
        {isUploading && <div className="upload-indicator">正在上传图片...</div>}
        <MDEditor
          value={content}
          onChange={setContent}
          className="md-editor large-toolbar"
          height={600}
          preview="edit"
          data-color-mode="light"
          visibleDragbar={false}
          ref={(el) => {
            previewRef.current = el;
            editorRef.current = el;
          }}
          // 尝试使用替代方法设置工具栏按钮提示
          commandsFilter={(cmd) => {
            if (cmd && cmd.title) {
              cmd.title = getChineseTitle(cmd.title);
            }
            return cmd;
          }}
        />
      </div>
      
      
    </div>
  );
}