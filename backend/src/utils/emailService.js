import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// 创建邮件传输器
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.qq.com',
  port: parseInt(process.env.EMAIL_PORT || '465'),
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER, // 你的邮箱地址
    pass: process.env.EMAIL_PASS, // 你的授权码
  },
});

// 生成6位随机验证码
export const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// 发送验证码邮件
export const sendVerificationEmail = async (to, code, isRegistration = true) => {
  const subject = isRegistration ? '注册验证码' : '重置密码验证码';
  const action = isRegistration ? '注册' : '重置密码';
  
  const mailOptions = {
    from: `"Markdown编辑器" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <h2 style="color: #4f46e5; text-align: center; margin-bottom: 20px;">Markdown编辑器</h2>
        <p>您好，</p>
        <p>感谢您使用我们的Markdown编辑器。您正在进行账户${action}操作，请使用以下验证码完成验证：</p>
        <div style="background-color: #f5f5f5; padding: 15px; margin: 15px 0; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #4f46e5;">
          ${code}
        </div>
        <p>验证码有效期为10分钟。如果您没有进行此操作，请忽略此邮件。</p>
        <p style="margin-top: 30px; color: #666; font-size: 12px; text-align: center;">
          这是一封自动发送的邮件，请勿直接回复。
        </p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('邮件发送成功:', info.messageId);
    return true;
  } catch (error) {
    console.error('邮件发送失败:', error);
    return false;
  }
};

// 测试邮件配置
export const testEmailConnection = async () => {
  try {
    const connection = await transporter.verify();
    console.log('邮件服务连接成功');
    return true;
  } catch (error) {
    console.error('邮件服务连接失败:', error);
    return false;
  }
}; 