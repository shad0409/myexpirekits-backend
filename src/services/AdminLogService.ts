import { pool } from '../server';

export class AdminLogService {
  /**
   * Log an admin action to the database
   */
  static async logAction(admin_id: string, action: string, details: string, ip_address: string = 'unknown'): Promise<void> {
    try {
      await pool.execute(
        `INSERT INTO admin_logs (admin_id, action, details, ip_address, created_at) 
         VALUES (?, ?, ?, ?, NOW())`,
        [admin_id, action, details, ip_address]
      );
      
      console.log(`Admin action logged: ${action} by admin ${admin_id}`);
    } catch (error) {
      console.error('Error logging admin action:', error);
      // Don't throw error to avoid breaking the main operation
    }
  }

  /**
   * Helper method to get client IP address from request
   */
  static getClientIP(req: any): string {
    return req.ip || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress || 
           req.headers['x-forwarded-for']?.split(',')[0] || 
           'unknown';
  }
}