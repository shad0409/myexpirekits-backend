export interface ConsumptionPattern {
    user_id: string;
    item_name: string;
    category: string;
    average_consumption_days: number | null;
    consumption_count: number;
    last_consumed?: Date;
  }
  
  export interface ConsumptionPrediction {
    item_name: string;
    category: string;
    days_until_next: number;
    confidence: number;
  }
  
  export class ConsumptionPredictor {
    private userPatterns: {[key: string]: {[key: string]: ConsumptionPattern[]}};
  
    constructor() {
      this.userPatterns = {}; // user_id -> category -> pattern
    }
    
    train(consumptionPatterns: ConsumptionPattern[], itemEvents: any[] = []): ConsumptionPredictor {
      // Group consumption events by user and category
      consumptionPatterns.forEach(pattern => {
        const userId = pattern.user_id;
        const category = pattern.category;
        
        if (!this.userPatterns[userId]) {
          this.userPatterns[userId] = {};
        }
        
        if (!this.userPatterns[userId][category]) {
          this.userPatterns[userId][category] = [];
        }
        
        this.userPatterns[userId][category].push(pattern);
      });
      
      // Process patterns for each user and category
      Object.entries(this.userPatterns).forEach(([userId, categories]) => {
        Object.entries(categories).forEach(([category, patterns]) => {
          // Sort patterns by consumption count (most consumed first)
          this.userPatterns[userId][category] = patterns.sort(
            (a, b) => b.consumption_count - a.consumption_count
          );
        });
      });
      
      console.log(`Trained consumption predictor for ${Object.keys(this.userPatterns).length} users`);
      return this;
    }
    
    // Predict next consumption for a given user
    predictNextConsumption(userId: string, category: string | null = null): {
      predictions: ConsumptionPrediction[];
      confidence: number;
    } {
      const userPatterns = this.userPatterns[userId];
      if (!userPatterns) {
        return { predictions: [], confidence: 0 };
      }
      
      let predictions: ConsumptionPrediction[] = [];
      
      // If category is specified, predict for that category only
      if (category) {
        const categoryPatterns = userPatterns[category];
        if (!categoryPatterns || categoryPatterns.length === 0) {
          return { predictions: [], confidence: 0 };
        }
        
        // Take top 3 most consumed items in this category
        predictions = categoryPatterns.slice(0, 3).map(pattern => ({
          item_name: pattern.item_name,
          category: pattern.category,
          days_until_next: pattern.average_consumption_days || 30,
          confidence: Math.min(pattern.consumption_count / 10, 0.9)
        }));
      } else {
        // Predict across all categories
        Object.entries(userPatterns).forEach(([cat, patterns]) => {
          // Take the most consumed item from each category
          if (patterns.length > 0) {
            const topPattern = patterns[0];
            predictions.push({
              item_name: topPattern.item_name,
              category: topPattern.category,
              days_until_next: topPattern.average_consumption_days || 30,
              confidence: Math.min(topPattern.consumption_count / 10, 0.9)
            });
          }
        });
        
        // Sort by confidence
        predictions.sort((a, b) => b.confidence - a.confidence);
      }
      
      const avgConfidence = predictions.length > 0
        ? predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length
        : 0;
      
      return {
        predictions,
        confidence: avgConfidence
      };
    }
  }