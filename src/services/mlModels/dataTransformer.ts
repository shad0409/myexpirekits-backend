export class DataTransformer {
  /**
   * Transform raw database data into training format for ML models
   */
  static preprocessConsumptionData(consumptionPatterns: any[], itemEvents: any[]) {
    const dataset: any[] = [];
    
    // Group events by item_id to track lifecycle
    const itemLifecycles: {[key: string]: any[]} = {};
    
    // Extract user IDs for later use
    const userItemMap: {[key: string]: string} = {};
    
    // Get categories and item names for each item
    const itemMetadata: {[key: string]: {category: string, name: string}} = {};
    
    itemEvents.forEach(event => {
      if (!itemLifecycles[event.item_id]) {
        itemLifecycles[event.item_id] = [];
      }
      itemLifecycles[event.item_id].push(event);
      
      // Store user ID for each item
      userItemMap[event.item_id] = event.user_id;
      
      // Try to extract item metadata if available in the event
      if (event.item_name && event.category) {
        itemMetadata[event.item_id] = {
          name: event.item_name,
          category: event.category
        };
      }
    });
    
    // For each item with a complete lifecycle (add -> consume/expire/discard)
    Object.entries(itemLifecycles).forEach(([itemId, events]) => {
      // Sort events by date
      events.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
      
      // Find add event
      const addEvent = events.find(e => e.event_type === 'add');
      if (!addEvent) return; // Skip if no add event
      
      // Find terminal event (consume, expire, or discard)
      const terminalEvent = events.find(e => 
        ['consume', 'expire', 'discard'].includes(e.event_type) && 
        new Date(e.event_date) > new Date(addEvent.event_date)
      );
      if (!terminalEvent) return; // Skip if no terminal event
      
      // Calculate lifespan in days
      const addDate = new Date(addEvent.event_date);
      const terminalDate = new Date(terminalEvent.event_date);
      const lifespanDays = Math.floor((terminalDate.getTime() - addDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Get user ID for this item
      const userId = userItemMap[itemId];
      
      // Find corresponding pattern for this item (matching user ID and item name)
      // First, try to find the item name from metadata or events
      let itemName = '';
      let category = '';
      
      if (itemMetadata[itemId]) {
        itemName = itemMetadata[itemId].name;
        category = itemMetadata[itemId].category;
      }
      
      // Try to get from terminal event if not found
      if (!itemName && terminalEvent.item_name) {
        itemName = terminalEvent.item_name;
      }
      
      // Try to get category from terminal event if not found
      if (!category && terminalEvent.category) {
        category = terminalEvent.category;
      }
      
      // Find matching consumption pattern
      let matchingPattern = null;
      if (itemName) {
        matchingPattern = consumptionPatterns.find(p => 
          p.user_id === userId && p.item_name.toLowerCase() === itemName.toLowerCase()
        );
      }
      
      // Create feature vector
      dataset.push({
        item_id: itemId,
        user_id: userId,
        item_name: itemName || `Item ${itemId}`,
        category: category || (matchingPattern ? matchingPattern.category : 'Unknown'),
        consumption_count: matchingPattern ? matchingPattern.consumption_count : 0,
        average_consumption_days: matchingPattern ? matchingPattern.average_consumption_days : null,
        actual_lifespan_days: lifespanDays,
        outcome: terminalEvent.event_type
      });
    });
    
    return dataset;
  }
  
  /**
   * Extract ingredients from user's inventory for recipe recommendations
   * This function remains for backward compatibility but is no longer used for recipes
   */
  static extractIngredientsFromItems(items: any[]): {
    allIngredients: string[];
    expiringIngredients: string[];
  } {
    // Filter for food items
    const foodItems = items.filter(item => item.category.toLowerCase() === 'food');
    
    // Get all ingredients
    const allIngredients = foodItems.map(item => item.name);
    
    // Get expiring ingredients (within 7 days)
    const now = new Date();
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(now.getDate() + 7);
    
    const expiringIngredients = foodItems
      .filter(item => {
        if (!item.expiry_date) return false;
        const expiryDate = new Date(item.expiry_date);
        return expiryDate <= sevenDaysLater;
      })
      .map(item => item.name);
    
    return {
      allIngredients,
      expiringIngredients
    };
  }
  
  /**
   * Preprocess time series data for consumption analysis
   */
  static preprocessTimeSeriesData(itemEvents: any[]): any {
    // Filter only consumption events
    const consumptionEvents = itemEvents.filter(event => event.event_type === 'consume');
    
    // Group by date and count events
    const eventsByDate: {[key: string]: number} = {};
    
    consumptionEvents.forEach(event => {
      const dateStr = new Date(event.event_date).toISOString().split('T')[0];
      eventsByDate[dateStr] = (eventsByDate[dateStr] || 0) + 1;
    });
    
    // Sort dates
    const sortedDates = Object.keys(eventsByDate).sort();
    
    // Create time series arrays
    const dates: string[] = [];
    const values: number[] = [];
    
    if (sortedDates.length === 0) {
      return { dates, values };
    }
    
    // Fill in missing dates with zeros
    let currentDate = new Date(sortedDates[0]);
    const endDate = new Date(sortedDates[sortedDates.length - 1]);
    
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      dates.push(dateStr);
      values.push(eventsByDate[dateStr] || 0);
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return { dates, values };
  }
  
  /**
   * Group item events by category for category-based analysis
   */
  static groupEventsByCategory(itemEvents: any[], items: any[]): {[key: string]: any[]} {
    // Create a map of item ID to category
    const itemCategoryMap: {[key: string]: string} = {};
    items.forEach(item => {
      itemCategoryMap[item.id] = item.category;
    });
    
    // Group events by category
    const eventsByCategory: {[key: string]: any[]} = {};
    
    itemEvents.forEach(event => {
      const category = itemCategoryMap[event.item_id] || 'Unknown';
      
      if (!eventsByCategory[category]) {
        eventsByCategory[category] = [];
      }
      
      eventsByCategory[category].push(event);
    });
    
    return eventsByCategory;
  }
  
  /**
   * Extract features for KNN classification of items
   */
  static extractItemFeatures(item: any, pattern: any | null): any {
    return {
      item_id: item.id,
      category: item.category,
      has_expiry_date: item.expiry_date ? 1 : 0,
      days_until_expiry: item.expiry_date 
        ? Math.max(0, Math.floor((new Date(item.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 365, // Default to 1 year if no expiry date
      times_consumed: pattern ? pattern.consumption_count : 0,
      avg_consumption_days: pattern ? pattern.average_consumption_days || 30 : 30
    };
  }
  
  /**
   * Calculate seasonal consumption patterns (weekly patterns)
   */
  static calculateWeeklyPattern(itemEvents: any[]): number[] {
    // Filter consumption events
    const consumptionEvents = itemEvents.filter(event => event.event_type === 'consume');
    
    // Initialize array for days of week (0 = Sunday, 6 = Saturday)
    const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
    
    // Count consumptions by day of week
    consumptionEvents.forEach(event => {
      const date = new Date(event.event_date);
      const dayOfWeek = date.getDay(); // 0-6
      weekdayCounts[dayOfWeek]++;
    });
    
    // Get total for normalization
    const total = weekdayCounts.reduce((sum, count) => sum + count, 0);
    
    // Return normalized pattern (0-1 range)
    return total > 0 
      ? weekdayCounts.map(count => count / total)
      : weekdayCounts;
  }
  
  /**
   * Calculate waste metrics from events
   */
  static calculateWasteMetrics(itemEvents: any[]): any {
    // Group events by type
    const eventGroups = {
      add: itemEvents.filter(e => e.event_type === 'add'),
      consume: itemEvents.filter(e => e.event_type === 'consume'),
      expire: itemEvents.filter(e => e.event_type === 'expire'),
      discard: itemEvents.filter(e => e.event_type === 'discard')
    };
    
    // Calculate waste rate (expired + discarded) / total items
    const totalItems = eventGroups.add.length;
    const wastedItems = eventGroups.expire.length + eventGroups.discard.length;
    
    const wasteRate = totalItems > 0 ? wastedItems / totalItems : 0;
    
    // Calculate average time to expiration
    let totalExpirationDays = 0;
    let expirationCount = 0;
    
    // Track items from add to expire
    const itemLifecycles: {[key: string]: {addDate?: Date, expireDate?: Date}} = {};
    
    // Process add events
    eventGroups.add.forEach(event => {
      if (!itemLifecycles[event.item_id]) {
        itemLifecycles[event.item_id] = {};
      }
      itemLifecycles[event.item_id].addDate = new Date(event.event_date);
    });
    
    // Process expire events
    eventGroups.expire.forEach(event => {
      if (!itemLifecycles[event.item_id]) {
        itemLifecycles[event.item_id] = {};
      }
      itemLifecycles[event.item_id].expireDate = new Date(event.event_date);
    });
    
    // Calculate days from add to expire
    Object.values(itemLifecycles).forEach(lifecycle => {
      if (lifecycle.addDate && lifecycle.expireDate) {
        const days = Math.floor(
          (lifecycle.expireDate.getTime() - lifecycle.addDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        if (days >= 0) {
          totalExpirationDays += days;
          expirationCount++;
        }
      }
    });
    
    const avgExpirationDays = expirationCount > 0 ? totalExpirationDays / expirationCount : 0;
    
    return {
      total_items: totalItems,
      consumed_items: eventGroups.consume.length,
      expired_items: eventGroups.expire.length,
      discarded_items: eventGroups.discard.length,
      waste_rate: wasteRate,
      avg_days_to_expiration: avgExpirationDays
    };
  }
}