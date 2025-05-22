import express, { Router, Request, Response } from 'express';
import * as dataItemsController from '../controllers/dataItemsController';
import { authenticateAdmin } from '../middleware/adminAuth';

const router = Router();

// Protected by admin authentication
router.use((req, res, next) => authenticateAdmin(req, res, next));

// GET all items
router.get('/items', async (req: Request, res: Response) => {
  await dataItemsController.getAllItems(req, res);
});

// GET item by ID
router.get('/items/:id', async (req: Request, res: Response) => {
  await dataItemsController.getItemById(req, res);
});

// GET items by category
router.get('/items/category/:category', async (req: Request, res: Response) => {
  await dataItemsController.getItemsByCategory(req, res);
});

// GET all categories
router.get('/categories', async (req: Request, res: Response) => {
  await dataItemsController.getAllCategories(req, res);
});

// PUT update an item
router.put('/items/:id', async (req: Request, res: Response) => {
  await dataItemsController.updateItem(req, res);
});

// DELETE an item
router.delete('/items/:id', async (req: Request, res: Response) => {
  await dataItemsController.deleteItem(req, res);
});

// POST add a new item
router.post('/items', async (req: Request, res: Response) => {
  await dataItemsController.addItem(req, res);
});

export default router;