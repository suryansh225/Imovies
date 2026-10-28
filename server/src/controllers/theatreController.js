import mongoose from 'mongoose';
import Theatre from '../models/Theatre.js';
import Screen from '../models/Screen.js';

/**
 * @desc    Get all theatres with optional city filter & search
 * @route   GET /api/theatres
 * @access  Public
 */
export const getTheatres = async (req, res, next) => {
  try {
    const { city, search, activeOnly = 'true' } = req.query;

    const filter = {};
    if (activeOnly === 'true') {
      filter.isActive = true;
    }

    if (city && city.trim()) {
      filter.city = new RegExp(`^${city.trim()}$`, 'i');
    }

    if (search && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { name: new RegExp(q, 'i') },
        { city: new RegExp(q, 'i') },
        { address: new RegExp(q, 'i') },
        { location: new RegExp(q, 'i') },
      ];
    }

    const theatres = await Theatre.find(filter).sort({ city: 1, name: 1 });

    res.status(200).json({
      success: true,
      count: theatres.length,
      theatres,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single theatre by ID
 * @route   GET /api/theatres/:id
 * @access  Public
 */
export const getTheatreById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid theatre ID format',
      });
    }

    const theatre = await Theatre.findById(id);
    if (!theatre) {
      return res.status(404).json({
        success: false,
        message: 'Theatre not found',
      });
    }

    res.status(200).json({
      success: true,
      theatre,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get screens for a specific theatre
 * @route   GET /api/theatres/:id/screens
 * @access  Public
 */
export const getTheatreScreens = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid theatre ID format',
      });
    }

    const theatre = await Theatre.findById(id);
    if (!theatre) {
      return res.status(404).json({
        success: false,
        message: 'Theatre not found',
      });
    }

    const screens = await Screen.find({ theatre: id, isActive: true }).sort({ name: 1 });

    res.status(200).json({
      success: true,
      theatre: {
        id: theatre._id,
        name: theatre.name,
        city: theatre.city,
      },
      count: screens.length,
      screens,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create theatre (Admin only)
 * @route   POST /api/theatres
 * @access  Private/Admin
 */
export const createTheatre = async (req, res, next) => {
  try {
    const { name, address, city, amenities, rating, location } = req.body;

    if (!name || !address || !city) {
      return res.status(400).json({
        success: false,
        message: 'Please provide theatre name, address, and city',
      });
    }

    const theatre = await Theatre.create({
      name: name.trim(),
      address: address.trim(),
      city: city.trim(),
      location: location || `${address.trim()}, ${city.trim()}`,
      amenities: amenities || ['Dolby Atmos', '4K Projection', 'Recliner Seats'],
      rating: rating !== undefined ? Number(rating) : 4.5,
    });

    res.status(201).json({
      success: true,
      message: 'Theatre created successfully',
      theatre,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update theatre (Admin only)
 * @route   PATCH /api/theatres/:id
 * @access  Private/Admin
 */
export const updateTheatre = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid theatre ID format',
      });
    }

    const theatre = await Theatre.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!theatre) {
      return res.status(404).json({
        success: false,
        message: 'Theatre not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Theatre updated successfully',
      theatre,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete or deactivate theatre (Admin only)
 * @route   DELETE /api/theatres/:id
 * @access  Private/Admin
 */
export const deleteTheatre = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { soft = 'true' } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid theatre ID format',
      });
    }

    const theatre = await Theatre.findById(id);
    if (!theatre) {
      return res.status(404).json({
        success: false,
        message: 'Theatre not found',
      });
    }

    if (soft === 'true') {
      theatre.isActive = false;
      await theatre.save();
      return res.status(200).json({
        success: true,
        message: 'Theatre deactivated successfully',
        theatre,
      });
    }

    await Theatre.findByIdAndDelete(id);
    // Also delete associated screens
    await Screen.deleteMany({ theatre: id });

    res.status(200).json({
      success: true,
      message: 'Theatre deleted successfully',
      id,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a screen for a theatre (Admin only)
 * @route   POST /api/theatres/:id/screens
 * @access  Private/Admin
 */
export const createScreen = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, screenType, seatLayout, columns } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid theatre ID format',
      });
    }

    const theatre = await Theatre.findById(id);
    if (!theatre) {
      return res.status(404).json({
        success: false,
        message: 'Theatre not found',
      });
    }

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Please provide screen name',
      });
    }

    const screen = await Screen.create({
      theatre: id,
      name: name.trim(),
      screenType: screenType || 'Standard',
      seatLayout: seatLayout || {
        premium: ['A', 'B', 'C'],
        gold: ['D', 'E', 'F', 'G'],
        silver: ['H', 'I', 'J', 'K', 'L'],
      },
      columns: columns || 10,
    });

    res.status(201).json({
      success: true,
      message: 'Screen created successfully',
      screen,
    });
  } catch (error) {
    next(error);
  }
};
