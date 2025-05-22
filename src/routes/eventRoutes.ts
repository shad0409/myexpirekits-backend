import express, { Router, Request, Response } from 'express';
import { trackItemEvent, getUserEvents } from '../controllers/eventController';

const router = Router();

// POST track new event
router.post('/track', async (req: Request, res: Response) => {
  await trackItemEvent(req, res);
});

// GET user events
router.get('/', async (req: Request, res: Response) => {
  await getUserEvents(req, res);
});

export default router;