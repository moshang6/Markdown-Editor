import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const res = await axios.post('/api/auth/login', { email, password });
      localStorage.setItem('token', res.data.token);
      
      // 保存用户信息到localStorage
      if (res.data.user) {
        localStorage.setItem('userInfo', JSON.stringify({
          id: res.data.user.id,
          username: res.data.user.username,
          email: res.data.user.email,
          avatar: res.data.user.avatar
        }));
      }
      
      navigate('/docs');
    } catch (error) {
      setError(error.response?.data?.message || '登录失败，请检查邮箱和密码');
    }
  };

  return (
    <div className="auth-container">
      <h2>登录</h2>
      
      {error && (
        <div className="message error">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="邮箱"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">登录</button>
      </form>
      <div className="auth-links">
        <p>没有账号？<Link to="/register">立即注册</Link></p>
        <p><Link to="/forgot-password">忘记密码？</Link></p>
      </div>
    </div>
  );
}