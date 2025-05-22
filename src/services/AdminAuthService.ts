import { pool } from '../server';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'your-admin-secret-key';
const SESSION_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

interface AdminUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'super_admin';
}

interface AdminLoginResult {
  success: boolean;
  message?: string;
  token?: string;
  user?: AdminUser;
}

export class AdminAuthService {
  /**
   * Authenticate admin user
   */
  static async login(username: string, password: string, ipAddress: string, userAgent: string): Promise<AdminLoginResult> {
    try {
      // Get admin user by username
      const [users]: any = await pool.execute(
        'SELECT * FROM admin_users WHERE username = ? AND is_active = TRUE',
        [username]
      );

      if (users.length === 0) {
        return { success: false, message: 'Invalid username or password' };
      }

      const user = users[0];

      // Verify password
      const passwordMatch = await bcrypt.compare(password, user.password_hash);
      if (!passwordMatch) {
        return { success: false, message: 'Invalid username or password' };
      }

      // Create JWT token
      const token = jwt.sign(
        { 
          id: user.id,
          username: user.username,
          role: user.role
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Create a session
      const sessionId = uuidv4();
      const expiresAt = new Date(Date.now() + SESSION_EXPIRY);

      await pool.execute(
        `INSERT INTO admin_sessions (id, admin_id, ip_address, user_agent, expires_at)
         VALUES (?, ?, ?, ?, ?)`,
        [sessionId, user.id, ipAddress, userAgent, expiresAt]
      );

      // Update last login
      await pool.execute(
        'UPDATE admin_users SET last_login = NOW() WHERE id = ?',
        [user.id]
      );

      // Log activity
      await this.logActivity(user.id, 'login', 'Admin login successful', ipAddress);

      // Return user info with token
      return {
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role
        }
      };
    } catch (error) {
      console.error('Admin login error:', error);
      return { success: false, message: 'Authentication failed' };
    }
  }

  /**
   * Verify JWT token and return admin user
   */
  static async verifyToken(token: string): Promise<AdminUser | null> {
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      
      // Check if user still exists and is active
      const [users]: any = await pool.execute(
        'SELECT * FROM admin_users WHERE id = ? AND is_active = TRUE',
        [decoded.id]
      );

      if (users.length === 0) {
        return null;
      }

      const user = users[0];

      return {
        id: user.id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role
      };
    } catch (error) {
      console.error('Token verification error:', error);
      return null;
    }
  }

  /**
   * Log admin activity
   */
  static async logActivity(adminId: number, action: string, details: string, ipAddress: string = ''): Promise<void> {
    try {
      await pool.execute(
        `INSERT INTO admin_activity_logs (admin_id, action, details, ip_address)
         VALUES (?, ?, ?, ?)`,
        [adminId, action, details, ipAddress]
      );
    } catch (error) {
      console.error('Error logging admin activity:', error);
    }
  }

  /**
   * Check if admin has specific permission
   */
  static async hasPermission(adminId: number, permissionName: string): Promise<boolean> {
    try {
      const [rows]: any = await pool.execute(
        `SELECT COUNT(*) as count
         FROM admin_users u
         JOIN admin_role_permissions rp ON u.role = rp.role_name
         JOIN admin_permissions p ON rp.permission_id = p.id
         WHERE u.id = ? AND p.name = ?`,
        [adminId, permissionName]
      );

      return rows[0].count > 0;
    } catch (error) {
      console.error('Error checking admin permission:', error);
      return false;
    }
  }

  /**
   * Get admin user by ID
   */
  static async getAdminById(id: number): Promise<AdminUser | null> {
    try {
      const [users]: any = await pool.execute(
        'SELECT * FROM admin_users WHERE id = ?',
        [id]
      );

      if (users.length === 0) {
        return null;
      }

      const user = users[0];

      return {
        id: user.id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role
      };
    } catch (error) {
      console.error('Error getting admin by ID:', error);
      return null;
    }
  }

  /**
   * Logout admin and invalidate session
   */
  static async logout(token: string): Promise<boolean> {
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      
      // Delete all sessions for this admin
      await pool.execute(
        'DELETE FROM admin_sessions WHERE admin_id = ?',
        [decoded.id]
      );

      return true;
    } catch (error) {
      console.error('Logout error:', error);
      return false;
    }
  }

  /**
   * Change admin password
   */
  static async changePassword(adminId: number, currentPassword: string, newPassword: string): Promise<boolean> {
    try {
      const [users]: any = await pool.execute(
        'SELECT * FROM admin_users WHERE id = ?',
        [adminId]
      );

      if (users.length === 0) {
        return false;
      }

      const user = users[0];

      // Verify current password
      const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);
      if (!passwordMatch) {
        return false;
      }

      // Hash new password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      await pool.execute(
        'UPDATE admin_users SET password_hash = ? WHERE id = ?',
        [passwordHash, adminId]
      );

      // Log activity
      await this.logActivity(adminId, 'password_change', 'Password changed successfully');

      return true;
    } catch (error) {
      console.error('Error changing admin password:', error);
      return false;
    }
  }
}