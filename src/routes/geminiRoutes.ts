import express, { Router, Request, Response } from 'express';
import { 
  generateRecipes, 
  getLatestRecipes,
  forceGenerateRecipes,
  regenerateRecipeImage,
  generateEnhancedShoppingList,
  getLatestShoppingList,
  checkRecentRecipes
} from '../controllers/geminiController';

const router = Router();

// Recipe endpoints
router.get('/recipes', async (req: Request, res: Response) => {
  await generateRecipes(req, res);
});

router.get('/recipes/latest', async (req: Request, res: Response) => {
  await getLatestRecipes(req, res);
});

router.get('/recipes/force-generate', async (req: Request, res: Response) => {
  await forceGenerateRecipes(req, res);
});

router.post('/recipes/regenerate-image', async (req: Request, res: Response) => {
  await regenerateRecipeImage(req, res);
});

router.get('/recipes/check-recent', async (req: Request, res: Response) => {
  await checkRecentRecipes(req, res);
});

// Shopping list endpoints
router.get('/shopping-list', async (req: Request, res: Response) => {
  await generateEnhancedShoppingList(req, res);
});

router.get('/shopping-list/latest', async (req: Request, res: Response) => {
  await getLatestShoppingList(req, res);
});

export default router;