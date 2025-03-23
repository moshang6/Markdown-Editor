import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const navigate = useNavigate();

  // 发送验证码
  const handleSendCode = async () => {
    if (!email) {
      setIsSuccess(false);
      setMessage('请输入邮箱地址');
      return;
    }

    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setIsSuccess(false);
      setMessage('请输入有效的邮箱地址');
      return;
    }

    setSendingCode(true);
    try {
      await axios.post('/api/auth/send-registration-code', { email });
      setIsSuccess(true);
      setMessage('验证码已发送至您的邮箱');
      
      // 开始倒计时
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error) {
      setIsSuccess(false);
      setMessage(error.response?.data?.message || '验证码发送失败');
    } finally {
      setSendingCode(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!verificationCode) {
      setIsSuccess(false);
      setMessage('请输入验证码');
      return;
    }
    
    try {
      await axios.post('/api/auth/register', { 
        username, 
        email, 
        password, 
        verificationCode 
      });
      setIsSuccess(true);
      setMessage('注册成功！即将跳转到登录页面...');
      
      // 3秒后自动跳转到登录页面
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error) {
      setIsSuccess(false);
      setMessage('注册失败：' + (error.response?.data?.message || '服务器错误'));
    }
  };

  return (
    <div className="auth-container">
      <h2>注册</h2>
      
      {message && (
        <div className={`message ${isSuccess ? 'success' : 'error'}`}>
          {message}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="用户名"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <div className="email-verification">
          <input
            type="email"
            placeholder="邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button 
            type="button" 
            className="verification-button"
            onClick={handleSendCode} 
            disabled={sendingCode || countdown > 0}
          >
            {countdown > 0 ? `${countdown}秒` : '获取验证码'}
          </button>
        </div>
        <input
          type="text"
          placeholder="验证码"
          value={verificationCode}
          onChange={(e) => setVerificationCode(e.target.value)}
          maxLength={6}
          required
        />
        <input
          type="password"
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">注册</button>
      </form>
      <p>已有账号？<Link to="/login">立即登录</Link></p>
    </div>
  );
}