import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Movie from '../models/Movie.js';

export const sampleMovies = [
  {
    title: "Echoes of Eternity",
    genre: ["Action", "Sci-Fi"],
    language: "English",
    rating: 8.7,
    votes: "245K",
    duration: "2h 28m",
    releaseDate: "2026-10-15",
    status: "now_showing",
    trending: true,
    description:
      "In a fractured future, a rogue AI architect uncovers a conspiracy that spans centuries. As timelines collapse, he must choose between saving humanity or erasing his own existence.",
    cast: ["Ethan Cole", "Priya Sharma", "Marcus Webb"],
    director: "James Ortega",
    certificate: "UA",
    poster: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&h=600&fit=crop",
    backdrop: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1200&h=600&fit=crop",
    price: 280,
  },
  {
    title: "Crimson Horizon",
    genre: ["Thriller", "Drama"],
    language: "English",
    rating: 8.2,
    votes: "178K",
    duration: "2h 10m",
    releaseDate: "2026-10-08",
    status: "now_showing",
    trending: true,
    description:
      "A decorated detective with a haunted past is pulled into a web of political deceit when a senator's daughter disappears without a trace.",
    cast: ["Sophia Vance", "Daniel Frost", "Amara Osei"],
    director: "Nadia Reeve",
    certificate: "A",
    poster: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&h=600&fit=crop",
    backdrop: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1200&h=600&fit=crop",
    price: 260,
  },
  {
    title: "Neon Requiem",
    genre: ["Crime", "Action"],
    language: "English",
    rating: 7.9,
    votes: "132K",
    duration: "2h 05m",
    releaseDate: "2026-09-28",
    status: "now_showing",
    trending: false,
    description:
      "A retired hitman is dragged back into the criminal underworld when his brother is kidnapped by a ruthless crime syndicate operating under neon-lit streets.",
    cast: ["Leo Archer", "Zara Knight", "Hugo Brennan"],
    director: "Chris Tanaka",
    certificate: "A",
    poster: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=400&h=600&fit=crop",
    backdrop: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=1200&h=600&fit=crop",
    price: 250,
  },
  {
    title: "Stars Between Us",
    genre: ["Romance", "Drama"],
    language: "Hindi",
    rating: 8.5,
    votes: "310K",
    duration: "2h 45m",
    releaseDate: "2026-10-01",
    status: "now_showing",
    trending: true,
    description:
      "Two strangers meet at a rooftop observatory and embark on an emotional journey across three countries, discovering that love transcends every barrier.",
    cast: ["Arjun Mehta", "Kavya Nair", "Rohit Sen"],
    director: "Priya Kapoor",
    certificate: "U",
    poster: "https://images.unsplash.com/photo-1542204165-65bf26472b9b?w=400&h=600&fit=crop",
    backdrop: "https://images.unsplash.com/photo-1542204165-65bf26472b9b?w=1200&h=600&fit=crop",
    price: 240,
  },
  {
    title: "Voidwalker",
    genre: ["Sci-Fi", "Horror"],
    language: "English",
    rating: 7.6,
    votes: "98K",
    duration: "1h 55m",
    releaseDate: "2026-10-18",
    status: "now_showing",
    trending: false,
    description:
      "An astronaut aboard a deep-space station discovers a dimensional rift that brings ancient horrors to life — horrors that exist beyond the laws of physics.",
    cast: ["Mia Donovan", "Viktor Salas", "Linnea Storm"],
    director: "Erik Halvorsen",
    certificate: "A",
    poster: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=400&h=600&fit=crop",
    backdrop: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=1200&h=600&fit=crop",
    price: 270,
  },
  {
    title: "The Last Ember",
    genre: ["Drama", "War"],
    language: "English",
    rating: 9.1,
    votes: "412K",
    duration: "3h 02m",
    releaseDate: "2026-10-22",
    status: "now_showing",
    trending: true,
    description:
      "Based on true events, a field medic navigates the chaos of a forgotten war, fighting to preserve humanity in the face of unimaginable destruction.",
    cast: ["James Harlow", "Elena Vasquez", "Omar Diallo"],
    director: "Samuel Crawford",
    certificate: "A",
    poster: "https://images.unsplash.com/photo-1500462918059-b1a0cb512f1d?w=400&h=600&fit=crop",
    backdrop: "https://images.unsplash.com/photo-1500462918059-b1a0cb512f1d?w=1200&h=600&fit=crop",
    price: 300,
  },
  {
    title: "Phantom Protocol",
    genre: ["Spy", "Action"],
    language: "English",
    rating: 8.0,
    votes: "156K",
    duration: "2h 18m",
    releaseDate: "2026-11-05",
    status: "upcoming",
    trending: false,
    description:
      "Elite spy agency operative Lyra Cross must stop a global terror network from detonating a biological weapon — all while being hunted by her own organization.",
    cast: ["Lyra Monroe", "Claude Renard", "Sasha Petrov"],
    director: "Olivia Hunt",
    certificate: "UA",
    poster: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=400&h=600&fit=crop",
    backdrop: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=1200&h=600&fit=crop",
    price: 290,
  },
  {
    title: "Monsoon Wedding 2.0",
    genre: ["Comedy", "Romance"],
    language: "Hindi",
    rating: 7.8,
    votes: "204K",
    duration: "2h 20m",
    releaseDate: "2026-11-12",
    status: "upcoming",
    trending: false,
    description:
      "A boisterous Punjabi family prepares for a chaotic destination wedding, but when the groom goes missing, the bride discovers something far more important.",
    cast: ["Simran Dhaliwal", "Vikram Johar", "Meena Rao"],
    director: "Ratan Bose",
    certificate: "U",
    poster: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=400&h=600&fit=crop",
    backdrop: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&h=600&fit=crop",
    price: 220,
  },
  {
    title: "Iron Frequency",
    genre: ["Sci-Fi", "Action"],
    language: "English",
    rating: 8.4,
    votes: "287K",
    duration: "2h 35m",
    releaseDate: "2026-11-20",
    status: "upcoming",
    trending: true,
    description:
      "When a military AI goes rogue and seizes control of the world's nuclear arsenal, a team of engineers must hack their way through the digital abyss to stop global annihilation.",
    cast: ["Finn Calloway", "Yuki Tanaka", "Ravi Menon"],
    director: "Brian MacAllister",
    certificate: "UA",
    poster: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=400&h=600&fit=crop",
    backdrop: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=1200&h=600&fit=crop",
    price: 310,
  },
  {
    title: "Dhruv",
    genre: ["Mythology", "Action"],
    language: "Telugu",
    rating: 8.9,
    votes: "521K",
    duration: "2h 55m",
    releaseDate: "2026-11-28",
    status: "upcoming",
    trending: true,
    description:
      "A powerful retelling of the ancient legend of Dhruv — a prince who becomes a star by defeating the gods of darkness through unshakeable devotion and warrior spirit.",
    cast: ["Kiran Tej", "Ananya Reddy", "Balakrishna"],
    director: "S. S. Rathore",
    certificate: "U",
    poster: "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=400&h=600&fit=crop",
    backdrop: "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=1200&h=600&fit=crop",
    price: 320,
  },
  {
    title: "Fractured Light",
    genre: ["Mystery", "Drama"],
    language: "English",
    rating: 8.1,
    votes: "143K",
    duration: "2h 12m",
    releaseDate: "2026-09-15",
    status: "now_showing",
    trending: false,
    description:
      "A photojournalist with amnesia returns to the city where she disappeared five years ago, only to find her own photographs documenting crimes she can't remember committing.",
    cast: ["Iris Dawson", "Marcus Lee", "Theo Blackwell"],
    director: "Camille Dubois",
    certificate: "UA",
    poster: "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=400&h=600&fit=crop",
    backdrop: "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=1200&h=600&fit=crop",
    price: 260,
  },
  {
    title: "Kaliyuga",
    genre: ["Action", "Mythology"],
    language: "Tamil",
    rating: 9.0,
    votes: "388K",
    duration: "3h 10m",
    releaseDate: "2026-10-25",
    status: "now_showing",
    trending: true,
    description:
      "In a dystopian reimagining of ancient India, a warrior clan rises against an immortal dark emperor who has enslaved the world through forbidden magic.",
    cast: ["Rajiv Chandran", "Meghna Pillai", "Sathyaraj"],
    director: "Vijay Shankar",
    certificate: "UA",
    poster: "https://images.unsplash.com/photo-1512070679279-8988d32161be?w=400&h=600&fit=crop",
    backdrop: "https://images.unsplash.com/photo-1512070679279-8988d32161be?w=1200&h=600&fit=crop",
    price: 300,
  },
];

export async function seedMovies() {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/imovies';

  console.log('Connecting to MongoDB for movie seeding...');
  await mongoose.connect(mongoURI);
  console.log('MongoDB connected successfully');

  // Clean up legacy text index if it exists on the collection
  try {
    const rawIndexes = await Movie.collection.indexes();
    const legacyTextIndex = rawIndexes.find((idx) => idx.textIndexVersion || idx.key?._fts === 'text');
    if (legacyTextIndex) {
      console.log(`Dropping legacy text index: ${legacyTextIndex.name}`);
      await Movie.collection.dropIndex(legacyTextIndex.name);
      console.log('Legacy text index dropped successfully.');
    }
  } catch (idxErr) {
    // Index may not exist or not accessible
    console.warn('Note on index check:', idxErr.message);
  }

  // Ensure model schema indexes are initialized
  await Movie.init();

  let insertedCount = 0;
  let updatedCount = 0;

  for (const movieData of sampleMovies) {
    let movie = await Movie.findOne({ title: movieData.title });
    if (movie) {
      Object.assign(movie, movieData);
      await movie.save();
      updatedCount++;
    } else {
      movie = new Movie(movieData);
      await movie.save();
      insertedCount++;
    }
  }

  console.log(`Seeding complete: ${insertedCount} inserted, ${updatedCount} updated.`);
  const totalInDb = await Movie.countDocuments();
  console.log(`Total movies in database: ${totalInDb}`);

  return { insertedCount, updatedCount, totalInDb };
}

// Execute only if invoked directly via CLI (e.g. node src/seeds/seedMovies.js or npm run seed)
const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('seedMovies.js') ||
  process.argv[1].endsWith('seedMovies')
);

if (isDirectRun) {
  seedMovies()
    .then(async () => {
      await mongoose.disconnect();
      console.log('MongoDB disconnected cleanly.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seeding error:', err);
      process.exit(1);
    });
}
