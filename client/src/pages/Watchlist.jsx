import { Link } from "react-router-dom";
import { Heart, Film, ArrowRight, Trash2 } from "lucide-react";
import { useApp } from "../context/AppContext";
import MovieCard from "../components/MovieCard";
import "./Watchlist.css";

export default function Watchlist() {
  const { watchlist, toggleWatchlist } = useApp();

  return (
    <div className="watchlist-page">
      <div className="watchlist-page__header">
        <div className="container">
          <div className="watchlist-page__header-inner">
            <div className="watchlist-page__title-group">
              <div className="watchlist-page__icon">
                <Heart size={26} fill="currentColor" />
              </div>
              <div>
                <h1>My Watchlist</h1>
                <p>
                  {watchlist.length} {watchlist.length === 1 ? "movie" : "movies"} saved for later
                </p>
              </div>
            </div>

            {watchlist.length > 0 && (
              <button
                className="watchlist-page__clear-btn"
                onClick={() => {
                  if (window.confirm("Are you sure you want to clear your entire watchlist?")) {
                    watchlist.forEach((m) => toggleWatchlist(m));
                  }
                }}
              >
                <Trash2 size={15} /> Clear All
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="container">
        {watchlist.length === 0 ? (
          <div className="watchlist-page__empty">
            <div className="watchlist-page__empty-icon">
              <Film size={54} />
            </div>
            <h2>Your Watchlist is Empty</h2>
            <p>
              Explore our current blockbusters and click the heart icon on any movie to save it here.
            </p>
            <Link to="/movies" className="watchlist-page__explore-btn">
              Explore Movies <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <div className="watchlist-page__grid">
            {watchlist.map((movie) => (
              <MovieCard key={movie._id || movie.id} movie={movie} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
