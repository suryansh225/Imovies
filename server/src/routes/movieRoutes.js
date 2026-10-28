import express from 'express';
import {
  getMovies,
  getMovieById,
  createMovie,
  updateMovie,
  deleteMovie,
} from '../controllers/movieController.js';
import { protect, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/', getMovies);
router.get('/:id', getMovieById);

// Admin-only routes
router.post('/', protect, requireAdmin, createMovie);
router.patch('/:id', protect, requireAdmin, updateMovie);
router.delete('/:id', protect, requireAdmin, deleteMovie);

export default router;
