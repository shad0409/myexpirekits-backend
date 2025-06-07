import { Request, Response } from 'express';
import { pool } from '../server';

export const getRecentLogs = async (req: Request, res: Response) => {
  try {
    const [logs]: any = await pool.execute(
      `SELECT * FROM admin_activity_logs 
       ORDER BY created_at DESC`
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
    const [logs]: any = await pool.execute(
      `SELECT * FROM admin_activity_logs 
       ORDER BY created_at DESC`
    );

    res.json({
      success: true,
      logs: logs
    });
  } catch (error) {
    console.error('Error fetching admin logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admin logs'
    });
  }
};