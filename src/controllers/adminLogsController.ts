import { Request, Response } from 'express';
import { pool } from '../server';

export const getRecentLogs = async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    
    const [logs]: any = await pool.execute(
      `SELECT * FROM admin_logs 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [limit]
    );

    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('Error fetching admin logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admin logs'
    });
  }
};

export const getAllLogs = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const [logs]: any = await pool.execute(
      `SELECT * FROM admin_logs 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [countResult]: any = await pool.execute(
      'SELECT COUNT(*) as total FROM admin_logs'
    );

    res.json({
      success: true,
      logs: logs,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(countResult[0].total / limit),
        total_records: countResult[0].total,
        records_per_page: limit
      }
    });
  } catch (error) {
    console.error('Error fetching admin logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admin logs'
    });
  }
};