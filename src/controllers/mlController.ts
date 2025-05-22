import { Request, Response } from 'express';
import { MLService } from '../services/mlService';
import { DataTransformer } from '../services/mlModels/dataTransformer';
import { pool } from '../server';

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