import { RandomForestRegression, RandomForestClassifier } from 'ml-random-forest';

export interface ConsumptionFeatures {
  // Historical patterns
  average_consumption_days: number;
  consumption_count: number;
  days_since_last_consumed: number;
  
  // Category features (we'll encode these as numbers)
  category_encoded: number;
  
  // Time-based features
  day_of_week: number;        // 0-6
  month: number;              // 1-12
  is_weekend: number;         // 0 or 1
  
  // Item characteristics
  days_until_expiry: number;
  item_age_days: number;
  
  // User behavior patterns
  user_total_items: number;
  user_avg_consumption_frequency: number;
}

export interface TrainingDataPoint {
  features: number[];          // Feature array for Random Forest
  days_target: number;         // For regression: actual days until consumed
  classification_target: number; // For classification: 1 if consumed within 7 days, 0 otherwise
}

export class RandomForestConsumptionPredictor {
  private regressionModel: RandomForestRegression | null = null;
  private classificationModel: RandomForestClassifier | null = null;
  private categoryEncoder: Map<string, number> = new Map();
  
  /**
   * Encode category as number for Random Forest
   */
  private encodeCategoryAsNumber(category: string): number {
    if (!this.categoryEncoder.has(category)) {
      this.categoryEncoder.set(category, this.categoryEncoder.size);
    }
    return this.categoryEncoder.get(category)!;
  }
  
  /**
   * Convert features object to array for Random Forest
   */
  private featuresToArray(features: ConsumptionFeatures): number[] {
    return [
      features.average_consumption_days,
      features.consumption_count,
      features.days_since_last_consumed,
      features.category_encoded,
      features.day_of_week,
      features.month,
      features.is_weekend,
      features.days_until_expiry,
      features.item_age_days,
      features.user_total_items,
      features.user_avg_consumption_frequency
    ];
  }
  
  /**
   * Clean and validate feature array to ensure all values are numeric
   */
  private cleanFeatureArray(features: number[]): number[] {
    return features.map((value, index) => {
      // Handle null/undefined
      if (value === null || value === undefined) {
        return this.getDefaultFeatureValue(index);
      }
      
      // Handle NaN
      if (isNaN(value)) {
        return this.getDefaultFeatureValue(index);
      }
      
      // Handle Infinity
      if (!isFinite(value)) {
        return this.getDefaultFeatureValue(index);
      }
      
      // Ensure it's a number
      const numValue = Number(value);
      if (isNaN(numValue)) {
        return this.getDefaultFeatureValue(index);
      }
      
      return numValue;
    });
  }

  /**
   * Get default values for each feature index
   */
  private getDefaultFeatureValue(index: number): number {
    const defaults = [
      30,    // average_consumption_days
      1,     // consumption_count  
      30,    // days_since_last_consumed
      0,     // category_encoded
      1,     // day_of_week
      6,     // month
      0,     // is_weekend
      30,    // days_until_expiry
      0,     // item_age_days
      1,     // user_total_items
      30     // user_avg_consumption_frequency
    ];
    
    return defaults[index] || 0;
  }

  /**
   * Validate training data before passing to Random Forest
   */
  private validateTrainingData(trainingData: TrainingDataPoint[]): TrainingDataPoint[] {
    console.log('Validating and cleaning training data...');
    
    const cleanedData = trainingData.map((dataPoint, i) => {
      // Clean features
      const cleanedFeatures = this.cleanFeatureArray(dataPoint.features);
      
      // Clean targets
      let cleanedDaysTarget = dataPoint.days_target;
      let cleanedClassificationTarget = dataPoint.classification_target;
      
      // Validate days target
      if (isNaN(cleanedDaysTarget) || !isFinite(cleanedDaysTarget)) {
        cleanedDaysTarget = 30; // Default to 30 days
      }
      
      // Ensure days target is positive and reasonable
      cleanedDaysTarget = Math.max(1, Math.min(cleanedDaysTarget, 365));
      
      // Validate classification target (should be 0 or 1)
      if (cleanedClassificationTarget !== 0 && cleanedClassificationTarget !== 1) {
        cleanedClassificationTarget = cleanedDaysTarget <= 7 ? 1 : 0;
      }
      
      return {
        features: cleanedFeatures,
        days_target: cleanedDaysTarget,
        classification_target: cleanedClassificationTarget
      };
    }).filter(dataPoint => {
      // Final validation: ensure all features are numbers
      return dataPoint.features.every(f => typeof f === 'number' && isFinite(f));
    });
    
    console.log(`Cleaned data: ${cleanedData.length}/${trainingData.length} examples passed validation`);
    return cleanedData;
  }
  
  /**
   * Extract features from raw data
   */
  extractFeatures(
    pattern: any, 
    currentDate: Date, 
    item: any | null = null,
    userStats: any
  ): ConsumptionFeatures {
    const daysSinceLastConsumed = pattern.last_consumed 
      ? Math.floor((currentDate.getTime() - new Date(pattern.last_consumed).getTime()) / (1000 * 60 * 60 * 24))
      : 999; // Large number if never consumed
    
    const daysUntilExpiry = item?.expiryDate 
      ? Math.floor((new Date(item.expiryDate).getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24))
      : 365; // Default 1 year if no expiry
    
    const itemAgeDays = item?.created_at
      ? Math.floor((currentDate.getTime() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    
    return {
      average_consumption_days: pattern.average_consumption_days || 30,
      consumption_count: pattern.consumption_count || 0,
      days_since_last_consumed: daysSinceLastConsumed,
      category_encoded: this.encodeCategoryAsNumber(pattern.category),
      day_of_week: currentDate.getDay(),
      month: currentDate.getMonth() + 1,
      is_weekend: (currentDate.getDay() === 0 || currentDate.getDay() === 6) ? 1 : 0,
      days_until_expiry: Math.max(0, daysUntilExpiry),
      item_age_days: itemAgeDays,
      user_total_items: userStats.total_items || 0,
      user_avg_consumption_frequency: userStats.avg_frequency || 30
    };
  }

  /**
   * Generate training data from consumption patterns (since consumed items are deleted)
   */
  async prepareTrainingData(pool: any): Promise<TrainingDataPoint[]> {
    try {
      console.log('Generating training data from consumption patterns...');
      
      // Get all consumption patterns
      const [patterns]: any = await pool.execute(
        'SELECT * FROM consumption_patterns WHERE consumption_count > 0'
      );
      
      if (patterns.length === 0) {
        console.log('No consumption patterns found');
        return [];
      }
      
      console.log(`Found ${patterns.length} consumption patterns`);
      
      const trainingData: TrainingDataPoint[] = [];
      
      // For each pattern, generate multiple training examples
      for (const pattern of patterns) {
        try {
          // Get user stats
          const [userPatterns]: any = await pool.execute(
            'SELECT COUNT(*) as total_patterns, AVG(average_consumption_days) as avg_freq FROM consumption_patterns WHERE user_id = ?',
            [pattern.user_id]
          );
          
          const userStats = {
            total_items: userPatterns[0]?.total_patterns || 1,
            avg_frequency: userPatterns[0]?.avg_freq || 30
          };
          
          // Generate multiple training examples per pattern by simulating different scenarios
          const scenarios = [
            // Scenario 1: Just added (0 days since last consumed)
            { days_since_last: 0, month: 1, day_of_week: 1, is_weekend: 0 },
            // Scenario 2: Half the average consumption cycle
            { days_since_last: Math.floor((pattern.average_consumption_days || 30) / 2), month: 3, day_of_week: 3, is_weekend: 0 },
            // Scenario 3: Full average consumption cycle
            { days_since_last: pattern.average_consumption_days || 30, month: 6, day_of_week: 5, is_weekend: 1 },
            // Scenario 4: Overdue consumption
            { days_since_last: Math.floor((pattern.average_consumption_days || 30) * 1.5), month: 9, day_of_week: 0, is_weekend: 1 },
          ];
          
          for (const scenario of scenarios) {
            // Simulate different expiry scenarios
            const expiryScenarios = [30, 90, 180, 365]; // Days until expiry
            
            for (const daysUntilExpiry of expiryScenarios) {
              // Create features for this scenario
              const features: ConsumptionFeatures = {
                average_consumption_days: pattern.average_consumption_days || 30,
                consumption_count: pattern.consumption_count,
                days_since_last_consumed: scenario.days_since_last,
                category_encoded: this.encodeCategoryAsNumber(pattern.category),
                day_of_week: scenario.day_of_week,
                month: scenario.month,
                is_weekend: scenario.is_weekend,
                days_until_expiry: daysUntilExpiry,
                item_age_days: Math.max(0, scenario.days_since_last), // Assume item age = days since last consumed
                user_total_items: userStats.total_items,
                user_avg_consumption_frequency: userStats.avg_frequency
              };
              
              // Predict target based on consumption patterns
              // The logic: if someone usually consumes this item every X days, 
              // and it's been Y days since last consumed, they'll likely consume it in (X-Y) days
              
              let predictedDays = Math.max(1, (pattern.average_consumption_days || 30) - scenario.days_since_last);
              
              // Add some randomness based on consumption frequency
              if (pattern.consumption_count > 5) {
                // High consumption items are more predictable
                predictedDays = predictedDays + Math.floor(Math.random() * 3 - 1); // ±1 day variance
              } else {
                // Low consumption items have more variance
                predictedDays = predictedDays + Math.floor(Math.random() * 10 - 5); // ±5 days variance
              }
              
              // Ensure reasonable bounds
              predictedDays = Math.max(1, Math.min(predictedDays, 180));
              
              // Classification target: will consume within 7 days?
              const willConsumeWithin7Days = predictedDays <= 7 ? 1 : 0;
              
              const trainingPoint: TrainingDataPoint = {
                features: this.featuresToArray(features),
                days_target: predictedDays,
                classification_target: willConsumeWithin7Days
              };
              
              trainingData.push(trainingPoint);
            }
          }
          
        } catch (error) {
          console.error(`Error processing pattern for ${pattern.item_name}:`, error);
          continue;
        }
      }
      
      console.log(`Generated ${trainingData.length} synthetic training examples`);
      return trainingData;
      
    } catch (error) {
      console.error('Error preparing training data:', error);
      throw error;
    }
  }

  /**
   * Train both regression and classification models
   */
  async train(pool: any): Promise<void> {
    try {
      console.log('Training Random Forest consumption models...');
      
      // Prepare training data
      const rawTrainingData = await this.prepareTrainingData(pool);
      
      if (rawTrainingData.length < 10) {
        throw new Error(`Need at least 10 training examples, got ${rawTrainingData.length}`);
      }
      
      // Validate and clean the data
      const trainingData = this.validateTrainingData(rawTrainingData);
      
      if (trainingData.length < 10) {
        throw new Error(`After cleaning, only ${trainingData.length} valid examples remain`);
      }
      
      // Separate features and targets
      const features = trainingData.map(d => d.features);
      const regressionTargets = trainingData.map(d => d.days_target);
      const classificationTargets = trainingData.map(d => d.classification_target);
      
      console.log(`Training with ${features.length} clean examples`);
      console.log(`Feature sample:`, features[0]);
      console.log(`Regression target range: ${Math.min(...regressionTargets)} - ${Math.max(...regressionTargets)} days`);
      console.log(`Classification balance: ${classificationTargets.filter(t => t === 1).length} consumed within 7 days, ${classificationTargets.filter(t => t === 0).length} consumed later`);
      
      // Train regression model (predict days until consumption)
      this.regressionModel = new RandomForestRegression({
        nEstimators: 50,        // Number of trees
        maxFeatures: 0.8,       // Use 80% of features per tree
        replacement: true,      // Bootstrap sampling
        seed: 42               // For reproducibility
      });
      
      this.regressionModel.train(features, regressionTargets);
      console.log('✅ Regression model trained');
      
      // Train classification model (will consume within 7 days?)
      this.classificationModel = new RandomForestClassifier({
        nEstimators: 50,
        maxFeatures: 0.8,
        replacement: true,
        seed: 42
      });
      
      this.classificationModel.train(features, classificationTargets);
      console.log('✅ Classification model trained');
      
      console.log('🌲 Random Forest models training complete!');
      
    } catch (error) {
      console.error('Error training models:', error);
      throw error;
    }
  }
  
  /**
   * Predict consumption for ACTIVE INVENTORY ONLY
   */
  async predictForActiveInventory(userId: string, pool: any): Promise<any[]> {
    if (!this.regressionModel || !this.classificationModel) {
      throw new Error('Models not trained yet');
    }
    
    // Get ONLY active items for this user
    const [activeItems]: any = await pool.execute(
      `SELECT * FROM items 
       WHERE userId = ? AND status = 'active'
       ORDER BY expiryDate ASC`,
      [userId]
    );
    
    if (activeItems.length === 0) {
      return [];
    }
    
    // Get user stats and patterns
    const [patterns]: any = await pool.execute(
      'SELECT * FROM consumption_patterns WHERE user_id = ?',
      [userId]
    );
    
    const userStats = {
      total_items: activeItems.length,
      avg_frequency: patterns.length > 0 
        ? patterns.reduce((sum: number, p: any) => sum + (p.average_consumption_days || 30), 0) / patterns.length
        : 30
    };
    
    // Make predictions for each active item
    const predictions = activeItems.map((item: any) => {
      // Find matching pattern
      const pattern = patterns.find((p: any) => p.item_name.toLowerCase() === item.name.toLowerCase());
      
      if (!pattern) {
        // No historical data - return default prediction
        return {
          item_id: item.id,
          item_name: item.name,
          category: item.category,
          days_until_consumption: null,
          will_consume_within_7_days: false,
          confidence: 0.1,
          reason: 'No historical consumption data'
        };
      }
      
      // Extract features
      const features = this.extractFeatures(pattern, new Date(), item, userStats);
      const featureArray = this.featuresToArray(features);
      
      // Clean features before prediction
      const cleanedFeatures = this.cleanFeatureArray(featureArray);
      
      // Make predictions
      const daysPredict = this.regressionModel!.predict([cleanedFeatures])[0];
      const classifyPredict = this.classificationModel!.predict([cleanedFeatures])[0];
      
      return {
        item_id: item.id,
        item_name: item.name,
        category: item.category,
        expiry_date: item.expiryDate,
        days_until_consumption: Math.round(daysPredict),
        will_consume_within_7_days: classifyPredict === 1,
        confidence: 0.8, // We'll improve this later
        features: features
      };
    });
    
    return predictions;
  }
}