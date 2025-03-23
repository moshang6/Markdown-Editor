import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import MDEditor from '@uiw/react-md-editor';
import axios from 'axios';
import './SharedDoc.css';

export default function SharedDoc() {
  const { docId } = useParams();
  const [documentData, setDocumentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const shareToken = new URLSearchParams(location.search).get('shareToken');

  // 调试信息
  useEffect(() => {
    console.log('SharedDoc组件加载');
    console.log('文档ID:', docId);
    console.log('分享令牌:', shareToken ? `${shareToken.substring(0, 10)}...` : '缺失');
  }, [docId, shareToken]);

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        setLoading(true);
        // 没有shareToken就无法访问
        if (!shareToken) {
          setError('缺少分享令牌，无法访问此文档。请确保您使用完整的分享链接。');
          setLoading(false);
          return;
        }

        console.log(`正在获取共享文档，ID: ${docId}，Token: ${shareToken.substring(0, 10)}...`);
        
        // 确保API URL使用的是正确的URL
        const apiUrl = `/api/docs/${docId}?shareToken=${shareToken}`;
        console.log('请求API:', apiUrl);
        
        const response = await axios.get(apiUrl);
        
        console.log('获取到共享文档数据:', response.data);
        
        if (!response.data || typeof response.data !== 'object') {
          console.error('返回的共享文档数据无效:', response.data);
          setError('获取到的文档格式无效');
          setLoading(false);
          return;
        }
        
        setDocumentData(response.data);
        setLoading(false);
      } catch (err) {
        console.error('获取共享文档失败:', err);
        
        // 网络错误或服务器不可用
        if (!err.response) {
          console.error('无法连接到服务器或网络错误');
          setError('无法连接到服务器，请检查您的网络连接。如果问题持续，可能是分享链接已经过期。');
        }
        // 服务器返回的错误
        else if (err.response) {
          console.error('错误响应状态:', err.response.status);
          console.error('错误响应数据:', err.response.data);
          
          // 针对不同的状态码显示不同的错误信息
          if (err.response.status === 404) {
            setError('文档不存在或分享链接已过期');
          } else if (err.response.status === 401 || err.response.status === 403) {
            setError('无权访问此文档，分享链接可能已失效');
          } else {
            setError(`获取文档失败: ${err.response.data.message || '服务器错误'}`);
          }
        } else {
          console.error('请求配置错误:', err.message);
          setError(`获取文档错误: ${err.message}`);
        }
        
        setLoading(false);
      }
    };

    if (docId && shareToken) {
      fetchDocument();
    } else {
      setLoading(false);
      setError('无效的链接参数');
    }
  }, [docId, shareToken]);

  // 复制文档内容
  const copyDocumentContent = () => {
    if (!documentData || !documentData.content) {
      alert('没有可复制的内容');
      return;
    }
    
    console.log('尝试复制内容:', documentData.content.substring(0, 50) + '...');
    
    try {
      // 检测是否移动设备
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      console.log('设备类型:', isMobile ? '移动设备' : '桌面设备');
      
      // 尝试使用现代Clipboard API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        // 在移动设备上请求权限
        if (isMobile) {
          console.log('在移动设备上使用Clipboard API，请求权限');
        }
        
        navigator.clipboard.writeText(documentData.content)
          .then(() => {
            alert('文档内容已复制到剪贴板');
          })
          .catch(err => {
            console.error('Clipboard API失败:', err);
            fallbackCopy();
          });
      } else {
        // 降级解决方案
        fallbackCopy();
      }
    } catch (err) {
      console.error('复制过程中出错:', err);
      fallbackCopy();
    }
  };
  
  // 降级的复制方法
  const fallbackCopy = () => {
    try {
      // 创建临时文本区域
      const textArea = document.createElement('textarea');
      textArea.value = documentData.content;
      // 使文本区域不可见但在移动设备上不要设置为绝对定位
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
      
      // 在移动设备上，将复制按钮显示为active状态，提供视觉反馈
      const copyButton = document.querySelector('.copy-button');
      if (copyButton) {
        copyButton.classList.add('active');
        setTimeout(() => copyButton.classList.remove('active'), 300);
      }
      
      // 执行复制命令
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        alert('文档内容已复制到剪贴板');
      } else {
        alert('复制失败，请手动选择内容并复制');
      }
    } catch (err) {
      console.error('降级复制失败:', err);
      alert('复制失败，请手动选择内容并复制');
    }
  };

  // 导出为Markdown文件
  const exportToMarkdown = () => {
    if (!documentData || !documentData.content) {
      alert('没有可导出的内容');
      return;
    }
    
    console.log('尝试导出文件:', documentData.title || '未命名文档');
    
    try {
      // 检测是否移动设备
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      console.log('导出功能 - 设备类型:', isMobile ? '移动设备' : '桌面设备');
      
      // 创建Blob对象
      const blob = new Blob([documentData.content], { type: 'text/markdown' });
      // 创建URL
      const url = URL.createObjectURL(blob);
      
      // 在移动设备上提供视觉反馈
      const downloadButton = document.querySelector('.download-button');
      if (downloadButton) {
        downloadButton.classList.add('active');
        setTimeout(() => downloadButton.classList.remove('active'), 300);
      }
      
      // 创建下载链接
      const a = document.createElement('a');
      a.href = url;
      a.download = `${documentData.title || '未命名文档'}.md`;
      a.style.display = 'none';
      
      // iOS Safari需要特殊处理
      if (isMobile && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) {
        console.log('检测到iOS设备，使用特殊处理');
        // 在iOS上，我们需要打开一个新窗口来下载
        window.open(url, '_blank');
        
        setTimeout(() => {
          // 提醒用户如何保存文件
          alert('在新打开的页面中，请点击分享按钮，然后选择"保存到文件"选项来下载Markdown文件。');
          URL.revokeObjectURL(url);
        }, 500);
        return;
      }
      
      // 触发下载
      document.body.appendChild(a);
      a.click();
      // 清理
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log('导出成功');
    } catch (err) {
      console.error('导出失败:', err);
      alert(`导出失败: ${err.message}`);
    }
  };

  // 处理注册/登录
  const handleAuth = (path) => {
    navigate(path);
  };

  if (loading) {
    return (
      <div className="shared-doc-container loading">
        <div className="loading-spinner"></div>
        <p>正在加载文档...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="shared-doc-container error">
        <h2>无法访问文档</h2>
        <p>{error}</p>
        <div className="auth-buttons">
          <button onClick={() => handleAuth('/login')}>登录</button>
          <button onClick={() => handleAuth('/register')}>注册</button>
        </div>
      </div>
    );
  }

  return (
    <div className="shared-doc-container">
      <div className="shared-doc-header">
        <h1>{documentData.title || '未命名文档'}</h1>
        
        <div className="shared-doc-info">
          <p>共享文档 · 只读模式</p>
          <p>创建者: {documentData.creator_username || '未知用户'}</p>
          <p>创建于: {new Date(documentData.created_at).toLocaleString()}</p>
          <p>最后更新: {new Date(documentData.updated_at).toLocaleString()}</p>
        </div>
        
        <div className="shared-doc-actions">
          <button 
            onClick={copyDocumentContent}
            className="action-button copy-button"
            title="复制文档全部内容"
          >
            复制内容
          </button>
          <button 
            onClick={exportToMarkdown}
            className="action-button download-button"
            title="将文档下载为Markdown文件"
          >
            下载MD文件
          </button>
          <button 
            onClick={() => handleAuth('/login')}
            className="action-button login-button"
            title="登录后可创建和编辑自己的文档"
          >
            登录查看更多
          </button>
        </div>
      </div>
      
      <div className="shared-doc-content">
        <MDEditor.Markdown 
          source={documentData.content || '该文档没有内容'} 
          style={{ padding: '20px', backgroundColor: '#fff' }}
        />
      </div>
      
      <div className="shared-doc-footer">
        <p>此文档通过链接分享 - 想创建自己的Markdown文档？</p>
        <div className="auth-buttons">
          
          <button onClick={() => handleAuth('/register')}>立即注册！</button>
        </div>
      </div>
    </div>
  );
} 