import { pool } from '../server';

export interface ConsumptionPattern {
  id?: number;
  user_id: string;
  item_name: string;
  category: string;
  average_consumption_days?: number | null;
  consumption_count: number;
  last_consumed?: Date;
  last_updated?: Date;
}

export class ConsumptionPatternService {
  /**
   * Update or create a consumption pattern record
   */
  static async updatePattern(pattern: ConsumptionPattern): Promise<void> {
    try {
      await pool.execute(
        `INSERT INTO consumption_patterns 
         (user_id, item_name, category, average_consumption_days, consumption_count, last_consumed) 
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           average_consumption_days = VALUES(average_consumption_days),
           consumption_count = consumption_count + 1,
           last_consumed = VALUES(last_consumed)`,
        [
          pattern.user_id,
          pattern.item_name,
          pattern.category,
          pattern.average_consumption_days || null,
          pattern.consumption_count || 1,
          pattern.last_consumed || new Date()
        ]
      );
    } catch (error) {
      console.error('Error updating consumption pattern:', error);
      throw error;
    }
  }

  /**
   * Get consumption patterns for a user
   */
  static async getUserPatterns(userId: string): Promise<ConsumptionPattern[]> {
    try {
      const [rows]: any = await pool.execute(
        `SELECT * FROM consumption_patterns 
         WHERE user_id = ? 
         ORDER BY consumption_count DESC`,
        [userId]
      );
      return rows;
    } catch (error) {
      console.error('Error getting consumption patterns:', error);
      throw error;
    }
  }

  /**
   * Get consumption statistics by category
   */
  static async getCategoryStats(userId: string): Promise<any[]> {
    try {
      const [rows]: any = await pool.execute(
        `SELECT 
           category, 
           SUM(consumption_count) as total_consumed,
           AVG(average_consumption_days) as avg_days_to_consume
         FROM consumption_patterns 
         WHERE user_id = ? 
         GROUP BY category
         ORDER BY total_consumed DESC`,
        [userId]
      );
      return rows;
    } catch (error) {
      console.error('Error getting category stats:', error);
      throw error;
    }
  }

  /**
   * Get most frequently consumed items
   */
  static async getFrequentItems(userId: string, limit: number = 5): Promise<ConsumptionPattern[]> {
    try {
      const [rows]: any = await pool.execute(
        `SELECT * FROM consumption_patterns 
         WHERE user_id = ? 
         ORDER BY consumption_count DESC
         LIMIT ${limit}`,  // Put the number directly in the query
        [userId]  // Only parameterize the userId
      );
      return rows;
    } catch (error) {
      console.error('Error getting frequent items:', error);
      throw error;
    }
  }

  /**
   * Calculate and update consumption pattern when an item is consumed
   */
  static async processConsumptionEvent(userId: string, itemId: string): Promise<void> {
    try {
      // Get item details
      const [itemRows]: any = await pool.execute(
        `SELECT id, name, category FROM items WHERE id = ?`,
        [itemId]
      );
      
      if (itemRows.length === 0) {
        throw new Error(`Item with ID ${itemId} not found`);
      }
      
      const item = itemRows[0];
      
      // Get item events to calculate average consumption days
      const [eventRows]: any = await pool.execute(
        `SELECT * FROM item_events 
         WHERE user_id = ? AND item_id = ? 
         ORDER BY event_date DESC`,
        [userId, itemId]
      );
      
      // Calculate average days between add and consume events
      let avgDays = null;
      if (eventRows.length >= 2) {
        // Find latest consume event
        const consumeEvents = eventRows.filter(
          (e: any) => e.event_type === 'consume'
        );
        
        // Find preceding add event
        if (consumeEvents.length > 0) {
          const consumeDate = new Date(consumeEvents[0].event_date);
          
          const addEvents = eventRows.filter(
            (e: any) => e.event_type === 'add' && new Date(e.event_date) < consumeDate
          );
          
          if (addEvents.length > 0) {
            // Sort by date (descending) to get the most recent add event before consumption
            addEvents.sort((a: any, b: any) => 
              new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
            );
            
            const addDate = new Date(addEvents[0].event_date);
            
            // Calculate days between add and consume
            const daysBetween = Math.ceil(
              (consumeDate.getTime() - addDate.getTime()) / (1000 * 3600 * 24)
            );
            
            avgDays = daysBetween;
          }
        }
      }
      
      // Update consumption pattern
      await this.updatePattern({
        user_id: userId,
        item_name: item.name,
        category: item.category,
        average_consumption_days: avgDays,
        consumption_count: 1,
        last_consumed: new Date()
      });
    } catch (error) {
      console.error('Error processing consumption event:', error);
      throw error;
    }
  }
}