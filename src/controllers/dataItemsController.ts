import { Request, Response } from 'express';
import { pool } from '../server';

// Get all items from database
export const getAllItems = async (req: Request, res: Response) => {
  try {
    // Get pagination parameters from query string
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50; // Default 50 items per page
    const offset = (page - 1) * limit;

    // Validate pagination parameters
    if (page < 1) {
      return res.status(400).json({ 
        success: false, 
        message: 'Page number must be greater than 0' 
      });
    }

    if (limit < 1 || limit > 1000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Limit must be between 1 and 1000' 
      });
    }

    // Get total count for pagination info
    const [countResult]: any = await pool.execute(
      'SELECT COUNT(*) as total FROM items_database'
    );
    const totalItems = countResult[0].total;
    const totalPages = Math.ceil(totalItems / limit);

    // Execute paginated query to get items
    const [rows]: any = await pool.execute(
      `SELECT * FROM items_database 
       ORDER BY updated_at DESC 
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    // Return paginated response
    res.json({
      success: true,
      data: rows,
      pagination: {
        current_page: page,
        per_page: limit,
        total_items: totalItems,
        total_pages: totalPages,
        has_next_page: page < totalPages,
        has_prev_page: page > 1
      }
    });

  } catch (error) {
    console.error('Error fetching items from database:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch items data' 
    });
  }
};

// Get item by ID
export const getItemById = async (req: Request, res: Response) => {
  try {
    const itemId = req.params.id;
    
    if (!itemId) {
      return res.status(400).json({ message: 'Item ID is required' });
    }
    
    const [rows]: any = await pool.execute(
      'SELECT * FROM items_database WHERE id = ?',
      [itemId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Item not found' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching item details:', error);
    res.status(500).json({ message: 'Failed to fetch item details' });
  }
};

// Get items by category
export const getItemsByCategory = async (req: Request, res: Response) => {
  try {
    const category = req.params.category;
    
    if (!category) {
      return res.status(400).json({ message: 'Category is required' });
    }
    
    const [rows]: any = await pool.execute(
      'SELECT * FROM items_database WHERE category = ? ORDER BY updated_at DESC',
      [category]
    );
    
    res.json(rows);
  } catch (error) {
    console.error('Error fetching items by category:', error);
    res.status(500).json({ message: 'Failed to fetch items by category' });
  }
};

// Get all categories
export const getAllCategories = async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.execute(
      'SELECT DISTINCT category FROM items_database ORDER BY category'
    );
    
    // Extract just the category names
    const categories = rows.map((row: any) => row.category);
    
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Failed to fetch categories' });
  }
};

// Update item details
export const updateItem = async (req: Request, res: Response) => {
  try {
    const itemId = req.params.id;
    const { name, category, barcode, image_url, expiryDate } = req.body;
    
    if (!itemId) {
      return res.status(400).json({ message: 'Item ID is required' });
    }
    
    console.log('Updating item:', { id: itemId, data: req.body });
    
    // Check if all required fields are present
    if (!name || !category) {
      return res.status(400).json({ message: 'Name and category are required' });
    }
    
    // Include expiryDate in the SQL update
    await pool.execute(
      `UPDATE items_database 
       SET name = ?, 
           category = ?, 
           barcode = ?, 
           expiryDate = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [name, category, barcode || null, expiryDate || null, itemId]
    );
    
    // Fetch and return the updated item for confirmation
    const [updatedRows]: any = await pool.execute(
      'SELECT * FROM items_database WHERE id = ?',
      [itemId]
    );
    
    if (updatedRows.length === 0) {
      return res.status(404).json({ message: 'Item not found after update' });
    }
    
    res.json({ 
      message: 'Item updated successfully',
      item: updatedRows[0]
    });
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ 
    });
  }
};

// Delete an item
export const deleteItem = async (req: Request, res: Response) => {
  try {
    const itemId = req.params.id;
    
    if (!itemId) {
      return res.status(400).json({ message: 'Item ID is required' });
    }
    
    // Delete the item from the database
    await pool.execute(
      'DELETE FROM items_database WHERE id = ?',
      [itemId]
    );
    
    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ message: 'Failed to delete item' });
  }
};

// Add a new item
export const addItem = async (req: Request, res: Response) => {
    try {
      const { name, category, barcode, image_url } = req.body;
      
      if (!name || !category) {
        return res.status(400).json({ message: 'Name and category are required' });
      }
      
      // Fix: Change image_url to image_uri in the SQL statement
      const [result]: any = await pool.execute(
        `INSERT INTO items_database (name, category, barcode, image_uri, created_at, updated_at)
         VALUES (?, ?, ?, ?, NOW(), NOW())`,
        [name, category, barcode || null, image_url || null]
      );
      
      res.status(201).json({ 
        message: 'Item added successfully',
        id: result.insertId
      });
    } catch (error) {
      console.error('Error adding item:', error);
      res.status(500).json({ message: 'Failed to add item' });
    }
  };
