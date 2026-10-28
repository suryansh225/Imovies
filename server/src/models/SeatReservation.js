import mongoose from 'mongoose';

/**
 * SeatReservation schema enforces strict unique compound constraint on { showtime, seatId }.
 * - status: 'held' | 'confirmed'
 * - expiresAt: Date (null if confirmed; Date for held)
 *
 * For active uniqueness:
 * MongoDB allows unique compound index on { showtime: 1, seatId: 1 }.
 * To allow a seat whose hold has expired to be reclaimed, when a new request comes in:
 * 1. Expired holds for that showtime or seat are cleaned up or overwritten.
 * 2. If an attempt finds an expired reservation, it purges expired reservations first.
 */
const seatReservationSchema = new mongoose.Schema(
  {
    showtime: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Showtime',
      required: true,
      index: true,
    },
    seatId: {
      type: String,
      required: true,
      trim: true,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['held', 'confirmed'],
      default: 'held',
      index: true,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index ensuring no two active reservations exist for the same showtime & seat
seatReservationSchema.index({ showtime: 1, seatId: 1 }, { unique: true });

const SeatReservation = mongoose.model('SeatReservation', seatReservationSchema);

export default SeatReservation;
