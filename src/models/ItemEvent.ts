import { pool } from '../server';

export interface ItemEvent {
  id?: number;
  user_id: string;
  item_id: string;
  event_type: 'add' | 'consume' | 'expire' | 'discard';
  event_date?: Date;
  notes?: string;
}

export class ItemEventService {
  /**
   * Create a new item event
   */
  static async createEvent(event: ItemEvent): Promise<number> {
    try {
      const [result]: any = await pool.execute(
        `INSERT INTO item_events 
         (user_id, item_id, event_type, notes) 
         VALUES (?, ?, ?, ?)`,
        [event.user_id, event.item_id, event.event_type, event.notes || null]
      );
      
      return result.insertId;
    } catch (error) {
      console.error('Error creating item event:', error);
      throw error;
    }
  }

  /**
   * Get item events for a user
   */
  static async getUserEvents(userId: string, itemId?: string): Promise<ItemEvent[]> {
    try {
      let sql = `SELECT * FROM item_events WHERE user_id = ?`;
      const params: any[] = [userId];
      
      if (itemId) {
        sql += ` AND item_id = ?`;
        params.push(itemId);
      }
      
      sql += ` ORDER BY event_date DESC`;
      
      const [rows]: any = await pool.execute(sql, params);
      return rows;
    } catch (error) {
      console.error('Error getting item events:', error);
      throw error;
    }
  }

  /**
   * Get consumption events for a user
   */
  static async getConsumptionEvents(userId: string): Promise<ItemEvent[]> {
    try {
      const [rows]: any = await pool.execute(
        `SELECT * FROM item_events 
         WHERE user_id = ? AND event_type = 'consume'
         ORDER BY event_date DESC`,
        [userId]
      );
      return rows;
    } catch (error) {
      console.error('Error getting consumption events:', error);
      throw error;
    }
  }
}