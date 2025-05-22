import express, { Router, Request, Response } from 'express';
import { 
  generateRecipes, 
  getLatestRecipes, 
  generateEnhancedShoppingList,
  getLatestShoppingList
} from '../controllers/geminiController';

const router = Router();

// Recipe endpoints
// Get latest stored recipes (without generating new ones)
router.get('/recipes/latest', async (req: Request, res: Response) => {
  await getLatestRecipes(req, res);
});

// Generate and store new recipes
router.get('/recipes/generate', async (req: Request, res: Response) => {
  // Force new generation
  req.query.force_new = 'true';
  await generateRecipes(req, res);
});

// Legacy endpoint - will check for existing recipes first before generating new ones
router.get('/recipes', async (req: Request, res: Response) => {
  await generateRecipes(req, res);
});

// Shopping list endpoints
// Get latest stored shopping list (without generating new one)
router.get('/shopping-list/latest', async (req: Request, res: Response) => {
  await getLatestShoppingList(req, res);
});

// Generate and store new shopping list
router.get('/shopping-list/generate', async (req: Request, res: Response) => {
  // Force new generation
  req.query.force_new = 'true';
  await generateEnhancedShoppingList(req, res);
});

// Legacy endpoint - will check for existing shopping list first before generating new one
router.get('/shopping-list', async (req: Request, res: Response) => {
  await generateEnhancedShoppingList(req, res);
});

export default router;