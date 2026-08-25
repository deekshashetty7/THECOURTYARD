const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const morgan = require('morgan');
const cron = require('node-cron');

const { env, connectDatabase } = require('./config');
const router = require('./routes');
const { errorHandler } = require('./middleware');
const { expireSubscriptions } = require('./services');
const { seedDefaultSettings } = require('./dataServices');
const { initializeEmailService } = require('./emailService');

const app = express();
const otpRouter = require('./otpRoutes');

/* =========================================================
   CORS
========================================================= */

const allowedOrigins = String(env.clientOrigin || '')
  .split(',')
  .map(origin => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

const knownOrigins = [
  'https://thecourtyard.vercel.app',
  'https://courtyard-pi.vercel.app',
];

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without Origin header
      // e.g. Postman, curl, server-to-server
      if (!origin) {
        return callback(null, true);
      }

      const normalizedOrigin = origin.replace(/\/$/, '');

      // Exact origins from environment variable
      if (allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      // Known production frontend URLs
      if (knownOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      // Allow Vercel preview deployments
      const isVercelPreview =
        /^https:\/\/thecourtyard-[a-z0-9-]+\.vercel\.app$/i.test(
          normalizedOrigin
        );

      if (isVercelPreview) {
        return callback(null, true);
      }

      console.error('CORS blocked origin:', normalizedOrigin);

      return callback(
        new Error(`Origin not allowed by CORS: ${normalizedOrigin}`)
      );
    },

    credentials: true,

    methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS',
    ],

    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
    ],

    optionsSuccessStatus: 204,
  })
);

/* =========================================================
   BODY PARSERS
========================================================= */

app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));

/* =========================================================
   COOKIES
========================================================= */

app.use(cookieParser());

/* =========================================================
   LOGGING
========================================================= */

app.use(morgan('dev'));

/* =========================================================
   ROOT
========================================================= */

app.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'tcy-backend',
    message: 'Use /api for API routes',
    api: '/api',
    health: '/api/health',
  });
});

/* =========================================================
   HEALTH
========================================================= */

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'tcy-backend',
    message: 'API is healthy',
  });
});

/* =========================================================
   API ROUTES
========================================================= */

app.use('/api', otpRouter);
app.use('/api', router);

/* =========================================================
   DEBUG ROUTES - DEVELOPMENT ONLY
========================================================= */

if (process.env.NODE_ENV !== 'production') {
  const routePaths = (router.stack || [])
    .filter(layer => layer.route)
    .map(layer => {
      const methods = Object.keys(
        layer.route.methods || {}
      )
        .join(',')
        .toUpperCase();

      return `${methods} ${layer.route.path}`;
    });

  console.log(
    'Registered API route count:',
    routePaths.length
  );

  console.log(
    'Registered API route sample:',
    routePaths.slice(0, 12).join(' | ') || 'NONE'
  );

  console.log(
    'Registered OTP API routes:',
    routePaths
      .filter(
        path =>
          path.includes('register-start') ||
          path.includes('verify-email-otp') ||
          path.includes('verify-phone-otp') ||
          path.includes('resend-email-otp') ||
          path.includes('resend-phone-otp')
      )
      .join(' | ') || 'NONE'
  );

  const otpRoutePaths = (otpRouter.stack || [])
    .filter(layer => layer.route)
    .map(layer => {
      const methods = Object.keys(
        layer.route.methods || {}
      )
        .join(',')
        .toUpperCase();

      return `${methods} ${layer.route.path}`;
    });

  console.log(
    'Dedicated OTP route count:',
    otpRoutePaths.length
  );

  console.log(
    'Dedicated OTP routes:',
    otpRoutePaths.join(' | ') || 'NONE'
  );
}

/* =========================================================
   404 HANDLER
   IMPORTANT:
   Do NOT use app.all('*') or app.get('*')
   because Express 5 rejects the '*' pattern.
========================================================= */

app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found',
    path: req.originalUrl,
  });
});

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(errorHandler);

/* =========================================================
   START SERVER
========================================================= */

async function start() {
  try {
    const dbConfig = await connectDatabase();
    const dbMode = dbConfig.mode || 'firestore';

    console.log(`Database mode: ${dbMode}`);

    if (dbMode === 'mysql') {
      const { initializeMysqlSchema, ensureSeedAdminUserMysql } = require('./mysqlServices');

      await initializeMysqlSchema();

      console.log('MySQL schema initialized successfully.');

      await ensureSeedAdminUserMysql();

      console.log('Admin seed user ensured.');
    }

    // Firebase has been removed from this deployment configuration.
    await seedDefaultSettings();

    console.log('Default settings initialized.');

    initializeEmailService();

    console.log('Email service initialized.');

    /* =====================================================
       CRON JOB
    ===================================================== */

    cron.schedule('5 0 * * *', async () => {
      try {
        await expireSubscriptions();

        console.log(
          'Expired subscriptions processed successfully.'
        );
      } catch (error) {
        console.error(
          'Failed to expire subscriptions:',
          error
        );
      }
    });

    /* =====================================================
       SERVER
    ===================================================== */

    const PORT = Number(env.port) || Number(process.env.PORT) || 3000;

    app.listen(PORT, '0.0.0.0', () => {
      console.log('========================================');
      console.log(`Backend API (${dbMode}) is running`);
      console.log(`Port: ${PORT}`);
      console.log(`API: /api`);
      console.log(`Health: /api/health`);
      console.log('========================================');

      console.log(
        'CORS configured for:',
        [
          ...allowedOrigins,
          ...knownOrigins,
          'Vercel preview deployments',
        ].join(', ')
      );
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

/* =========================================================
   START
========================================================= */

if (require.main === module) {
  start();
}

module.exports = app;
