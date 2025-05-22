import { Request, Response } from 'express';
import { ItemEventService, ItemEvent } from '../models/ItemEvent';

export const trackItemEvent = async (req: Request, res: Response) => {
  try {
    const { user_id, item_id, event_type, notes } = req.body;

    if (!user_id || !item_id || !event_type) {
      return res.status(400).json({ message: 'User ID, Item ID, and event type are required' });
    }

    const event: ItemEvent = {
      user_id,
      item_id,
      event_type,
      notes
    };

    const eventId = await ItemEventService.createEvent(event);
    
    res.status(201).json({ 
      message: 'Event tracked successfully',
      event_id: eventId
    });
  } catch (error) {
    console.error('Error tracking item event:', error);
    res.status(500).json({ message: 'Failed to track item event' });
  }
};

export const getUserEvents = async (req: Request, res: Response) => {
  try {
    const user_id = req.query.user_id as string;
    const item_id = req.query.item_id as string | undefined;

    if (!user_id) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const events = await ItemEventService.getUserEvents(user_id, item_id);
    
    res.json(events);
  } catch (error) {
    console.error('Error fetching user events:', error);
    res.status(500).json({ message: 'Failed to fetch user events' });
  }
};