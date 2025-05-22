import { Request, Response } from 'express';
import mysql from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

interface ItemRow extends RowDataPacket {
  id: string;
  userId: string;
  name: string;
  category: string;
  expiryDate: Date;
  imageUri: string | null;
  created_at: Date;
  status: string;
  barcode: string | null;
}

// Use the existing pool from server.ts instead of creating a new one
import { pool } from '../server';

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

export const itemController = {
  async getAllItems(req: Request, res: Response) {
    try {
      const userId = req.params.userId;
      const [rows] = await pool.query<ItemRow[]>('SELECT * FROM items WHERE userId = ?', [userId]);
      res.json({ success: true, data: rows });
    } catch (error) {
      console.error('Error fetching items:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch items' });
    }
  },

  async addItem(req: MulterRequest, res: Response) {
    try {
      console.log('Received request body:', req.body);
      console.log('Received file:', req.file);
  
      // When using FormData, the fields come as strings
      const userId = req.body.userId;
      const name = req.body.name;
      const category = req.body.category;
      const expiryDate = req.body.expiryDate;
      const status = req.body.status || 'active';
      const barcode = req.body.barcode || null;
      const file = req.file;
      const addMethod = req.body.addMethod || 'manual'; // New field to track how item was added
  
      console.log('Parsed fields:', { userId, name, category, expiryDate, status, barcode, addMethod });
  
      // Validate required fields
      if (!userId || !name) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          details: { 
            received: { userId, name },
            file: file ? 'present' : 'missing'
          },
        });
      }

      const id = uuidv4();
      const imageUri = file ? file.path : null;

      // Check if we're scanning a barcode that exists in the database
      if (barcode && addMethod === 'scan') {
        const [existingItems] = await pool.query<ItemRow[]>(
          'SELECT * FROM items_database WHERE barcode = ?',
          [barcode]
        );

        if (existingItems.length > 0) {
          // Barcode exists in database, use existing product information
          const existingItem = existingItems[0];
          
          // If expiryDate is present, add directly to items table
          if (expiryDate) {
            const [result] = await pool.query<ResultSetHeader>(
              'INSERT INTO items (id, userId, name, category, expiryDate, imageUri, barcode, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
              [id, userId, existingItem.name, existingItem.category || category || 'General', expiryDate, imageUri, barcode, status]
            );

            // Fetch and return the newly created item
            const [items] = await pool.query<ItemRow[]>(
              'SELECT * FROM items WHERE id = ?',
              [id]
            );
            
            return res.json({ 
              success: true, 
              data: items[0],
              source: 'database',
              message: 'Item added from database match'
            });
          }
        }
      }
      
      // Determine if item should go to pending or directly to items table
      if (!expiryDate || (addMethod === 'manual' || addMethod === 'photo')) {
        // No expiry date or added manually or via photo -> add to pending_items
        const [pendingResult] = await pool.query<ResultSetHeader>(
          `INSERT INTO pending_items (id, userId, name, category, barcode, imageUri, status, notes, added_by) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, userId, name, category || 'General', barcode, imageUri, 'pending', `Added via ${addMethod}`, userId]
        );

        // Also add to items table - remove barcode field from the query
        const [itemsResult] = await pool.query<ResultSetHeader>(
          'INSERT INTO items (id, userId, name, category, expiryDate, imageUri, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [id, userId, name, category || 'General', expiryDate || null, imageUri, status]
        );

        // Return success with pending flag
        return res.json({ 
          success: true, 
          data: {
            id,
            userId,
            name,
            category: category || 'General',
            barcode,
            imageUri,
            status: 'pending'
          },
          pending: true,
          message: 'Item added to inventory and pending queue for review'
        });
      } else {
        // Has expiry date and was scanned with barcode -> add directly to items
        const [result] = await pool.query<ResultSetHeader>(
          'INSERT INTO items (id, userId, name, category, expiryDate, imageUri, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [id, userId, name, category || 'General', expiryDate || null, imageUri, status]
        );

        // Fetch and return the newly created item
        const [items] = await pool.query<ItemRow[]>(
          'SELECT * FROM items WHERE id = ?',
          [id]
        );
        
        if (!items[0]) {
          throw new Error('Item was inserted but could not be retrieved');
        }

        return res.json({ 
          success: true, 
          data: items[0]
        });
      }
    } catch (error: any) {
      console.error('Error in addItem:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add item',
        details: error.message,
      });
    }
  },

  async updateItem(req: Request, res: Response) {
    try {
      const { id } = req.params;
      let updateFields = [];
      let queryParams = [];
      
      // Check which fields are present in the request body
      const { name, category, expiryDate, status } = req.body;
      
      if (name !== undefined) {
        updateFields.push('name = ?');
        queryParams.push(name);
      }
      
      if (category !== undefined) {
        updateFields.push('category = ?');
        queryParams.push(category);
      }
      
      if (expiryDate !== undefined) {
        updateFields.push('expiryDate = ?');
        queryParams.push(expiryDate);
      }
      
      if (status !== undefined) {
        updateFields.push('status = ?');
        queryParams.push(status);
      }
      
      // If no fields to update, return error
      if (updateFields.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'No fields to update provided'
        });
      }
      
      // Add id as the last parameter
      queryParams.push(id);
      
      // Create dynamic UPDATE query
      const updateQuery = `UPDATE items SET ${updateFields.join(', ')} WHERE id = ?`;
      console.log('Update query:', updateQuery, queryParams);
      
      const [result] = await pool.query<ResultSetHeader>(updateQuery, queryParams);

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, error: 'Item not found' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error updating item:', error);
      res.status(500).json({ success: false, error: 'Failed to update item' });
    }
  },

  async deleteItem(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const [result] = await pool.query<ResultSetHeader>(
        'DELETE FROM items WHERE id = ?', 
        [id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, error: 'Item not found' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting item:', error);
      res.status(500).json({ success: false, error: 'Failed to delete item' });
    }
  }
};