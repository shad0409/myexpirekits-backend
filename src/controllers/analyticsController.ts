import { Request, Response } from 'express';
import { ConsumptionPatternService } from '../models/ConsumptionPattern';
import { ItemEventService } from '../models/ItemEvent';
import { pool } from '../server';
import { MLService } from '../services/mlService';

/**
 * Get consumption analytics for a user
 */
export const getConsumptionAnalytics = async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    // Get consumption patterns
    const patterns = await ConsumptionPatternService.getUserPatterns(userId);
    
    // Get category statistics
    const categoryStats = await ConsumptionPatternService.getCategoryStats(userId);
    
    // Get most frequently consumed items
    const frequentItems = await ConsumptionPatternService.getFrequentItems(userId, 5);
    
    // Get monthly consumption trends
    const [monthlyTrends]: any = await pool.execute(
      `SELECT 
         DATE_FORMAT(event_date, '%Y-%m') as month,
         COUNT(*) as consumption_count
       FROM item_events
       WHERE user_id = ? AND event_type = 'consume'
       GROUP BY DATE_FORMAT(event_date, '%Y-%m')
       ORDER BY month DESC
       LIMIT 6`,
      [userId]
    );
    
    // Get waste stats (expired items)
    const [wasteStats]: any = await pool.execute(
      `SELECT 
         i.category,
         COUNT(*) as expired_count
       FROM item_events e
       JOIN items i ON e.item_id = i.id
       WHERE e.user_id = ? AND e.event_type = 'expire'
       GROUP BY i.category`,
      [userId]
    );
    
    res.json({
      patterns,
      categoryStats,
      frequentItems,
      monthlyTrends,
      wasteStats,
      generated: new Date()
    });
  } catch (error) {
    console.error('Error getting consumption analytics:', error);
    res.status(500).json({ message: 'Failed to get consumption analytics' });
  }
};

/**
 * Process consumption event and update patterns
 */
export const processConsumption = async (req: Request, res: Response) => {
  try {
    const { user_id, item_id } = req.body;
    
    if (!user_id || !item_id) {
      return res.status(400).json({ message: 'User ID and Item ID are required' });
    }
    
    // Record the consumption event
    await ItemEventService.createEvent({
      user_id,
      item_id,
      event_type: 'consume'
    });
    
    // Update consumption patterns
    await ConsumptionPatternService.processConsumptionEvent(user_id, item_id);
    
    res.json({ message: 'Consumption processed successfully' });
  } catch (error) {
    console.error('Error processing consumption:', error);
    res.status(500).json({ message: 'Failed to process consumption' });
  }
};

/**
 * Get predictive insights about item outcomes
 */
export const getPredictiveInsights = async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    // Get active items
    const [itemRows]: any = await pool.execute(
      `SELECT * FROM items 
       WHERE userId = ? AND status = 'active'
       ORDER BY expiryDate`,
      [userId]
    );
    
    if (itemRows.length === 0) {
      return res.json({
        timestamp: new Date(),
        predictions: [],
        summary: {
          total_items: 0,
          at_risk_items: 0
        }
      });
    }
    
    // Get ML service instance
    const mlService = MLService.getInstance();
    
    // Predict outcome for each item
    const predictions = await Promise.all(
      itemRows.map(async (item: any) => {
        try {
          const prediction = await mlService.predictItemOutcome(userId, item.id);
          return prediction;
        } catch (error) {
          console.error(`Error predicting outcome for item ${item.id}:`, error);
          return null;
        }
      })
    );
    
    // Filter out null predictions
    const validPredictions = predictions.filter(p => p !== null);
    
    // Count at-risk items (likely to expire)
    const atRiskItems = validPredictions.filter(
      p => p.prediction === 'expire' && p.confidence > 0.6
    );
    
    res.json({
      timestamp: new Date(),
      predictions: validPredictions,
      summary: {
        total_items: itemRows.length,
        predicted_items: validPredictions.length,
        at_risk_items: atRiskItems.length
      }
    });
  } catch (error) {
    console.error('Error getting predictive insights:', error);
    res.status(500).json({ message: 'Failed to generate predictive insights' });
  }
};

/**
 * Get time series prediction for future consumption
 */
export const getConsumptionForecast = async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    // Get ML service instance
    const mlService = MLService.getInstance();
    
    // Get consumption trend prediction
    const prediction = await mlService.predictConsumptionTrend(userId);
    
    res.json(prediction);
  } catch (error) {
    console.error('Error getting consumption forecast:', error);
    res.status(500).json({ message: 'Failed to generate consumption forecast' });
  }
};

/**
 * Get category-based time series analysis
 */
export const getCategoryAnalysis = async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;
    const category = req.query.category as string;
    
    if (!userId || !category) {
      return res.status(400).json({ 
        message: 'User ID and category are required' 
      });
    }
    
    // Get ML service instance
    const mlService = MLService.getInstance();
    
    // Get category time series
    const analysis = await mlService.getCategoryTimeSeries(userId, category);
    
    res.json(analysis);
  } catch (error) {
    console.error('Error getting category analysis:', error);
    res.status(500).json({ message: 'Failed to generate category analysis' });
  }
};

/**
 * Get comprehensive consumption analysis dashboard
 */
export const getComprehensiveAnalysis = async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    // Get ML service instance
    const mlService = MLService.getInstance();
    
    // Get comprehensive analysis
    const analysis = await mlService.getComprehensiveAnalysis(userId);
    
    res.json(analysis);
  } catch (error) {
    console.error('Error getting comprehensive analysis:', error);
    res.status(500).json({ message: 'Failed to generate comprehensive analysis' });
  }
};