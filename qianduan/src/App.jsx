import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import axios from 'axios';
import Login from './pages/Login';
import Register from './pages/Register';
import Documents from './pages/Documents';
import Editor from './pages/Editor';
import Profile from './pages/Profile';
import SharedDoc from './pages/SharedDoc';
import ForgotPassword from './pages/ForgotPassword';
import config from './config';
import './pages/styles.css';
import './App.css';

// 设置axios默认配置
axios.defaults.baseURL = config.api.baseUrl;
axios.defaults.withCredentials = true; // 启用凭证
console.log('API基础URL:', axios.defaults.baseURL);

// 添加请求拦截器
axios.interceptors.request.use(config => {
  console.log(`发送${config.method?.toUpperCase() || 'GET'}请求:`, config.url);
  return config;
}, error => {
  console.error('请求错误:', error);
  return Promise.reject(error);
});

// 添加响应拦截器
axios.interceptors.response.use(response => {
  return response;
}, error => {
  console.error('响应错误:', error.message);
  if (error.response) {
    console.error('错误状态:', error.response.status);
    console.error('错误数据:', error.response.data);
  } else if (error.request) {
    console.error('未收到响应:', error.request);
  }
  return Promise.reject(error);
});

function App() {
  const [loading, setLoading] = useState(true);
  const [serverStatus, setServerStatus] = useState('checking');
  
  useEffect(() => {
    // 检查服务器连接
    const checkServerConnection = async () => {
      try {
        await axios.get('/api/health');
        console.log('服务器连接成功');
        setServerStatus('connected');
      } catch (error) {
        console.error('服务器连接失败:', error);
        setServerStatus('disconnected');
      } finally {
        setLoading(false);
      }
    };
    
    checkServerConnection();
  }, []);
  
  if (loading) {
    return <div className="loading-screen">正在连接服务器...</div>;
  }
  
  if (serverStatus === 'disconnected') {
    return (
      <div className="error-screen">
        <h2>无法连接到服务器</h2>
        <p>请检查您的网络连接，或者联系管理员。</p>
        <button onClick={() => window.location.reload()}>重试</button>
      </div>
    );
  }
  
  // 检查用户是否已登录
  const isAuthenticated = localStorage.getItem('token') !== null;

  return (
    <div className="app-container">
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/docs" element={
            isAuthenticated ? <Documents /> : <Navigate to="/login" />
          } />
          <Route path="/editor/:docId" element={
            isAuthenticated ? <Editor /> : <Navigate to="/login" />
          } />
          <Route path="/profile" element={
            isAuthenticated ? <Profile /> : <Navigate to="/login" />
          } />
          <Route path="/shared-doc/:docId" element={<SharedDoc />} />
          <Route path="/" element={
            isAuthenticated ? <Navigate to="/docs" /> : <Navigate to="/login" />
          } />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
