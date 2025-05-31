import dotenv from 'dotenv';
dotenv.config();

export class ImageService {
  private static readonly UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
  private static readonly BASE_URL = 'https://api.unsplash.com';
  
  /**
   * Get recipe image from Unsplash based on recipe name with randomization
   */
  static async getRecipeImage(recipeName: string, usedImages: Set<string> = new Set(), attemptNumber: number = 0): Promise<string | null> {
    try {
      if (!this.UNSPLASH_ACCESS_KEY) {
        console.warn('Unsplash access key not found');
        return null;
      }

      // Clean up recipe name for better search results
      const searchQuery = this.cleanRecipeNameForSearch(recipeName, attemptNumber);
      console.log(`Searching Unsplash for: ${searchQuery} (attempt ${attemptNumber + 1})`);
      
      // Add randomization by using different pages and per_page
      const page = Math.floor(Math.random() * 3) + 1; // Page 1-3
      const perPage = 5; // Get more results to choose from
      
      const response = await fetch(
        `${this.BASE_URL}/search/photos?query=${encodeURIComponent(searchQuery)}&per_page=${perPage}&page=${page}&orientation=landscape&content_filter=high`,
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
        // Try to find an unused image
        for (const result of data.results) {
          const imageUrl = result.urls.regular;
          if (!usedImages.has(imageUrl)) {
            console.log(`Found unique image for ${recipeName}: ${imageUrl}`);
            usedImages.add(imageUrl);
            return imageUrl;
          }
        }
        
        // If all images are used, take the first one anyway but log it
        const imageUrl = data.results[0].urls.regular;
        console.log(`Using potentially duplicate image for ${recipeName}: ${imageUrl}`);
        usedImages.add(imageUrl);
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
  static async getIngredientBasedImage(ingredients: string[], usedImages: Set<string> = new Set(), attemptNumber: number = 0): Promise<string | null> {
    try {
      if (!this.UNSPLASH_ACCESS_KEY || !ingredients.length) {
        return null;
      }

      // Extract main ingredients and create diverse search queries
      const mainIngredients = this.extractMainIngredients(ingredients);
      const searchStrategies = [
        `${mainIngredients.join(' ')} dish`,
        `${mainIngredients[0]} recipe`,
        `${mainIngredients.join(' ')} cooking`,
        `delicious ${mainIngredients[0]}`,
        `${mainIngredients[0]} meal`
      ];
      
      const searchQuery = searchStrategies[attemptNumber % searchStrategies.length];
      console.log(`Searching Unsplash by ingredients: ${searchQuery}`);
      
      const page = Math.floor(Math.random() * 3) + 1;
      
      const response = await fetch(
        `${this.BASE_URL}/search/photos?query=${encodeURIComponent(searchQuery)}&per_page=5&page=${page}&orientation=landscape&content_filter=high`,
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
        // Try to find an unused image
        for (const result of data.results) {
          const imageUrl = result.urls.regular;
          if (!usedImages.has(imageUrl)) {
            console.log(`Found unique ingredient-based image: ${imageUrl}`);
            usedImages.add(imageUrl);
            return imageUrl;
          }
        }
        
        // Fallback to first result if all are used
        const imageUrl = data.results[0].urls.regular;
        usedImages.add(imageUrl);
        return imageUrl;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching ingredient-based image:', error);
      return null;
    }
  }
  
  /**
   * Get a diverse food image based on recipe index
   */
  static async getDiverseFoodImage(recipeIndex: number, usedImages: Set<string> = new Set()): Promise<string> {
    try {
      if (!this.UNSPLASH_ACCESS_KEY) {
        return this.getDefaultPlaceholder();
      }

      const diverseQueries = [
        'delicious homemade food',
        'gourmet cooking dish',
        'fresh meal preparation',
        'tasty restaurant food',
        'healthy cooking recipe',
        'comfort food dish',
        'culinary arts food',
        'appetizing meal'
      ];
      
      const query = diverseQueries[recipeIndex % diverseQueries.length];
      const page = Math.floor(Math.random() * 5) + 1;
      
      console.log(`Getting diverse food image with query: ${query}, page: ${page}`);

      const response = await fetch(
        `${this.BASE_URL}/search/photos?query=${encodeURIComponent(query)}&per_page=10&page=${page}&orientation=landscape`,
        {
          headers: {
            'Authorization': `Client-ID ${this.UNSPLASH_ACCESS_KEY}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          // Try to find an unused image
          for (const result of data.results) {
            const imageUrl = result.urls.regular;
            if (!usedImages.has(imageUrl)) {
              usedImages.add(imageUrl);
              return imageUrl;
            }
          }
          
          // If all used, take a random one from results
          const randomIndex = Math.floor(Math.random() * data.results.length);
          const imageUrl = data.results[randomIndex].urls.regular;
          usedImages.add(imageUrl);
          return imageUrl;
        }
      }
      
      return this.getDefaultPlaceholder();
    } catch (error) {
      console.error('Error fetching diverse food image:', error);
      return this.getDefaultPlaceholder();
    }
  }
  
  /**
   * Clean recipe name for better search results with variation
   */
  private static cleanRecipeNameForSearch(recipeName: string, attemptNumber: number = 0): string {
    const baseName = recipeName
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove special characters
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
    
    // Different search strategies based on attempt number
    const strategies = [
      baseName, // Try exact name first
      `${baseName} recipe`,
      `${baseName} dish`,
      `homemade ${baseName}`,
      `delicious ${baseName}`
    ];
    
    return strategies[attemptNumber % strategies.length];
  }
  
  /**
   * Extract main ingredients from the ingredients list
   */
  private static extractMainIngredients(ingredients: string[]): string[] {
    const stopWords = ['cup', 'cups', 'tablespoon', 'tablespoons', 'tbsp', 'teaspoon', 'teaspoons', 'tsp', 
                      'pound', 'pounds', 'lb', 'lbs', 'ounce', 'ounces', 'oz', 'gram', 'grams', 'g',
                      'kilogram', 'kg', 'liter', 'liters', 'l', 'ml', 'milliliter', 'milliliters',
                      'piece', 'pieces', 'slice', 'slices', 'clove', 'cloves', 'bunch', 'large', 'small',
                      'medium', 'fresh', 'dried', 'chopped', 'diced', 'minced', 'sliced', 'grated', 'from', 'inventory'];
    
    const mainIngredients: string[] = [];
    
    for (let i = 0; i < Math.min(ingredients.length, 3); i++) {
      const ingredient = ingredients[i];
      
      // Extract the main ingredient name
      const words = ingredient.toLowerCase()
        .replace(/\([^)]*\)/g, '') // Remove parentheses content
        .split(' ');
      
      const significantWords = words.filter(word => 
        !stopWords.includes(word) && 
        !/^\d/.test(word) && // Not starting with number
        word.length > 2
      );
      
      if (significantWords.length > 0) {
        // Take the most significant word (prefer the last one, usually the ingredient name)
        const mainIngredient = significantWords[significantWords.length - 1];
        if (!mainIngredients.includes(mainIngredient)) {
          mainIngredients.push(mainIngredient);
        }
      }
    }
    
    return mainIngredients.slice(0, 3); // Return max 3 main ingredients
  }
  
  /**
   * Get default placeholder image URL
   */
  private static getDefaultPlaceholder(): string {
    // Array of diverse food placeholders
    const placeholders = [
      'https://images.unsplash.com/photo-1546549032-9571cd6b27df?w=500&h=300&fit=crop',
      'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=500&h=300&fit=crop',
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=500&h=300&fit=crop',
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=500&h=300&fit=crop'
    ];
    
    return placeholders[Math.floor(Math.random() * placeholders.length)];
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