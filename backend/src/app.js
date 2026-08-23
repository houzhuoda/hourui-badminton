// Express 应用入口
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { config } from './utils/config.js';
import { initDb, closeDb } from './db/index.js';
import { notFound, errorHandler } from './middleware/error.js';

// 路由
import authRoutes from './routes/auth.js';
import memberRoutes from './routes/members.js';
import channelRoutes from './routes/channels.js';
import courseRoutes from './routes/courses.js';
import coachRoutes from './routes/coaches.js';
import sessionRoutes from './routes/sessions.js';
import orderRoutes from './routes/orders.js';
import attendanceRoutes from './routes/attendance.js';
import dashboardRoutes from './routes/dashboard.js';
import reportRoutes from './routes/reports.js';
import commissionRoutes from './routes/commissions.js';
import bookingRoutes from './routes/bookings.js';
import memberEndRoutes from './routes/memberEnd.js';
import salesRoutes from './routes/sales.js';
import salesAdminRoutes from './routes/sales_admin.js';
import privateBookingRoutes from './routes/privateBookings.js';
import courtRoutes from './routes/courts.js';

// 初始化数据库
initDb();

const app = express();

// 信任反向代理（nginx），用于正确获取客户端 IP
app.set('trust proxy', 1);

// 安全与基础中间件
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
if (config.env !== 'test') {
  app.use(morgan('dev'));
}

// 限流（登录接口更严格）
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/login', loginLimiter);

// 健康检查
app.get('/api/health', (req, res) => res.json({ code: 0, data: { status: 'ok' }, message: 'ok' }));

// 路由挂载
app.use('/api/auth', authRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/coaches', coachRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/commissions', commissionRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/member-end', memberEndRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/sales-admin', salesAdminRoutes);
app.use('/api/private-bookings', privateBookingRoutes);
app.use('/api/courts', courtRoutes);

// 404 + 错误处理
app.use(notFound);
app.use(errorHandler);

// 优雅关闭
process.on('SIGINT', () => {
  closeDb();
  process.exit(0);
});
process.on('SIGTERM', () => {
  closeDb();
  process.exit(0);
});

// 仅在直接运行时启动服务器（测试时由 supertest 挂载）
let server = null;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(config.port, () => {
    console.log(`[侯瑞羽毛球系统] 后端服务已启动: http://localhost:${config.port}`);
  });
}

export { app, server };
