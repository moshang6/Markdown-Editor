import jwt from 'jsonwebtoken';

const authenticateToken = (req, res, next) => {
  // 从请求头获取token
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    return res.status(401).json({ message: '未提供授权令牌' });
  }

  // 验证token
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: '授权令牌无效或已过期' });
    }
    
    // 将用户信息添加到请求对象中
    req.user = user;
    next();
  });
};

export default authenticateToken; 