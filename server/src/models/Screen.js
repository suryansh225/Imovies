import mongoose from 'mongoose';

const screenSchema = new mongoose.Schema(
  {
    theatre: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Theatre',
      required: [true, 'Please provide theatre reference'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Please provide screen name (e.g. Audi 1 / Screen 1)'],
      trim: true,
    },
    screenType: {
      type: String,
      enum: ['Standard', 'IMAX', '4DX', 'Dolby Atmos', 'Gold Class', 'Laser 4K'],
      default: 'Standard',
    },
    seatLayout: {
      premium: {
        type: [String],
        default: ['A', 'B', 'C'],
      },
      gold: {
        type: [String],
        default: ['D', 'E', 'F', 'G'],
      },
      silver: {
        type: [String],
        default: ['H', 'I', 'J', 'K', 'L'],
      },
    },
    columns: {
      type: Number,
      default: 10,
      min: 5,
      max: 30,
    },
    totalSeats: {
      type: Number,
      default: function () {
        const rows = [
          ...(this.seatLayout?.premium || []),
          ...(this.seatLayout?.gold || []),
          ...(this.seatLayout?.silver || []),
        ];
        return rows.length * (this.columns || 10);
      },
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

screenSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

// A theatre cannot have duplicate screen names
screenSchema.index({ theatre: 1, name: 1 }, { unique: true });

const Screen = mongoose.model('Screen', screenSchema);

export default Screen;
