import { Request, Response } from 'express';
import { RecipeGenerationService } from '../services/recipeGenerationService';
import { ShoppingListGeminiService } from '../services/shoppingListGeminiService';

/**
 * Generate recipes using Gemini API with images and store in database
 */
export const generateRecipes = async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;
    const forceNew = req.query.force_new === 'true'; // Optional parameter to force new generation
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    console.log(`Processing recipe request for user ${userId}, force new: ${forceNew}`);
    
    // Use the new method that includes image fetching and intelligent caching
    const recipes = await RecipeGenerationService.getOrGenerateRecipes(userId, forceNew);
    console.log(`Successfully retrieved/generated ${recipes.recipes?.length || 0} recipes with images`);
    
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
    
    // Ensure all recipes have image URLs (backward compatibility)
    if (recipes.recipes) {
      recipes.recipes = recipes.recipes.map((recipe: any) => ({
        ...recipe,
        image_url: recipe.image_url || 'https://images.unsplash.com/photo-1546549032-9571cd6b27df?w=500&h=300&fit=crop'
      }));
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
 * Force generate completely new recipes (ignores cache)
 */
export const forceGenerateRecipes = async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    console.log(`Force generating new recipes for user ${userId}`);
    
    // Always generate new recipes with images
    const recipes = await RecipeGenerationService.generateRecipeSuggestions(userId);
    console.log(`Successfully generated ${recipes.recipes?.length || 0} new recipes with images`);
    
    res.json(recipes);
  } catch (error) {
    console.error('Error force generating recipes:', error);
    res.status(500).json({ 
      message: 'Failed to force generate recipes',
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