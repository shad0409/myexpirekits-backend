import { Request, Response } from 'express';
import { AdminAuthService } from '../services/AdminAuthService';
import { pool } from '../server'

/**
 * Admin login
 */
export const adminLogin = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const ipAddress = req.ip || '';
    const userAgent = req.headers['user-agent'] || '';

    const result = await AdminAuthService.login(username, password, ipAddress, userAgent);

    if (!result.success) {
      return res.status(401).json({ message: result.message });
    }

    res.json({
      message: 'Login successful',
      token: result.token,
      user: result.user
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'An error occurred during login' });
  }
};

// Add this to your adminAuthController.ts

/**
 * Debug admin login
 */
export const debugAdminLogin = async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      
      console.log(`Debug login attempt: ${username}`);
      
      // Try to query the admin user directly from the database
      const [users]: any = await pool.execute(
        'SELECT * FROM admin_users WHERE username = ?',
        [username]
      );
      
      if (users.length === 0) {
        console.log('No user found with this username');
        return res.status(401).json({ message: 'Invalid username or password' });
      }
      
      const user = users[0];
      console.log(`Found user: ${user.username}, hash: ${user.password_hash.substring(0, 10)}...`);
      
      // Log the raw password for debugging (remove in production!)
      console.log(`Attempting to verify password: ${password} against hash`);
      
      // Test password match
      const bcrypt = require('bcrypt');
      const passwordMatch = await bcrypt.compare(password, user.password_hash);
      
      console.log(`Password match result: ${passwordMatch}`);
      
      if (!passwordMatch) {
        return res.status(401).json({ message: 'Invalid username or password' });
      }
      
      // Create a simple token for testing
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        { id: user.id, username: user.username },
        process.env.ADMIN_JWT_SECRET || 'test-secret-key',
        { expiresIn: '24h' }
      );
      
      res.json({
        message: 'Debug login successful',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Debug admin login error:', error);
      res.status(500).json({ message: 'An error occurred during login', error: String(error) });
    }
};

/**
 * Admin logout
 */
export const adminLogout = async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || '';

    if (!token) {
      return res.status(400).json({ message: 'Token is required' });
    }

    const success = await AdminAuthService.logout(token);

    if (!success) {
      return res.status(400).json({ message: 'Logout failed' });
    }

    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Admin logout error:', error);
    res.status(500).json({ message: 'An error occurred during logout' });
  }
};

/**
 * Verify admin token
 */
export const verifyAdminToken = async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || '';

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const admin = await AdminAuthService.verifyToken(token);

    if (!admin) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    res.json({
      message: 'Token is valid',
      user: admin
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ message: 'An error occurred during token verification' });
  }
};

/**
 * Change admin password
 */
export const changeAdminPassword = async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const adminId = (req as any).user?.id;

    if (!adminId) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const adminIdNum = Number(adminId);

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    // Password strength validation
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters long' });
    }

    const success = await AdminAuthService.changePassword(adminIdNum, currentPassword, newPassword);

    if (!success) {
      return res.status(400).json({ message: 'Password change failed. Check your current password.' });
    }

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ message: 'An error occurred during password change' });
  }
};

/**
 * Get admin profile
 */
export const getAdminProfile = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user?.id;

    const adminIdNum = Number(adminId);

    if (!adminId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const admin = await AdminAuthService.getAdminById(adminIdNum);

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    res.json({
      user: admin
    });
  } catch (error) {
    console.error('Error getting admin profile:', error);
    res.status(500).json({ message: 'An error occurred while fetching profile' });
  }
};

