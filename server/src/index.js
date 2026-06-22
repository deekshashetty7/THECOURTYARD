const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const morgan = require('morgan');
const cron = require('node-cron');
const { env, connectDatabase } = require('./config');
const router = require('./routes');
const { notFound, errorHandler } = require('./middleware');
const { expireSubscriptions } = require('./services');
const { seedDefaultSettings } = require('./dataServices');
const { initializeEmailService, finalizeEmailService, verifyEmailService } = require('./emailService');

const app = express();
const otpRouter = require('./otpRoutes');

const allowedOrigins = String(env.clientOrigin || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (!allowedOrigins.length || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'tcy-backend',
    message: 'Use /api for API routes',
    api: '/api',
    health: '/api/health',
  });
});

app.use('/api', otpRouter);
app.use('/api', router);

if (process.env.NODE_ENV !== 'production') {
  const routePaths = (router.stack || [])
    .filter(layer => layer.route)
    .map(layer => {
      const methods = Object.keys(layer.route.methods || {}).join(',').toUpperCase();
      return `${methods} ${layer.route.path}`;
    });
  console.log('Registered API route count:', routePaths.length);
  console.log('Registered API route sample:', routePaths.slice(0, 12).join(' | ') || 'NONE');
  console.log('Registered OTP API routes:', routePaths.filter(path => path.includes('register-start') || path.includes('verify-email-otp') || path.includes('resend-email-otp')).join(' | ') || 'NONE');

  const otpRoutePaths = (otpRouter.stack || [])
    .filter(layer => layer.route)
    .map(layer => {
      const methods = Object.keys(layer.route.methods || {}).join(',').toUpperCase();
      return `${methods} ${layer.route.path}`;
    });
  console.log('Dedicated OTP route count:', otpRoutePaths.length);
  console.log('Dedicated OTP routes:', otpRoutePaths.join(' | ') || 'NONE');
}

app.use(notFound);
app.use(errorHandler);

async function start() {
  const dbConfig = await connectDatabase();
  const dbMode = dbConfig.mode || 'mysql';
  const { initializeMysqlSchema, ensureSeedAdminUserMysql } = require('./mysqlServices');
  await initializeMysqlSchema();
  await ensureSeedAdminUserMysql();
  await seedDefaultSettings();
  initializeEmailService();
  await finalizeEmailService();
  const emailStatus = await verifyEmailService();
  if (!emailStatus.ok) {
    console.warn('Email delivery disabled:', emailStatus.reason);
    console.warn('OTP emails will not reach inboxes until email is configured in server/.env');
    console.warn('Run: node server/scripts/test-email.js your@email.com');
  } else {
    console.log(`Email service verified (${emailStatus.provider})`);
  }

  cron.schedule('5 0 * * *', async () => {
    try {
      await expireSubscriptions();
    } catch (error) {
      console.error('Failed to expire subscriptions', error);
    }
  });

  app.listen(env.port, () => {
    console.log(`Backend API (${dbMode}) running on http://localhost:${env.port}/api`);
  });
}

if (require.main === module) {
  start().catch(error => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = app;
