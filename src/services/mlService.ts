import { pool } from '../server';
import { KNNExpirationPredictor } from './mlModels/knnExpirationPredictor';
import { ConsumptionPredictor } from './mlModels/consumptionPredictor';
import { DataTransformer } from './mlModels/dataTransformer';

export class MLService {
  private static instance: MLService;
  private expirationPredictor: KNNExpirationPredictor;
  private consumptionPredictor: ConsumptionPredictor;
  private isModelsTrained: boolean = false;
  private lastTrainingTime: Date | null = null;
  
  private constructor() {
    this.expirationPredictor = new KNNExpirationPredictor(5); // k=5 neighbors
    this.consumptionPredictor = new ConsumptionPredictor();
  }
  
  /**
   * Get the singleton instance of MLService
   */
  public static getInstance(): MLService {
    if (!MLService.instance) {
      MLService.instance = new MLService();
    }
    return MLService.instance;
  }
  
  /**
   * Train all models using the latest data from the database
   * This should be called periodically (e.g., daily or when significant new data is added)
   */
  public async trainModels(): Promise<void> {
    try {
      console.log('Training ML models with latest data...');
      
      // Fetch all consumption patterns
      const [consumptionPatterns]: any = await pool.execute(
        'SELECT * FROM consumption_patterns'
      );
      
      // Fetch all item events
      const [itemEvents]: any = await pool.execute(
        'SELECT * FROM item_events ORDER BY event_date DESC'
      );
      
      // Transform data for training
      const trainingData = DataTransformer.preprocessConsumptionData(
        consumptionPatterns, 
        itemEvents
      );
      
      // Train expiration predictor
      this.expirationPredictor.train(trainingData);
      
      // Train consumption predictor
      this.consumptionPredictor.train(consumptionPatterns, itemEvents);
      
      this.isModelsTrained = true;
      this.lastTrainingTime = new Date();
      
      console.log('ML models trained successfully.');
    } catch (error) {
      console.error('Error training ML models:', error);
      throw error;
    }
  }
  
  /**
   * Predict consumption trends for the next 7 days using simple moving average
   */
  public async predictConsumptionTrend(userId: string): Promise<any> {
    try {
      if (!this.isModelsTrained) {
        await this.trainModels();
      }
      
      // Get recent consumption events for the user
      const [events]: any = await pool.execute(
        `SELECT * FROM item_events 
         WHERE user_id = ? AND event_type = 'consume' 
         ORDER BY event_date DESC
         LIMIT 30`,
        [userId]
      );
      
      // Group by date
      const eventsByDate: {[key: string]: number} = {};
      
      events.forEach((event: any) => {
        const dateStr = new Date(event.event_date).toISOString().split('T')[0];
        eventsByDate[dateStr] = (eventsByDate[dateStr] || 0) + 1;
      });
      
      // Get last 14 days data for moving average
      const last14Days: number[] = [];
      
      const today = new Date();
      for (let i = 13; i >= 0; i--) {
        const date = new Date();
        date.setDate(today.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        last14Days.push(eventsByDate[dateStr] || 0);
      }
      
      // Calculate 7-day moving average
      const movingAverages: number[] = [];
      for (let i = 0; i < 8; i++) {
        const window = last14Days.slice(i, i + 7);
        const avg = window.reduce((sum, val) => sum + val, 0) / window.length;
        movingAverages.push(avg);
      }
      
      // Use moving average to predict next 7 days
      // Calculate trend line from the moving averages
      let trend = 0;
      if (movingAverages.length >= 2) {
        // Simple linear trend from start to end of moving averages
        trend = (movingAverages[movingAverages.length - 1] - movingAverages[0]) / (movingAverages.length - 1);
      }
      
      // Generate predictions for next 7 days
      const predictions: number[] = [];
      const lastMA = movingAverages[movingAverages.length - 1];
      
      for (let i = 1; i <= 7; i++) {
        // Predict using last MA + trend
        const predicted = Math.max(0, Math.round(lastMA + (trend * i)));
        predictions.push(predicted);
      }
      
      // Generate dates for the prediction
      const predictionDates: string[] = [];
      for (let i = 1; i <= 7; i++) {
        const date = new Date();
        date.setDate(today.getDate() + i);
        predictionDates.push(date.toISOString().split('T')[0]);
      }
      
      return {
        timestamp: new Date(),
        historical: {
          dates: last14Days.map((_, i) => {
            const date = new Date();
            date.setDate(today.getDate() - 13 + i);
            return date.toISOString().split('T')[0];
          }),
          values: last14Days
        },
        prediction: {
          dates: predictionDates,
          values: predictions
        },
        confidence: 0.6 // Fixed confidence for simple model
      };
    } catch (error) {
      console.error('Error predicting consumption trend:', error);
      
      // Return fallback prediction
      const today = new Date();
      const predictionDates: string[] = [];
      for (let i = 1; i <= 7; i++) {
        const date = new Date();
        date.setDate(today.getDate() + i);
        predictionDates.push(date.toISOString().split('T')[0]);
      }
      
      return {
        timestamp: new Date(),
        historical: {
          dates: [],
          values: []
        },
        prediction: {
          dates: predictionDates,
          values: [0, 0, 0, 0, 0, 0, 0]
        },
        error: 'Error generating prediction'
      };
    }
  }
  
  /**
   * Get inventory analysis with predictions for all items
   */
  public async analyzeInventory(userId: string): Promise<any> {
    try {
      if (!this.isModelsTrained) {
        await this.trainModels();
      }
      
      // Get all active items for this user
      const [items]: any = await pool.execute(
        `SELECT * FROM items 
         WHERE userId = ? AND status = 'active'
         ORDER BY expiryDate IS NULL, expiryDate ASC`,
        [userId]
      );
      
      if (items.length === 0) {
        return {
          timestamp: new Date(),
          items: [],
          summary: {
            total_items: 0,
            expiring_soon: 0,
            waste_risk: 0
          }
        };
      }
      
      // Get all consumption patterns for this user
      const [patterns]: any = await pool.execute(
        `SELECT * FROM consumption_patterns 
         WHERE user_id = ?`,
        [userId]
      );
      
      // Create a map of item name to pattern for faster lookups
      const patternMap = new Map();
      patterns.forEach((pattern: any) => {
        patternMap.set(pattern.item_name.toLowerCase(), pattern);
      });
      
      // Get item event counts by category
      const [categoryStats]: any = await pool.execute(
        `SELECT i.category, 
                COUNT(DISTINCT i.id) as item_count,
                COUNT(CASE WHEN e.event_type = 'consume' THEN 1 END) as consume_count,
                COUNT(CASE WHEN e.event_type = 'expire' THEN 1 END) as expire_count
         FROM items i
         LEFT JOIN item_events e ON i.id = e.item_id
         WHERE i.userId = ?
         GROUP BY i.category`,
        [userId]
      );
      
      // Calculate waste risk by category
      const categoryWasteRisk = new Map();
      categoryStats.forEach((stat: any) => {
        const totalEvents = stat.consume_count + stat.expire_count;
        const wasteRisk = totalEvents > 0 ? stat.expire_count / totalEvents : 0;
        categoryWasteRisk.set(stat.category, wasteRisk);
      });
      
      // Analyze each item and make predictions
      const itemAnalyses = await Promise.all(items.map(async (item: any) => {
        try {
          // Find matching pattern
          const pattern = patternMap.get(item.name.toLowerCase());
          
          // Extract days until expiry
          const daysUntilExpiry = item.expiryDate 
            ? Math.max(0, Math.floor((new Date(item.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
            : null;
          
          // Create feature vector
          const featureVector = {
            item_id: item.id,
            item_name: item.name,
            category: item.category,
            consumption_count: pattern ? pattern.consumption_count : 0,
            average_consumption_days: pattern ? pattern.average_consumption_days : null,
            days_until_expiry: daysUntilExpiry,
            status: item.status,
            user_id: userId
          };
          
          // Get prediction
          const prediction = this.expirationPredictor.predict(featureVector);
          
          // Calculate category waste risk
          const categoryRisk = categoryWasteRisk.get(item.category) || 0;
          
          // Calculate overall risk score (combine prediction confidence and category risk)
          const riskScore = prediction.prediction === 'expire' 
            ? 0.7 * prediction.confidence + 0.3 * categoryRisk
            : 0.3 * categoryRisk - 0.1 * prediction.confidence;
          
          return {
            id: item.id,
            name: item.name,
            category: item.category,
            expiryDate: item.expiryDate,
            days_until_expiry: daysUntilExpiry,
            status: item.status,
            prediction: {
              outcome: prediction.prediction,
              confidence: prediction.confidence,
              days: prediction.days
            },
            consumption_stats: {
              avg_consumption_days: pattern ? pattern.average_consumption_days : null,
              consumption_count: pattern ? pattern.consumption_count : 0,
              last_consumed: pattern ? pattern.last_consumed : null
            },
            risk_score: riskScore,
            risk_level: riskScore > 0.7 ? 'high' : riskScore > 0.4 ? 'medium' : 'low'
          };
        } catch (error) {
          console.error(`Error analyzing item ${item.id}:`, error);
          return null;
        }
      }));
      
      // Filter out failed analyses
      const validAnalyses = itemAnalyses.filter(item => item !== null);
      
      // Sort by risk score (highest first)
      validAnalyses.sort((a, b) => b.risk_score - a.risk_score);
      
      // Calculate summary statistics
      const expiringSoon = validAnalyses.filter(item => 
        item.days_until_expiry !== null && item.days_until_expiry <= 7
      ).length;
      
      const highRiskItems = validAnalyses.filter(item => item.risk_level === 'high').length;
      const overallWasteRisk = validAnalyses.reduce((sum, item) => sum + item.risk_score, 0) / validAnalyses.length;
      
      return {
        timestamp: new Date(),
        items: validAnalyses,
        summary: {
          total_items: validAnalyses.length,
          expiring_soon: expiringSoon,
          high_risk_items: highRiskItems,
          waste_risk: overallWasteRisk,
          waste_risk_level: overallWasteRisk > 0.6 ? 'high' : overallWasteRisk > 0.3 ? 'medium' : 'low'
        },
        categories: Array.from(categoryWasteRisk.entries()).map(([category, risk]) => ({
          category,
          item_count: categoryStats.find((stat: any) => stat.category === category)?.item_count || 0,
          waste_risk: risk,
          risk_level: risk > 0.6 ? 'high' : risk > 0.3 ? 'medium' : 'low'
        }))
      };
    } catch (error) {
      console.error('Error analyzing inventory:', error);
      throw error;
    }
  }  /**
   * Calculate usage statistics from events
   */
  private calculateUsageStats(events: any[], item: any): any {
    if (events.length === 0) {
      return {
        avg_consumption_days: null,
        consumption_count: 0,
        last_consumed: null,
        typical_purchase_frequency: null
      };
    }
    
    // Calculate days between 'add' and 'consume' events for this item category
    const addConsumeIntervals: number[] = [];
    const consumeDates: Date[] = [];
    
    events.forEach(event => {
      if (event.event_type === 'consume') {
        consumeDates.push(new Date(event.event_date));
      }
    });
    
    // Sort by date (most recent first)
    consumeDates.sort((a, b) => b.getTime() - a.getTime());
    
    // Calculate intervals between consumptions
    const consumeIntervals: number[] = [];
    for (let i = 0; i < consumeDates.length - 1; i++) {
      const days = Math.floor(
        (consumeDates[i].getTime() - consumeDates[i + 1].getTime()) / (1000 * 60 * 60 * 24)
      );
      if (days > 0) {
        consumeIntervals.push(days);
      }
    }
    
    // Calculate typical consumption frequency (in days)
    const typicalFrequency = consumeIntervals.length > 0
      ? Math.round(consumeIntervals.reduce((sum, val) => sum + val, 0) / consumeIntervals.length)
      : null;
    
    // Get the date of the last consumption
    const lastConsumed = consumeDates.length > 0 ? consumeDates[0] : null;
    
    return {
      consumption_count: events.length,
      avg_consumption_days: addConsumeIntervals.length > 0
        ? Math.round(addConsumeIntervals.reduce((sum, val) => sum + val, 0) / addConsumeIntervals.length)
        : null,
      last_consumed: lastConsumed,
      typical_purchase_frequency: typicalFrequency,
      next_predicted_purchase: typicalFrequency && lastConsumed
        ? new Date(lastConsumed.getTime() + typicalFrequency * 24 * 60 * 60 * 1000)
        : null
    };
  }  /**
   * Predict item outcome (consume, expire, discard)
   */
  public async predictItemOutcome(userId: string, itemId: string): Promise<any> {
    try {
      if (!this.isModelsTrained) {
        await this.trainModels();
      }
      
      // Get item details
      const [itemRows]: any = await pool.execute(
        'SELECT * FROM items WHERE id = ?',
        [itemId]
      );
      
      if (itemRows.length === 0) {
        throw new Error(`Item with ID ${itemId} not found`);
      }
      
      const item = itemRows[0];
      
      // Get consumption pattern for this user+item
      const [patternRows]: any = await pool.execute(
        'SELECT * FROM consumption_patterns WHERE user_id = ? AND item_name = ?',
        [userId, item.name]
      );
      
      const pattern = patternRows.length > 0 ? patternRows[0] : null;
      
      // Get previous consumption events for this user and similar items
      const [eventRows]: any = await pool.execute(
        `SELECT e.* 
         FROM item_events e 
         JOIN items i ON e.item_id = i.id
         WHERE e.user_id = ? AND i.category = ? AND e.event_type = 'consume'
         ORDER BY e.event_date DESC
         LIMIT 10`,
        [userId, item.category]
      );
      
      // Create feature vector for prediction
      const featureVector = {
        item_id: itemId,
        item_name: item.name,
        category: item.category,
        consumption_count: pattern ? pattern.consumption_count : 0,
        average_consumption_days: pattern ? pattern.average_consumption_days : null,
        days_until_expiry: item.expiryDate 
          ? Math.max(0, Math.floor((new Date(item.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
          : null,
        status: item.status,
        user_id: userId
      };
      
      // Get prediction
      const prediction = this.expirationPredictor.predict(featureVector);
      
      // Calculate estimated date based on prediction
      const estimatedDate = new Date();
      estimatedDate.setDate(estimatedDate.getDate() + prediction.days);
      
      // Calculate usage stats from event history
      const usageStats = this.calculateUsageStats(eventRows, item);
      
      return {
        item_id: itemId,
        item_name: item.name,
        category: item.category,
        current_status: item.status,
        expiry_date: item.expiryDate,
        days_until_expiry: featureVector.days_until_expiry,
        prediction: prediction.prediction,
        confidence: prediction.confidence,
        estimated_days: prediction.days,
        estimated_date: estimatedDate,
        usage_stats: usageStats,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error predicting item outcome:', error);
      throw error;
    }
  }
  
  /**
   * Predict consumption patterns by category
   */
  public async predictConsumptionByCategory(userId: string): Promise<any> {
    try {
      if (!this.isModelsTrained) {
        await this.trainModels();
      }
      
      // Get all categories
      const [categoriesRows]: any = await pool.execute(
        `SELECT DISTINCT category 
         FROM consumption_patterns 
         WHERE user_id = ?
         ORDER BY category`,
        [userId]
      );
      
      const categories = categoriesRows.map((row: any) => row.category);
      
      // Get predictions for each category
      const categoryPredictions: {[key: string]: any} = {};
      
      for (const category of categories) {
        const result = this.consumptionPredictor.predictNextConsumption(userId, category);
        categoryPredictions[category] = result;
      }
      
      // Get overall prediction
      const overallPrediction = this.consumptionPredictor.predictNextConsumption(userId);
      
      return {
        timestamp: new Date(),
        overall: overallPrediction,
        by_category: categoryPredictions
      };
    } catch (error) {
      console.error('Error predicting consumption by category:', error);
      throw error;
    }
  }
  
  /**
   * Get consumption time series analysis for a specific category
   */
  public async getCategoryTimeSeries(userId: string, category: string): Promise<any> {
    try {
      // Get items in this category
      const [items]: any = await pool.execute(
        `SELECT * FROM items 
         WHERE userId = ? AND category = ?
         ORDER BY name`,
        [userId, category]
      );
      
      if (items.length === 0) {
        return {
          timestamp: new Date(),
          category,
          time_series: [],
          summary: {
            total_items: 0,
            total_events: 0
          }
        };
      }
      
      // Get all item IDs
      const itemIds = items.map((item: any) => item.id);
      
      // Get all consumption events for these items
      const [events]: any = await pool.execute(
        `SELECT e.*, i.name as item_name 
         FROM item_events e
         JOIN items i ON e.item_id = i.id
         WHERE e.user_id = ? 
         AND e.event_type = 'consume'
         AND e.item_id IN (?)
         ORDER BY e.event_date`,
        [userId, itemIds]
      );
      
      // Group by month
      const monthlyConsumption: {[key: string]: number} = {};
      
      events.forEach((event: any) => {
        const date = new Date(event.event_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        monthlyConsumption[monthKey] = (monthlyConsumption[monthKey] || 0) + 1;
      });
      
      // Convert to array
      const timeSeries = Object.entries(monthlyConsumption)
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => a.month.localeCompare(b.month));
      
      // Calculate average consumption per month
      const avgConsumption = timeSeries.length > 0
        ? timeSeries.reduce((sum, entry) => sum + entry.count, 0) / timeSeries.length
        : 0;
      
      return {
        timestamp: new Date(),
        category,
        time_series: timeSeries,
        summary: {
          total_items: items.length,
          total_events: events.length,
          avg_monthly_consumption: avgConsumption
        }
      };
    } catch (error) {
      console.error('Error getting category time series:', error);
      throw error;
    }
  }
  
  /**
   * Advanced Analytics: Get comprehensive consumption analysis
   */
  public async getComprehensiveAnalysis(userId: string): Promise<any> {
    try {
      // Get consumption trend prediction
      const consumptionTrend = await this.predictConsumptionTrend(userId);
      
      // Get category predictions
      const categoryPredictions = await this.predictConsumptionByCategory(userId);
      
      // Get all items with predicted outcomes
      const [itemRows]: any = await pool.execute(
        `SELECT * FROM items 
         WHERE userId = ? AND status = 'active'
         ORDER BY expiry_date`,
        [userId]
      );
      
      // Predict outcome for each item
      const itemPredictions = await Promise.all(
        itemRows.map(async (item: any) => {
          try {
            const prediction = await this.predictItemOutcome(userId, item.id);
            return {
              ...item,
              prediction
            };
          } catch (error) {
            console.error(`Error predicting outcome for item ${item.id}:`, error);
            return item;
          }
        })
      );
      
      // Group items by predicted outcome
      const groupedItems = {
        likely_consume: itemPredictions.filter(
          item => item.prediction && item.prediction.prediction === 'consume'
        ),
        likely_expire: itemPredictions.filter(
          item => item.prediction && item.prediction.prediction === 'expire'
        ),
        uncertain: itemPredictions.filter(
          item => !item.prediction || item.prediction.confidence < 0.6
        )
      };
      
      // Calculate waste risk
      const wasteRisk = groupedItems.likely_expire.length / 
        (groupedItems.likely_expire.length + groupedItems.likely_consume.length) || 0;
      
      return {
        timestamp: new Date(),
        consumption_trend: consumptionTrend,
        category_predictions: categoryPredictions,
        item_outcomes: groupedItems,
        analytics: {
          active_items: itemRows.length,
          waste_risk: wasteRisk,
          waste_risk_level: wasteRisk < 0.2 ? 'low' : wasteRisk < 0.5 ? 'medium' : 'high'
        }
      };
    } catch (error) {
      console.error('Error getting comprehensive analysis:', error);
      throw error;
    }
  }
}