import express, { Router, Request, Response } from 'express';
import { 
  getAllRecipes, 
  getRecipeById, 
  getRecipeRecommendations,
  addSampleRecipe
} from '../controllers/recipeController';

const router = Router();

// GET all recipes
router.get('/', async (req: Request, res: Response) => {
  await getAllRecipes(req, res);
});

// GET recipe by ID
router.get('/:id', async (req: Request, res: Response) => {
  await getRecipeById(req, res);
});

// GET recipe recommendations
router.get('/recommendations/user', async (req: Request, res: Response) => {
  await getRecipeRecommendations(req, res);
});

// POST add sample recipe (for testing)
router.post('/sample', async (req: Request, res: Response) => {
  await addSampleRecipe(req, res);
});

export default router;