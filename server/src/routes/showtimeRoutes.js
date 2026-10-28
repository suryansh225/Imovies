import express from 'express';
import {
  getShowtimes,
  getShowtimeById,
  createShowtime,
  updateShowtime,
  deleteShowtime,
} from '../controllers/showtimeController.js';
import { protect, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/', getShowtimes);
router.get('/:id', getShowtimeById);

// Admin-only routes
router.post('/', protect, requireAdmin, createShowtime);
router.patch('/:id', protect, requireAdmin, updateShowtime);
router.delete('/:id', protect, requireAdmin, deleteShowtime);

export default router;
