import { Request, Response } from 'express';
import { pool } from '../server';
import { RowDataPacket } from 'mysql2';

interface OpenFoodFactsRow extends RowDataPacket {
  id: string;
  barcode: string;
  name: string;
  category: string;
  image_uri: string;
  created_at: Date;
  updated_at: Date;
}

export const barcodeController = {
  async getProductByBarcode(req: Request, res: Response) {
    try {
      const { barcode } = req.params;
      
      if (!barcode) {
        return res.status(400).json({ 
          success: false, 
          error: 'Barcode is required' 
        });
      }
      
      console.log(`[DEBUG] Looking up barcode: ${barcode}`);
      
      // First check if the table exists and what columns it has
      try {
        const [tableInfo] = await pool.query(
          'DESCRIBE myexpirekits.items_database'
        );
        console.log('[DEBUG] Table structure:', JSON.stringify(tableInfo));
      } catch (error) {
        console.error('[DEBUG] Error checking table structure:', error);
      }
      
      // Adjusted query based on your screenshot - using the column names shown
      const [rows] = await pool.query<OpenFoodFactsRow[]>(
        'SELECT * FROM myexpirekits.items_database WHERE barcode = ? LIMIT 1',
        [barcode]
      );
      
      console.log(`[DEBUG] Query result for barcode ${barcode}:`, rows ? rows.length : 'no results');
      
      if (!rows || rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Product not found'
        });
      }
      
      const product = rows[0];
      console.log('[DEBUG] Product found:', JSON.stringify(product));
      
      // Format the category: remove 'en:' prefix and capitalize the first letter
      let formattedCategory = product.category;
      
      if (formattedCategory) {
        // Check if category starts with 'en:'
        if (formattedCategory.toLowerCase().startsWith('en:')) {
          // Remove 'en:' prefix
          formattedCategory = formattedCategory.substring(3);
        }
        
        // Capitalize the first letter of the category
        if (formattedCategory.length > 0) {
          formattedCategory = formattedCategory.charAt(0).toUpperCase() + formattedCategory.slice(1);
        }
      }
      
      // Transform to match the expected frontend format
      const result = {
        product_name: product.name,
        product_type: formattedCategory, // Using the formatted category
        image_front_url: product.image_uri
      };
      
      console.log('[DEBUG] Sending response:', JSON.stringify(result));
      res.json(result);
    } catch (error) {
      console.error('Error fetching product by barcode:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch product information'
      });
    }
  }
};