import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  Filter,
  SlidersHorizontal,
  X,
  ChevronDown,
  LayoutGrid,
  List,
  RotateCcw,
  Star,
  Film,
  Sparkles,
} from "lucide-react";
import { movieAPI } from "../services/api";
import { movies as fallbackMovies } from "../data/movies";
import { useApp } from "../context/AppContext";
import MovieCard from "../components/MovieCard";
import "./Movies.css";

const STANDARD_GENRES = [
  "Action",
  "Comedy",
  "Crime",
  "Drama",
  "Horror",
  "Mystery",
  "Mythology",
  "Romance",
  "Sci-Fi",
  "Spy",
  "Thriller",
  "War",
];

const STANDARD_LANGS = ["English", "Hindi", "Tamil", "Telugu"];

const FILTERS = [
  { key: "all", label: "All Releases" },
  { key: "now_showing", label: "Now Showing" },
  { key: "upcoming", label: "Upcoming" },
  { key: "trending", label: "Trending 🔥" },
];

export default function Movies() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { searchQuery, setSearchQuery } = useApp();

  const [query, setQuery] = useState(searchParams.get("search") || searchQuery || "");
  const [filter, setFilter] = useState(searchParams.get("filter") || "all");
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [selectedLangs, setSelectedLangs] = useState([]);
  const [sortBy, setSortBy] = useState("rating");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'list'

  // Movies state
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);

  // Sync search query from context/URL
  useEffect(() => {
    const urlSearch = searchParams.get("search");
    if (urlSearch !== null) setQuery(urlSearch);
    const urlFilter = searchParams.get("filter");
    if (urlFilter) setFilter(urlFilter);
  }, [searchParams]);

  // Client-side fallback filter
  const filterFallback = useCallback(() => {
    let result = [...fallbackMovies];

    if (query.trim()) {
      const q = query.toLowerCase().trim();
      result = result.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.director?.toLowerCase().includes(q) ||
          (Array.isArray(m.cast) && m.cast.some((c) => c.toLowerCase().includes(q))) ||
          (Array.isArray(m.genre) && m.genre.some((g) => g.toLowerCase().includes(q)))
      );
    }

    if (filter === "now_showing") {
      result = result.filter((m) => m.status === "now_showing");
    } else if (filter === "upcoming") {
      result = result.filter((m) => m.status === "upcoming");
    } else if (filter === "trending") {
      result = result.filter((m) => m.trending);
    }

    if (selectedGenres.length > 0) {
      result = result.filter((m) =>
        Array.isArray(m.genre) && selectedGenres.some((g) => m.genre.includes(g))
      );
    }

    if (selectedLangs.length > 0) {
      result = result.filter((m) => selectedLangs.includes(m.language));
    }

    if (minRating > 0) {
      result = result.filter((m) => (m.rating || 0) >= minRating);
    }

    if (sortBy === "rating") {
      result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === "title") {
      result.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === "release") {
      result.sort((a, b) => new Date(b.releaseDate || 0) - new Date(a.releaseDate || 0));
    } else if (sortBy === "price_asc") {
      result.sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (sortBy === "price_desc") {
      result.sort((a, b) => (b.price || 0) - (a.price || 0));
    }

    return result;
  }, [query, filter, selectedGenres, selectedLangs, minRating, sortBy]);

  // Fetch movies from API or fallback
  const fetchMovies = useCallback(async () => {
    try {
      setLoading(true);

      const params = { limit: 50 };
      if (query.trim()) params.search = query.trim();
      if (filter === "now_showing") params.status = "now_showing";
      else if (filter === "upcoming") params.status = "upcoming";
      else if (filter === "trending") params.trending = "true";

      if (selectedGenres.length > 0) params.genre = selectedGenres.join(",");
      if (selectedLangs.length > 0) params.language = selectedLangs.join(",");
      if (minRating > 0) params.minRating = minRating;

      if (sortBy === "rating") params.sort = "-rating";
      else if (sortBy === "title") params.sort = "title";
      else if (sortBy === "release") params.sort = "-releaseDate";
      else if (sortBy === "price_asc") params.sort = "price_asc";
      else if (sortBy === "price_desc") params.sort = "price_desc";

      const data = await movieAPI.getMovies(params);
      if (data && data.movies && data.movies.length > 0) {
        setMovies(data.movies);
      } else {
        setMovies(filterFallback());
      }
    } catch {
      // Offline fallback
      setMovies(filterFallback());
    } finally {
      setLoading(false);
    }
  }, [query, filter, selectedGenres, selectedLangs, minRating, sortBy, filterFallback]);

  useEffect(() => {
    fetchMovies();
  }, [fetchMovies]);

  const toggleGenre = (genre) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const toggleLang = (lang) => {
    setSelectedLangs((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );
  };

  const clearAllFilters = () => {
    setQuery("");
    setSearchQuery("");
    setFilter("all");
    setSelectedGenres([]);
    setSelectedLangs([]);
    setMinRating(0);
    setSortBy("rating");
    setSearchParams({});
  };

  const hasActiveFilters =
    Boolean(query) ||
    filter !== "all" ||
    selectedGenres.length > 0 ||
    selectedLangs.length > 0 ||
    minRating > 0;

  return (
    <div className="movies-page">
      {/* ── Page Header & Search ── */}
      <div className="movies-page__header">
        <div className="container">
          <div className="movies-page__header-inner">
            <div className="movies-page__title-group">
              <h1>Explore Movies</h1>
              <p>Discover current theatrical blockbusters, advance premieres, and top-rated hits</p>
            </div>

            {/* Quick Search */}
            <div className="movies-page__search-wrap">
              <Search size={18} className="movies-page__search-icon" />
              <input
                type="text"
                placeholder="Search by title, director, cast..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSearchQuery(e.target.value);
                }}
                className="movies-page__search-input"
              />
              {query && (
                <button
                  className="movies-page__search-clear"
                  onClick={() => {
                    setQuery("");
                    setSearchQuery("");
                  }}
                  aria-label="Clear search"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </div>

          {/* Category Tabs */}
          <div className="movies-page__tabs">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                className={`movies-page__tab${filter === f.key ? " movies-page__tab--active" : ""}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container">
        {/* ── Filter Bar & View Controls ── */}
        <div className="movies-page__toolbar">
          <div className="movies-page__toolbar-left">
            <button
              className={`movies-page__filter-toggle${filtersOpen ? " active" : ""}`}
              onClick={() => setFiltersOpen((prev) => !prev)}
            >
              <SlidersHorizontal size={16} />
              <span>Filters</span>
              {(selectedGenres.length > 0 || selectedLangs.length > 0 || minRating > 0) && (
                <span className="movies-page__filter-count">
                  {selectedGenres.length + selectedLangs.length + (minRating > 0 ? 1 : 0)}
                </span>
              )}
            </button>

            <span className="movies-page__results-count">
              Showing <strong>{movies.length}</strong> {movies.length === 1 ? "movie" : "movies"}
            </span>
          </div>

          <div className="movies-page__toolbar-right">
            {/* Sort Dropdown */}
            <div className="movies-page__sort-wrap">
              <span className="movies-page__sort-label">Sort By:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="movies-page__sort-select"
              >
                <option value="rating">Rating: High to Low</option>
                <option value="release">Release Date</option>
                <option value="title">Title (A-Z)</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>

            {/* Layout Toggle */}
            <div className="movies-page__view-toggle">
              <button
                className={`movies-page__view-btn${viewMode === "grid" ? " active" : ""}`}
                onClick={() => setViewMode("grid")}
                aria-label="Grid View"
              >
                <LayoutGrid size={17} />
              </button>
              <button
                className={`movies-page__view-btn${viewMode === "list" ? " active" : ""}`}
                onClick={() => setViewMode("list")}
                aria-label="List View"
              >
                <List size={17} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Collapsible Filters Drawer ── */}
        {filtersOpen && (
          <div className="movies-page__filters-panel">
            {/* Genres */}
            <div className="filters-panel__section">
              <label className="filters-panel__label">Genre</label>
              <div className="filters-panel__chips">
                {STANDARD_GENRES.map((g) => {
                  const isSelected = selectedGenres.includes(g);
                  return (
                    <button
                      key={g}
                      className={`filters-panel__chip${isSelected ? " active" : ""}`}
                      onClick={() => toggleGenre(g)}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Languages */}
            <div className="filters-panel__section">
              <label className="filters-panel__label">Language</label>
              <div className="filters-panel__chips">
                {STANDARD_LANGS.map((lang) => {
                  const isSelected = selectedLangs.includes(lang);
                  return (
                    <button
                      key={lang}
                      className={`filters-panel__chip${isSelected ? " active" : ""}`}
                      onClick={() => toggleLang(lang)}
                    >
                      {lang}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Min Rating */}
            <div className="filters-panel__section">
              <div className="filters-panel__label-row">
                <label className="filters-panel__label">Minimum Rating</label>
                <span className="filters-panel__rating-val">{minRating > 0 ? `${minRating}★` : "Any"}</span>
              </div>
              <input
                type="range"
                min="0"
                max="9"
                step="0.5"
                value={minRating}
                onChange={(e) => setMinRating(parseFloat(e.target.value))}
                className="filters-panel__range"
              />
            </div>

            {/* Footer action */}
            {hasActiveFilters && (
              <div className="filters-panel__footer">
                <button className="filters-panel__reset-btn" onClick={clearAllFilters}>
                  <RotateCcw size={14} /> Reset All Filters
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Active Filter Pills Bar ── */}
        {hasActiveFilters && (
          <div className="movies-page__active-tags">
            {query && (
              <span className="active-tag">
                Query: &ldquo;{query}&rdquo;
                <X size={13} onClick={() => setQuery("")} />
              </span>
            )}
            {selectedGenres.map((g) => (
              <span key={g} className="active-tag">
                {g}
                <X size={13} onClick={() => toggleGenre(g)} />
              </span>
            ))}
            {selectedLangs.map((l) => (
              <span key={l} className="active-tag">
                {l}
                <X size={13} onClick={() => toggleLang(l)} />
              </span>
            ))}
            {minRating > 0 && (
              <span className="active-tag">
                Min {minRating}★
                <X size={13} onClick={() => setMinRating(0)} />
              </span>
            )}
            <button className="active-tag__clear-all" onClick={clearAllFilters}>
              Clear All
            </button>
          </div>
        )}

        {/* ── Results Grid / List ── */}
        {movies.length === 0 ? (
          <div className="movies-page__empty">
            <Film size={48} className="movies-page__empty-icon" />
            <h3>No movies found</h3>
            <p>Try adjusting your search criteria or clearing active filters to see more results.</p>
            <button className="movies-page__reset-btn" onClick={clearAllFilters}>
              <RotateCcw size={15} /> Reset Filters
            </button>
          </div>
        ) : (
          <div className={`movies-page__grid movies-page__grid--${viewMode}`}>
            {movies.map((movie) => (
              <MovieCard key={movie._id || movie.id} movie={movie} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
