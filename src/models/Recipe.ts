import { pool } from '../server';

export interface Recipe {
  id?: number;
  name: string;
  description?: string;
  instructions: string;
  preparation_time?: number;
  cooking_time?: number;
  servings?: number;
  image_url?: string;
  source_url?: string;
}

export interface RecipeIngredient {
  id?: number;
  recipe_id: number;
  ingredient_name: string;
  amount?: string;
  unit?: string;
}

export class RecipeService {
  /**
   * Get all recipes
   */
  static async getAllRecipes(): Promise<Recipe[]> {
    try {
      const [rows]: any = await pool.execute('SELECT * FROM recipes');
      return rows;
    } catch (error) {
      console.error('Error getting recipes:', error);
      throw error;
    }
  }

  /**
   * Get recipe by ID
   */
  static async getRecipeById(id: number): Promise<Recipe | null> {
    try {
      const [rows]: any = await pool.execute(
        'SELECT * FROM recipes WHERE id = ?',
        [id]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Error getting recipe by ID:', error);
      throw error;
    }
  }

  /**
   * Get ingredients for a recipe
   */
  static async getRecipeIngredients(recipeId: number): Promise<RecipeIngredient[]> {
    try {
      const [rows]: any = await pool.execute(
        'SELECT * FROM recipe_ingredients WHERE recipe_id = ?',
        [recipeId]
      );
      return rows;
    } catch (error) {
      console.error('Error getting recipe ingredients:', error);
      throw error;
    }
  }

  /**
   * Add a new recipe
   */
  static async addRecipe(recipe: Recipe): Promise<number> {
    try {
      const [result]: any = await pool.execute(
        `INSERT INTO recipes 
         (name, description, instructions, preparation_time, cooking_time, servings, image_url, source_url) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          recipe.name,
          recipe.description || null,
          recipe.instructions,
          recipe.preparation_time || null,
          recipe.cooking_time || null,
          recipe.servings || null,
          recipe.image_url || null,
          recipe.source_url || null
        ]
      );
      return result.insertId;
    } catch (error) {
      console.error('Error adding recipe:', error);
      throw error;
    }
  }

  /**
   * Add ingredient to recipe
   */
  static async addRecipeIngredient(ingredient: RecipeIngredient): Promise<number> {
    try {
      const [result]: any = await pool.execute(
        `INSERT INTO recipe_ingredients 
         (recipe_id, ingredient_name, amount, unit) 
         VALUES (?, ?, ?, ?)`,
        [
          ingredient.recipe_id,
          ingredient.ingredient_name,
          ingredient.amount || null,
          ingredient.unit || null
        ]
      );
      return result.insertId;
    } catch (error) {
      console.error('Error adding recipe ingredient:', error);
      throw error;
    }
  }
}