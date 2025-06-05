import { Request, Response } from 'express';
import { RecipeGenerationService } from '../services/recipeGenerationService';
import { ShoppingListGeminiService } from '../services/shoppingListGeminiService';
import { GeminiService } from '../services/geminiService';

/**
 * Generate recipes using Gemini API with AI-generated images and store in database
 */
export const generateRecipes = async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;
    const forceNew = req.query.force_new === 'true'; // Optional parameter to force new generation
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    console.log(`Processing recipe request for user ${userId}, force new: ${forceNew}`);
    
    const startTime = Date.now();
    
    // Use the updated method that includes Gemini image generation and intelligent caching
    const recipes = await RecipeGenerationService.getOrGenerateRecipes(userId, forceNew);
    
    const endTime = Date.now();
    const generationTime = endTime - startTime;
    
    console.log(`Successfully retrieved/generated ${recipes.recipes?.length || 0} recipes in ${generationTime}ms`);
    
    // Count recipes with successfully generated images
    const recipesWithImages = recipes.recipes?.filter(r => r.image_url !== null).length || 0;
    const recipesWithoutImages = recipes.recipes?.filter(r => r.image_url === null).length || 0;
    
    // Add metadata about generation
    const response = {
      ...recipes,
      metadata: {
        generationTime,
        totalRecipes: recipes.recipes?.length || 0,
        recipesWithImages,
        recipesWithoutImages,
        wasFromCache: !forceNew && await RecipeGenerationService.hasRecentRecipes(userId),
        generatedAt: recipes.generated
      }
    };
    
    res.json(response);
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
    
    // Add metadata for consistency
    const response = {
      ...recipes,
      metadata: {
        totalRecipes: recipes.recipes?.length || 0,
        fromCache: true,
        generatedAt: recipes.generated
      }
    };
    
    res.json(response);
  } catch (error) {
    console.error('Error fetching latest recipes:', error);
    res.status(500).json({ 
      message: 'Failed to fetch latest recipes',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Force generate completely new recipes with AI images (ignores cache)
 */
export const forceGenerateRecipes = async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    console.log(`Force generating new recipes for user ${userId}`);
    
    const startTime = Date.now();
    
    // Always generate new recipes with AI images
    const recipes = await RecipeGenerationService.generateRecipeSuggestions(userId);
    
    const endTime = Date.now();
    const generationTime = endTime - startTime;
    
    console.log(`Successfully generated ${recipes.recipes?.length || 0} new recipes in ${generationTime}ms`);
    
    // Count image generation success
    const recipesWithImages = recipes.recipes?.filter(r => r.image_url !== null).length || 0;
    const recipesWithoutImages = recipes.recipes?.filter(r => r.image_url === null).length || 0;
    
    // Add generation metadata
    const response = {
      ...recipes,
      metadata: {
        generationTime,
        totalRecipes: recipes.recipes?.length || 0,
        recipesWithImages,
        recipesWithoutImages,
        forceGenerated: true,
        generatedAt: recipes.generated
      }
    };
    
    res.json(response);
  } catch (error) {
    console.error('Error force generating recipes:', error);
    res.status(500).json({ 
      message: 'Failed to force generate recipes',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Regenerate AI image for a specific recipe
 */
export const regenerateRecipeImage = async (req: Request, res: Response) => {
  try {
    const { recipeName, description, ingredients } = req.body;
    
    if (!recipeName || !description || !ingredients) {
      return res.status(400).json({ 
        message: 'Recipe name, description, and ingredients are required' 
      });
    }
    
    console.log(`Regenerating image for recipe: ${recipeName}`);
    
    const startTime = Date.now();
    
    const imageUrl = await RecipeGenerationService.regenerateRecipeImage(
      recipeName, 
      description, 
      ingredients
    );
    
    const endTime = Date.now();
    const generationTime = endTime - startTime;
    
    console.log(`Image regenerated successfully for "${recipeName}" in ${generationTime}ms`);
    
    res.json({
      success: true,
      imageUrl,
      recipeName,
      generationTime,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error regenerating recipe image:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to regenerate recipe image',
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
    
    const startTime = Date.now();
    let shoppingList;
    
    if (forceNew) {
      // Force generate a new shopping list
      console.log(`Generating new shopping list for user ${userId}`);
      shoppingList = await ShoppingListGeminiService.generateNewShoppingList?.(userId) || 
                     await ShoppingListGeminiService.generateEnhancedShoppingList(userId);
    } else {
      // Get existing shopping list or generate new one if none exists
      shoppingList = await ShoppingListGeminiService.generateEnhancedShoppingList(userId);
    }
    
    const endTime = Date.now();
    const generationTime = endTime - startTime;
    
    console.log(`Successfully processed shopping list with ${shoppingList.items?.length || 0} items in ${generationTime}ms`);
    
    // Add metadata
    const response = {
      ...shoppingList,
      metadata: {
        generationTime,
        totalItems: shoppingList.items?.length || 0,
        forceGenerated: forceNew,
        generatedAt: shoppingList.generated || new Date()
      }
    };
    
    res.json(response);
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
    const shoppingList = await ShoppingListGeminiService.getLatestShoppingList?.(userId);
    
    if (!shoppingList) {
      console.log('No shopping list found, will need to generate a new one');
      return res.status(404).json({ 
        message: 'No shopping list found. Please generate a new shopping list.',
        needsGeneration: true
      });
    }
    
    // Add metadata for consistency
    const response = {
      ...shoppingList,
      metadata: {
        totalItems: shoppingList.items?.length || 0,
        fromCache: true,
        generatedAt: shoppingList.generated || new Date()
      }
    };
    
    res.json(response);
  } catch (error) {
    console.error('Error fetching latest shopping list:', error);
    res.status(500).json({ 
      message: 'Failed to fetch latest shopping list',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Check if user has recent recipes (utility endpoint)
 */
export const checkRecentRecipes = async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    const hasRecent = await RecipeGenerationService.hasRecentRecipes(userId);
    
    res.json({
      userId,
      hasRecentRecipes: hasRecent,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error checking recent recipes:', error);
    res.status(500).json({ 
      message: 'Failed to check recent recipes',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const testImageOnly = async (req: Request, res: Response) => {
  try {
    console.log('Testing image generation...');
    
    const imageUrl = await GeminiService.generateImage(
      "A delicious plate of spaghetti with tomato sauce and basil, professional food photography"
    );
    
    res.json({
      success: true,
      imageUrl,
      message: 'Image generated successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Image test failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
};