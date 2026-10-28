import mongoose from 'mongoose';
import { customAlphabet } from 'nanoid';

// Generate a short, unique booking reference like IMV-A3X9K2
const nanoid = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8);

const seatItemSchema = new mongoose.Schema(
  {
    seatId: {
      type: String,
      required: true,
      // e.g. "A1", "B10"
    },
    row: {
      type: String,
      required: true,
    },
    number: {
      type: Number,
      required: true,
    },
    category: {
      type: String,
      enum: ['silver', 'gold', 'premium'],
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    bookingRef: {
      type: String,
      unique: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Booking must belong to a user'],
      index: true,
    },
    showtime: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Showtime',
      required: [true, 'Booking must reference a showtime'],
      index: true,
    },
    movie: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Movie',
      required: [true, 'Booking must reference a movie'],
    },
    theatre: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Theatre',
      required: [true, 'Booking must reference a theatre'],
    },
    screen: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Screen',
      required: [true, 'Booking must reference a screen'],
    },
    seats: {
      type: [seatItemSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'Booking must include at least one seat',
      },
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0, 'Total amount cannot be negative'],
    },
    status: {
      type: String,
      enum: ['pending_payment', 'confirmed', 'cancelled', 'expired'],
      default: 'pending_payment',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
      index: true,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    // Razorpay payment details
    razorpayOrderId: {
      type: String,
      sparse: true,
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      sparse: true,
      index: true,
    },
    razorpaySignature: {
      type: String,
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancellationReason: {
      type: String,
      default: '',
      maxlength: 300,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Auto-generate booking reference before first save
bookingSchema.pre('save', function (next) {
  if (!this.bookingRef) {
    this.bookingRef = `IMV-${nanoid()}`;
  }
  next();
});

// Compound index to efficiently look up booked seats for a showtime
bookingSchema.index({ showtime: 1, status: 1 });
// Per-user lookup
bookingSchema.index({ user: 1, status: 1, createdAt: -1 });

const Booking = mongoose.model('Booking', bookingSchema);
export default Booking;
