import express, { Router, Request, Response } from 'express';
import { 
  generateShoppingList,
  getUserShoppingLists,
  getShoppingList,
  updateShoppingListItem,
  deleteShoppingList
} from '../controllers/shoppingListController';

const router = Router();

// GET all shopping lists for a user
router.get('/', async (req: Request, res: Response) => {
  await getUserShoppingLists(req, res);
});

// POST generate a new shopping list
router.post('/generate', async (req: Request, res: Response) => {
  await generateShoppingList(req, res);
});

// GET a specific shopping list with items
router.get('/:id', async (req: Request, res: Response) => {
  await getShoppingList(req, res);
});

// PUT update a shopping list item
router.put('/item/:itemId', async (req: Request, res: Response) => {
  await updateShoppingListItem(req, res);
});

// DELETE a shopping list
router.delete('/:id', async (req: Request, res: Response) => {
  await deleteShoppingList(req, res);
});

export default router;