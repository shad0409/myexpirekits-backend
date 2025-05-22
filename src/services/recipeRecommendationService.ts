import { pool } from '../server';
import { RecipeService } from '../models/Recipe';

interface Item {
    id: string;
    name: string;
    category: string;
    expiry_date?: string | Date | null;
    status: string;
    user_id: string;
  }

interface RecipeMatch {
  recipe_id: number;
  recipe_name: string;
  match_score: number;
  matching_ingredients: number;
  total_ingredients: number;
  uses_expiring_items: boolean;
  expiring_items_used: number;
}

export class RecipeRecommendationService {
  /**
   * Find recipes that match user's inventory items, especially those nearing expiration
   */
  static async findMatchingRecipes(userId: string): Promise<any> {
    try {
      // Get user's inventory (focus on food items)
      const [items]: any = await pool.execute(
        `SELECT * FROM items 
         WHERE userId = ? AND category = 'Food' AND status = 'active'`,
        [userId]
      );
      
      if (items.length === 0) {
        return {
          message: "No food items in inventory",
          recipes: []
        };
      }
      
      // Get expiring food items (within 7 days)
      const sevenDaysLater = new Date();
      sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
      
      const expiringItems = items.filter((item: Item) => {
        const expiryDate = item.expiry_date ? new Date(item.expiry_date) : null;
        return expiryDate && expiryDate <= sevenDaysLater;
      });
      
      // Get all item names
      const itemNames = items.map((item: Item) => item.name.toLowerCase());
      const expiringItemNames = expiringItems.map((item: Item) => item.name.toLowerCase());
      
      // Get all recipes
      const recipes = await RecipeService.getAllRecipes();
      
      if (recipes.length === 0) {
        return {
          message: "No recipes available",
          recipes: []
        };
      }
      
      // Calculate recipe matches
      const recipeMatches: RecipeMatch[] = [];
      
      for (const recipe of recipes) {
        const ingredients = await RecipeService.getRecipeIngredients(recipe.id!);
        const ingredientNames = ingredients.map(ing => ing.ingredient_name.toLowerCase());
        
        // Find matching ingredients
        const matchingItems = ingredientNames.filter(ing => 
          itemNames.some((item:string) => this.ingredientsMatch(item, ing))
        );
        
        // Find matching expiring ingredients
        const matchingExpiringItems = matchingItems.filter(ing => 
          expiringItemNames.some((item:string) => this.ingredientsMatch(item, ing))
        );
        
        // Calculate match score
        let matchScore = matchingItems.length / Math.max(1, Math.sqrt(ingredientNames.length));
        
        // Add bonus for recipes using expiring items (50% bonus per expiring item)
        if (matchingExpiringItems.length > 0) {
          matchScore += matchingExpiringItems.length * 0.5;
        }
        
        recipeMatches.push({
          recipe_id: recipe.id!,
          recipe_name: recipe.name,
          match_score: matchScore,
          matching_ingredients: matchingItems.length,
          total_ingredients: ingredientNames.length,
          uses_expiring_items: matchingExpiringItems.length > 0,
          expiring_items_used: matchingExpiringItems.length
        });
      }
      
      // Sort recipes by match score (descending)
      const sortedMatches = recipeMatches
        .filter(match => match.match_score > 0)
        .sort((a, b) => {
          // Prioritize recipes using expiring items
          if (a.uses_expiring_items && !b.uses_expiring_items) return -1;
          if (!a.uses_expiring_items && b.uses_expiring_items) return 1;
          
          // Then sort by match score
          return b.match_score - a.match_score;
        });
      
      // Get full details for top 10 recipes
      const topRecipes = [];
      for (const match of sortedMatches.slice(0, 10)) {
        const recipe = await RecipeService.getRecipeById(match.recipe_id);
        const ingredients = await RecipeService.getRecipeIngredients(match.recipe_id);
        
        topRecipes.push({
          ...match,
          recipe_details: recipe,
          ingredients: ingredients
        });
      }
      
      return {
        timestamp: new Date(),
        total_matches: sortedMatches.length,
        recipes: topRecipes
      };
    } catch (error) {
      console.error('Recipe recommendation error:', error);
      throw error;
    }
  }

  /**
   * Check if two ingredient names match
   * This handles cases like "tomato" matching "tomatoes" or "tomato sauce"
   */
  private static ingredientsMatch(item: string, ingredient: string): boolean {
    // Exact match
    if (item === ingredient) return true;
    
    // Check if one contains the other
    if (item.includes(ingredient) || ingredient.includes(item)) return true;
    
    // Remove plurals for comparison
    const singularItem = item.endsWith('s') ? item.slice(0, -1) : item;
    const singularIng = ingredient.endsWith('s') ? ingredient.slice(0, -1) : ingredient;
    
    if (singularItem === singularIng) return true;
    if (singularItem.includes(singularIng) || singularIng.includes(singularItem)) return true;
    
    return false;
  }

  /**
   * Add a sample recipe to the database (for testing)
   */
  static async addSampleRecipe(): Promise<number> {
    try {
      // Check if we already have recipes
      const [count]: any = await pool.execute('SELECT COUNT(*) as count FROM recipes');
      if (count[0].count > 0) {
        return -1; // Already have recipes
      }
      
      // Add a sample recipe
      const recipeId = await RecipeService.addRecipe({
        name: 'Classic Pasta with Tomato Sauce',
        description: 'A simple and delicious pasta dish with homemade tomato sauce',
        instructions: `
          1. Boil pasta according to package instructions
          2. In a pan, heat olive oil and add minced garlic
          3. Add diced tomatoes and simmer for 15 minutes
          4. Season with salt, pepper, and basil
          5. Combine pasta with sauce and serve with grated cheese
        `,
        preparation_time: 10,
        cooking_time: 20,
        servings: 4,
        image_url: 'https://example.com/pasta.jpg',
        source_url: 'https://example.com/pasta-recipe'
      });
      
      // Add ingredients
      const ingredients = [
        { name: 'Pasta', amount: '500', unit: 'g' },
        { name: 'Tomatoes', amount: '4', unit: 'large' },
        { name: 'Garlic', amount: '3', unit: 'cloves' },
        { name: 'Olive Oil', amount: '2', unit: 'tbsp' },
        { name: 'Basil', amount: '1', unit: 'bunch' },
        { name: 'Salt', amount: '1', unit: 'tsp' },
        { name: 'Pepper', amount: '1/2', unit: 'tsp' },
        { name: 'Parmesan Cheese', amount: '50', unit: 'g' }
      ];
      
      for (const ing of ingredients) {
        await RecipeService.addRecipeIngredient({
          recipe_id: recipeId,
          ingredient_name: ing.name,
          amount: ing.amount,
          unit: ing.unit
        });
      }
      
      return recipeId;
    } catch (error) {
      console.error('Error adding sample recipe:', error);
      throw error;
    }
  }
}