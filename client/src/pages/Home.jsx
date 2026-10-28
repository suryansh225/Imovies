import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Search,
  Play,
  ChevronLeft,
  ChevronRight,
  Star,
  TrendingUp,
  Zap,
  Calendar,
  Award,
  Sparkles,
  Heart,
  ShieldCheck,
  Tv,
  Film,
  Ticket,
} from "lucide-react";
import { movieAPI } from "../services/api";
import { movies as fallbackMovies } from "../data/movies";
import { useApp } from "../context/AppContext";
import MovieCard from "../components/MovieCard";
import SectionHeader from "../components/SectionHeader";
import "./Home.css";

const STATS = [
  { icon: <Film size={22} />, value: "500+", label: "Cinematic Titles" },
  { icon: <Award size={22} />, value: "50+", label: "IMAX & Luxe Screens" },
  { icon: <Star size={22} />, value: "4.9★", label: "Audience Score" },
  { icon: <Ticket size={22} />, value: "2M+", label: "Tickets Booked" },
];

const QUICK_FILTERS = [
  { id: "all", label: "All Releases", icon: <Film size={14} /> },
  { id: "now_showing", label: "Now Showing", icon: <Zap size={14} /> },
  { id: "trending", label: "Trending", icon: <TrendingUp size={14} /> },
  { id: "imax", label: "IMAX Experience", icon: <Tv size={14} /> },
  { id: "upcoming", label: "Upcoming", icon: <Calendar size={14} /> },
];

export default function Home() {
  const [heroIdx, setHeroIdx] = useState(0);
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("all");

  const navigate = useNavigate();
  const { setSearchQuery, setTrailerMovie, toggleWatchlist, isWatchlisted } = useApp();

  // Fetch movies with automatic fallback to rich local sample data
  const fetchHomeMovies = async () => {
    try {
      setLoading(true);
      const data = await movieAPI.getMovies({ limit: 50 });
      if (data && data.movies && data.movies.length > 0) {
        setMovies(data.movies);
      } else {
        setMovies(fallbackMovies);
      }
    } catch {
      // Graceful offline fallback
      setMovies(fallbackMovies);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHomeMovies();
  }, []);

  const heroMovies = movies.filter((m) => m.trending).slice(0, 5);
  const activeHeroList = heroMovies.length > 0 ? heroMovies : movies.slice(0, 5);

  const currentHero = activeHeroList[heroIdx] || movies[0];
  const isHeroInWatchlist = currentHero ? isWatchlisted(currentHero._id || currentHero.id) : false;

  // Auto-advance hero carousel
  useEffect(() => {
    if (activeHeroList.length <= 1) return;
    const timer = setInterval(() => {
      setHeroIdx((prev) => (prev + 1) % activeHeroList.length);
    }, 6500);
    return () => clearInterval(timer);
  }, [activeHeroList.length]);

  useEffect(() => {
    setHeroLoaded(false);
    const timer = setTimeout(() => setHeroLoaded(true), 120);
    return () => clearTimeout(timer);
  }, [heroIdx]);

  // Filtered lists for sections
  const nowShowing = movies.filter((m) => m.status === "now_showing");
  const upcoming = movies.filter((m) => m.status === "upcoming");
  const topRated = [...movies].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 4);

  // Dynamic filter for the main showcase
  const displayedShowcase = movies.filter((m) => {
    if (activeCategory === "now_showing") return m.status === "now_showing";
    if (activeCategory === "upcoming") return m.status === "upcoming";
    if (activeCategory === "trending") return m.trending;
    if (activeCategory === "imax") return m.genre?.includes("Sci-Fi") || m.genre?.includes("Action");
    return true;
  });

  return (
    <div className="home">
      {/* ── Cinematic Hero ── */}
      {currentHero && (
        <section className="hero" id="home-hero">
          <div
            className={`hero__bg${heroLoaded ? " hero__bg--loaded" : ""}`}
            style={{ backgroundImage: `url(${currentHero.backdrop || currentHero.poster})` }}
          />
          <div className="hero__vignette" />
          <div className="hero__gradient" />

          <div className="hero__inner">
            <div className="hero__content">
              {/* Eyebrow badge */}
              <div className="hero__eyebrow">
                <span className="hero__eyebrow-pill">
                  <TrendingUp size={13} />
                  Trending #{heroIdx + 1}
                </span>
                <span className="hero__eyebrow-format">IMAX 4K LASER</span>
              </div>

              {/* Title */}
              <h1 className="hero__title">{currentHero.title}</h1>

              {/* Metadata strip */}
              <div className="hero__meta">
                <span className="hero__rating">
                  <Star size={15} fill="#ffc107" color="#ffc107" />
                  {currentHero.rating}
                  {currentHero.votes && <span className="hero__votes">({currentHero.votes})</span>}
                </span>
                <span className="hero__dot">·</span>
                <span className="hero__meta-text">{currentHero.duration || "2h 15m"}</span>
                {currentHero.certificate && (
                  <>
                    <span className="hero__dot">·</span>
                    <span className="hero__cert">{currentHero.certificate}</span>
                  </>
                )}
                {Array.isArray(currentHero.genre) && currentHero.genre.length > 0 && (
                  <>
                    <span className="hero__dot">·</span>
                    <div className="hero__genre-list">
                      {currentHero.genre.slice(0, 3).map((g) => (
                        <span key={g} className="hero__genre-pill">
                          {g}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Description */}
              <p className="hero__desc">{currentHero.description}</p>

              {/* Action buttons */}
              <div className="hero__actions">
                <Link
                  to={`/movie/${currentHero._id || currentHero.id}`}
                  className="hero__btn hero__btn--primary"
                  id={`hero-book-${currentHero._id || currentHero.id}`}
                >
                  <Ticket size={17} />
                  Book Tickets · ₹{currentHero.price || 280}
                </Link>

                <button
                  type="button"
                  className="hero__btn hero__btn--glass"
                  onClick={() => setTrailerMovie(currentHero)}
                >
                  <Play size={16} fill="currentColor" />
                  Watch Trailer
                </button>

                <button
                  type="button"
                  className={`hero__btn hero__btn--icon${
                    isHeroInWatchlist ? " hero__btn--icon-active" : ""
                  }`}
                  onClick={() => toggleWatchlist(currentHero)}
                  title={isHeroInWatchlist ? "Remove from Watchlist" : "Save to Watchlist"}
                  aria-label="Toggle Watchlist"
                >
                  <Heart size={18} fill={isHeroInWatchlist ? "currentColor" : "none"} />
                </button>
              </div>
            </div>

            {/* Carousel Thumbnails */}
            {activeHeroList.length > 1 && (
              <div className="hero__thumbs-panel">
                <div className="hero__thumbs-label">Up Next in Carousel</div>
                <div className="hero__thumbs">
                  {activeHeroList.map((m, i) => (
                    <button
                      key={m._id || m.id || i}
                      className={`hero__thumb${i === heroIdx ? " hero__thumb--active" : ""}`}
                      onClick={() => setHeroIdx(i)}
                      id={`hero-thumb-${m._id || m.id}`}
                      aria-label={`Select ${m.title}`}
                    >
                      <img src={m.poster} alt={m.title} />
                      <div className="hero__thumb-overlay">
                        <span className="hero__thumb-title">{m.title}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Navigation Controls */}
          {activeHeroList.length > 1 && (
            <>
              <button
                className="hero__nav hero__nav--prev"
                onClick={() =>
                  setHeroIdx((i) => (i - 1 + activeHeroList.length) % activeHeroList.length)
                }
                aria-label="Previous Slide"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                className="hero__nav hero__nav--next"
                onClick={() => setHeroIdx((i) => (i + 1) % activeHeroList.length)}
                aria-label="Next Slide"
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}
        </section>
      )}

      {/* ── Quick Category Filter Bar ── */}
      <section className="home__filter-bar">
        <div className="container">
          <div className="home__filter-pills">
            {QUICK_FILTERS.map((f) => (
              <button
                key={f.id}
                className={`home__filter-btn${activeCategory === f.id ? " home__filter-btn--active" : ""}`}
                onClick={() => setActiveCategory(f.id)}
              >
                {f.icon}
                <span>{f.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Main Showcase Grid ── */}
      <section className="home__section">
        <div className="container">
          <SectionHeader
            title={
              activeCategory === "all"
                ? "Now Showing & Featured"
                : QUICK_FILTERS.find((f) => f.id === activeCategory)?.label || "Featured Movies"
            }
            subtitle="Catch the latest blockbusters on the biggest screens near you"
            actionText="View Full Catalog"
            actionTo="/movies"
          />

          <div className="home__movies-grid">
            {displayedShowcase.slice(0, 8).map((movie) => (
              <MovieCard key={movie._id || movie.id} movie={movie} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CinePass VIP Banner ── */}
      <section className="home__vip-promo">
        <div className="container">
          <div className="vip-banner">
            <div className="vip-banner__glow" />
            <div className="vip-banner__content">
              <div className="vip-banner__badge">
                <Sparkles size={14} /> EXCLUSIVE CINEPASS PERK
              </div>
              <h2>Upgrade to CinePass VIP</h2>
              <p>
                Get 20% off every ticket, free popcorn upgrades, zero cancellation fees, and early access to IMAX premiere bookings.
              </p>
              <div className="vip-banner__actions">
                <Link to="/register" className="vip-banner__btn">
                  Claim Your Pass · Use code <strong>IMOVIES20</strong>
                </Link>
                <span className="vip-banner__note">★ Over 40,000 CinePass members</span>
              </div>
            </div>
            <div className="vip-banner__visual">
              <div className="vip-card-mockup">
                <div className="vip-card-mockup__chip" />
                <div className="vip-card-mockup__title">iMovies VIP Pass</div>
                <div className="vip-card-mockup__number">•••• •••• •••• 2026</div>
                <div className="vip-card-mockup__name">GOLD MEMBER ACCESS</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Top Rated Masterpieces Section ── */}
      <section className="home__section">
        <div className="container">
          <SectionHeader
            title="Top Rated Masterpieces"
            subtitle="Critically acclaimed movies loved by cinema connoisseurs"
            actionText="Browse All"
            actionTo="/movies?sort=rating"
          />

          <div className="home__movies-grid">
            {topRated.map((movie) => (
              <MovieCard key={movie._id || movie.id} movie={movie} />
            ))}
          </div>
        </div>
      </section>

      {/* ── The iMovies Experience Strip ── */}
      <section className="home__experience">
        <div className="container">
          <div className="experience__header">
            <h2>The Premium Cinema Experience</h2>
            <p>Why millions of moviegoers book their tickets through iMovies every month</p>
          </div>

          <div className="experience__grid">
            <div className="experience__card">
              <div className="experience__icon-wrap">
                <Tv size={26} />
              </div>
              <h3>IMAX 4K Laser Projection</h3>
              <p>Next-generation optical precision with deeper contrast and dual laser clarity.</p>
            </div>

            <div className="experience__card">
              <div className="experience__icon-wrap">
                <Zap size={26} />
              </div>
              <h3>Dolby Atmos 360° Sound</h3>
              <p>Dimensional spatial audio that flows all around you with breathtaking realism.</p>
            </div>

            <div className="experience__card">
              <div className="experience__icon-wrap">
                <Ticket size={26} />
              </div>
              <h3>Instant M-Ticket & QR Pass</h3>
              <p>Direct entry from your phone with no queueing at the theatre box office.</p>
            </div>

            <div className="experience__card">
              <div className="experience__icon-wrap">
                <ShieldCheck size={26} />
              </div>
              <h3>Guaranteed Best Seat Booking</h3>
              <p>Real-time visual seat map showing recliner, VIP, and prime vantage points.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats Strip ── */}
      <section className="home__stats">
        <div className="container">
          <div className="stats__grid">
            {STATS.map((s, i) => (
              <div key={i} className="stats__item">
                <div className="stats__icon">{s.icon}</div>
                <div className="stats__value">{s.value}</div>
                <div className="stats__label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
