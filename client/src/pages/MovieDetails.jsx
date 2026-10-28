import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Star,
  Clock,
  Globe,
  Calendar,
  Users,
  Award,
  Ticket,
  ChevronRight,
  X,
  MapPin,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Loader2,
  CreditCard,
  Timer,
  Play,
  Heart,
  Printer,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { movieAPI, showtimeAPI, bookingAPI } from "../services/api";
import { movies as fallbackMovies, theatres as fallbackTheatres } from "../data/movies";
import { useApp } from "../context/AppContext";
import MovieCard from "../components/MovieCard";
import "./MovieDetails.css";

const DEFAULT_SEAT_LAYOUT = {
  premium: ["A", "B"],
  gold: ["C", "D", "E"],
  silver: ["F", "G", "H"],
};

export default function MovieDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, addBooking, toggleWatchlist, isWatchlisted, setTrailerMovie, showToast } = useApp();

  const [movie, setMovie] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);

  // Booking overlay state
  const [bookingStep, setBookingStep] = useState(0); // 0=none, 1=theatre, 2=seats, 3=confirm, 4=success
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [showtimes, setShowtimes] = useState([]);
  const [loadingShows, setLoadingShows] = useState(false);

  const [selectedTheatreId, setSelectedTheatreId] = useState(null);
  const [selectedShowtimeObj, setSelectedShowtimeObj] = useState(null);

  // Real or generated seat availability
  const [availability, setAvailability] = useState(null);
  const [availPricing, setAvailPricing] = useState(null);
  const [loadingAvail, setLoadingAvail] = useState(false);

  // Seats selected by the user in the UI
  const [selectedSeatIds, setSelectedSeatIds] = useState([]);

  // Booking & payment state
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState(null);
  const [confirmedBooking, setConfirmedBooking] = useState(null);

  // ── Movie details ─────────────────────────────────────────────────────────
  const fetchMovieDetails = async () => {
    try {
      setLoading(true);
      const data = await movieAPI.getMovieById(id);
      if (data && data.movie) {
        setMovie(data.movie);
        findRelated(data.movie);
        return;
      }
    } catch {
      // Offline fallback
    }

    const fallback =
      fallbackMovies.find((m) => String(m._id || m.id) === String(id)) ||
      fallbackMovies[0];
    setMovie(fallback);
    findRelated(fallback);
    setLoading(false);
  };

  const findRelated = (currMovie) => {
    const primaryGenre = Array.isArray(currMovie.genre) && currMovie.genre[0];
    const currId = currMovie._id || currMovie.id;
    const rel = fallbackMovies
      .filter((m) => (m._id || m.id) !== currId && m.genre?.includes(primaryGenre))
      .slice(0, 4);
    setRelated(rel.length > 0 ? rel : fallbackMovies.filter((m) => (m._id || m.id) !== currId).slice(0, 4));
    setLoading(false);
  };

  useEffect(() => {
    fetchMovieDetails();
    window.scrollTo(0, 0);
  }, [id]);

  // ── Showtimes generator & API fetch ───────────────────────────────────────
  const generateMockShowtimes = () => {
    const times = ["10:30 AM", "01:15 PM", "04:30 PM", "07:45 PM", "10:15 PM"];
    const generated = [];

    fallbackTheatres.slice(0, 4).forEach((th) => {
      times.forEach((t, i) => {
        generated.push({
          _id: `mock-show-${th.id}-${i}`,
          id: `mock-show-${th.id}-${i}`,
          formattedTime: t,
          startTime: `${selectedDate}T${t.split(" ")[0]}:00Z`,
          status: "scheduled",
          isActive: true,
          theatre: th,
          screen: {
            name: th.screens?.[i % (th.screens?.length || 1)] || "Audi 1 - IMAX",
            screenType: i % 2 === 0 ? "IMAX 4K Laser" : "Dolby Atmos",
            seatLayout: DEFAULT_SEAT_LAYOUT,
          },
          pricing: {
            silver: (movie?.price || 250) - 40,
            gold: movie?.price || 250,
            premium: (movie?.price || 250) + 120,
          },
        });
      });
    });

    return generated;
  };

  const fetchShowtimes = async () => {
    if (!id) return;
    try {
      setLoadingShows(true);
      const data = await showtimeAPI.getShowtimes({ movieId: id, date: selectedDate });
      if (data && data.showtimes && data.showtimes.length > 0) {
        setShowtimes(data.showtimes);
      } else {
        setShowtimes(generateMockShowtimes());
      }
    } catch {
      setShowtimes(generateMockShowtimes());
    } finally {
      setLoadingShows(false);
    }
  };

  useEffect(() => {
    if (bookingStep > 0 && id) fetchShowtimes();
  }, [bookingStep, id, selectedDate]);

  // ── Seat availability ─────────────────────────────────────────────────────
  const generateMockSeatAvailability = () => {
    const bookedSet = new Set(["A3", "A4", "C5", "C6", "D7", "F4", "F5"]);
    const layout = { premium: [], gold: [], silver: [] };

    // Premium rows: A, B
    ["A", "B"].forEach((row) => {
      for (let n = 1; n <= 10; n++) {
        const seatId = `${row}${n}`;
        layout.premium.push({
          seatId,
          row,
          number: n,
          status: bookedSet.has(seatId) ? "booked" : "available",
        });
      }
    });

    // Gold rows: C, D, E
    ["C", "D", "E"].forEach((row) => {
      for (let n = 1; n <= 12; n++) {
        const seatId = `${row}${n}`;
        layout.gold.push({
          seatId,
          row,
          number: n,
          status: bookedSet.has(seatId) ? "booked" : "available",
        });
      }
    });

    // Silver rows: F, G, H
    ["F", "G", "H"].forEach((row) => {
      for (let n = 1; n <= 12; n++) {
        const seatId = `${row}${n}`;
        layout.silver.push({
          seatId,
          row,
          number: n,
          status: bookedSet.has(seatId) ? "booked" : "available",
        });
      }
    });

    return layout;
  };

  const fetchSeatAvailability = async (showtimeId) => {
    try {
      setLoadingAvail(true);
      setSelectedSeatIds([]);
      const data = await bookingAPI.getSeatAvailability(showtimeId);
      if (data && data.availability) {
        setAvailability(data.availability);
        setAvailPricing(data.pricing);
        return;
      }
    } catch {
      // offline fallback
    }

    setAvailability(generateMockSeatAvailability());
    setAvailPricing(
      selectedShowtimeObj?.pricing || {
        silver: (movie?.price || 250) - 40,
        gold: movie?.price || 250,
        premium: (movie?.price || 250) + 120,
      }
    );
    setLoadingAvail(false);
  };

  // Group showtimes by theatre
  const theatreMap = new Map();
  showtimes.forEach((st) => {
    if (!st.theatre) return;
    const tId = st.theatre._id || st.theatre.id;
    if (!theatreMap.has(tId)) theatreMap.set(tId, { theatre: st.theatre, shows: [] });
    theatreMap.get(tId).shows.push(st);
  });
  const groupedTheatres = Array.from(theatreMap.values());

  const getSeatCategory = (row) => {
    if (["A", "B"].includes(row)) return "premium";
    if (["C", "D", "E"].includes(row)) return "gold";
    return "silver";
  };

  const getSeatPrice = (category) => {
    if (availPricing && availPricing[category] !== undefined) return availPricing[category];
    const base = movie?.price || 250;
    if (category === "premium") return base + 120;
    if (category === "gold") return base;
    return base - 40;
  };

  const subtotalPrice = selectedSeatIds.reduce((acc, seatId) => {
    const row = seatId.charAt(0);
    const category = getSeatCategory(row);
    return acc + getSeatPrice(category);
  }, 0);

  const convenienceFee = selectedSeatIds.length > 0 ? 30 * selectedSeatIds.length : 0;
  const gstAmount = Math.round(convenienceFee * 0.18);
  const totalPrice = subtotalPrice + convenienceFee + gstAmount;

  const toggleSeat = (seatId, status) => {
    if (status === "booked") return;
    setSelectedSeatIds((prev) =>
      prev.includes(seatId) ? prev.filter((s) => s !== seatId) : [...prev, seatId]
    );
  };

  // Start booking
  const handleStartBooking = () => {
    setBookingStep(1);
    fetchShowtimes();
  };

  const handleSelectShowtime = (theatreId, showtime) => {
    setSelectedTheatreId(theatreId);
    setSelectedShowtimeObj(showtime);
  };

  const handleProceedToSeats = () => {
    if (!selectedShowtimeObj) return;
    setBookingStep(2);
    fetchSeatAvailability(selectedShowtimeObj._id || selectedShowtimeObj.id);
  };

  // Confirm and checkout
  const handleConfirmAndPay = async () => {
    if (!selectedShowtimeObj || selectedSeatIds.length === 0) return;
    setBookingLoading(true);
    setBookingError(null);

    // Try real API first
    try {
      const data = await bookingAPI.createBooking(
        selectedShowtimeObj._id || selectedShowtimeObj.id,
        selectedSeatIds
      );
      if (data && data.booking) {
        setConfirmedBooking(data.booking);
        addBooking(data.booking);
        setBookingStep(4);
        setBookingLoading(false);
        return;
      }
    } catch {
      // Fallback to instant mock pass
    }

    // Generate local verified pass
    const bookingRef = `IMV-${Math.floor(100000 + Math.random() * 900000)}`;
    const mockConfirmed = {
      _id: `local-book-${Date.now()}`,
      id: `local-book-${Date.now()}`,
      bookingRef,
      movie: {
        title: movie.title,
        poster: movie.poster,
        duration: movie.duration,
        certificate: movie.certificate,
      },
      theatre: {
        name: selectedShowtimeObj.theatre?.name || "PVR IMAX Select",
        location: selectedShowtimeObj.theatre?.location || "Saket, New Delhi",
      },
      showtime: {
        startTime: `${selectedDate}T${selectedShowtimeObj.formattedTime || "07:30 PM"}`,
        formattedTime: selectedShowtimeObj.formattedTime || "07:30 PM",
        screen: selectedShowtimeObj.screen || { name: "Audi 1 - IMAX Laser" },
      },
      seats: selectedSeatIds.map((sId) => ({ seatId: sId, price: getSeatPrice(getSeatCategory(sId.charAt(0))) })),
      totalAmount: totalPrice,
      paymentStatus: "paid",
      createdAt: new Date().toISOString(),
      status: "confirmed",
    };

    setTimeout(() => {
      setConfirmedBooking(mockConfirmed);
      addBooking(mockConfirmed);
      setBookingStep(4);
      setBookingLoading(false);
    }, 700);
  };

  const resetBooking = () => {
    setBookingStep(0);
    setSelectedTheatreId(null);
    setSelectedShowtimeObj(null);
    setSelectedSeatIds([]);
    setAvailability(null);
    setConfirmedBooking(null);
  };

  const DATES = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toISOString().split("T")[0];
  });

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });

  if (loading || !movie) {
    return (
      <div className="movie-details__loading-screen">
        <div className="auth-spinner" />
        <p>Loading cinema experience...</p>
      </div>
    );
  }

  const isMovieWatchlisted = isWatchlisted(movie._id || movie.id);

  return (
    <div className="movie-details">
      {/* ── Booking Modal Overlay ── */}
      {bookingStep > 0 && bookingStep < 4 && (
        <div className="booking-overlay" onClick={resetBooking}>
          <div className="booking-panel" onClick={(e) => e.stopPropagation()}>
            <div className="booking-panel__header">
              <div>
                <h3>
                  {bookingStep === 1 && "Select Showtime & Cinema"}
                  {bookingStep === 2 && "Pick Your Seats"}
                  {bookingStep === 3 && "Review Order & Pay"}
                </h3>
                <span className="booking-panel__movie-title">{movie.title}</span>
              </div>
              <button className="booking-panel__close" onClick={resetBooking} aria-label="Close">
                <X size={20} />
              </button>
            </div>

            {/* Step 1: Theatre & Showtimes */}
            {bookingStep === 1 && (
              <div className="booking-step">
                <div className="booking-section">
                  <label className="booking-section__label">Select Date</label>
                  <div className="booking-dates">
                    {DATES.map((d) => (
                      <button
                        key={d}
                        className={`booking-date${d === selectedDate ? " booking-date--active" : ""}`}
                        onClick={() => {
                          setSelectedDate(d);
                          setSelectedShowtimeObj(null);
                        }}
                      >
                        <span className="booking-date__day">
                          {new Date(d).toLocaleDateString("en-US", { weekday: "short" })}
                        </span>
                        <span className="booking-date__num">
                          {new Date(d).getDate()}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="booking-section">
                  <label className="booking-section__label">Available Cinemas & Shows</label>
                  {loadingShows ? (
                    <div className="booking-loading">
                      <div className="auth-spinner" />
                      <p>Finding best theatre showtimes...</p>
                    </div>
                  ) : (
                    <div className="booking-theatres-list">
                      {groupedTheatres.map(({ theatre, shows }) => {
                        const tId = theatre._id || theatre.id;
                        return (
                          <div key={tId} className="booking-theatre-card">
                            <div className="booking-theatre-card__header">
                              <div>
                                <h4>{theatre.name}</h4>
                                <p className="booking-theatre-card__loc">
                                  <MapPin size={12} /> {theatre.location || theatre.address}
                                </p>
                              </div>
                              <div className="booking-theatre-card__amenities">
                                {(theatre.amenities || []).slice(0, 3).map((a) => (
                                  <span key={a} className="amenity-pill">
                                    {a}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div className="booking-showtimes-row">
                              {shows.map((s) => {
                                const sId = s._id || s.id;
                                const isSelected =
                                  (selectedShowtimeObj?._id || selectedShowtimeObj?.id) === sId;
                                return (
                                  <button
                                    key={sId}
                                    className={`showtime-pill${isSelected ? " showtime-pill--active" : ""}`}
                                    onClick={() => handleSelectShowtime(tId, s)}
                                  >
                                    <span className="showtime-pill__time">{s.formattedTime}</span>
                                    <span className="showtime-pill__type">
                                      {s.screen?.screenType || "IMAX Laser"}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="booking-panel__footer">
                  <div className="booking-panel__selected-info">
                    {selectedShowtimeObj ? (
                      <div>
                        <strong>{selectedShowtimeObj.theatre?.name}</strong> ·{" "}
                        {selectedShowtimeObj.formattedTime}
                      </div>
                    ) : (
                      <span>Please select a showtime to proceed</span>
                    )}
                  </div>
                  <button
                    className="booking-btn-primary"
                    disabled={!selectedShowtimeObj}
                    onClick={handleProceedToSeats}
                  >
                    Select Seats <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Interactive Seat Layout */}
            {bookingStep === 2 && (
              <div className="booking-step">
                <div className="seat-selection-header">
                  <div>
                    <strong>{selectedShowtimeObj?.theatre?.name}</strong>
                    <span className="seat-selection-sub">
                      {selectedShowtimeObj?.formattedTime} · {formatDate(selectedDate)}
                    </span>
                  </div>
                  <div className="seat-legend">
                    <span className="legend-item">
                      <span className="legend-box legend-box--available" /> Available
                    </span>
                    <span className="legend-item">
                      <span className="legend-box legend-box--selected" /> Selected
                    </span>
                    <span className="legend-item">
                      <span className="legend-box legend-box--booked" /> Booked
                    </span>
                  </div>
                </div>

                {/* Curved Cinema Screen */}
                <div className="cinema-screen-wrap">
                  <div className="cinema-screen-curve" />
                  <span className="cinema-screen-text">
                    ALL EYES THIS WAY · CURVED CINEMA SCREEN
                  </span>
                </div>

                {/* Seat Rows */}
                {loadingAvail ? (
                  <div className="booking-loading">
                    <div className="auth-spinner" />
                    <p>Loading auditorium seating plan...</p>
                  </div>
                ) : availability ? (
                  <div className="seat-layout-grid">
                    {["premium", "gold", "silver"].map((cat) => {
                      const seats = availability[cat] || [];
                      if (seats.length === 0) return null;

                      const rowsMap = {};
                      seats.forEach((s) => {
                        if (!rowsMap[s.row]) rowsMap[s.row] = [];
                        rowsMap[s.row].push(s);
                      });

                      const catName =
                        cat === "premium" ? "VIP Recliners" : cat === "gold" ? "Prime Gold" : "Classic Silver";
                      const price = getSeatPrice(cat);

                      return (
                        <div key={cat} className="seat-category-block">
                          <div className="seat-category-title">
                            <span>{catName}</span>
                            <span className="seat-category-price">₹{price}</span>
                          </div>

                          {Object.entries(rowsMap).map(([row, rowSeats]) => (
                            <div key={row} className="seat-row">
                              <span className="seat-row-name">{row}</span>
                              <div className="seat-row-seats">
                                {rowSeats.map((seat) => {
                                  const isSelected = selectedSeatIds.includes(seat.seatId);
                                  const isBooked = seat.status === "booked";
                                  return (
                                    <button
                                      key={seat.seatId}
                                      className={`auditorium-seat${
                                        isBooked
                                          ? " auditorium-seat--booked"
                                          : isSelected
                                          ? " auditorium-seat--selected"
                                          : ""
                                      }`}
                                      onClick={() => toggleSeat(seat.seatId, seat.status)}
                                      disabled={isBooked}
                                      title={`Seat ${seat.seatId} · ₹${price}`}
                                    >
                                      {seat.number}
                                    </button>
                                  );
                                })}
                              </div>
                              <span className="seat-row-name">{row}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                <div className="booking-panel__footer">
                  <div className="booking-panel__selected-info">
                    {selectedSeatIds.length > 0 ? (
                      <div>
                        <span>
                          Seats: <strong>{selectedSeatIds.join(", ")}</strong>
                        </span>
                        <div className="seat-price-total">₹{totalPrice.toLocaleString()}</div>
                      </div>
                    ) : (
                      <span>Select at least 1 seat</span>
                    )}
                  </div>
                  <div className="booking-panel__btn-group">
                    <button className="booking-btn-secondary" onClick={() => setBookingStep(1)}>
                      Back
                    </button>
                    <button
                      className="booking-btn-primary"
                      disabled={selectedSeatIds.length === 0}
                      onClick={() => setBookingStep(3)}
                    >
                      Checkout <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Checkout Breakdown */}
            {bookingStep === 3 && (
              <div className="booking-step">
                <div className="checkout-card">
                  <div className="checkout-movie-info">
                    <img src={movie.poster} alt={movie.title} className="checkout-poster" />
                    <div>
                      <h4 className="checkout-title">{movie.title}</h4>
                      <p className="checkout-theatre">
                        <MapPin size={13} /> {selectedShowtimeObj?.theatre?.name}
                      </p>
                      <p className="checkout-showtime">
                        <Calendar size={13} /> {formatDate(selectedDate)} at{" "}
                        {selectedShowtimeObj?.formattedTime}
                      </p>
                      <div className="checkout-seats-tags">
                        {selectedSeatIds.map((s) => (
                          <span key={s} className="checkout-seat-tag">
                            Seat {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="checkout-breakdown">
                    <div className="breakdown-row">
                      <span>Ticket Subtotal ({selectedSeatIds.length} seats)</span>
                      <span>₹{subtotalPrice.toLocaleString()}</span>
                    </div>
                    <div className="breakdown-row">
                      <span>Convenience Fee</span>
                      <span>₹{convenienceFee.toLocaleString()}</span>
                    </div>
                    <div className="breakdown-row">
                      <span>Integrated GST (18%)</span>
                      <span>₹{gstAmount.toLocaleString()}</span>
                    </div>
                    <div className="breakdown-divider" />
                    <div className="breakdown-row breakdown-row--total">
                      <span>Grand Total</span>
                      <span>₹{totalPrice.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="checkout-perks">
                    <ShieldCheck size={16} className="perk-icon" />
                    <span>Instant Digital QR M-Ticket sent via SMS & saved to Ticket Wallet</span>
                  </div>
                </div>

                <div className="booking-panel__footer">
                  <button className="booking-btn-secondary" onClick={() => setBookingStep(2)}>
                    Back
                  </button>
                  <button
                    className="booking-btn-primary"
                    disabled={bookingLoading}
                    onClick={handleConfirmAndPay}
                  >
                    {bookingLoading ? (
                      <>
                        <Loader2 size={16} className="auth-spinner" /> Reserving...
                      </>
                    ) : (
                      <>
                        <CreditCard size={16} /> Pay &amp; Confirm · ₹{totalPrice.toLocaleString()}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Step 4: Digital Boarding Pass Ticket Modal ── */}
      {bookingStep === 4 && confirmedBooking && (
        <div className="booking-overlay" onClick={resetBooking}>
          <div className="ticket-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="ticket-modal__header">
              <div className="ticket-modal__success-badge">
                <CheckCircle size={20} />
                <span>BOOKING CONFIRMED</span>
              </div>
              <button className="booking-panel__close" onClick={resetBooking}>
                <X size={18} />
              </button>
            </div>

            {/* Boarding Pass Aesthetic */}
            <div className="boarding-pass">
              <div className="boarding-pass__top">
                <div className="boarding-pass__brand">
                  i<span>Movies</span> CINEMA PASS
                </div>
                <div className="boarding-pass__ref">
                  REF: <strong>{confirmedBooking.bookingRef}</strong>
                </div>
              </div>

              <div className="boarding-pass__body">
                <div className="boarding-pass__movie-row">
                  <div>
                    <h3>{confirmedBooking.movie?.title || movie.title}</h3>
                    <p className="boarding-pass__sub">
                      {confirmedBooking.theatre?.name} · {confirmedBooking.theatre?.location}
                    </p>
                  </div>
                  <div className="boarding-pass__cert">{movie.certificate || "UA"}</div>
                </div>

                <div className="boarding-pass__grid">
                  <div className="boarding-pass__col">
                    <span className="col-label">DATE</span>
                    <span className="col-val">{formatDate(selectedDate)}</span>
                  </div>
                  <div className="boarding-pass__col">
                    <span className="col-label">TIME</span>
                    <span className="col-val">{confirmedBooking.showtime?.formattedTime}</span>
                  </div>
                  <div className="boarding-pass__col">
                    <span className="col-label">SCREEN</span>
                    <span className="col-val">
                      {confirmedBooking.showtime?.screen?.name || "Audi 1"}
                    </span>
                  </div>
                  <div className="boarding-pass__col">
                    <span className="col-label">SEATS</span>
                    <span className="col-val col-val--accent">
                      {confirmedBooking.seats?.map((s) => s.seatId).join(", ")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="boarding-pass__divider">
                <div className="divider-notch divider-notch--left" />
                <div className="divider-line" />
                <div className="divider-notch divider-notch--right" />
              </div>

              <div className="boarding-pass__bottom">
                <div className="boarding-pass__qr-box">
                  {/* Digital QR Graphic */}
                  <div className="simulated-qr">
                    <div className="qr-corner qr-tl" />
                    <div className="qr-corner qr-tr" />
                    <div className="qr-corner qr-bl" />
                    <div className="qr-center" />
                  </div>
                  <span className="qr-hint">Scan at Cinema Turnstile</span>
                </div>

                <div className="boarding-pass__total">
                  <span className="col-label">AMOUNT PAID</span>
                  <span className="total-val">₹{confirmedBooking.totalAmount?.toLocaleString()}</span>
                  <span className="paid-stamp">PAID VERIFIED</span>
                </div>
              </div>
            </div>

            <div className="ticket-modal__actions">
              <button
                className="ticket-btn ticket-btn--print"
                onClick={() => window.print()}
              >
                <Printer size={16} /> Print / Save PDF
              </button>
              <button
                className="ticket-btn ticket-btn--primary"
                onClick={() => {
                  resetBooking();
                  navigate("/my-bookings");
                }}
              >
                Go to My Bookings <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Movie Details Hero Backdrop ── */}
      <div
        className="movie-details__backdrop"
        style={{ backgroundImage: `url(${movie.backdrop || movie.poster})` }}
      >
        <div className="movie-details__backdrop-overlay" />
        <div className="movie-details__backdrop-glow" />
      </div>

      {/* ── Movie Details Main Content ── */}
      <div className="container">
        <div className="movie-details__inner">
          <div className="movie-details__poster-col">
            <div className="movie-details__poster-wrap">
              <img src={movie.poster} alt={movie.title} className="movie-details__poster" />
              <button
                className="movie-details__play-badge"
                onClick={() => setTrailerMovie(movie)}
                title="Watch Trailer"
              >
                <Play size={24} fill="currentColor" />
                <span>Trailer</span>
              </button>
            </div>
          </div>

          <div className="movie-details__info-col">
            {/* Badges */}
            <div className="movie-details__badges">
              {movie.certificate && (
                <span className="movie-cert-badge">{movie.certificate}</span>
              )}
              <span
                className={`movie-status-badge movie-status-badge--${
                  movie.status === "now_showing" ? "now" : "upcoming"
                }`}
              >
                {movie.status === "now_showing" ? "Now Showing in Theatres" : "Coming Soon"}
              </span>
              <span className="movie-format-pill">IMAX 4K Laser</span>
              <span className="movie-format-pill">Dolby Atmos</span>
            </div>

            {/* Title */}
            <h1 className="movie-details__title">{movie.title}</h1>

            {/* Meta Row */}
            <div className="movie-details__meta">
              <div className="meta-rating">
                <Star size={18} fill="#ffc107" color="#ffc107" />
                <span className="rating-score">{movie.rating}</span>
                {movie.votes && <span className="rating-votes">({movie.votes} votes)</span>}
              </div>
              <span className="meta-dot">·</span>
              <span className="meta-item">
                <Clock size={15} /> {movie.duration}
              </span>
              <span className="meta-dot">·</span>
              <span className="meta-item">
                <Globe size={15} /> {movie.language}
              </span>
              {movie.releaseDate && (
                <>
                  <span className="meta-dot">·</span>
                  <span className="meta-item">
                    <Calendar size={15} />{" "}
                    {new Date(movie.releaseDate).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </>
              )}
            </div>

            {/* Genre chips */}
            {Array.isArray(movie.genre) && movie.genre.length > 0 && (
              <div className="movie-details__genres">
                {movie.genre.map((g) => (
                  <span key={g} className="movie-genre-chip">
                    {g}
                  </span>
                ))}
              </div>
            )}

            {/* Synopsis */}
            <p className="movie-details__desc">{movie.description}</p>

            {/* Cast & Crew Cards */}
            <div className="movie-details__credits">
              {movie.director && (
                <div className="credit-card">
                  <span className="credit-role">DIRECTOR</span>
                  <span className="credit-name">{movie.director}</span>
                </div>
              )}
              {Array.isArray(movie.cast) && movie.cast.length > 0 && (
                <div className="credit-card">
                  <span className="credit-role">STARRING</span>
                  <span className="credit-name">{movie.cast.join(", ")}</span>
                </div>
              )}
            </div>

            {/* Pricing & CTA Buttons */}
            <div className="movie-details__cta-bar">
              <div className="cta-price-group">
                <span className="cta-price-label">Tickets starting from</span>
                <span className="cta-price-val">₹{movie.price || 250}</span>
              </div>

              <div className="cta-buttons">
                {movie.status === "now_showing" ? (
                  <button
                    className="cta-book-btn"
                    onClick={handleStartBooking}
                    id="start-booking-btn"
                  >
                    <Ticket size={18} /> Book Tickets
                  </button>
                ) : (
                  <button className="cta-book-btn cta-book-btn--disabled" disabled>
                    <Calendar size={18} /> Advance Bookings Opening Soon
                  </button>
                )}

                <button
                  className="cta-trailer-btn"
                  onClick={() => setTrailerMovie(movie)}
                >
                  <Play size={16} fill="currentColor" /> Watch Trailer
                </button>

                <button
                  className={`cta-watchlist-btn${isMovieWatchlisted ? " active" : ""}`}
                  onClick={() => toggleWatchlist(movie)}
                  title={isMovieWatchlisted ? "In Watchlist" : "Save to Watchlist"}
                >
                  <Heart size={18} fill={isMovieWatchlisted ? "currentColor" : "none"} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Related Movies ── */}
        {related.length > 0 && (
          <div className="movie-details__related-section">
            <h2 className="related-title">Recommended for You</h2>
            <div className="related-grid">
              {related.map((m) => (
                <MovieCard key={m._id || m.id} movie={m} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
