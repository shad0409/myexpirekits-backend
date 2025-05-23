import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';

import itemRoutes from './routes/itemRoutes';
import barcodeRoutes from './routes/barcodeRoutes';  
import eventRoutes from './routes/eventRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import recipeRoutes from './routes/recipeRoutes';
import shoppingListRoutes from './routes/shoppingListRoutes'
import mlRoutes from './routes/mlRoutes'
import adminRoutes from './routes/adminRoutes'
import dataItemsRoutes from './routes/dataItemsRoutes';
import geminiRoutes from './routes/geminiRoutes';

import { MLService } from './services/mlService';

const app = express();
// Railway automatically sets PORT
const PORT = Number(process.env.PORT) || 3000;

// Enhanced database configuration for Railway + Google Cloud SQL
console.log('🔧 Database Config:', {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? 'enabled' : 'disabled'
});

// Create pool configuration with only valid mysql2 options
const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'myexpirekits',
  port: Number(process.env.DB_PORT) || 3306,
  
  // Connection pool settings
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  
  // Connection timeout settings
  timeout: 60000,
  
  // SSL configuration for Google Cloud SQL
  ...(process.env.DB_SSL === 'true' && {
    ssl: {
      rejectUnauthorized: false
    }
  })
};

const pool = mysql.createPool(poolConfig);

// CORS configuration for Railway
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('❌ CORS blocked origin:', origin);
      console.log('✅ Allowed origins:', allowedOrigins);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-Requested-With']
}));

app.options('*', cors());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint (Railway uses this)
app.get('/', (req, res) => {
  res.json({ 
    status: 'MyExpireKits Backend is running',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'production',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.execute('SELECT 1 as health_check');
    connection.release();
    
    res.json({ 
      status: 'healthy', 
      database: 'connected',
      host: process.env.DB_HOST,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Health check failed:', error);
    res.status(500).json({ 
      status: 'unhealthy', 
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Test endpoint (keep your existing one)
app.get('/api/test', (req, res) => {
  console.log('Test endpoint hit:', {
    ip: req.ip,
    headers: req.headers
  });
  res.json({ 
    message: 'Backend is connected!',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/items', itemRoutes);
app.use('/api/barcode', barcodeRoutes); 
app.use('/api/events', eventRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/shopping-lists', shoppingListRoutes);
app.use('/api/ml', mlRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/admin/data', dataItemsRoutes);
app.use('/api/gemini', geminiRoutes);

app.use('/uploads', express.static('uploads'));

// Database connection test with retry logic
async function testDatabaseConnection() {
  const maxRetries = 3;
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      const connection = await pool.getConnection();
      console.log('✅ Database connection successful');
      
      const [dbResult] = await connection.execute<mysql.RowDataPacket[]>('SELECT DATABASE() as db');
      console.log('✅ Connected to database:', dbResult[0]?.db);
      
      connection.release();
      return true;
    } catch (err: any) {
      retries++;
      console.error(`❌ Database connection attempt ${retries}/${maxRetries} failed:`, {
        code: err.code,
        errno: err.errno,
        sqlMessage: err.sqlMessage,
        sqlState: err.sqlState
      });
      
      if (retries === maxRetries) {
        console.error('❌ Max database connection retries reached');
        console.error('Connection details:', {
          host: process.env.DB_HOST,
          user: process.env.DB_USER,
          database: process.env.DB_NAME,
          ssl: process.env.DB_SSL
        });
        return false;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  return false;
}

// Start server
async function startServer() {
  try {
    console.log('🚀 Starting MyExpireKits server...');
    
    // Test database connection
    const dbConnected = await testDatabaseConnection();
    
    if (!dbConnected) {
      console.warn('⚠️ Starting server without database connection');
    }
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🎉 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'production'}`);
      console.log(`🗄️ Database: ${process.env.DB_HOST || 'localhost'}`);
      console.log(`🌐 Server URL: ${process.env.RAILWAY_STATIC_URL || `http://localhost:${PORT}`}`);
    });
    
    // Train ML models after server starts (with delay to avoid Railway timeout)
    if (process.env.NODE_ENV === 'production') {
      setTimeout(async () => {
        try {
          console.log('🧠 Training ML models...');
          const mlService = MLService.getInstance();
          await mlService.trainModels();
          console.log('✅ ML model training completed');
        } catch (error) {
          console.error('❌ Error during ML model training:', error);
          // Don't crash the server if ML training fails
        }
      }, 10000); // 10 second delay for Railway
    }
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, shutting down gracefully');
  await pool.end();
  process.exit(0);
});

startServer();

export { pool };
