import mongoose from 'mongoose';

const theatreSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide theatre name'],
      trim: true,
      maxlength: [120, 'Name cannot exceed 120 characters'],
    },
    address: {
      type: String,
      required: [true, 'Please provide theatre address'],
      trim: true,
    },
    city: {
      type: String,
      required: [true, 'Please provide city'],
      trim: true,
      index: true,
    },
    location: {
      type: String,
      trim: true,
      default: function () {
        return `${this.address}, ${this.city}`;
      },
    },
    amenities: {
      type: [String],
      default: ['Dolby Atmos', '4K Projection', 'Recliner Seats'],
    },
    rating: {
      type: Number,
      default: 4.5,
      min: 0,
      max: 5,
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

theatreSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

theatreSchema.virtual('screens', {
  ref: 'Screen',
  localField: '_id',
  foreignField: 'theatre',
});

theatreSchema.index({ name: 1, city: 1 }, { unique: true });

const Theatre = mongoose.model('Theatre', theatreSchema);

export default Theatre;
