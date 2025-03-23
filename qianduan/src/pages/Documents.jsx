import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Documents() {
  const [documents, setDocuments] = useState([]);
  const [recentDocuments, setRecentDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recentLoading, setRecentLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState('');
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    
    // 如果没有token，重定向到登录页面
    if (!token) {
      navigate('/login');
      return;
    }
    
    // 获取用户信息
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    if (userInfo.username) {
      setUsername(userInfo.username);
    }
    if (userInfo.avatar) {
      setAvatar(userInfo.avatar);
    }
    
    const fetchDocuments = async () => {
      try {
        const res = await axios.get('/api/docs', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        setDocuments(res.data);
        setLoading(false);
      } catch (error) {
        console.error('获取文档列表失败:', error);
        setLoading(false);
        
        // 如果是401错误，说明token无效或过期，重定向到登录页面
        if (error.response && error.response.status === 401) {
          localStorage.removeItem('token');
          navigate('/login');
        }
      }
    };

    const fetchRecentDocuments = async () => {
      try {
        const res = await axios.get('/api/docs/recent?limit=3', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        setRecentDocuments(res.data);
        setRecentLoading(false);
      } catch (error) {
        console.error('获取最近文档失败:', error);
        setRecentLoading(false);
      }
    };
    
    fetchDocuments();
    fetchRecentDocuments();
  }, [navigate]);

  const handleCreate = () => {
    navigate('/editor/new');
  };

  const handleDelete = async (docId, title) => {
    // 显示确认对话框
    if (!window.confirm(`确定要删除"${title || '未命名文档'}"吗？此操作不可撤回！`)) {
      return; // 用户取消删除
    }
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/docs/${docId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      // 从文档列表和最近文档列表中移除被删除的文档
      setDocuments(documents.filter(doc => doc.id !== docId));
      setRecentDocuments(recentDocuments.filter(doc => doc.id !== docId));
      
      // 显示删除成功提示
      alert(`文档"${title || '未命名文档'}"删除成功`);
    } catch (error) {
      console.error('删除文档失败:', error);
      alert('删除文档失败');
    }
  };

  const handleOpenLocalFile = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (file && file.name.endsWith('.md')) {
      try {
        const content = await readFileAsText(file);
        
        // 创建临时文档数据
        const tempDoc = {
          title: file.name.replace('.md', ''),
          content: content,
          local: true // 标记为本地文件
        };

        // 将文档保存到后端或直接导航至编辑器
        localStorage.setItem('tempDoc', JSON.stringify(tempDoc));
        navigate('/editor/new?local=true');
      } catch (error) {
        alert('读取文件失败：' + error.message);
      }
    } else {
      alert('请选择一个 .md 格式的文件');
    }
  };

  // 辅助函数：读取文件内容
  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target.result);
      reader.onerror = (error) => reject(error);
      reader.readAsText(file);
    });
  };

  // 退出登录
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userInfo');
    navigate('/login');
  };

  // 格式化日期时间
  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="documents-container">
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
      
      <div className="header">
        <h2>我的文档</h2>
        <div className="header-buttons">
          <button onClick={handleOpenLocalFile} className="import-button">
            导入 Markdown
          </button>
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".md"
            style={{ display: 'none' }}
          />
          <button onClick={handleCreate} className="create-button">
            新建文档
          </button>
        </div>
      </div>

      {/* 最近打开的文档列表 */}
      <div className="recent-documents-section">
        <h3>最近打开的文档</h3>
        {recentLoading ? (
          <p>加载中...</p>
        ) : recentDocuments.length > 0 ? (
          <div className="recent-document-list">
            {recentDocuments.map((doc) => (
              <div 
                key={doc.id} 
                className="recent-document-card"
                onClick={() => navigate(`/editor/${doc.id}`)}
              >
                <div className="recent-document-header">
                  <h4>{doc.title || '未命名文档'}</h4>
                  <div className="recent-document-actions" onClick={(e) => e.stopPropagation()}>
                    <span className="recent-document-date">{formatDateTime(doc.updated_at)}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(doc.id, doc.title);
                      }}
                      className="delete-button small"
                      title="删除文档"
                    >
                      删除
                    </button>
                  </div>
                </div>
                <p className="recent-document-summary">{doc.summary || '无内容'}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="no-documents">暂无最近打开的文档</p>
        )}
      </div>

      <h3>所有文档</h3>
      {loading ? (
        <p>加载中...</p>
      ) : documents.length > 0 ? (
        <div className="document-list">
          {documents.map((doc) => (
            <div 
              key={doc.id} 
              className="document-card"
              onClick={() => navigate(`/editor/${doc.id}`)}
              style={{ cursor: 'pointer' }}
            >
              <h3>
                {doc.title || '未命名文档'}
              </h3>
              <div className="actions" onClick={(e) => e.stopPropagation()}>
                <span>{new Date(doc.updated_at || doc.created_at).toLocaleDateString()}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(doc.id, doc.title);
                  }}
                  className="delete-button"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="no-documents">暂无文档，点击右上角"新建文档"按钮创建</p>
      )}
    </div>
  );
}