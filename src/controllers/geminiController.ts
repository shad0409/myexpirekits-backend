import { Request, Response } from 'express';
import { RecipeGenerationService } from '../services/recipeGenerationService';
import { ShoppingListGeminiService } from '../services/shoppingListGeminiService';

/**
 * Generate recipes using Gemini API and store in database
 */
export const generateRecipes = async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;
    const forceNew = req.query.force_new === 'true'; // Optional parameter to force new generation
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    console.log(`Processing recipe request for user ${userId}, force new: ${forceNew}`);
    
    // First check if we already have recipes for this user
    if (!forceNew) {
      const existingRecipes = await RecipeGenerationService.getLatestRecipes(userId);
      if (existingRecipes) {
        console.log('Found existing recipes, returning those');
        return res.json(existingRecipes);
      }
    }
    
    // If we don't have recipes or need new ones, generate them
    console.log(`Generating new recipes for user ${userId}`);
    const recipes = await RecipeGenerationService.generateRecipeSuggestions(userId);
    console.log(`Successfully generated ${recipes.recipes?.length || 0} recipes`);
    
    res.json(recipes);
  } catch (error) {
    console.error('Error generating recipes:', error);
    res.status(500).json({ 
      message: 'Failed to generate recipes',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Fetch the latest stored recipes for a user without generating new ones
 */
export const getLatestRecipes = async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    console.log(`Fetching latest recipes for user ${userId}`);
    const recipes = await RecipeGenerationService.getLatestRecipes(userId);
    
    if (!recipes) {
      console.log('No recipes found, will need to generate new ones');
      return res.status(404).json({ 
        message: 'No recipes found. Please generate new recipes.',
        needsGeneration: true
      });
    }
    
    res.json(recipes);
  } catch (error) {
    console.error('Error fetching latest recipes:', error);
    res.status(500).json({ 
      message: 'Failed to fetch latest recipes',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Generate enhanced shopping list and store in database
 */
export const generateEnhancedShoppingList = async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;
    const forceNew = req.query.force_new === 'true'; // Optional parameter to force new generation
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    console.log(`Processing shopping list request for user ${userId}, force new: ${forceNew}`);
    
    let shoppingList;
    
    if (forceNew) {
      // Force generate a new shopping list
      console.log(`Generating new shopping list for user ${userId}`);
      shoppingList = await ShoppingListGeminiService.generateNewShoppingList(userId);
    } else {
      // Get existing shopping list or generate new one if none exists
      shoppingList = await ShoppingListGeminiService.generateEnhancedShoppingList(userId);
    }
    
    console.log(`Successfully processed shopping list with ${shoppingList.items?.length || 0} items`);
    
    res.json(shoppingList);
  } catch (error) {
    console.error('Error generating enhanced shopping list:', error);
    
    // More detailed error response
    res.status(500).json({ 
      message: 'Failed to generate enhanced shopping list',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Get the latest stored shopping list for a user without generating a new one
 */
export const getLatestShoppingList = async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    console.log(`Fetching latest shopping list for user ${userId}`);
    const shoppingList = await ShoppingListGeminiService.getLatestShoppingList(userId);
    
    if (!shoppingList) {
      console.log('No shopping list found, will need to generate a new one');
      return res.status(404).json({ 
        message: 'No shopping list found. Please generate a new shopping list.',
        needsGeneration: true
      });
    }
    
    res.json(shoppingList);
  } catch (error) {
    console.error('Error fetching latest shopping list:', error);
    res.status(500).json({ 
      message: 'Failed to fetch latest shopping list',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};