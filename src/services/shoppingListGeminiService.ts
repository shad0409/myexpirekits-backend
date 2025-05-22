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

interface ShoppingListItem {
  name: string;
  category: string;
  quantity: string;
  estimatedPrice: number;
  nutritionalValue: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
  reason: string;
  priority: number;
  note?: string;
}

interface ShoppingListResult {
  items: ShoppingListItem[];
  totalEstimatedPrice: number;
  nutritionalSummary: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  categories: {
    categoryName: string;
    itemCount: number;
    totalPrice: number;
  }[];
  generated: Date;
}

class ShoppingListError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'ShoppingListError';
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ShoppingListError);
    }
    
    // Log the error immediately for debugging
    console.error(`[ShoppingListError] ${message}`);
    if (cause) {
      console.error('Caused by:', cause);
    }
  }
}

export class ShoppingListGeminiService {
  /**
   * Generate a shopping list based on items about to expire and already expired items
   */
  static async generateEnhancedShoppingList(userId: string): Promise<ShoppingListResult> {
    try {
      console.log('Starting shopping list generation for user:', userId);
      
      // Check for existing shopping list first
      const existingList = await this.getLatestShoppingList(userId);
      if (existingList) {
        console.log('Found existing shopping list, returning it');
        return existingList;
      }
      
      // Calculate the date for 1 week from now
      const oneWeekLater = new Date();
      oneWeekLater.setDate(oneWeekLater.getDate() + 7);
      const oneWeekLaterISO = oneWeekLater.toISOString().split('T')[0]; // Format as YYYY-MM-DD
      
      try {
        // Get items that will expire within a week (about to expire)
        const [aboutToExpireItems] = await pool.query<Item[]>(
          `SELECT * FROM items 
           WHERE userId = ? 
           AND status = 'active' 
           AND expiryDate IS NOT NULL 
           AND expiryDate <= ?
           ORDER BY expiryDate ASC`,
          [userId, oneWeekLaterISO]
        );
        
        // Get already expired items by checking status
        const [expiredItems] = await pool.query<Item[]>(
          `SELECT * FROM items 
           WHERE userId = ? 
           AND status = 'expired'
           ORDER BY expiryDate DESC`,
          [userId]
        );
        
        // Combine both lists
        const allRelevantItems = [...aboutToExpireItems, ...expiredItems];
        
        console.log(`Found ${aboutToExpireItems.length} items expiring within the next week`);
        console.log(`Found ${expiredItems.length} already expired items`);
        console.log(`Total items to consider for shopping list: ${allRelevantItems.length}`);
        
        // If no items to consider, return a basic empty shopping list
        if (allRelevantItems.length === 0) {
          const emptyList = {
            items: [],
            totalEstimatedPrice: 0,
            nutritionalSummary: {
              calories: 0,
              protein: 0,
              carbs: 0,
              fat: 0
            },
            categories: [],
            generated: new Date()
          };
          
          // Save empty list to database
          await this.saveShoppingListToDatabase(userId, emptyList);
          
          return emptyList;
        }
        
        // Prepare context for Gemini with all relevant items
        const context = {
          aboutToExpireItems: aboutToExpireItems.map(item => ({
            id: item.id,
            name: item.name,
            category: item.category,
            expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString() : null,
            status: "about to expire"
          })),
          expiredItems: expiredItems.map(item => ({
            id: item.id,
            name: item.name,
            category: item.category,
            expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString() : null,
            status: "expired"
          }))
        };
        
        // Create a prompt for Gemini that includes both categories of items
        const prompt = `
          Create a comprehensive shopping list to replace these items: 
          
          ITEMS THAT WILL EXPIRE SOON:
          ${aboutToExpireItems.map(item => `${item.name} (${item.category})`).join(', ')}
          
          ALREADY EXPIRED ITEMS:
          ${expiredItems.map(item => `${item.name} (${item.category})`).join(', ')}
          
          For each item on the shopping list include:
          - name
          - category (Produce, Dairy, Meat, etc.)
          - quantity (specific amount)
          - estimatedPrice (in Malaysian Ringgit)
          - nutritionalValue (calories, protein, carbs, fat)
          - reason (why this item is being suggested)
          - priority (1-3, with 3 being highest)
          
          Give higher priority (3) to items replacing already expired items, and medium priority (2) to items replacing soon-to-expire items.
          
          Your response must be a valid JSON object with this exact structure:
          {
            "items": [
              {
                "name": "Item name",
                "category": "Shopping category",
                "quantity": "Specific quantity",
                "estimatedPrice": 12.50,
                "nutritionalValue": {
                  "calories": 200,
                  "protein": 5,
                  "carbs": 30,
                  "fat": 2
                },
                "reason": "Replacement",
                "priority": 3,
                "note": "Optional note"
              }
            ],
            "totalEstimatedPrice": 135.75,
            "nutritionalSummary": {
              "calories": 2500,
              "protein": 125,
              "carbs": 300,
              "fat": 60
            },
            "categories": [
              {
                "categoryName": "Produce",
                "itemCount": 5,
                "totalPrice": 25.80
              }
            ]
          }
          
          IMPORTANT: Only respond with the JSON object. No other text, explanations, or markdown.
        `;
        
        console.log('Sending request to Gemini API...');
        
        try {
          // Generate shopping list using Gemini
          const response = await GeminiService.generateWithContext(prompt, context);
          console.log('Received response from Gemini API');
          
          try {
            // Extract the JSON content from the response
            const jsonStr = GeminiService.extractJsonFromResponse(response);
            console.log('Extracted JSON string, length:', jsonStr.length);
            
            // Debug: Log the first 100 characters of the extracted JSON
            console.log('First 100 chars of JSON:', jsonStr.substring(0, 100));
            
            // Parse the JSON
            const shoppingList = JSON.parse(jsonStr);
            console.log('Successfully parsed JSON');
            
            // Add generated timestamp
            const shoppingListWithTimestamp = {
              ...shoppingList,
              generated: new Date()
            };
            
            // Save to database
            await this.saveShoppingListToDatabase(userId, shoppingListWithTimestamp);
            
            // Return the result
            return shoppingListWithTimestamp;
          } catch (parseError) {
            console.error('Failed to parse Gemini response as JSON:', parseError);
            console.error('Raw response:', response);
            
            // Create a fallback shopping list
            const fallbackList = createFallbackShoppingList(allRelevantItems);
            
            // Save fallback list to database
            await this.saveShoppingListToDatabase(userId, fallbackList);
            
            return fallbackList;
          }
        } catch (geminiError) {
          console.error('Gemini API error:', geminiError);
          
          // Create a fallback shopping list
          const fallbackList = createFallbackShoppingList(allRelevantItems);
          
          // Save fallback list to database
          await this.saveShoppingListToDatabase(userId, fallbackList);
          
          return fallbackList;
        }
      } catch (dbError) {
        console.error('Database query error:', dbError);
        throw new ShoppingListError('Failed to query database for items', dbError);
      }
    } catch (error: unknown) {
      // This will catch all other errors
      console.error('Critical error in shopping list generation:', error);
      
      if (error instanceof ShoppingListError) {
        throw error; // Already formatted properly
      } else if (error instanceof Error) {
        throw new ShoppingListError(`Failed to generate shopping list: ${error.message}`, error);
      } else {
        throw new ShoppingListError('Failed to generate shopping list: Unknown error', error);
      }
    }
  }
  
  /**
   * Save generated shopping list to the database
   */
  private static async saveShoppingListToDatabase(userId: string, shoppingList: ShoppingListResult): Promise<void> {
    try {
      console.log(`Saving shopping list with ${shoppingList.items.length} items to database for user ${userId}`);
      
      // First, mark existing shopping lists as inactive
      await pool.execute(
        `UPDATE gemini_shopping_lists SET is_active = FALSE WHERE user_id = ?`,
        [userId]
      );
      
      // Convert the shopping list object to a JSON string - stringify ONLY ONCE
      const listDataJson = JSON.stringify(shoppingList);
      
      console.log('Shopping list data being saved to database:', listDataJson.substring(0, 100) + '...');
      
      // Insert new shopping list
      await pool.execute(
        `INSERT INTO gemini_shopping_lists (user_id, list_data) VALUES (?, ?)`,
        [userId, listDataJson]
      );
      
      console.log('Shopping list successfully saved to database');
    } catch (error) {
      console.error('Error saving shopping list to database:', error);
      throw error;
    }
  }
  
  /**
   * Get the latest generated shopping list for a user from the database
   */
  static async getLatestShoppingList(userId: string): Promise<ShoppingListResult | null> {
    try {
      console.log(`Fetching latest shopping list for user ${userId}`);
      
      const [rows]: any = await pool.execute(
        `SELECT list_data FROM gemini_shopping_lists 
         WHERE user_id = ? AND is_active = TRUE 
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );
      
      if (rows.length === 0) {
        console.log('No saved shopping list found for user');
        return null;
      }
      
      // Get the list_data string from the result
      const listDataStr = rows[0].list_data;
      
      console.log('Shopping list data from database type:', typeof listDataStr);
      console.log('Shopping list data preview:', typeof listDataStr === 'string' 
        ? listDataStr.substring(0, 100) + '...' 
        : JSON.stringify(listDataStr).substring(0, 100) + '...');
      
      try {
        // Parse the stored JSON - only parse if it's a string
        const listData = typeof listDataStr === 'string' 
          ? JSON.parse(listDataStr) 
          : listDataStr;
        
        console.log(`Found shopping list with ${listData.items?.length || 0} items`);
        
        // Ensure the generated field is a Date object
        if (listData.generated && typeof listData.generated === 'string') {
          listData.generated = new Date(listData.generated);
        }
        
        return listData;
      } catch (error) {
        console.error('Error parsing shopping list data from database:', error);
        console.error('Raw shopping list data:', listDataStr);
        throw error;
      }
    } catch (error) {
      console.error('Error fetching shopping list from database:', error);
      return null;
    }
  }
  
  /**
   * Force generate a new shopping list even if one already exists
   */
  static async generateNewShoppingList(userId: string): Promise<ShoppingListResult> {
    // Mark all existing shopping lists as inactive
    try {
      await pool.execute(
        `UPDATE gemini_shopping_lists SET is_active = FALSE WHERE user_id = ?`,
        [userId]
      );
      
      // Generate a new shopping list
      return this.generateEnhancedShoppingList(userId);
    } catch (error) {
      console.error('Error generating new shopping list:', error);
      throw error;
    }
  }
}

// Helper function to create a fallback shopping list
function createFallbackShoppingList(items: any[]): ShoppingListResult {
  console.log('Creating fallback shopping list with', items.length, 'items');
  
  // Create items to replace the provided items
  const shoppingItems: ShoppingListItem[] = items.map(item => {
    // Check item status to set appropriate priority
    const isExpired = item.status === 'expired';
    
    return {
      name: item.name,
      category: mapToShoppingCategory(item.category),
      quantity: '1',
      estimatedPrice: estimatePrice(item.category),
      nutritionalValue: {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0
      },
      reason: isExpired ? 'Replacement for expired item' : 'Replacement for soon-to-expire item',
      priority: isExpired ? 3 : 2, // Higher priority (3) for expired items
      note: isExpired 
        ? `Replacement for expired item: ${item.name}` 
        : `Replacement for item expiring soon: ${item.name}`
    };
  });
  
  // Add some basic staples if there aren't enough items
  if (shoppingItems.length < 5) {
    const staples = [
      { name: 'Rice', category: 'Pantry', price: 25.0 },
      { name: 'Bread', category: 'Bakery', price: 4.5 },
      { name: 'Milk', category: 'Dairy', price: 7.0 },
      { name: 'Eggs', category: 'Dairy', price: 12.0 },
      { name: 'Chicken', category: 'Meat', price: 15.0 }
    ];
    
    for (let i = 0; i < Math.min(5 - shoppingItems.length, staples.length); i++) {
      shoppingItems.push({
        name: staples[i].name,
        category: staples[i].category,
        quantity: '1',
        estimatedPrice: staples[i].price,
        nutritionalValue: {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0
        },
        reason: 'Basic staple',
        priority: 1,
        note: 'Recommended basic item'
      });
    }
  }
  
  // Calculate total price
  const totalEstimatedPrice = shoppingItems.reduce((total, item) => total + item.estimatedPrice, 0);
  
  // Group by category
  const categoryGroups: Record<string, { itemCount: number, totalPrice: number }> = {};
  shoppingItems.forEach(item => {
    if (!categoryGroups[item.category]) {
      categoryGroups[item.category] = {
        itemCount: 0,
        totalPrice: 0
      };
    }
    categoryGroups[item.category].itemCount++;
    categoryGroups[item.category].totalPrice += item.estimatedPrice;
  });
  
  const categorySummary = Object.entries(categoryGroups).map(([categoryName, data]) => ({
    categoryName,
    itemCount: data.itemCount,
    totalPrice: data.totalPrice
  }));
  
  console.log('Successfully created fallback shopping list with', shoppingItems.length, 'items');
  
  return {
    items: shoppingItems,
    totalEstimatedPrice,
    nutritionalSummary: {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0
    },
    categories: categorySummary,
    generated: new Date()
  };
}

// Helper function to map item category to shopping category
function mapToShoppingCategory(category: string): string {
  const categoryMap: Record<string, string> = {
    'Food': 'Grocery',
    'Dairy': 'Dairy',
    'Meat': 'Meat',
    'Vegetables': 'Produce',
    'Fruits': 'Produce',
    'Bakery': 'Bakery',
    'Beverages': 'Beverages',
    'Canned Goods': 'Pantry',
    'Snacks': 'Snacks',
    'Condiments': 'Pantry',
    'Cleaning': 'Household',
    'Personal Care': 'Personal Care',
    'Cosmetics': 'Personal Care',
    'Medication': 'Pharmacy'
  };
  
  return categoryMap[category] || 'General';
}

// Helper function to estimate price based on category
function estimatePrice(category: string): number {
  const priceMap: Record<string, number> = {
    'Food': 15.0,
    'Dairy': 8.5,
    'Meat': 25.0,
    'Vegetables': 6.0,
    'Fruits': 10.0,
    'Bakery': 5.5,
    'Beverages': 12.0,
    'Canned Goods': 7.5,
    'Snacks': 9.0,
    'Condiments': 8.0,
    'Cleaning': 15.0,
    'Personal Care': 18.0,
    'Cosmetics': 30.0,
    'Medication': 35.0
  };
  
  return priceMap[category] || 10.0;
}