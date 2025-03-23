import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [step, setStep] = useState(1); // 1: 输入邮箱, 2: 输入验证码和新密码
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
      await axios.post('/api/auth/send-reset-code', { email });
      setIsSuccess(true);
      setMessage('验证码已发送至您的邮箱');
      setStep(2);
      
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

  // 重置密码
  const handleResetPassword = async (e) => {
    e.preventDefault();
    
    if (!verificationCode) {
      setIsSuccess(false);
      setMessage('请输入验证码');
      return;
    }
    
    if (newPassword.length < 6) {
      setIsSuccess(false);
      setMessage('密码长度不能少于6个字符');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setIsSuccess(false);
      setMessage('两次输入的密码不一致');
      return;
    }
    
    try {
      await axios.post('/api/auth/reset-password', { 
        email, 
        verificationCode,
        newPassword
      });
      setIsSuccess(true);
      setMessage('密码重置成功！即将跳转到登录页面...');
      
      // 3秒后自动跳转到登录页面
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error) {
      setIsSuccess(false);
      setMessage('密码重置失败：' + (error.response?.data?.message || '服务器错误'));
    }
  };

  return (
    <div className="auth-container">
      <h2>找回密码</h2>
      
      {message && (
        <div className={`message ${isSuccess ? 'success' : 'error'}`}>
          {message}
        </div>
      )}
      
      {step === 1 ? (
        <>
          <div className="email-verification">
            <input
              type="email"
              placeholder="请输入注册时使用的邮箱"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <button 
            className="reset-button" 
            onClick={handleSendCode} 
            disabled={sendingCode}
          >
            {sendingCode ? '发送中...' : '发送验证码'}
          </button>
        </>
      ) : (
        <form onSubmit={handleResetPassword}>
          <div className="verification-info">
            验证码已发送至 <strong>{email}</strong>
            {countdown > 0 ? (
              <span className="countdown">({countdown}秒后可重新发送)</span>
            ) : (
              <button 
                type="button" 
                className="resend-button" 
                onClick={handleSendCode} 
                disabled={sendingCode}
              >
                重新发送
              </button>
            )}
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
            placeholder="新密码"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="确认新密码"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          <button type="submit">重置密码</button>
        </form>
      )}
      <p><Link to="/login">返回登录</Link></p>
    </div>
  );
} 