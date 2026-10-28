import mongoose from 'mongoose';

const movieSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please provide a movie title'],
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    description: {
      type: String,
      required: [true, 'Please provide a movie description'],
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    poster: {
      type: String,
      required: [true, 'Please provide a poster image URL'],
      trim: true,
    },
    backdrop: {
      type: String,
      required: [true, 'Please provide a backdrop image URL'],
      trim: true,
    },
    genre: {
      type: [String],
      required: [true, 'Please specify at least one genre'],
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: 'A movie must have at least one genre',
      },
    },
    language: {
      type: String,
      required: [true, 'Please provide the movie language'],
      trim: true,
    },
    duration: {
      type: String,
      required: [true, 'Please provide the movie duration (e.g. 2h 15m)'],
      trim: true,
    },
    durationMinutes: {
      type: Number,
      default: 120,
    },
    releaseDate: {
      type: String,
      required: [true, 'Please provide a release date (YYYY-MM-DD)'],
      trim: true,
    },
    certificate: {
      type: String,
      enum: ['U', 'UA', 'A', 'R', 'PG-13', 'PG', 'G'],
      default: 'UA',
    },
    cast: {
      type: [String],
      default: [],
    },
    director: {
      type: String,
      required: [true, 'Please provide director name'],
      trim: true,
    },
    trailerUrl: {
      type: String,
      default: '',
      trim: true,
    },
    rating: {
      type: Number,
      default: 0,
      min: [0, 'Rating cannot be below 0'],
      max: [10, 'Rating cannot be above 10'],
    },
    votes: {
      type: String,
      default: '0',
    },
    price: {
      type: Number,
      default: 250,
      min: [0, 'Price must be non-negative'],
    },
    trending: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['now_showing', 'upcoming', 'inactive'],
      default: 'now_showing',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    language_override: 'textSearchLanguage', // Prevents Mongoose from mapping schema field 'language' as text search language override
  }
);

// Virtual id property mapped to _id
movieSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

// Indexes for high-performance filter queries
movieSchema.index({ status: 1 });
movieSchema.index({ genre: 1 });
movieSchema.index({ language: 1 });
movieSchema.index({ rating: -1 });
movieSchema.index({ trending: 1 });
movieSchema.index({ releaseDate: -1 });

const Movie = mongoose.model('Movie', movieSchema);

export default Movie;
