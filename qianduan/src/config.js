/**
 * 应用配置文件
 * 集中管理所有环境变量和配置项
 */

// 全局配置
const config = {
  // API配置
  api: {
    protocol: 'https',
    domain: 'my.moshang.site', // 域名
    ip: 'my.moshang.site',       // 外网IP
    port: '5000',
    frontendPort: '443',      // 前端端口
    UPLOAD_PATH: '/api/upload/image', // 图片上传API路径
    
    // 获取当前主机名
    get currentHost() {
      if (typeof window !== 'undefined') {
        // 浏览器环境
        return window.location.hostname;
      }
      return this.ip; // 非浏览器环境默认使用IP
    },
    
    // 根据当前访问的主机名智能选择使用域名还是IP
    get host() {
      // 如果当前访问的是域名，就使用域名，否则使用IP
      return this.currentHost === this.domain ? this.domain : this.ip;
    },
    
    // 基础URL
    get baseUrl() {
      return `${this.protocol}://${this.host}:${this.port}`;
    },
    
    // 构建完整的API URL
    getUrl(endpoint) {
      return `${this.baseUrl}/api/${endpoint}`;
    },
    
    // 构建完整的媒体URL（图片、文件等）
    getMediaUrl(path) {
      return `${this.baseUrl}${path}`;
    },
    
    // 构建分享链接
    getShareUrl(docId, shareToken) {
      // 使用当前访问的主机名构建分享链接
      return `${this.protocol}://${this.currentHost}:${this.frontendPort}/shared-doc/${docId}?shareToken=${shareToken}`;
    }
  },
  
  // 应用配置
  app: {
    name: 'Markdown编辑器',
    version: '1.0.0',
  },
  
  // 认证相关配置
  auth: {
    // Token存储键名
    TOKEN_KEY: 'token',
    
    // 用户信息存储键名
    USER_INFO_KEY: 'userInfo'
  },
  
  // 编辑器相关配置
  editor: {
    // 编辑器默认高度
    DEFAULT_HEIGHT: 600,
    
    // 临时文档存储键名
    TEMP_DOC_KEY: 'tempDoc'
  }
};

export default config; 