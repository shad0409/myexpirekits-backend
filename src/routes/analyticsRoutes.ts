import express, { Router, Request, Response } from 'express';
import { 
  getConsumptionAnalytics, 
  processConsumption,
  getPredictiveInsights,
  getConsumptionForecast,
  getCategoryAnalysis,
  getComprehensiveAnalysis
} from '../controllers/analyticsController';

// Import inventory analysis function from mlController
import { analyzeInventory } from '../controllers/mlController';

const router = Router();

// GET consumption analytics
router.get('/consumption', async (req: Request, res: Response) => {
  await getConsumptionAnalytics(req, res);
});

// POST process consumption event
router.post('/consumption', async (req: Request, res: Response) => {
  await processConsumption(req, res);
});

// GET predictive insights
router.get('/predictions', async (req: Request, res: Response) => {
  await getPredictiveInsights(req, res);
});

// GET consumption forecast (time series prediction)
router.get('/forecast', async (req: Request, res: Response) => {
  await getConsumptionForecast(req, res);
});

// GET category-based analysis
router.get('/category', async (req: Request, res: Response) => {
  await getCategoryAnalysis(req, res);
});

// GET comprehensive analytics dashboard
router.get('/dashboard', async (req: Request, res: Response) => {
  await getComprehensiveAnalysis(req, res);
});

// GET inventory analysis with predictions
router.get('/inventory/analyze', async (req: Request, res: Response) => {
  await analyzeInventory(req, res);
});

export default router;