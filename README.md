
## 一、运行init.sql和editor.sql数据库文件

## 二、修改backend后端配置
 1.在src/index.js第41行  
```
// 中间件  
app.use(cors({
  origin: ['http://192.168.31.73:5173', 'http://localhost:5173', 'http://my.moshang.site:5173', 'https://my.moshang.site:90'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));`

```
添加前端可访问的链接到origin:中

2.在config.js第221行
```js
// 添加SSL证书配置
const sslOptions = {
  cert: fs.readFileSync('C:/Users/moshang2/Downloads/md.moshang.site/full_chain.pem'),
  key: fs.readFileSync('C:/Users/moshang2/Downloads/md.moshang.site/private.key')
};
```
修改个人域名证书路径

3.在.env修改DB_PASSWORD、EMAIL_USER、EMAIL_PASS、API_DOMAIN和API_IP

4.后端在backend文件夹运行npm run dev，打开https://域名：API端口 能显示”Markdown编辑器后端服务运行中“即为成功  
![image](https://md.moshang.site:5000/uploads/img/img-1742741661612-298253129.png)  
## 三、修改qianduan前端配置
1.在qianduan/src修改config.js第11行domain、ip(也是域名或公网IP)和前端端口frontendPort  
```js
const config = {
  // API配置
  api: {
    protocol: 'https',
    domain: 'md.moshang.site', // 域名
    ip: 'md.moshang.site',       // 外网IP
    port: '5000',
    frontendPort: '443',      // 前端端口
    UPLOAD_PATH: '/api/upload/image', // 图片上传API路径
    ...
    }
}
```
2.在qianduan目录下运行npm run build，产生打包后的dist静态文件，最后配置nginx配置文件即可，样例如下：
```conf
server {
    listen 443 ssl;
    ssl_certificate E:/phpstudy_pro/WWW/个人网站证书/full_chain.pem;
	ssl_certificate_key E:/phpstudy_pro/WWW/个人网站证书/private.key;
    server_name my.moshang.site;
    root E:/下载/markdown生成器网页/qianduan/dist;  # Nginx默认的静态文件目录，根据您的实际路径调整
    index index.html;

    # 启用gzip压缩
    gzip on;
    gzip_disable "msie6";
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    
    # 缓存静态资源
    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000";
    }
    
    # 处理API请求 - 代理到后端服务器
    location /api/ {
        # 替换为您的实际后端API地址
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    # 处理WebSocket请求
    location /socket.io/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
    
    # 将所有非静态资源或API请求重定向到index.html，以支持前端路由
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # 错误页面配置
    error_page 404 /index.html;
    
    # 禁止访问敏感文件
    location ~ /\.(?!well-known).* {
        deny all;
    }
} 
```
## 四、测试
打开https://域名：前端端口
能显示如下图即为成功
![image](https://md.moshang.site:5000/uploads/img/img-1742742034002-563298457.png)  
测试链接https://md.moshang.site/
