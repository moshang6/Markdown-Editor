# Nginx部署指南 - Markdown生成器应用

本指南将帮助您将Markdown生成器应用部署到Nginx服务器上。

## 准备工作

1. 确保您已经在前端项目目录中运行了构建命令，生成了`dist`目录：
```
npm run build
```

2. 确保您有一个已经安装好的Nginx服务器。

## 部署步骤

### 1. 复制静态文件

将`dist`目录中的所有文件复制到Nginx的静态文件目录，通常是：
```
/usr/share/nginx/html
```

如果您使用Windows，则可能需要使用FTP或其他文件传输工具将文件上传到服务器。

### 2. 配置Nginx

1. 将项目中的`nginx.conf`文件复制到Nginx的配置目录：
   - Linux系统通常在：`/etc/nginx/conf.d/`
   - 创建一个新文件，例如：`/etc/nginx/conf.d/markdown-app.conf`

2. 修改配置文件中的以下设置：
   - `server_name` - 将其设置为您的实际域名
   - `root` - 确保路径指向您复制静态文件的目录
   - 后端API地址 - 在`proxy_pass`配置中确保使用正确的后端服务器地址

3. 协议选择（HTTP/HTTPS）：
   - 配置文件中使用了`$scheme`变量，会自动使用与当前请求相同的协议（HTTP或HTTPS）
   - 确保在后端的`.env`文件中设置了正确的`API_PROTOCOL`值（http或https）
   - 确保在前端的`.env`文件中设置了正确的`VITE_API_PROTOCOL`值（http或https）

### 3. 测试和重启Nginx

1. 测试Nginx配置文件的语法是否正确：
```
nginx -t
```

2. 如果配置正确，重启Nginx服务：
```
systemctl restart nginx
```
或
```
service nginx restart
```

### 4. 配置HTTPS（推荐）

如果您需要HTTPS支持，可以使用Let's Encrypt获取免费SSL证书：

1. 安装Certbot：
```
apt-get install certbot python3-certbot-nginx
```

2. 获取并安装证书：
```
certbot --nginx -d your-domain.com
```

3. 证书会自动添加到您的Nginx配置中。

4. 启用HTTPS后，请更新环境变量：
   - 后端`.env`文件中设置`API_PROTOCOL=https`
   - 前端`.env`文件中设置`VITE_API_PROTOCOL=https`
   - 执行重新构建前端：`npm run build`
   - 更新部署文件并重启服务

## 故障排除

如果遇到路由问题：
- 确保Nginx配置中包含了`try_files $uri $uri/ /index.html;`
- 检查浏览器控制台中是否有任何错误

如果API请求失败：
- 检查Nginx日志：`/var/log/nginx/error.log`
- 确保后端服务器正在运行并且可以访问
- 验证代理配置是否正确
- 确认协议（HTTP/HTTPS）配置一致

## 更新应用

当您需要更新应用时：

1. 在开发环境中构建新版本：
```
npm run build
```

2. 将新的`dist`目录内容复制到服务器上的静态文件目录，替换旧文件。

3. 如果您更改了Nginx配置，请重启Nginx。 