import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Ticket,
  Calendar,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  Film,
  ArrowRight,
  Printer,
  Sparkles,
  AlertCircle,
  QrCode,
  Download,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import "./MyBookings.css";

export default function MyBookings() {
  const { user, bookings, bookingsLoading, cancelBooking, fetchBookings } = useApp();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("all");
  const [cancellingId, setCancellingId] = useState(null);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const now = new Date();

  const upcoming = bookings.filter((b) => {
    if (b.status === "cancelled") return false;
    const start = b.showtime?.startTime ? new Date(b.showtime.startTime) : null;
    return start ? start >= now : true;
  });

  const past = bookings.filter((b) => {
    if (b.status === "cancelled") return false;
    const start = b.showtime?.startTime ? new Date(b.showtime.startTime) : null;
    return start ? start < now : false;
  });

  const cancelled = bookings.filter((b) => b.status === "cancelled");

  const displayedBookings =
    activeTab === "upcoming"
      ? upcoming
      : activeTab === "past"
      ? past
      : activeTab === "cancelled"
      ? cancelled
      : bookings;

  const formatDate = (iso) => {
    if (!iso) return "Today";
    try {
      return new Date(iso).toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  };

  const handleCancel = async (booking) => {
    if (
      !window.confirm(
        `Are you sure you want to cancel booking ${booking.bookingRef}? A full refund will be credited to the original payment source.`
      )
    )
      return;

    const bookingId = booking._id || booking.id;
    setCancellingId(bookingId);
    try {
      await cancelBooking(bookingId, "Cancelled by user");
    } finally {
      setCancellingId(null);
    }
  };

  // Empty state when no user and no bookings
  if (!user && bookings.length === 0) {
    return (
      <div className="my-bookings">
        <div className="my-bookings__empty-auth">
          <div className="empty-auth-icon">
            <Film size={48} />
          </div>
          <h2>Cinema Ticket Wallet</h2>
          <p>
            Sign in to access your digital tickets, booking history, and instant QR entry passes.
          </p>
          <div className="my-bookings__empty-actions">
            <Link to="/login" className="mb-btn-primary" id="mb-login-btn">
              Sign In
            </Link>
            <Link to="/register" className="mb-btn-secondary" id="mb-register-btn">
              Create Account
            </Link>
          </div>
          <Link to="/movies" className="mb-explore-link">
            Browse Movies &amp; Book Tickets <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="my-bookings">
      {/* ── Page Header ── */}
      <div className="my-bookings__header">
        <div className="container">
          <div className="my-bookings__header-inner">
            <div className="my-bookings__title-group">
              <div className="my-bookings__icon">
                <Ticket size={26} />
              </div>
              <div>
                <h1>My Ticket Wallet</h1>
                <p>
                  Manage your confirmed bookings, download digital passes, and scan at turnstiles
                </p>
              </div>
            </div>

            {!user && bookings.length > 0 && (
              <div className="my-bookings__guest-pill">
                <span>Guest Session · Sign in to permanently save your tickets</span>
                <Link to="/login" className="guest-login-link">
                  Sign In
                </Link>
              </div>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="my-bookings__tabs">
            <button
              className={`mb-tab${activeTab === "all" ? " active" : ""}`}
              onClick={() => setActiveTab("all")}
            >
              All Bookings ({bookings.length})
            </button>
            <button
              className={`mb-tab${activeTab === "upcoming" ? " active" : ""}`}
              onClick={() => setActiveTab("upcoming")}
            >
              Upcoming Shows ({upcoming.length})
            </button>
            <button
              className={`mb-tab${activeTab === "past" ? " active" : ""}`}
              onClick={() => setActiveTab("past")}
            >
              Past ({past.length})
            </button>
            <button
              className={`mb-tab${activeTab === "cancelled" ? " active" : ""}`}
              onClick={() => setActiveTab("cancelled")}
            >
              Cancelled ({cancelled.length})
            </button>
          </div>
        </div>
      </div>

      <div className="container">
        {displayedBookings.length === 0 ? (
          <div className="my-bookings__empty-list">
            <Ticket size={48} className="empty-list-icon" />
            <h3>No bookings found in this tab</h3>
            <p>Ready for your next movie night? Explore now showing blockbusters!</p>
            <Link to="/movies" className="mb-btn-primary">
              Book Tickets <ArrowRight size={15} />
            </Link>
          </div>
        ) : (
          <div className="my-bookings__grid">
            {displayedBookings.map((b) => {
              const bId = b._id || b.id;
              const isCancelling = cancellingId === bId;
              const isCancelled = b.status === "cancelled";
              const movieTitle = b.movie?.title || "Movie Title";
              const poster =
                b.movie?.poster ||
                "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&h=600&fit=crop";
              const theatreName = b.theatre?.name || "Cinema Hall";
              const theatreLoc = b.theatre?.location || "City Centre";
              const screenName = b.showtime?.screen?.name || "Audi 1";
              const time =
                b.showtime?.formattedTime ||
                (b.showtime?.startTime
                  ? new Date(b.showtime.startTime).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })
                  : "07:30 PM");
              const seatString =
                Array.isArray(b.seats) && b.seats.length > 0
                  ? b.seats.map((s) => s.seatId || s).join(", ")
                  : "Seat A1, A2";

              return (
                <div
                  key={bId}
                  className={`ticket-card${isCancelled ? " ticket-card--cancelled" : ""}`}
                >
                  <div className="ticket-card__glow" />

                  {/* Left Movie Banner */}
                  <div className="ticket-card__left">
                    <img src={poster} alt={movieTitle} className="ticket-card__poster" />
                    <div className="ticket-card__poster-overlay" />
                  </div>

                  {/* Right Pass Details */}
                  <div className="ticket-card__right">
                    <div className="ticket-card__header">
                      <div>
                        <div className="ticket-card__ref-tag">
                          REF: <strong>{b.bookingRef || `IMV-${bId.slice(-6)}`}</strong>
                        </div>
                        <h3 className="ticket-card__title">{movieTitle}</h3>
                      </div>

                      <div className="ticket-card__badge-wrap">
                        {isCancelled ? (
                          <span className="ticket-badge ticket-badge--cancelled">
                            <XCircle size={13} /> Cancelled
                          </span>
                        ) : (
                          <span className="ticket-badge ticket-badge--confirmed">
                            <CheckCircle size={13} /> Confirmed
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="ticket-card__meta-grid">
                      <div className="ticket-meta-item">
                        <span className="meta-label">CINEMA</span>
                        <span className="meta-val">
                          <MapPin size={12} /> {theatreName}
                        </span>
                        <span className="meta-sub">{theatreLoc}</span>
                      </div>

                      <div className="ticket-meta-item">
                        <span className="meta-label">DATE &amp; TIME</span>
                        <span className="meta-val">
                          <Calendar size={12} /> {formatDate(b.showtime?.startTime || b.createdAt)}
                        </span>
                        <span className="meta-sub">{time}</span>
                      </div>

                      <div className="ticket-meta-item">
                        <span className="meta-label">SCREEN</span>
                        <span className="meta-val">{screenName}</span>
                        <span className="meta-sub">IMAX 4K Laser</span>
                      </div>

                      <div className="ticket-meta-item">
                        <span className="meta-label">SEATS</span>
                        <span className="meta-val meta-val--seats">{seatString}</span>
                        <span className="meta-sub">Reserved</span>
                      </div>
                    </div>

                    {/* Perforated Divider */}
                    <div className="ticket-card__divider">
                      <div className="divider-notch-left" />
                      <div className="divider-dash" />
                      <div className="divider-notch-right" />
                    </div>

                    {/* Bottom Actions & QR */}
                    <div className="ticket-card__footer">
                      <div className="ticket-footer__left">
                        <div className="ticket-qr-sim">
                          <div className="qr-sim-dot" />
                          <div className="qr-sim-dot" />
                          <div className="qr-sim-dot" />
                        </div>
                        <div className="ticket-price-info">
                          <span className="price-label">TOTAL PAID</span>
                          <span className="price-val">₹{b.totalAmount?.toLocaleString() || "560"}</span>
                        </div>
                      </div>

                      <div className="ticket-footer__actions">
                        <button
                          className="ticket-action-btn ticket-action-btn--print"
                          onClick={() => window.print()}
                          title="Print or Save PDF ticket"
                        >
                          <Printer size={15} /> Print Pass
                        </button>

                        {!isCancelled && (
                          <button
                            className="ticket-action-btn ticket-action-btn--cancel"
                            onClick={() => handleCancel(b)}
                            disabled={isCancelling}
                          >
                            {isCancelling ? "Cancelling..." : "Cancel"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
