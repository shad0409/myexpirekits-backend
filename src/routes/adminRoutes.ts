import express, { Router, Request, Response } from 'express';
import { 
  adminLogin, 
  adminLogout, 
  verifyAdminToken, 
  changeAdminPassword, 
  getAdminProfile,
  debugAdminLogin
} from '../controllers/adminAuthController';
import { authenticateAdmin } from '../middleware/adminAuth';
import { pendingItemsController } from '../controllers/pendingItemsController';

const router = Router();

// Auth routes (no authentication required)
router.post('/login', async (req: Request, res: Response) => {
  await adminLogin(req, res);
});

router.post('/debug-login', async (req: Request, res: Response) => {
    await debugAdminLogin(req, res);
});

router.post('/verify-token', async (req: Request, res: Response) => {
  await verifyAdminToken(req, res);
});

router.use((req, res, next) => {
  console.log(`Admin route accessed: ${req.method} ${req.path}`);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  next();
});

// Get all pending items (with optional status filter)
router.get('/pending-items', async (req: Request, res: Response) => {
  await pendingItemsController.getAllPendingItems(req, res);
});

// Get a specific pending item by ID
router.get('/pending-items/:id', async (req: Request, res: Response) => {
  await pendingItemsController.getPendingItemById(req, res);
});

// Approve a pending item
router.put('/pending-items/:id/approve', async (req: Request, res: Response) => {
  console.log('🚀 APPROVE route hit with ID:', req.params.id);
  console.log('🚀 APPROVE request body:', req.body);
  await pendingItemsController.approvePendingItem(req, res);
});

// Reject a pending item
router.put('/pending-items/:id/reject', async (req: Request, res: Response) => {
  console.log('🚀 REJECT route hit with ID:', req.params.id);
  console.log('🚀 REJECT request body:', req.body);
  await pendingItemsController.rejectPendingItem(req, res);
});

// Apply the authentication middleware correctly
router.use(authenticateAdmin);

// Routes requiring authentication
router.post('/logout', async (req: Request, res: Response) => {
  await adminLogout(req, res);
});

router.post('/change-password', async (req: Request, res: Response) => {
  await changeAdminPassword(req, res);
});

router.get('/profile', async (req: Request, res: Response) => {
  await getAdminProfile(req, res);
});

export default router;