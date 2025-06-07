import { Request, Response } from 'express';
import { MLService } from '../services/mlService';
import { DataTransformer } from '../services/mlModels/dataTransformer';
import { pool } from '../server';

interface ModelComparison {
  item_id: string;
  item_name: string;
  category: string;
  expiry_date: string | null;
  random_forest: {
    days_until_consumption: number | null;
    will_consume_within_7_days: boolean;
    confidence: number;
    has_historical_data: boolean;
  };
  knn: {
    predicted_outcome: string;
    confidence: number;
    risk_score: number;
    risk_level: string;
  } | null;
  agreement: {
    both_have_predictions: boolean;
    models_agree: boolean;
    confidence_difference: number | null;
  };
}

/**
 * Train ML models with latest data
 */
export const trainModels = async (req: Request, res: Response) => {
  try {
    const mlService = MLService.getInstance();
    await mlService.trainModels();
    
    res.json({
      message: 'ML models trained successfully',
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error training ML models:', error);
    res.status(500).json({ message: 'Failed to train ML models' });
  }
};

/**
 * Predict item outcome (consume, expire, discard)
 */
export const predictItemOutcome = async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;
    const itemId = req.query.item_id as string;
    
    if (!userId || !itemId) {
      return res.status(400).json({ message: 'User ID and Item ID are required' });
    }
    
    const mlService = MLService.getInstance();
    const prediction = await mlService.predictItemOutcome(userId, itemId);
    
    res.json(prediction);
  } catch (error) {
    console.error('Error predicting item outcome:', error);
    res.status(500).json({ message: 'Failed to predict item outcome' });
  }
};

/**
 * Predict consumption patterns by category
 */
export const predictConsumptionByCategory = async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;
    const category = req.query.category as string | undefined;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    const mlService = MLService.getInstance();
    const prediction = await mlService.predictConsumptionByCategory(userId);
    
    // If category specified, filter the results
    if (category && prediction.by_category && prediction.by_category[category]) {
      res.json(prediction.by_category[category]);
    } else {
      res.json(prediction);
    }
  } catch (error) {
    console.error('Error predicting consumption by category:', error);
    res.status(500).json({ message: 'Failed to predict consumption patterns' });
  }
};

/**
 * Get time series consumption forecast
 */
export const getConsumptionForecast = async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    const mlService = MLService.getInstance();
    const forecast = await mlService.predictConsumptionTrend(userId);
    
    res.json(forecast);
  } catch (error) {
    console.error('Error getting consumption forecast:', error);
    res.status(500).json({ message: 'Failed to generate consumption forecast' });
  }
};

/**
 * Get consumption time series for a specific category
 */
export const getCategoryTimeSeries = async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;
    const category = req.query.category as string;
    
    if (!userId || !category) {
      return res.status(400).json({ message: 'User ID and category are required' });
    }
    
    const mlService = MLService.getInstance();
    const timeSeries = await mlService.getCategoryTimeSeries(userId, category);
    
    res.json(timeSeries);
  } catch (error) {
    console.error('Error getting category time series:', error);
    res.status(500).json({ message: 'Failed to get category time series' });
  }
};

/**
 * Get comprehensive consumption analysis
 */
export const getComprehensiveAnalysis = async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    const mlService = MLService.getInstance();
    const analysis = await mlService.getComprehensiveAnalysis(userId);
    
    res.json(analysis);
  } catch (error) {
    console.error('Error getting comprehensive analysis:', error);
    res.status(500).json({ message: 'Failed to generate comprehensive analysis' });
  }
};

/**
 * Get weekly consumption patterns
 */
export const getWeeklyPatterns = async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    // Get user's item events
    const [events]: any = await pool.execute(
      `SELECT * FROM item_events 
       WHERE user_id = ? AND event_type = 'consume'
       ORDER BY event_date DESC`,
      [userId]
    );
    
    // Calculate weekly patterns using DataTransformer
    const weeklyPattern = DataTransformer.calculateWeeklyPattern(events);
    
    // Get day names for the pattern
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Format response
    const patternResponse = days.map((day, index) => ({
      day,
      value: weeklyPattern[index]
    }));
    
    // Find most and least active days
    let maxIndex = 0;
    let minIndex = 0;
    
    weeklyPattern.forEach((value, index) => {
      if (value > weeklyPattern[maxIndex]) maxIndex = index;
      if (value < weeklyPattern[minIndex]) minIndex = index;
    });
    
    res.json({
      timestamp: new Date(),
      pattern: patternResponse,
      most_active_day: days[maxIndex],
      least_active_day: days[minIndex]
    });
  } catch (error) {
    console.error('Error getting weekly patterns:', error);
    res.status(500).json({ message: 'Failed to get weekly consumption patterns' });
  }
};

/**
 * Analyze user's inventory with predictions for all items
 */
export const analyzeInventory = async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    const mlService = MLService.getInstance();
    const analysis = await mlService.analyzeInventory(userId);
    
    res.json(analysis);
  } catch (error) {
    console.error('Error analyzing inventory:', error);
    res.status(500).json({ message: 'Failed to analyze inventory' });
  }
};

// Add these new controller methods to your existing mlController.ts

/**
 * Get Random Forest predictions for active inventory
 */
export const getRandomForestPredictions = async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    console.log(`Getting Random Forest predictions for user ${userId}`);
    const mlService = MLService.getInstance();
    const predictions = await mlService.getRandomForestPredictions(userId);
    
    res.json(predictions);
  } catch (error) {
    console.error('Error getting Random Forest predictions:', error);
    res.status(500).json({ 
      message: 'Failed to get Random Forest predictions',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get enhanced comprehensive analysis with all ML models
 */
export const getEnhancedComprehensiveAnalysis = async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    console.log(`Getting enhanced comprehensive analysis for user ${userId}`);
    const mlService = MLService.getInstance();
    const analysis = await mlService.getComprehensiveAnalysis(userId);
    
    res.json({
      ...analysis,
      ml_models_used: [
        'Random Forest (consumption timing)',
        'KNN (item outcome prediction)', 
        'ConsumptionPredictor (category patterns)',
        'Statistical (trend analysis)'
      ],
      predictions_explanation: {
        random_forest: 'Predicts days until consumption and likelihood of consumption within 7 days',
        knn: 'Predicts whether items will be consumed or expire based on historical patterns',
        statistical: 'Provides consumption trend forecasts using moving averages',
        consumption_predictor: 'Analyzes consumption patterns by category'
      }
    });
  } catch (error) {
    console.error('Error getting enhanced comprehensive analysis:', error);
    res.status(500).json({ 
      message: 'Failed to get enhanced comprehensive analysis',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Compare predictions between different ML models for same items
 */
export const compareMLModels = async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    console.log(`Comparing ML models for user ${userId}`);
    const mlService = MLService.getInstance();
    
    // Get predictions from both models
    const [rfPredictions, inventoryAnalysis] = await Promise.all([
      mlService.getRandomForestPredictions(userId),
      mlService.analyzeInventory(userId)
    ]);
    
    // Compare predictions for same items
    const comparisons: ModelComparison[] = rfPredictions.predictions.map((rfPred: any) => {
      const knnItem = inventoryAnalysis.items.find((item: any) => item.id === rfPred.item_id);
      
      return {
        item_id: rfPred.item_id,
        item_name: rfPred.item_name,
        category: rfPred.category,
        expiry_date: rfPred.expiry_date,
        
        // Random Forest predictions
        random_forest: {
          days_until_consumption: rfPred.days_until_consumption,
          will_consume_within_7_days: rfPred.will_consume_within_7_days,
          confidence: rfPred.confidence,
          has_historical_data: rfPred.days_until_consumption !== null
        },
        
        // KNN predictions
        knn: knnItem ? {
          predicted_outcome: knnItem.prediction.outcome,
          confidence: knnItem.prediction.confidence,
          risk_score: knnItem.risk_score,
          risk_level: knnItem.risk_level
        } : null,
        
        // Agreement analysis
        agreement: {
          both_have_predictions: rfPred.days_until_consumption !== null && knnItem !== null,
          models_agree: rfPred.will_consume_within_7_days === (knnItem?.prediction.outcome === 'consume'),
          confidence_difference: knnItem ? Math.abs(rfPred.confidence - knnItem.prediction.confidence) : null
        }
      };
    });
    
    // Calculate summary statistics with proper typing
    const totalItems = comparisons.length;
    const itemsWithBothPredictions = comparisons.filter((c: ModelComparison) => c.agreement.both_have_predictions).length;
    const agreementCount = comparisons.filter((c: ModelComparison) => c.agreement.models_agree).length;
    
    res.json({
      timestamp: new Date(),
      total_items: totalItems,
      items_with_both_predictions: itemsWithBothPredictions,
      model_agreement_rate: itemsWithBothPredictions > 0 ? agreementCount / itemsWithBothPredictions : 0,
      comparisons,
      summary: {
        random_forest_predictions: rfPredictions.summary,
        knn_predictions: {
          total_items: inventoryAnalysis.summary.total_items,
          high_risk_items: inventoryAnalysis.summary.high_risk_items,
          waste_risk_level: inventoryAnalysis.summary.waste_risk_level
        }
      }
    });
  } catch (error) {
    console.error('Error comparing ML models:', error);
    res.status(500).json({ 
      message: 'Failed to compare ML models',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};