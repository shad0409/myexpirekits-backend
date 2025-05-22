import { pool } from '../server';
import { ConsumptionPatternService } from '../models/ConsumptionPattern';
import { MLService } from '../services/mlService';

interface PredictionResult {
  item_id: string;
  item_name: string;
  category: string;
  days_until_depletion: number | null;
  confidence: number;
  needs_restocking: boolean;
  predicted_depletion_date?: Date;
}

export class PredictiveService {
  /**
   * Generate predictive insights about when items will need to be restocked
   */
  static async generatePredictions(userId: string): Promise<any> {
    try {
      // Get user's current inventory
      const [items]: any = await pool.execute(
        `SELECT * FROM items WHERE userId = ? AND status = 'active'`,
        [userId]
      );
      
      if (items.length === 0) {
        return {
          message: "No active items found in inventory",
          predictions: []
        };
      }
      
      // Get user's consumption patterns
      const patterns = await ConsumptionPatternService.getUserPatterns(userId);
      
      if (patterns.length === 0) {
        return {
          message: "No consumption patterns found. Start using items to generate predictions.",
          predictions: []
        };
      }
      
      // Generate predictions for each item
      const predictions: PredictionResult[] = [];
      
      for (const item of items) {
        // Find matching pattern for this item
        const pattern = patterns.find(p => 
          p.item_name.toLowerCase() === item.name.toLowerCase()
        );
        
        if (!pattern || pattern.consumption_count < 2) {
          // Not enough data for prediction
          predictions.push({
            item_id: item.id,
            item_name: item.name,
            category: item.category,
            days_until_depletion: null,
            confidence: 0,
            needs_restocking: false,
            predicted_depletion_date: undefined
          });
          continue;
        }
        
        // Calculate days until depletion based on average consumption
        const daysUntilDepletion = pattern.average_consumption_days || 30;
        
        // Calculate confidence based on number of consumption events
        // More consumption events = higher confidence
        const confidence = Math.min(pattern.consumption_count / 10, 1);
        
        // Calculate predicted depletion date
        const depletionDate = new Date();
        depletionDate.setDate(depletionDate.getDate() + daysUntilDepletion);
        
        predictions.push({
          item_id: item.id,
          item_name: item.name,
          category: item.category,
          days_until_depletion: daysUntilDepletion,
          confidence,
          needs_restocking: daysUntilDepletion < 14, // Flag if depletion within 2 weeks
          predicted_depletion_date: depletionDate
        });
      }
      
      // Sort predictions by days until depletion (ascending)
      predictions.sort((a, b) => {
        if (a.days_until_depletion === null) return 1;
        if (b.days_until_depletion === null) return -1;
        return a.days_until_depletion - b.days_until_depletion;
      });
      
      return {
        timestamp: new Date(),
        predictions,
        needsRestocking: predictions.filter(p => p.needs_restocking)
      };
    } catch (error) {
      console.error('Error generating predictions:', error);
      throw error;
    }
  }

  /**
   * Get items that are predicted to expire soon
   */
  static async getPredictedExpirations(userId: string): Promise<any> {
    try {
      // Get active items with expiration dates
      const [items]: any = await pool.execute(
        `SELECT * FROM items 
         WHERE userId = ? AND status = 'active' AND expiryDate IS NOT NULL
         ORDER BY expiryDate ASC`,
        [userId]
      );
      
      if (items.length === 0) {
        return {
          message: "No items with expiration dates found",
          expirations: []
        };
      }
      
      // Categorize items by expiration timeframe
      const today = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(today.getDate() + 7);
      const nextMonth = new Date();
      nextMonth.setDate(today.getDate() + 30);
      
      const expirations = {
        expired: [] as any[],
        thisWeek: [] as any[],
        thisMonth: [] as any[],
        later: [] as any[]
      };
      
      items.forEach((item: any) => {
        const expiryDate = new Date(item.expiryDate);
        
        if (expiryDate < today) {
          expirations.expired.push(item);
        } else if (expiryDate <= nextWeek) {
          expirations.thisWeek.push(item);
        } else if (expiryDate <= nextMonth) {
          expirations.thisMonth.push(item);
        } else {
          expirations.later.push(item);
        }
      });
      
      return {
        timestamp: new Date(),
        expirations,
        summary: {
          expired: expirations.expired.length,
          thisWeek: expirations.thisWeek.length,
          thisMonth: expirations.thisMonth.length,
          later: expirations.later.length
        }
      };
    } catch (error) {
      console.error('Error getting predicted expirations:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive inventory analysis with ML insights
   * This method integrates directly with mlService for advanced analytics
   */
  static async getInventoryAnalysis(userId: string): Promise<any> {
    try {
      // Try to use the ML service for advanced analysis
      const mlService = MLService.getInstance();
      return await mlService.analyzeInventory(userId);
    } catch (error) {
      console.error('Error using ML service for inventory analysis:', error);
      
      // Fall back to basic expiration prediction if ML service fails
      return this.getPredictedExpirations(userId);
    }
  }
}