import { Request, Response, NextFunction } from 'express';
import { AdminAuthService } from '../services/AdminAuthService';

/**
 * Middleware to authenticate admin users
 */
export const authenticateAdmin = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const admin = await AdminAuthService.verifyToken(token);
    
    if (!admin) {
      res.status(401).json({ message: 'Invalid or expired token' });
      return;
    }
    
    // Attach admin user to request - only set the id property
    (req as any).user = {
      id: String(admin.id) // Convert to string to match the interface
    };
    
    // Store admin role in the request object as a separate property
    (req as any).adminRole = admin.role;
    
    next();
  } catch (error) {
    console.error('Admin authentication error:', error);
    res.status(401).json({ message: 'Authentication failed' });
    return;
  }
};

/**
 * Middleware to check admin permissions
 */
export const checkAdminPermission = (permissionName: string) => {
  return async (
    req: Request, 
    res: Response, 
    next: NextFunction
  ): Promise<void> => {
    try {
        const adminId = (req as any).user?.id;
      
      if (!adminId) {
        res.status(401).json({ message: 'Authentication required' });
        return;
      }
      
      const hasPermission = await AdminAuthService.hasPermission(Number(adminId), permissionName);
      
      if (!hasPermission) {
        res.status(403).json({ message: 'Insufficient permissions' });
        return;
      }
      
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ message: 'Error checking permissions' });
      return;
    }
  };
};