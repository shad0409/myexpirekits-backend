import express, { Router, Request, Response } from 'express';
import {
  trainModels,
  predictItemOutcome,
  predictConsumptionByCategory,
  getConsumptionForecast,
  getCategoryTimeSeries,
  getComprehensiveAnalysis,
  getWeeklyPatterns,
  analyzeInventory,
  getRandomForestPredictions,
  getEnhancedComprehensiveAnalysis,
  compareMLModels
} from '../controllers/mlController';

const router = Router();

// POST train ML models
router.post('/train', async (req: Request, res: Response) => {
  await trainModels(req, res);
});

// GET predict item outcome
router.get('/predict/item', async (req: Request, res: Response) => {
  await predictItemOutcome(req, res);
});

// GET consumption prediction by category
router.get('/predict/consumption', async (req: Request, res: Response) => {
  await predictConsumptionByCategory(req, res);
});

// GET time series forecast
router.get('/trends/forecast', async (req: Request, res: Response) => {
  await getConsumptionForecast(req, res);
});

// GET category time series
router.get('/trends/category', async (req: Request, res: Response) => {
  await getCategoryTimeSeries(req, res);
});

// GET comprehensive analysis
router.get('/analysis/comprehensive', async (req: Request, res: Response) => {
  await getComprehensiveAnalysis(req, res);
});

// GET weekly patterns
router.get('/patterns/weekly', async (req: Request, res: Response) => {
  await getWeeklyPatterns(req, res);
});

// GET inventory analysis
router.get('/inventory/analyze', async (req: Request, res: Response) => {
  await analyzeInventory(req, res);
});

// GET Random Forest predictions for active inventory
router.get('/random-forest/predictions', async (req: Request, res: Response) => {
  await getRandomForestPredictions(req, res);
});

// GET enhanced comprehensive analysis with all models
router.get('/analysis/enhanced', async (req: Request, res: Response) => {
  await getEnhancedComprehensiveAnalysis(req, res);
});

// GET model comparison analysis
router.get('/models/compare', async (req: Request, res: Response) => {
  await compareMLModels(req, res);
});

export default router;