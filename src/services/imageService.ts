import dotenv from 'dotenv';
dotenv.config();

export class ImageService {
  private static readonly UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
  private static readonly BASE_URL = 'https://api.unsplash.com';
  
  /**
   * Get recipe image from Unsplash based on recipe name
   */
  static async getRecipeImage(recipeName: string): Promise<string | null> {
    try {
      if (!this.UNSPLASH_ACCESS_KEY) {
        console.warn('Unsplash access key not found');
        return null;
      }

      // Clean up recipe name for better search results
      const searchQuery = this.cleanRecipeNameForSearch(recipeName);
      console.log(`Searching Unsplash for: ${searchQuery}`);
      
      const response = await fetch(
        `${this.BASE_URL}/search/photos?query=${encodeURIComponent(searchQuery)}&per_page=3&orientation=landscape&content_filter=high`,
        {
          headers: {
            'Authorization': `Client-ID ${this.UNSPLASH_ACCESS_KEY}`
          }
        }
      );
      
      if (!response.ok) {
        console.error(`Unsplash API error: ${response.status} ${response.statusText}`);
        return null;
      }
      
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        // Return the regular size image URL
        const imageUrl = data.results[0].urls.regular;
        console.log(`Found image for ${recipeName}: ${imageUrl}`);
        return imageUrl;
      }
      
      console.log(`No images found for recipe: ${recipeName}`);
      return null;
    } catch (error) {
      console.error('Error fetching recipe image from Unsplash:', error);
      return null;
    }
  }
  
  /**
   * Get image based on main ingredients when recipe name fails
   */
  static async getIngredientBasedImage(ingredients: string[]): Promise<string | null> {
    try {
      if (!this.UNSPLASH_ACCESS_KEY || !ingredients.length) {
        return null;
      }

      // Extract main ingredients (first 2-3 key ingredients)
      const mainIngredients = this.extractMainIngredients(ingredients);
      const searchQuery = `${mainIngredients.join(' ')} food dish cooking`;
      
      console.log(`Searching Unsplash by ingredients: ${searchQuery}`);
      
      const response = await fetch(
        `${this.BASE_URL}/search/photos?query=${encodeURIComponent(searchQuery)}&per_page=3&orientation=landscape&content_filter=high`,
        {
          headers: {
            'Authorization': `Client-ID ${this.UNSPLASH_ACCESS_KEY}`
          }
        }
      );
      
      if (!response.ok) {
        return null;
      }
      
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        const imageUrl = data.results[0].urls.regular;
        console.log(`Found ingredient-based image: ${imageUrl}`);
        return imageUrl;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching ingredient-based image:', error);
      return null;
    }
  }
  
  /**
   * Get a generic food image as ultimate fallback
   */
  static async getGenericFoodImage(): Promise<string> {
    try {
      if (!this.UNSPLASH_ACCESS_KEY) {
        return this.getDefaultPlaceholder();
      }

      const response = await fetch(
        `${this.BASE_URL}/search/photos?query=delicious food cooking&per_page=1&orientation=landscape`,
        {
          headers: {
            'Authorization': `Client-ID ${this.UNSPLASH_ACCESS_KEY}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          return data.results[0].urls.regular;
        }
      }
      
      return this.getDefaultPlaceholder();
    } catch (error) {
      console.error('Error fetching generic food image:', error);
      return this.getDefaultPlaceholder();
    }
  }
  
  /**
   * Clean recipe name for better search results
   */
  private static cleanRecipeNameForSearch(recipeName: string): string {
    return recipeName
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove special characters
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim()
      + ' food recipe dish'; // Add food-related keywords
  }
  
  /**
   * Extract main ingredients from the ingredients list
   */
  private static extractMainIngredients(ingredients: string[]): string[] {
    const stopWords = ['cup', 'cups', 'tablespoon', 'tablespoons', 'tbsp', 'teaspoon', 'teaspoons', 'tsp', 
                      'pound', 'pounds', 'lb', 'lbs', 'ounce', 'ounces', 'oz', 'gram', 'grams', 'g',
                      'kilogram', 'kg', 'liter', 'liters', 'l', 'ml', 'milliliter', 'milliliters',
                      'piece', 'pieces', 'slice', 'slices', 'clove', 'cloves', 'bunch', 'large', 'small',
                      'medium', 'fresh', 'dried', 'chopped', 'diced', 'minced', 'sliced', 'grated'];
    
    const mainIngredients: string[] = [];
    
    for (let i = 0; i < Math.min(ingredients.length, 3); i++) {
      const ingredient = ingredients[i];
      
      // Extract the main ingredient name (usually the last significant word)
      const words = ingredient.toLowerCase().split(' ');
      const significantWords = words.filter(word => 
        !stopWords.includes(word) && 
        !/^\d/.test(word) && // Not starting with number
        word.length > 2
      );
      
      if (significantWords.length > 0) {
        // Take the last significant word (usually the ingredient name)
        const mainIngredient = significantWords[significantWords.length - 1];
        if (!mainIngredients.includes(mainIngredient)) {
          mainIngredients.push(mainIngredient);
        }
      }
    }
    
    return mainIngredients.slice(0, 2); // Return max 2 main ingredients
  }
  
  /**
   * Get default placeholder image URL
   */
  private static getDefaultPlaceholder(): string {
    // Using a reliable Unsplash food image as default
    return 'https://images.unsplash.com/photo-1546549032-9571cd6b27df?w=500&h=300&fit=crop';
  }
  
  /**
   * Validate if URL is accessible
   */
  static async validateImageUrl(imageUrl: string): Promise<boolean> {
    try {
      const response = await fetch(imageUrl, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}