import { Request, Response } from 'express';
import { pool } from '../server';

interface PendingItem {
  id: string;
  userId: string;
  name: string;
  category: string;
  barcode: string | null;
  imageUri: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;
  notes: string | null;
  added_by: string | null;
}

export const pendingItemsController = {
  /**
   * Get all pending items (with optional status filter)
   */
  async getAllPendingItems(req: Request, res: Response) {
    try {
      // Get optional status filter
      const status = req.query.status as string | undefined;
      
      // Create query based on status filter
      let query = 'SELECT * FROM pending_items';
      const params: any[] = [];
      
      if (status && status !== 'all') {
        query += ' WHERE status = ?';
        params.push(status);
      }
      
      // Add order by created_at (newest first)
      query += ' ORDER BY created_at DESC';
      
      // Execute query
      const [rows]: any = await pool.execute(query, params);
      
      res.json({
        success: true,
        data: rows
      });
    } catch (error) {
      console.error('Error fetching pending items:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch pending items'
      });
    }
  },

  /**
   * Get a specific pending item by ID
   */
  async getPendingItemById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      const [rows]: any = await pool.execute(
        'SELECT * FROM pending_items WHERE id = ?',
        [id]
      );
      
      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Pending item not found'
        });
      }
      
      res.json({
        success: true,
        data: rows[0]
      });
    } catch (error) {
      console.error('Error fetching pending item:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch pending item'
      });
    }
  },

  /**
   * Approve a pending item and move it to the items table
   */
  async approvePendingItem(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { expiryDate, barcode } = req.body;
      
      // Validate that expiryDate is provided
      if (!expiryDate) {
        return res.status(400).json({
          success: false,
          error: 'Expiry date is required'
        });
      }
      
      console.log('Starting approval process for pending item:', id, 'with expiry date:', expiryDate);
      
      // Start a transaction
      const connection = await pool.getConnection();
      await connection.beginTransaction();
      
      try {
        // 1. Get the pending item
        const [pendingItems]: any = await connection.execute(
          'SELECT * FROM pending_items WHERE id = ?',
          [id]
        );
        
        if (pendingItems.length === 0) {
          console.log('Pending item not found:', id);
          await connection.rollback();
          connection.release();
          return res.status(404).json({
            success: false,
            error: 'Pending item not found'
          });
        }
        
        const pendingItem = pendingItems[0] as PendingItem;
        console.log('Found pending item:', pendingItem);
        
        // 2. Check if item is already processed
        if (pendingItem.status !== 'pending') {
          console.log('Item already processed with status:', pendingItem.status);
          await connection.rollback();
          connection.release();
          return res.status(400).json({
            success: false,
            error: `Item is already ${pendingItem.status}`
          });
        }
        
        // 3. Update pending item status
        await connection.execute(
          `UPDATE pending_items 
           SET status = ?, updated_at = NOW() 
           WHERE id = ?`,
          ['accepted', id]
        );
        
        console.log('Updated pending item status to accepted');
        
        // 4. Use the barcode from request if provided, otherwise use the one from pending item
        const barcodeToUse = barcode !== undefined ? barcode : pendingItem.barcode;
        
        console.log('Inserting into items_database with data:', {
          barcode: barcodeToUse,
          name: pendingItem.name,
          category: pendingItem.category,
          image_uri: pendingItem.imageUri,
          expiryDate: expiryDate
        });
        
        // 5. Insert into items_database table - using auto-increment for id
        const [result]: any = await connection.execute(
          `INSERT INTO items_database 
           (barcode, name, category, image_uri, created_at, updated_at, expiryDate) 
           VALUES (?, ?, ?, ?, NOW(), NOW(), ?)`,
          [
            barcodeToUse || '',  // Ensure barcode is never null
            pendingItem.name,
            pendingItem.category,
            pendingItem.imageUri || null,
            expiryDate
          ]
        );
        
        console.log('Insert result:', result);
        
        // Get the newly inserted ID
        const newItemId = result.insertId;
        console.log('New item ID:', newItemId);
        
        // Commit the transaction
        await connection.commit();
        console.log('Transaction committed successfully');
        
        res.json({
          success: true,
          message: 'Item approved and added to inventory',
          data: {
            id: newItemId,
            pendingItemId: id
          }
        });
      } catch (error) {
        // If there's an error, roll back the transaction
        console.error('Error during transaction:', error);
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error approving pending item:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to approve pending item'
      });
    }
  },

  /**
   * Reject a pending item
   */
  async rejectPendingItem(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      // 1. Get the pending item
      const [pendingItems]: any = await pool.execute(
        'SELECT * FROM pending_items WHERE id = ?',
        [id]
      );
      
      if (pendingItems.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Pending item not found'
        });
      }
      
      const pendingItem = pendingItems[0] as PendingItem;
      
      // 2. Check if item is already processed
      if (pendingItem.status !== 'pending') {
        return res.status(400).json({
          success: false,
          error: `Item is already ${pendingItem.status}`
        });
      }
      
      // 3. Update pending item status
      await pool.execute(
        `UPDATE pending_items 
         SET status = ?, updated_at = NOW() 
         WHERE id = ?`,
        ['rejected', id]
      );
      
      res.json({
        success: true,
        message: 'Item rejected'
      });
    } catch (error) {
      console.error('Error rejecting pending item:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reject pending item'
      });
    }
  }
};