import { pool } from '../server';

export interface ShoppingList {
  id?: number;
  user_id: string;
  name: string;
  created_at?: Date;
  updated_at?: Date;
  is_active: boolean;
}

export interface ShoppingListItem {
  id?: number;
  list_id: number;
  item_name: string;
  category?: string;
  quantity?: string;
  is_checked: boolean;
  reason: 'predicted' | 'depleted' | 'regular' | 'manual';
  priority: number;
  added_at?: Date;
}

export class ShoppingListService {
  /**
   * Create a new shopping list
   */
  static async createList(list: ShoppingList): Promise<number> {
    try {
      const [result]: any = await pool.execute(
        `INSERT INTO shopping_lists (user_id, name, is_active) 
         VALUES (?, ?, ?)`,
        [list.user_id, list.name, list.is_active]
      );
      
      return result.insertId;
    } catch (error) {
      console.error('Error creating shopping list:', error);
      throw error;
    }
  }

  /**
   * Get all shopping lists for a user
   */
  static async getUserLists(userId: string): Promise<ShoppingList[]> {
    try {
      const [rows]: any = await pool.execute(
        `SELECT * FROM shopping_lists 
         WHERE user_id = ? 
         ORDER BY created_at DESC`,
        [userId]
      );
      return rows;
    } catch (error) {
      console.error('Error getting user shopping lists:', error);
      throw error;
    }
  }

  /**
   * Get a specific shopping list
   */
  static async getListById(listId: number): Promise<ShoppingList | null> {
    try {
      const [rows]: any = await pool.execute(
        `SELECT * FROM shopping_lists WHERE id = ?`,
        [listId]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Error getting shopping list:', error);
      throw error;
    }
  }

  /**
   * Add item to shopping list
   */
  static async addListItem(item: ShoppingListItem): Promise<number> {
    try {
      const [result]: any = await pool.execute(
        `INSERT INTO shopping_list_items 
         (list_id, item_name, category, quantity, is_checked, reason, priority) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          item.list_id,
          item.item_name,
          item.category || null,
          item.quantity || null,
          item.is_checked,
          item.reason,
          item.priority
        ]
      );
      
      return result.insertId;
    } catch (error) {
      console.error('Error adding shopping list item:', error);
      throw error;
    }
  }

  /**
   * Get items in a shopping list
   */
  static async getListItems(listId: number): Promise<ShoppingListItem[]> {
    try {
      const [rows]: any = await pool.execute(
        `SELECT * FROM shopping_list_items 
         WHERE list_id = ? 
         ORDER BY priority DESC, added_at DESC`,
        [listId]
      );
      return rows;
    } catch (error) {
      console.error('Error getting shopping list items:', error);
      throw error;
    }
  }

  /**
   * Update shopping list item
   */
  static async updateListItem(itemId: number, isChecked: boolean): Promise<void> {
    try {
      await pool.execute(
        `UPDATE shopping_list_items 
         SET is_checked = ? 
         WHERE id = ?`,
        [isChecked, itemId]
      );
    } catch (error) {
      console.error('Error updating shopping list item:', error);
      throw error;
    }
  }

  /**
   * Delete a shopping list
   */
  static async deleteList(listId: number): Promise<void> {
    try {
      await pool.execute(
        `DELETE FROM shopping_lists WHERE id = ?`,
        [listId]
      );
    } catch (error) {
      console.error('Error deleting shopping list:', error);
      throw error;
    }
  }
}