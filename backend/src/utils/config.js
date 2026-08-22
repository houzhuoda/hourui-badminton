// 应用配置
import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 3100,
  jwtSecret: process.env.JWT_SECRET || 'hourui-dev-secret-2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  // 手机号加密密钥（生产环境应从环境变量读取）
  phoneEncryptKey: process.env.PHONE_ENCRYPT_KEY || 'hourui-phone-key-2026',
  // CORS
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5174,http://localhost:5175,http://localhost:5176,http://localhost:5177').split(','),
  // 数据库
  dbPath: process.env.DB_PATH || './data/hourui.db',
  // 环境
  env: process.env.NODE_ENV || 'development',
  // 管理员默认账号（仅种子初始化用）
  defaultAdmin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
    name: '管理员',
  },
};
