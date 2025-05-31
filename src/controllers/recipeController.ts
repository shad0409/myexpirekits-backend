import { Request, Response } from 'express';
import { RecipeService } from '../models/Recipe';
import { RecipeRecommendationService } from '../services/recipeRecommendationService';

/**
 * Get all recipes
 */
export const getAllRecipes = async (req: Request, res: Response) => {
  try {
    const recipes = await RecipeService.getAllRecipes();
    res.json(recipes);
  } catch (error) {
    console.error('Error getting all recipes:', error);
    res.status(500).json({ message: 'Failed to get recipes' });
  }
};

/**
 * Get recipe by ID
 */
export const getRecipeById = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const recipe = await RecipeService.getRecipeById(id);
    
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }
    
    const ingredients = await RecipeService.getRecipeIngredients(id);
    
    res.json({
      ...recipe,
      ingredients
    });
  } catch (error) {
    console.error('Error getting recipe by ID:', error);
    res.status(500).json({ message: 'Failed to get recipe' });
  }
};

/**
 * Get recipe recommendations based on user's inventory
 */
export const getRecipeRecommendations = async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;
    const forceGenerate = req.query.force === 'true'; // Allow forcing new generation
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    console.log(`Getting recipe recommendations for user: ${userId}, force: ${forceGenerate}`);
    
    const recommendations = await RecipeRecommendationService.findMatchingRecipes(userId);
    res.json(recommendations);
  } catch (error) {
    console.error('Error getting recipe recommendations:', error);
    res.status(500).json({ message: 'Failed to get recipe recommendations' });
  }
};

/**
 * Add a sample recipe (for testing/development)
 */
export const addSampleRecipe = async (req: Request, res: Response) => {
  try {
    const recipeId = await RecipeRecommendationService.addSampleRecipe();
    
    if (recipeId === -1) {
      return res.json({ message: 'Sample recipes already exist' });
    }
    
    res.json({ 
      message: 'Sample recipe added successfully',
      recipe_id: recipeId
    });
  } catch (error) {
    console.error('Error adding sample recipe:', error);
    res.status(500).json({ message: 'Failed to add sample recipe' });
  }
};