import express, { Router } from 'express';
import { barcodeController } from '../controllers/barcodeController';

const router = Router();

// Add a simple test endpoint
router.get('/test', (req, res) => {
  res.json({ message: 'Barcode routes working' });
});

// GET product by barcode
router.get('/:barcode', async (req, res) => {
  await barcodeController.getProductByBarcode(req, res);
});

// Make sure to export the router as default
export default router;