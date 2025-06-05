import { GeminiService } from './geminiService';
import { pool } from '../server';
import { RowDataPacket } from 'mysql2';

interface Item extends RowDataPacket {
  id: string;
  userId: string;
  name: string;
  category: string;
  expiryDate: Date;
  imageUri: string | null;
  status: string;
  barcode: string | null;
}

interface RecipeResult {
  recipes: RecipeItem[];
  generated: Date;
}

interface RecipeItem {
  name: string;
  description: string;
  ingredients: string[];
  instructions: string[];
  preparationTime: number;
  cookingTime: number;
  difficulty: string;
  nutritionalInfo: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  suitableFor: string[];
  tags: string[];
  expiringItemsUsed: string[];
  image_url?: string;
}

export class RecipeGenerationService {
  /**
   * Generate recipe suggestions based on user's inventory and save to database
   */
  static async generateRecipeSuggestions(userId: string): Promise<RecipeResult> {
    try {
      console.log('Generating recipe suggestions for user:', userId);
      
      // Fetch user's inventory
      const [items] = await pool.query<Item[]>(
        `SELECT * FROM items 
         WHERE userId = ? AND category = 'Food' AND status = 'active'
         ORDER BY expiryDate ASC`,
        [userId]
      );
      
      if (items.length === 0) {
        throw new Error('No food items found in inventory');
      }
      
      // Identify expiring items (within 7 days)
      const sevenDaysLater = new Date();
      sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
      
      const expiringItems = items.filter(item => {
        const expiryDate = item.expiryDate ? new Date(item.expiryDate) : null;
        return expiryDate && expiryDate <= sevenDaysLater;
      });

      const userPrefs = {}; 
      
      // Prepare context for Gemini
      const context = {
        inventory: items.map(item => ({
          name: item.name,
          category: item.category,
          expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString() : null
        })),
        expiringItems: expiringItems.map(item => ({
          name: item.name,
          expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString() : null
        })),
        userPreferences: userPrefs
      };
        
      // Create prompt for Gemini
      const prompt = `
        You are an expert chef specializing in creative recipes that use available ingredients.
        
        Generate 5 unique recipe suggestions based on the user's inventory, prioritizing items that will expire soon.
        
        For each recipe:
        1. Create an appealing name and brief description
        2. List all required ingredients, indicating which ones are from the user's inventory
        3. Provide step-by-step cooking instructions
        4. Include preparation time, cooking time, and difficulty level
        5. Add nutritional information (calories, protein, carbs, fat) as estimates
        6. Note dietary preferences (vegetarian, vegan, gluten-free, etc.)
        7. Include any special tags like "quick", "budget-friendly", etc.
        8. List the expiring items used in the recipe
        
        Prioritize these factors:
        - Use as many expiring items as possible in each recipe
        - Create diverse recipe suggestions (different cuisines, meal types)
        - Keep recipes practical and achievable with common kitchen equipment
        - Consider Malaysian cooking styles and preferences
        - Provide estimated portion sizes (serves 2-4 people)
        
        Return your response as valid JSON with this structure:
        {
          "recipes": [
            {
              "name": "Recipe Name",
              "description": "Brief description",
              "ingredients": ["1 cup ingredient 1 (from inventory)", "2 tbsp ingredient 2 (not in inventory)"],
              "instructions": ["Step 1: Do this", "Step 2: Do that"],
              "preparationTime": 15,
              "cookingTime": 30,
              "difficulty": "Easy|Medium|Hard",
              "nutritionalInfo": {
                "calories": 350,
                "protein": 25,
                "carbs": 40,
                "fat": 10
              },
              "suitableFor": ["vegetarian", "gluten-free"],
              "tags": ["quick", "budget-friendly"],
              "expiringItemsUsed": ["item1", "item2"]
            }
          ]
        }
        
        DO NOT include any explanations outside the JSON structure. Ensure the JSON can be parsed directly.
      `;
      
      // Generate recipes using Gemini
      console.log('Generating recipes with Gemini LLM...');
      const response = await GeminiService.generateWithContext(prompt, context);
      
      try {
        // Extract the JSON content from the response
        const jsonStr = GeminiService.extractJsonFromResponse(response);
        
        // Parse the JSON
        const recipeResult = JSON.parse(jsonStr);
        
        // Add images to each recipe using Gemini image generation
        console.log('Generating images for recipes using Gemini...');
        
        const recipesWithImages = await Promise.all(
          recipeResult.recipes.map(async (recipe: any) => {
            try {
              console.log(`Generating image for recipe: ${recipe.name}`);
              
              const imageUrl = await this.generateRecipeImage(
                recipe.name, 
                recipe.description, 
                recipe.ingredients
              );
              
              console.log(`Image generated for "${recipe.name}": ${imageUrl}`);
              
              return {
                ...recipe,
                image_url: imageUrl
              };
            } catch (error) {
              console.error(`Error generating image for recipe "${recipe.name}":`, error);
              // If image generation fails, continue without image
              return {
                ...recipe,
                image_url: null
              };
            }
          })
        );
        
        console.log(`Successfully generated ${recipesWithImages.length} recipes with images`);
        
        const recipes = {
          recipes: recipesWithImages,
          generated: new Date()
        };
        
        // Save to database
        await this.saveRecipesToDatabase(userId, recipes);
        
        return recipes;
      } catch (error) {
        console.error('Error parsing Gemini recipe response:', error);
        console.error('Raw response:', response);
        throw new Error('Failed to parse recipe suggestions');
      }
    } catch (error) {
      console.error('Error generating recipe suggestions:', error);
      throw error;
    }
  }

  /**
   * Generate recipe image using Gemini
   */
  private static async generateRecipeImage(
    recipeName: string, 
    description: string, 
    ingredients: string[]
  ): Promise<string> {
    const prompt = `Create a high-quality, professional food photography image of "${recipeName}".
    
    Description: ${description}
    
    Key ingredients: ${ingredients.slice(0, 5).join(', ')}
    
    Requirements:
    - Professional food photography style
    - Clean, appetizing presentation
    - Vibrant colors and sharp focus
    - Natural lighting
    - Clean background (white or wooden)
    - No text, watermarks, or labels
    - Restaurant-quality plating
    - Make it look delicious and Instagram-worthy
    - Show the finished dish ready to eat`;

    return await GeminiService.generateRecipeImage(recipeName, description, ingredients);
  }
  
  /**
   * Save generated recipes to the database
   */
  private static async saveRecipesToDatabase(userId: string, recipes: RecipeResult): Promise<void> {
    try {
      console.log(`Saving ${recipes.recipes.length} recipes to database for user ${userId}`);
      
      // First, mark existing recipes as inactive
      await pool.execute(
        `UPDATE gemini_recipes SET is_active = FALSE WHERE user_id = ?`,
        [userId]
      );
      
      // Convert the recipes object to a JSON string
      const recipeDataJson = JSON.stringify(recipes);
      
      console.log('Recipe data being saved to database:', recipeDataJson.substring(0, 100) + '...');
      
      // Insert new recipes
      await pool.execute(
        `INSERT INTO gemini_recipes (user_id, recipe_data) VALUES (?, ?)`,
        [userId, recipeDataJson]
      );
      
      console.log('Recipes successfully saved to database');
    } catch (error) {
      console.error('Error saving recipes to database:', error);
      throw error;
    }
  }
  
  /**
   * Get the latest generated recipes for a user from the database
   */
  static async getLatestRecipes(userId: string): Promise<RecipeResult | null> {
    try {
      console.log(`Fetching latest recipes for user ${userId}`);
      
      const [rows]: any = await pool.execute(
        `SELECT recipe_data FROM gemini_recipes 
         WHERE user_id = ? AND is_active = TRUE 
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );
      
      if (rows.length === 0) {
        console.log('No saved recipes found for user');
        return null;
      }
      
      // Get the recipe_data string from the result
      const recipeDataStr = rows[0].recipe_data;
      
      console.log('Recipe data from database type:', typeof recipeDataStr);
      console.log('Recipe data preview:', typeof recipeDataStr === 'string' 
        ? recipeDataStr.substring(0, 100) + '...' 
        : JSON.stringify(recipeDataStr).substring(0, 100) + '...');
      
      try {
        // Parse the stored JSON
        const recipeData = typeof recipeDataStr === 'string' 
          ? JSON.parse(recipeDataStr) 
          : recipeDataStr;
        
        console.log(`Found ${recipeData.recipes?.length || 0} saved recipes`);
        
        // Ensure the generated field is a Date object
        if (recipeData.generated && typeof recipeData.generated === 'string') {
          recipeData.generated = new Date(recipeData.generated);
        }
        
        return recipeData;
      } catch (error) {
        console.error('Error parsing recipe data from database:', error);
        console.error('Raw recipe data:', recipeDataStr);
        throw error;
      }
    } catch (error) {
      console.error('Error fetching recipes from database:', error);
      return null;
    }
  }
  
  /**
   * Check if user has recent recipes (within last 24 hours) to avoid unnecessary API calls
   */
  static async hasRecentRecipes(userId: string): Promise<boolean> {
    try {
      const [rows]: any = await pool.execute(
        `SELECT created_at FROM gemini_recipes 
         WHERE user_id = ? AND is_active = TRUE 
         AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );
      
      return rows.length > 0;
    } catch (error) {
      console.error('Error checking for recent recipes:', error);
      return false;
    }
  }
  
  /**
   * Get or generate recipes for a user (with caching logic)
   */
  static async getOrGenerateRecipes(userId: string, forceGenerate: boolean = false): Promise<RecipeResult> {
    try {
      // Check if we should use cached recipes
      if (!forceGenerate) {
        const hasRecent = await this.hasRecentRecipes(userId);
        if (hasRecent) {
          console.log('Using recent cached recipes for user:', userId);
          const cachedRecipes = await this.getLatestRecipes(userId);
          if (cachedRecipes) {
            return cachedRecipes;
          }
        }
      }
      
      // Generate new recipes
      console.log('Generating new recipes for user:', userId);
      return await this.generateRecipeSuggestions(userId);
    } catch (error) {
      console.error('Error getting or generating recipes:', error);
      
      // Fallback: try to get any existing recipes
      const existingRecipes = await this.getLatestRecipes(userId);
      if (existingRecipes) {
        console.log('Using existing recipes as fallback');
        return existingRecipes;
      }
      
      throw error;
    }
  }

  /**
   * Regenerate image for a specific recipe
   */
  static async regenerateRecipeImage(recipeName: string, description: string, ingredients: string[]): Promise<string> {
    try {
      console.log(`Regenerating image for recipe: ${recipeName}`);
      return await this.generateRecipeImage(recipeName, description, ingredients);
    } catch (error) {
      console.error('Error regenerating recipe image:', error);
      throw error;
    }
  }
}