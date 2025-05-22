export class RecipeRecommender {
    private recipes: any[];
    private ingredientVectors: {[key: number]: string[]};
  
    constructor() {
      this.recipes = [];
      this.ingredientVectors = {};
    }
    
    // Add recipes to the recommender
    addRecipes(recipes: any[], recipeIngredients: any[]): RecipeRecommender {
      this.recipes = recipes;
      
      // Create ingredient vectors (recipe id -> list of ingredients)
      recipes.forEach(recipe => {
        const recipeId = recipe.id;
        const ingredients = recipeIngredients
          .filter(ing => ing.recipe_id === recipeId)
          .map(ing => ing.ingredient_name.toLowerCase());
        
        this.ingredientVectors[recipeId] = ingredients;
      });
      
      console.log(`Added ${recipes.length} recipes to recommender`);
      return this;
    }
    
    // Calculate Jaccard similarity between ingredient sets
    private calculateSimilarity(ingredients1: string[], ingredients2: string[]): number {
      const set1 = new Set(ingredients1);
      const set2 = new Set(ingredients2);
      
      // Calculate intersection size
      const intersection = new Set([...set1].filter(x => set2.has(x)));
      
      // Calculate union size
      const union = new Set([...set1, ...set2]);
      
      // Jaccard similarity: intersection size / union size
      return intersection.size / union.size;
    }
    
    // Find similar ingredients (handle plurals, variations)
    private findSimilarIngredients(ingredient: string, recipeIngredients: string[]): string[] {
      return recipeIngredients.filter(recipeIng => {
        // Exact match
        if (recipeIng === ingredient) return true;
        
        // One contains the other
        if (recipeIng.includes(ingredient) || ingredient.includes(recipeIng)) return true;
        
        // Handle plurals
        const singularIngredient = ingredient.endsWith('s') ? ingredient.slice(0, -1) : ingredient;
        const singularRecipeIng = recipeIng.endsWith('s') ? recipeIng.slice(0, -1) : recipeIng;
        
        return singularIngredient === singularRecipeIng || 
               singularIngredient.includes(singularRecipeIng) || 
               singularRecipeIng.includes(singularIngredient);
      });
    }
    
    // Recommend recipes based on available ingredients
    recommend(availableIngredients: string[], expiringIngredients: string[] = [], limit = 5): any[] {
      if (!availableIngredients || availableIngredients.length === 0) {
        return [];
      }
      
      // Convert ingredients to lowercase for matching
      const normalizedAvailable = availableIngredients.map(ing => ing.toLowerCase());
      const normalizedExpiring = expiringIngredients.map(ing => ing.toLowerCase());
      
      // Score recipes based on ingredient overlap
      const scores = this.recipes.map(recipe => {
        const recipeId = recipe.id;
        const recipeIngredients = this.ingredientVectors[recipeId] || [];
        
        // Calculate similarity with available ingredients
        const availableSimilarity = this.calculateSimilarity(
          normalizedAvailable, 
          recipeIngredients
        );
        
        // Calculate percentage of expiring ingredients used
        let expiringUsage = 0;
        if (normalizedExpiring.length > 0) {
          const usedExpiring = normalizedExpiring.filter(ing => 
            this.findSimilarIngredients(ing, recipeIngredients).length > 0
          );
          expiringUsage = usedExpiring.length / normalizedExpiring.length;
        }
        
        // Final score with higher weight on expiring ingredients
        const score = availableSimilarity * 0.4 + expiringUsage * 0.6;
        
        return {
          recipe,
          score,
          availableSimilarity,
          expiringUsage
        };
      });
      
      // Sort by score and take top recommendations
      return scores
        .filter(item => item.score > 0) // Only include recipes with some matching ingredients
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(item => ({
          ...item.recipe,
          match_score: item.score,
          expiring_usage: item.expiringUsage
        }));
    }
  }