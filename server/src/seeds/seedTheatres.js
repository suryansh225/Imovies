import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Theatre from '../models/Theatre.js';
import Screen from '../models/Screen.js';
import Showtime from '../models/Showtime.js';
import Movie from '../models/Movie.js';

export const sampleTheatres = [
  {
    name: "PVR IMAX Citywalk",
    address: "Saket District Centre",
    city: "New Delhi",
    location: "Saket, New Delhi",
    amenities: ["IMAX", "Dolby Atmos", "4K Laser", "Recliner Seats"],
    rating: 4.7,
    screens: [
      { name: "Audi 1 - IMAX Laser", screenType: "IMAX" },
      { name: "Audi 2 - Dolby Atmos", screenType: "Dolby Atmos" },
      { name: "Audi 3 - Premiere", screenType: "Standard" },
    ],
  },
  {
    name: "INOX Insignia",
    address: "Bandra Kurla Complex",
    city: "Mumbai",
    location: "BKC, Mumbai",
    amenities: ["4DX", "Dolby Atmos", "VIP Lounge", "Fine Dining"],
    rating: 4.8,
    screens: [
      { name: "Insignia Screen 1", screenType: "Gold Class" },
      { name: "Insignia Screen 2 - 4DX", screenType: "4DX" },
    ],
  },
  {
    name: "Cinepolis Luxe",
    address: "Forum Mall, Hosur Road",
    city: "Bengaluru",
    location: "Koramangala, Bengaluru",
    amenities: ["RealD 3D", "Dolby Atmos", "Premium Seating"],
    rating: 4.5,
    screens: [
      { name: "Luxe Screen 1", screenType: "Dolby Atmos" },
      { name: "Luxe Screen 2", screenType: "Standard" },
    ],
  },
  {
    name: "MIRAJ Cinemas",
    address: "Road No. 1, Banjara Hills",
    city: "Hyderabad",
    location: "Banjara Hills, Hyderabad",
    amenities: ["4K Projection", "Atmos Sound", "Recliner Seats"],
    rating: 4.4,
    screens: [
      { name: "Screen 1 - 4K Atmos", screenType: "Dolby Atmos" },
      { name: "Screen 2", screenType: "Standard" },
    ],
  },
  {
    name: "SPI Palazzo",
    address: "Nungambakkam High Road",
    city: "Chennai",
    location: "Nungambakkam, Chennai",
    amenities: ["3D", "Dolby Atmos", "Lounge Access"],
    rating: 4.6,
    screens: [
      { name: "Palazzo Screen 1", screenType: "Dolby Atmos" },
      { name: "Palazzo Screen 2", screenType: "Standard" },
    ],
  },
];

export async function seedTheatresAndShowtimes() {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/imovies';

  console.log('Connecting to MongoDB for theatre and showtime seeding...');
  await mongoose.connect(mongoURI);
  console.log('MongoDB connected successfully');

  // Ensure models initialize indexes
  await Promise.all([Theatre.init(), Screen.init(), Showtime.init()]);

  const seededTheatres = [];
  const seededScreens = [];

  for (const tData of sampleTheatres) {
    let theatre = await Theatre.findOne({ name: tData.name, city: tData.city });
    if (!theatre) {
      theatre = await Theatre.create({
        name: tData.name,
        address: tData.address,
        city: tData.city,
        location: tData.location,
        amenities: tData.amenities,
        rating: tData.rating,
      });
      console.log(`Created theatre: ${theatre.name}`);
    } else {
      theatre.address = tData.address;
      theatre.location = tData.location;
      theatre.amenities = tData.amenities;
      theatre.rating = tData.rating;
      theatre.isActive = true;
      await theatre.save();
      console.log(`Updated theatre: ${theatre.name}`);
    }
    seededTheatres.push(theatre);

    // Create or update screens for this theatre
    for (const sData of tData.screens) {
      let screen = await Screen.findOne({ theatre: theatre._id, name: sData.name });
      if (!screen) {
        screen = await Screen.create({
          theatre: theatre._id,
          name: sData.name,
          screenType: sData.screenType,
          columns: 10,
          seatLayout: {
            premium: ['A', 'B', 'C'],
            gold: ['D', 'E', 'F', 'G'],
            silver: ['H', 'I', 'J', 'K', 'L'],
          },
        });
        console.log(`  Created screen: ${screen.name}`);
      } else {
        screen.screenType = sData.screenType;
        screen.isActive = true;
        await screen.save();
      }
      seededScreens.push(screen);
    }
  }

  // Create showtimes for now_showing movies over the next 7 days
  const nowShowingMovies = await Movie.find({ status: 'now_showing' });
  console.log(`Found ${nowShowingMovies.length} now_showing movies to schedule.`);

  if (nowShowingMovies.length > 0 && seededScreens.length > 0) {
    let createdShowtimes = 0;
    const timeSlots = [
      { startHour: 10, startMin: 30, durationHrs: 2.5 },
      { startHour: 13, startMin: 45, durationHrs: 2.5 },
      { startHour: 17, startMin: 0, durationHrs: 2.5 },
      { startHour: 20, startMin: 30, durationHrs: 2.5 },
    ];

    // Next 7 days
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const baseDate = new Date();
      baseDate.setDate(baseDate.getDate() + dayOffset);
      const year = baseDate.getFullYear();
      const month = baseDate.getMonth();
      const day = baseDate.getDate();

      // Schedule showtimes across theatres
      for (let sIdx = 0; sIdx < seededScreens.length; sIdx++) {
        const screen = seededScreens[sIdx];
        const movie = nowShowingMovies[(sIdx + dayOffset) % nowShowingMovies.length];

        for (let slotIdx = 0; slotIdx < timeSlots.length; slotIdx++) {
          const slot = timeSlots[slotIdx];
          const startTime = new Date(Date.UTC(year, month, day, slot.startHour - 5, slot.startMin - 30)); // adjust for IST
          const endTime = new Date(startTime.getTime() + slot.durationHrs * 60 * 60 * 1000);

          const basePrice = movie.price || 250;
          const pricing = {
            silver: basePrice,
            gold: basePrice + 40,
            premium: basePrice + 120,
          };

          const existingShow = await Showtime.findOne({
            screen: screen._id,
            startTime,
          });

          if (!existingShow) {
            await Showtime.create({
              movie: movie._id,
              theatre: screen.theatre,
              screen: screen._id,
              startTime,
              endTime,
              pricing,
              status: 'scheduled',
              isActive: true,
            });
            createdShowtimes++;
          }
        }
      }
    }
    console.log(`Generated ${createdShowtimes} scheduled showtimes across the next 7 days.`);
  }

  const totalTheatres = await Theatre.countDocuments();
  const totalScreens = await Screen.countDocuments();
  const totalShowtimes = await Showtime.countDocuments();

  console.log(`Summary: ${totalTheatres} theatres, ${totalScreens} screens, ${totalShowtimes} showtimes in database.`);

  return { totalTheatres, totalScreens, totalShowtimes };
}

// Execute directly if run via CLI
const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('seedTheatres.js') ||
  process.argv[1].endsWith('seedTheatres')
);

if (isDirectRun) {
  seedTheatresAndShowtimes()
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
