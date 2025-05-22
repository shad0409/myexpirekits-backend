import express, { Router, Request, Response } from 'express';
import { itemController } from '../controllers/itemController';
import multer from 'multer';

const upload = multer({ dest: 'uploads/' });

const router = Router();

// GET all items for a user
router.get('/user/:userId', async (req: Request, res: Response) => {
  await itemController.getAllItems(req, res);
});

// POST new item
router.post(
  '/',
  upload.single('image'), // Middleware for single image upload
  async (req: Request, res: Response) => {
    await itemController.addItem(req, res);
  }
);

// PUT update item
router.put('/:id', async (req: Request, res: Response) => {
  await itemController.updateItem(req, res);
});

// DELETE item
router.delete('/:id', async (req: Request, res: Response) => {
  await itemController.deleteItem(req, res);
});

export default router;