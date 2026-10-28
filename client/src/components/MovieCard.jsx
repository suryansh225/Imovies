import { Link, useNavigate } from "react-router-dom";
import { Star, Clock, Globe, Ticket, Heart, Play } from "lucide-react";
import { useApp } from "../context/AppContext";
import "./MovieCard.css";

export default function MovieCard({ movie, size = "md" }) {
  const movieId = movie._id || movie.id;
  const navigate = useNavigate();
  const { toggleWatchlist, isWatchlisted, setTrailerMovie } = useApp();

  const {
    title,
    genre = [],
    language,
    rating,
    votes,
    duration,
    poster,
    status,
    certificate,
    price = 250,
  } = movie;

  const inWatchlist = isWatchlisted(movieId);

  const handleWatchlistClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWatchlist(movie);
  };

  const handlePlayTrailer = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setTrailerMovie(movie);
  };

  const handleBookClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/movie/${movieId}#book`);
  };

  return (
    <div className={`movie-card movie-card--${size}`} id={`movie-card-${movieId}`}>
      {/* Poster Wrap */}
      <Link to={`/movie/${movieId}`} className="movie-card__poster-link">
        <div className="movie-card__poster-wrap">
          <img
            src={poster}
            alt={title}
            className="movie-card__poster"
            loading="lazy"
            onError={(e) => {
              e.target.src = `https://placehold.co/400x600/15151e/888888?text=${encodeURIComponent(title)}`;
            }}
          />

          {/* Glow and vignette overlay */}
          <div className="movie-card__overlay">
            <button
              className="movie-card__play"
              onClick={handlePlayTrailer}
              title="Watch Trailer"
              aria-label={`Watch trailer for ${title}`}
            >
              <Play size={20} fill="currentColor" />
            </button>
          </div>

          {/* Top badges */}
          <div className="movie-card__badges">
            <span
              className={`movie-card__status movie-card__status--${
                status === "now_showing" ? "now" : "upcoming"
              }`}
            >
              {status === "now_showing" ? "Now Showing" : "Upcoming"}
            </span>
            {certificate && <span className="movie-card__cert">{certificate}</span>}
          </div>

          {/* Quick Watchlist Heart Button */}
          <button
            className={`movie-card__heart-btn${inWatchlist ? " movie-card__heart-btn--active" : ""}`}
            onClick={handleWatchlistClick}
            aria-label={inWatchlist ? "Remove from watchlist" : "Add to watchlist"}
            title={inWatchlist ? "In Watchlist" : "Save to Watchlist"}
          >
            <Heart size={16} fill={inWatchlist ? "currentColor" : "none"} />
          </button>

          {/* Rating Chip */}
          <div className="movie-card__rating-badge">
            <Star size={12} fill="#ffc107" color="#ffc107" />
            <span className="movie-card__rating-num">{rating}</span>
            {votes && <span className="movie-card__rating-votes">({votes})</span>}
          </div>
        </div>
      </Link>

      {/* Info Block */}
      <div className="movie-card__info">
        <Link to={`/movie/${movieId}`} className="movie-card__title-link">
          <h3 className="movie-card__title" title={title}>
            {title}
          </h3>
        </Link>

        <div className="movie-card__meta">
          <span className="movie-card__meta-item">
            <Globe size={13} />
            {language}
          </span>
          <span className="movie-card__dot">·</span>
          <span className="movie-card__meta-item">
            <Clock size={13} />
            {duration}
          </span>
        </div>

        <div className="movie-card__genres">
          {Array.isArray(genre) &&
            genre.slice(0, 2).map((g) => (
              <span key={g} className="movie-card__genre-tag">
                {g}
              </span>
            ))}
        </div>

        <div className="movie-card__bottom">
          <div className="movie-card__price">
            <span className="movie-card__price-label">Tickets from</span>
            <span className="movie-card__price-value">₹{price}</span>
          </div>

          <button
            className="movie-card__book-btn"
            onClick={handleBookClick}
            id={`book-btn-${movieId}`}
          >
            <Ticket size={14} />
            <span>Book</span>
          </button>
        </div>
      </div>
    </div>
  );
}
