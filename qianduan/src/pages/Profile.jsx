import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Profile() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatar, setAvatar] = useState('');
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [messageSource, setMessageSource] = useState('');
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
    const fetchUserInfo = async () => {
      try {
        const res = await axios.get('/api/auth/profile', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        setUsername(res.data.username || '');
        setEmail(res.data.email || '');
        setAvatar(res.data.avatar || '');
      } catch (error) {
        console.error('获取用户信息失败:', error);
        if (error.response && error.response.status === 401) {
          localStorage.removeItem('token');
          navigate('/login');
        }
      }
    };
    
    fetchUserInfo();
  }, [navigate]);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    // 验证密码
    if (newPassword !== confirmPassword) {
      setIsSuccess(false);
      setMessage('两次输入的新密码不一致');
      setMessageSource('password');
      return;
    }
    
    if (newPassword.length < 6) {
      setIsSuccess(false);
      setMessage('密码长度不能少于6个字符');
      setMessageSource('password');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      await axios.put('/api/auth/change-password', {
        currentPassword,
        newPassword
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      setIsSuccess(true);
      setMessage('密码修改成功');
      setMessageSource('password');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setIsSuccess(false);
      setMessage(error.response?.data?.message || '密码修改失败');
      setMessageSource('password');
    }
  };
  
  const handleAvatarClick = () => {
    fileInputRef.current.click();
  };
  
  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // 验证文件类型
    const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      setIsSuccess(false);
      setMessage('请上传JPG、PNG或GIF格式的图片');
      setMessageSource('avatar');
      return;
    }
    
    // 验证文件大小 (2MB限制)
    if (file.size > 2 * 1024 * 1024) {
      setIsSuccess(false);
      setMessage('图片大小不能超过2MB');
      setMessageSource('avatar');
      return;
    }
    
    // 使用FormData上传文件
    const formData = new FormData();
    formData.append('avatar', file);
    
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('/api/auth/upload-avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`
        }
      });
      
      setAvatar(res.data.avatarUrl);
      // 更新localStorage中的头像
      const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
      userInfo.avatar = res.data.avatarUrl;
      localStorage.setItem('userInfo', JSON.stringify(userInfo));
      
      setIsSuccess(true);
      setMessage('头像上传成功');
      setMessageSource('avatar');
    } catch (error) {
      setIsSuccess(false);
      setMessage(error.response?.data?.message || '头像上传失败');
      setMessageSource('avatar');
    }
  };
  
  const handleBackToDocuments = () => {
    navigate('/docs');
  };
  
  // 退出登录
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userInfo');
    navigate('/login');
  };

  return (
    <div className="profile-container">
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
      
      <div className="profile-header">
        <h2>个人资料</h2>
        <button onClick={handleBackToDocuments} className="back-button">
          返回文档列表
        </button>
      </div>
      
      {/* 移动消息提示到此处 */}
      {message && (
        <div className={`message ${isSuccess ? 'success' : 'error'}`}>
          {message}
        </div>
      )}
      
      <div className="profile-content">
        <div className="profile-section">
          <h3>基本信息</h3>
          <div className="avatar-section">
            <div className="avatar-wrapper" onClick={handleAvatarClick}>
              {avatar ? 
                <img src={avatar} alt={username} className="avatar-img-large" /> : 
                <div className="avatar-placeholder-large">{username.charAt(0).toUpperCase()}</div>
              }
              <div className="avatar-overlay">点击更换</div>
            </div>
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleAvatarChange}
              accept="image/jpeg,image/png,image/gif"
              style={{ display: 'none' }}
            />
          </div>
          
          <div className="user-info">
            <div className="info-item">
              <label>用户名</label>
              <p>{username}</p>
            </div>
            <div className="info-item">
              <label>邮箱</label>
              <p>{email}</p>
            </div>
          </div>
        </div>
        
        <div className="profile-section">
          <h3>修改密码</h3>
          <form onSubmit={handlePasswordChange} className="password-form">
            <div className="form-group">
              <label>当前密码</label>
              <input 
                type="password" 
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>新密码</label>
              <input 
                type="password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="form-group">
              <label>确认新密码</label>
              <input 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <button type="submit" className="change-password-button">
              修改密码
            </button>
          </form>
        </div>
      </div>
    </div>
  );
} 