# 🎬 iMovies

A movie ticket booking app: browse movies and theatres, pick a showtime and seats, and pay with Razorpay.

- **client/** – React 19 + Vite single-page app
- **server/** – Node.js + Express + MongoDB (Mongoose) REST API

## Project structure

```
iMovies/
├── client/                     # Frontend (React + Vite)
│   ├── public/                 # Static files (favicon, icons)
│   ├── src/
│   │   ├── assets/             # Images and SVGs
│   │   ├── components/         # Reusable UI (Navbar, Footer, MovieCard, SectionHeader)
│   │   ├── context/            # Global state (AppContext)
│   │   ├── data/               # Static/sample data
│   │   ├── pages/              # Route-level screens (Home, Movies, MovieDetails,
│   │   │                       #   Theatres, MyBookings, Login, Register)
│   │   ├── services/           # API client (api.js)
│   │   ├── App.jsx             # Routes
│   │   └── main.jsx            # Entry point
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── server/                     # Backend (Express + MongoDB)
│   ├── src/
│   │   ├── controllers/        # Request handlers
│   │   ├── middleware/         # Auth (JWT) middleware
│   │   ├── models/             # Mongoose schemas
│   │   ├── routes/             # API route definitions
│   │   ├── seeds/              # Database seed scripts
│   │   ├── services/           # Third-party integrations (Razorpay)
│   │   ├── db.js               # MongoDB connection
│   │   └── server.js           # App entry point
│   ├── tests/                  # API tests
│   ├── .env.example
│   └── package.json
│
├── package.json                # Root scripts to run everything together
├── .gitignore
└── README.md
```

## Getting started

### 1. Install dependencies
```bash
npm run install:all
```

### 2. Configure environment
```bash
cp server/.env.example server/.env   # set MONGODB_URI, JWT_SECRET, Razorpay keys
cp client/.env.example client/.env   # optional: VITE_API_URL
```

### 3. Seed the database (optional)
```bash
npm run seed
```

### 4. Run
```bash
npm run dev          # client (http://localhost:5173) + server (http://localhost:5000)
```

## Scripts (run from the project root)

| Command              | Description                              |
| -------------------- | ---------------------------------------- |
| `npm run dev`        | Start client and server together         |
| `npm run dev:client` | Start only the Vite dev server           |
| `npm run dev:server` | Start only the API (nodemon)             |
| `npm run build`      | Production build of the client           |
| `npm run lint`       | Lint the client                          |
| `npm run seed`       | Seed movies and theatres                 |
| `npm test`           | Run server tests                         |
