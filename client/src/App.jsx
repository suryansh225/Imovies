import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ToastContainer from "./components/Toast";
import TrailerModal from "./components/TrailerModal";
import Home from "./pages/Home";
import Movies from "./pages/Movies";
import MovieDetails from "./pages/MovieDetails";
import Watchlist from "./pages/Watchlist";
import Login from "./pages/Login";
import Register from "./pages/Register";
import MyBookings from "./pages/MyBookings";
import Theatres from "./pages/Theatres";
import "./App.css";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <ScrollToTop />
        <div className="app">
          <Navbar />
          <main className="app__main">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/movies" element={<Movies />} />
              <Route path="/movie/:id" element={<MovieDetails />} />
              <Route path="/watchlist" element={<Watchlist />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/my-bookings" element={<MyBookings />} />
              <Route path="/theatres" element={<Theatres />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
          <Footer />
          <TrailerModal />
          <ToastContainer />
        </div>
      </BrowserRouter>
    </AppProvider>
  );
}

function NotFound() {
  return (
    <div
      style={{
        minHeight: "75vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.2rem",
        color: "rgba(255,255,255,0.6)",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <span style={{ fontSize: "4.5rem", lineHeight: 1 }}>🎬</span>
      <h2 style={{ color: "#fff", fontSize: "2rem", fontWeight: 800, margin: 0 }}>
        Screenplay Not Found (404)
      </h2>
      <p style={{ margin: 0, maxWidth: 420 }}>
        The scene or feature you are trying to view does not exist or may have been relocated.
      </p>
      <a
        href="/"
        style={{
          background: "var(--accent, #e50914)",
          color: "#fff",
          fontWeight: 700,
          textDecoration: "none",
          padding: "0.75rem 1.6rem",
          borderRadius: "50px",
          marginTop: "0.5rem",
          boxShadow: "0 4px 15px rgba(229, 9, 20, 0.4)",
        }}
      >
        ← Return to Main Screen
      </a>
    </div>
  );
}
