import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authAPI, bookingAPI } from "../services/api";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser]                       = useState(null);
  const [token, setToken]                     = useState(null);
  const [bookings, setBookings]               = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [searchQuery, setSearchQuery]         = useState("");
  const [loading, setLoading]                 = useState(true); // Initial auth check
  const [watchlist, setWatchlist]             = useState(() => {
    try {
      const saved = localStorage.getItem("imovies_watchlist");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [toasts, setToasts]                   = useState([]);
  const [trailerMovie, setTrailerMovie]       = useState(null);

  // ── Toast Notifications ───────────────────────────────────────────────────
  const showToast = useCallback((message, type = "info") => {
    const id = Date.now() + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Watchlist Management ──────────────────────────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem("imovies_watchlist", JSON.stringify(watchlist));
    } catch { /* ignore */ }
  }, [watchlist]);

  const toggleWatchlist = useCallback((movie) => {
    const mId = movie._id || movie.id;
    setWatchlist((prev) => {
      const exists = prev.some((m) => (m._id || m.id) === mId);
      if (exists) {
        showToast(`Removed "${movie.title}" from Watchlist`, "info");
        return prev.filter((m) => (m._id || m.id) !== mId);
      } else {
        showToast(`Added "${movie.title}" to Watchlist!`, "success");
        return [...prev, movie];
      }
    });
  }, [showToast]);

  const isWatchlisted = useCallback((mId) => {
    return watchlist.some((m) => (m._id || m.id) === mId);
  }, [watchlist]);

  // ── Fetch user's bookings (with offline/demo fallback) ────────────────────
  const fetchBookings = useCallback(async () => {
    setBookingsLoading(true);
    try {
      const data = await bookingAPI.getMyBookings();
      if (data && data.bookings) {
        setBookings(data.bookings);
        return;
      }
    } catch {
      // Fallback: check localStorage for offline bookings
    }

    try {
      const savedLocal = localStorage.getItem("imovies_local_bookings");
      if (savedLocal) {
        setBookings(JSON.parse(savedLocal));
      } else {
        setBookings([]);
      }
    } catch {
      setBookings([]);
    } finally {
      setBookingsLoading(false);
    }
  }, []);

  // ── Restore session on load ───────────────────────────────────────────────
  useEffect(() => {
    const initializeAuth = async () => {
      const savedToken = localStorage.getItem("imovies_token");

      if (savedToken) {
        setToken(savedToken);
        try {
          const data = await authAPI.getMe();
          if (data && data.user) {
            setUser(data.user);
            localStorage.setItem("imovies_user", JSON.stringify(data.user));
            await fetchBookings();
          }
        } catch (error) {
          console.warn("Session expired or invalid:", error.message);
          localStorage.removeItem("imovies_token");
          localStorage.removeItem("imovies_user");
          setUser(null);
          setToken(null);
        }
      } else {
        const savedUser = localStorage.getItem("imovies_user");
        if (savedUser) {
          try {
            setUser(JSON.parse(savedUser));
          } catch {
            localStorage.removeItem("imovies_user");
          }
        }
      }

      // Load bookings (either backend or local demo)
      await fetchBookings();
      setLoading(false);
    };

    initializeAuth();
  }, [fetchBookings]);

  // ── Auth actions ──────────────────────────────────────────────────────────
  const loginUser = async (userData, userToken) => {
    setUser(userData);
    localStorage.setItem("imovies_user", JSON.stringify(userData));
    if (userToken) {
      setToken(userToken);
      localStorage.setItem("imovies_token", userToken);
    }
    showToast(`Welcome back, ${userData.name || "Cinema Lover"}!`, "success");
    await fetchBookings();
  };

  const logoutUser = async () => {
    try { await authAPI.logout(); } catch { /* continue */ }
    setUser(null);
    setToken(null);
    setBookings([]);
    localStorage.removeItem("imovies_user");
    localStorage.removeItem("imovies_token");
    showToast("You have been signed out.", "info");
  };

  // ── Booking actions ───────────────────────────────────────────────────────
  const addBooking = (booking) => {
    setBookings((prev) => {
      const updated = [booking, ...prev];
      try {
        localStorage.setItem("imovies_local_bookings", JSON.stringify(updated));
      } catch { /* ignore */ }
      return updated;
    });
    showToast("Booking Confirmed! Seats reserved.", "success");
  };

  const cancelBooking = async (bookingId, reason = "") => {
    setBookings((prev) => {
      const updated = prev.map((b) =>
        (b._id || b.id) === bookingId ? { ...b, status: "cancelled" } : b
      );
      try {
        localStorage.setItem("imovies_local_bookings", JSON.stringify(updated));
      } catch { /* ignore */ }
      return updated;
    });

    try {
      await bookingAPI.cancelBooking(bookingId, reason);
    } catch {
      // Local cancel is preserved
    }
    showToast("Booking was successfully cancelled.", "info");
  };

  return (
    <AppContext.Provider
      value={{
        user,
        token,
        login: loginUser,
        logout: logoutUser,
        bookings,
        bookingsLoading,
        addBooking,
        cancelBooking,
        fetchBookings,
        searchQuery,
        setSearchQuery,
        loading,
        setLoading,
        watchlist,
        toggleWatchlist,
        isWatchlisted,
        toasts,
        showToast,
        removeToast,
        trailerMovie,
        setTrailerMovie,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
};
