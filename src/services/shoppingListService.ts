import { pool } from '../server';
import { ShoppingListService } from '../models/ShoppingList';
import { ConsumptionPatternService } from '../models/ConsumptionPattern';
import { PredictiveService } from '../services/predictiveService';

export class ShoppingListGenerator {
  /**
   * Generate a shopping list based on predictions and consumption patterns
   */
  static async generateShoppingList(userId: string): Promise<any> {
    try {
      // Get predictive insights
      const predictiveResults = await PredictiveService.generatePredictions(userId);
      const predictions = predictiveResults.predictions || [];
      
      // Get frequently consumed items
      const frequentItems = await ConsumptionPatternService.getFrequentItems(userId);
      
      // Get recently depleted items (marked as 'consumed' in the last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const [depletedItems]: any = await pool.execute(
        `SELECT i.name, i.category, e.event_date 
         FROM item_events e
         JOIN items i ON e.item_id = i.id
         WHERE e.userId = ? 
         AND e.event_type = 'consume'
         AND e.event_date > ?
         ORDER BY e.event_date DESC`,
        [userId, sevenDaysAgo.toISOString()]
      );
      
      // Create a list of items to add to the shopping list
      const shoppingItems: any[] = [];
      
      // Add items from predictions that need restocking soon
      predictions
        .filter((p: any) => p.needs_restocking && p.confidence > 0.3)
        .forEach((prediction: any) => {
          shoppingItems.push({
            item_name: prediction.item_name,
            category: prediction.category,
            reason: 'predicted',
            priority: prediction.days_until_depletion < 7 ? 3 : 2,
            quantity: ''
          });
        });
      
      // Add recently depleted items
      depletedItems.forEach((item: any) => {
        // Check if already added from predictions
        if (!shoppingItems.some(si => si.item_name.toLowerCase() === item.name.toLowerCase())) {
          shoppingItems.push({
            item_name: item.name,
            category: item.category,
            reason: 'depleted',
            priority: 2,
            quantity: ''
          });
        }
      });
      
      // Add frequently consumed items
      frequentItems
        .filter(pattern => pattern.consumption_count > 2)
        .slice(0, 5) // Top 5 frequently consumed
        .forEach(pattern => {
          // Check if already added
          if (!shoppingItems.some(si => si.item_name.toLowerCase() === pattern.item_name.toLowerCase())) {
            shoppingItems.push({
              item_name: pattern.item_name,
              category: pattern.category,
              reason: 'regular',
              priority: 1,
              quantity: ''
            });
          }
        });
      
      // Create a new shopping list
      const listName = `Shopping List ${new Date().toLocaleDateString()}`;
      const listId = await ShoppingListService.createList({
        user_id: userId,
        name: listName,
        is_active: true
      });
      
      // Add items to the shopping list
      for (const item of shoppingItems) {
        await ShoppingListService.addListItem({
          list_id: listId,
          item_name: item.item_name,
          category: item.category,
          quantity: item.quantity,
          is_checked: false,
          reason: item.reason,
          priority: item.priority
        });
      }
      
      // Get the complete list with items
      const list = await ShoppingListService.getListById(listId);
      const items = await ShoppingListService.getListItems(listId);
      
      return {
        list,
        items: items.sort((a, b) => b.priority - a.priority),
        summary: {
          total_items: items.length,
          predicted_items: items.filter(i => i.reason === 'predicted').length,
          depleted_items: items.filter(i => i.reason === 'depleted').length,
          regular_items: items.filter(i => i.reason === 'regular').length
        }
      };
    } catch (error) {
      console.error('Error generating shopping list:', error);
      throw error;
    }
  }
}