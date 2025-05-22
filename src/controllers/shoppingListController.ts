import { Request, Response } from 'express';
import { ShoppingListService } from '../models/ShoppingList';
import { ShoppingListGenerator } from '../services/shoppingListService';

/**
 * Generate a new shopping list
 */
export const generateShoppingList = async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    const result = await ShoppingListGenerator.generateShoppingList(userId);
    res.json(result);
  } catch (error) {
    console.error('Error generating shopping list:', error);
    res.status(500).json({ message: 'Failed to generate shopping list' });
  }
};

/**
 * Get all shopping lists for a user
 */
export const getUserShoppingLists = async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    const lists = await ShoppingListService.getUserLists(userId);
    res.json(lists);
  } catch (error) {
    console.error('Error getting user shopping lists:', error);
    res.status(500).json({ message: 'Failed to get shopping lists' });
  }
};

/**
 * Get a specific shopping list with items
 */
export const getShoppingList = async (req: Request, res: Response) => {
  try {
    const listId = parseInt(req.params.id);
    
    const list = await ShoppingListService.getListById(listId);
    
    if (!list) {
      return res.status(404).json({ message: 'Shopping list not found' });
    }
    
    const items = await ShoppingListService.getListItems(listId);
    
    res.json({
      list,
      items
    });
  } catch (error) {
    console.error('Error getting shopping list:', error);
    res.status(500).json({ message: 'Failed to get shopping list' });
  }
};

/**
 * Update a shopping list item
 */
export const updateShoppingListItem = async (req: Request, res: Response) => {
  try {
    const itemId = parseInt(req.params.itemId);
    const { is_checked } = req.body;
    
    if (is_checked === undefined) {
      return res.status(400).json({ message: 'is_checked field is required' });
    }
    
    await ShoppingListService.updateListItem(itemId, is_checked);
    res.json({ message: 'Item updated successfully' });
  } catch (error) {
    console.error('Error updating shopping list item:', error);
    res.status(500).json({ message: 'Failed to update shopping list item' });
  }
};

/**
 * Delete a shopping list
 */
export const deleteShoppingList = async (req: Request, res: Response) => {
  try {
    const listId = parseInt(req.params.id);
    
    await ShoppingListService.deleteList(listId);
    res.json({ message: 'Shopping list deleted successfully' });
  } catch (error) {
    console.error('Error deleting shopping list:', error);
    res.status(500).json({ message: 'Failed to delete shopping list' });
  }
};