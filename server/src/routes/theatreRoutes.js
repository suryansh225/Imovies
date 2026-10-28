import express from 'express';
import {
  getTheatres,
  getTheatreById,
  getTheatreScreens,
  createTheatre,
  updateTheatre,
  deleteTheatre,
  createScreen,
} from '../controllers/theatreController.js';
import { protect, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/', getTheatres);
router.get('/:id', getTheatreById);
router.get('/:id/screens', getTheatreScreens);

// Admin-only routes
router.post('/', protect, requireAdmin, createTheatre);
router.patch('/:id', protect, requireAdmin, updateTheatre);
router.delete('/:id', protect, requireAdmin, deleteTheatre);
router.post('/:id/screens', protect, requireAdmin, createScreen);

export default router;
