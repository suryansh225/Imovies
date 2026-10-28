import mongoose from 'mongoose';
import Showtime from '../models/Showtime.js';
import Screen from '../models/Screen.js';
import Movie from '../models/Movie.js';
import Theatre from '../models/Theatre.js';

/**
 * @desc    Get showtimes filtered by movie, date, and theatre
 * @route   GET /api/showtimes
 * @access  Public
 */
export const getShowtimes = async (req, res, next) => {
  try {
    const { movieId, theatreId, date } = req.query;

    const filter = { isActive: true };

    if (movieId) {
      if (!mongoose.Types.ObjectId.isValid(movieId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid movie ID format',
        });
      }
      filter.movie = movieId;
    }

    if (theatreId) {
      if (!mongoose.Types.ObjectId.isValid(theatreId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid theatre ID format',
        });
      }
      filter.theatre = theatreId;
    }

    // Filter by calendar date (e.g. YYYY-MM-DD)
    if (date) {
      const startOfDay = new Date(`${date}T00:00:00.000Z`);
      const endOfDay = new Date(`${date}T23:59:59.999Z`);

      if (isNaN(startOfDay.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format. Expected YYYY-MM-DD',
        });
      }

      filter.startTime = { $gte: startOfDay, $lte: endOfDay };
    }

    const showtimes = await Showtime.find(filter)
      .populate('movie', 'title poster duration rating certificate')
      .populate('theatre', 'name location city amenities rating')
      .populate('screen', 'name screenType seatLayout columns totalSeats')
      .sort({ startTime: 1 });

    res.status(200).json({
      success: true,
      count: showtimes.length,
      showtimes,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single showtime by ID
 * @route   GET /api/showtimes/:id
 * @access  Public
 */
export const getShowtimeById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid showtime ID format',
      });
    }

    const showtime = await Showtime.findById(id)
      .populate('movie', 'title poster backdrop duration genre language rating certificate price')
      .populate('theatre', 'name address city location amenities rating')
      .populate('screen', 'name screenType seatLayout columns totalSeats');

    if (!showtime) {
      return res.status(404).json({
        success: false,
        message: 'Showtime not found',
      });
    }

    res.status(200).json({
      success: true,
      showtime,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a showtime (Admin only)
 *          Prevents overlapping showtimes for the same screen
 * @route   POST /api/showtimes
 * @access  Private/Admin
 */
export const createShowtime = async (req, res, next) => {
  try {
    const { movieId, theatreId, screenId, startTime, endTime, pricing, status } = req.body;

    if (!movieId || !theatreId || !screenId || !startTime || !endTime || !pricing) {
      return res.status(400).json({
        success: false,
        message: 'Please provide movieId, theatreId, screenId, startTime, endTime, and pricing (silver, gold, premium)',
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(movieId) ||
      !mongoose.Types.ObjectId.isValid(theatreId) ||
      !mongoose.Types.ObjectId.isValid(screenId)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID format for movie, theatre, or screen',
      });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date/time format for startTime or endTime',
      });
    }

    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: 'Showtime startTime must be before endTime',
      });
    }

    // Verify entities exist
    const [movie, theatre, screen] = await Promise.all([
      Movie.findById(movieId),
      Theatre.findById(theatreId),
      Screen.findById(screenId),
    ]);

    if (!movie) {
      return res.status(404).json({ success: false, message: 'Movie not found' });
    }
    if (!theatre) {
      return res.status(404).json({ success: false, message: 'Theatre not found' });
    }
    if (!screen || screen.theatre.toString() !== theatreId) {
      return res.status(400).json({
        success: false,
        message: 'Screen not found or does not belong to specified theatre',
      });
    }

    // Validate pricing
    if (
      pricing.silver === undefined ||
      pricing.gold === undefined ||
      pricing.premium === undefined ||
      pricing.silver < 0 ||
      pricing.gold < 0 ||
      pricing.premium < 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Pricing must include non-negative values for silver, gold, and premium',
      });
    }

    // Overlap Check: A screen cannot have two active showtimes overlapping
    // Overlap condition: existing.start < new.end AND existing.end > new.start
    const overlap = await Showtime.findOne({
      screen: screenId,
      isActive: true,
      status: { $ne: 'cancelled' },
      startTime: { $lt: end },
      endTime: { $gt: start },
    });

    if (overlap) {
      return res.status(409).json({
        success: false,
        message: 'Showtime conflict: Another showtime is already scheduled on this screen during the requested time slot',
        conflictingShowtimeId: overlap._id,
      });
    }

    const showtime = await Showtime.create({
      movie: movieId,
      theatre: theatreId,
      screen: screenId,
      startTime: start,
      endTime: end,
      pricing,
      status: status || 'scheduled',
    });

    res.status(201).json({
      success: true,
      message: 'Showtime created successfully',
      showtime,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update showtime (Admin only)
 * @route   PATCH /api/showtimes/:id
 * @access  Private/Admin
 */
export const updateShowtime = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid showtime ID format',
      });
    }

    const existingShowtime = await Showtime.findById(id);
    if (!existingShowtime) {
      return res.status(404).json({
        success: false,
        message: 'Showtime not found',
      });
    }

    const screenId = req.body.screenId || existingShowtime.screen;
    const start = req.body.startTime ? new Date(req.body.startTime) : existingShowtime.startTime;
    const end = req.body.endTime ? new Date(req.body.endTime) : existingShowtime.endTime;

    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: 'Showtime startTime must be before endTime',
      });
    }

    // If times or screen changed, check for overlaps with other showtimes
    if (req.body.startTime || req.body.endTime || req.body.screenId) {
      const overlap = await Showtime.findOne({
        _id: { $ne: id },
        screen: screenId,
        isActive: true,
        status: { $ne: 'cancelled' },
        startTime: { $lt: end },
        endTime: { $gt: start },
      });

      if (overlap) {
        return res.status(409).json({
          success: false,
          message: 'Showtime conflict: Another showtime overlaps with the updated schedule',
        });
      }
    }

    const updates = { ...req.body };
    if (req.body.startTime) updates.startTime = start;
    if (req.body.endTime) updates.endTime = end;
    if (req.body.movieId) updates.movie = req.body.movieId;
    if (req.body.theatreId) updates.theatre = req.body.theatreId;
    if (req.body.screenId) updates.screen = req.body.screenId;

    const showtime = await Showtime.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Showtime updated successfully',
      showtime,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete or deactivate showtime (Admin only)
 * @route   DELETE /api/showtimes/:id
 * @access  Private/Admin
 */
export const deleteShowtime = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { soft = 'true' } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid showtime ID format',
      });
    }

    const showtime = await Showtime.findById(id);
    if (!showtime) {
      return res.status(404).json({
        success: false,
        message: 'Showtime not found',
      });
    }

    if (soft === 'true') {
      showtime.isActive = false;
      showtime.status = 'cancelled';
      await showtime.save();
      return res.status(200).json({
        success: true,
        message: 'Showtime deactivated successfully',
        showtime,
      });
    }

    await Showtime.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Showtime deleted successfully',
      id,
    });
  } catch (error) {
    next(error);
  }
};
