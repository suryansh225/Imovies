import mongoose from 'mongoose';

const showtimeSchema = new mongoose.Schema(
  {
    movie: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Movie',
      required: [true, 'Please provide movie reference'],
      index: true,
    },
    theatre: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Theatre',
      required: [true, 'Please provide theatre reference'],
      index: true,
    },
    screen: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Screen',
      required: [true, 'Please provide screen reference'],
      index: true,
    },
    startTime: {
      type: Date,
      required: [true, 'Please provide showtime start time'],
      index: true,
    },
    endTime: {
      type: Date,
      required: [true, 'Please provide showtime end time'],
      index: true,
    },
    pricing: {
      silver: {
        type: Number,
        required: [true, 'Please provide silver seat price'],
        min: 0,
      },
      gold: {
        type: Number,
        required: [true, 'Please provide gold seat price'],
        min: 0,
      },
      premium: {
        type: Number,
        required: [true, 'Please provide premium seat price'],
        min: 0,
      },
    },
    status: {
      type: String,
      enum: ['scheduled', 'ongoing', 'completed', 'cancelled'],
      default: 'scheduled',
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

showtimeSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

// Format time string e.g. "10:30 AM"
showtimeSchema.virtual('formattedTime').get(function () {
  if (!this.startTime) return '';
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(this.startTime);
});

// Fast querying by movie, date range, and theatre
showtimeSchema.index({ movie: 1, startTime: 1, theatre: 1 });
showtimeSchema.index({ screen: 1, startTime: 1, endTime: 1 });

const Showtime = mongoose.model('Showtime', showtimeSchema);

export default Showtime;
