import express, { Router, Request, Response } from 'express';
import { getRecentLogs, getAllLogs } from '../controllers/adminLogsController';

const router = Router();

router.get('/recent', async (req: Request, res: Response) => {
  await getRecentLogs(req, res);
});

router.get('/', async (req: Request, res: Response) => {
  await getAllLogs(req, res);
});

export default router;