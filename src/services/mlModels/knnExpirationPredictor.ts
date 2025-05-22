export interface TrainingDataPoint {
    item_id: string;
    item_name: string;
    category: string;
    consumption_count: number;
    average_consumption_days: number | null;
    actual_lifespan_days: number;
    outcome: 'consume' | 'expire' | 'discard';
    user_id: string;
  }
  
  export interface PredictionResult {
    prediction: 'consume' | 'expire' | 'discard';
    confidence: number;
    days: number;
  }
  
  export class KNNExpirationPredictor {
    private k: number;
    private trainingData: TrainingDataPoint[];
  
    constructor(k = 3) {
      this.k = k;
      this.trainingData = [];
    }
    
    train(dataset: TrainingDataPoint[]): KNNExpirationPredictor {
      this.trainingData = dataset;
      console.log(`Trained model with ${dataset.length} examples`);
      return this;
    }
    
    // Calculate Euclidean distance between two data points
    private distance(point1: any, point2: any): number {
      const squaredDiffs = [
        // Weight category more by using one-hot encoding
        point1.category === point2.category ? 0 : 5,
        // Consumption count is important
        Math.pow(((point1.consumption_count || 0) - (point2.consumption_count || 0)) / 10, 2),
        // Average consumption days is very important
        Math.pow(((point1.average_consumption_days || 30) - (point2.average_consumption_days || 30)) / 3, 2)
      ];
      
      return Math.sqrt(squaredDiffs.reduce((sum, diff) => sum + diff, 0));
    }
    
    predict(item: any): PredictionResult {
      if (this.trainingData.length === 0) {
        return { prediction: 'consume', confidence: 0, days: 30 };
      }
      
      // Find k nearest neighbors
      let neighbors = this.trainingData
        .filter(dataPoint => dataPoint.category === item.category) // Filter by category first
        .map(dataPoint => ({
          dataPoint,
          distance: this.distance(dataPoint, item)
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, this.k);
      
      // If no neighbors match the category, fall back to all items
      if (neighbors.length === 0) {
        neighbors = this.trainingData
          .map(dataPoint => ({
            dataPoint,
            distance: this.distance(dataPoint, item)
          }))
          .sort((a, b) => a.distance - b.distance)
          .slice(0, this.k);
      }
      
      // Count outcomes
      const outcomes: {[key: string]: number} = {};
      let totalDays = 0;
      
      neighbors.forEach(neighbor => {
        const outcome = neighbor.dataPoint.outcome;
        const days = neighbor.dataPoint.actual_lifespan_days;
        
        outcomes[outcome] = (outcomes[outcome] || 0) + 1;
        totalDays += days;
      });
      
      // Find the most common outcome
      let maxCount = 0;
      let prediction: 'consume' | 'expire' | 'discard' = 'consume';
      
      Object.entries(outcomes).forEach(([outcome, count]) => {
        if (count > maxCount) {
          maxCount = count;
          prediction = outcome as 'consume' | 'expire' | 'discard';
        }
      });
      
      // Calculate confidence and average days until the predicted outcome
      const confidence = maxCount / this.k;
      const averageDays = totalDays / neighbors.length;
      
      return {
        prediction,
        confidence,
        days: Math.round(averageDays)
      };
    }
  }