import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useApp } from "../context/AppContext";
import {
  Film,
  Search,
  Menu,
  X,
  Ticket,
  User,
  LogOut,
  ChevronDown,
  Home,
  Clapperboard,
  Building2,
  Heart,
  Star,
  Sparkles,
} from "lucide-react";
import { movies as mockMovies } from "../data/movies";
import "./Navbar.css";

export default function Navbar() {
  const { user, logout, searchQuery, setSearchQuery, watchlist } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [userDropdown, setUserDropdown] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const searchRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setUserDropdown(false);
    setSearchResults([]);
  }, [location]);

  // Handle instant search matching
  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      const q = searchQuery.toLowerCase().trim();
      const matches = mockMovies
        .filter(
          (m) =>
            m.title.toLowerCase().includes(q) ||
            (Array.isArray(m.genre) && m.genre.some((g) => g.toLowerCase().includes(q))) ||
            (m.language && m.language.toLowerCase().includes(q))
        )
        .slice(0, 5);
      setSearchResults(matches);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  // Close search suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchResults([]);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/movies?search=${encodeURIComponent(searchQuery)}`);
      setSearchOpen(false);
      setSearchResults([]);
    }
  };

  const handleSelectSuggestion = (movieId) => {
    setSearchResults([]);
    setSearchQuery("");
    navigate(`/movie/${movieId}`);
  };

  const navLinks = [
    { to: "/", label: "Home", icon: <Home size={16} /> },
    { to: "/movies", label: "Movies", icon: <Clapperboard size={16} /> },
    { to: "/theatres", label: "Theatres", icon: <Building2 size={16} /> },
    { to: "/watchlist", label: "Watchlist", icon: <Heart size={16} />, badge: watchlist.length },
    { to: "/my-bookings", label: "My Bookings", icon: <Ticket size={16} /> },
  ];

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : "U";

  return (
    <header className={`navbar${scrolled ? " navbar--scrolled" : ""}`}>
      <div className="navbar__inner">
        {/* Brand Logo */}
        <Link to="/" className="navbar__logo" id="navbar-logo">
          <div className="navbar__logo-icon-wrap">
            <Film size={22} className="navbar__logo-icon" />
          </div>
          <span>
            i<span className="navbar__logo-accent">Movies</span>
          </span>
          <span className="navbar__logo-tag">CINEMA</span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="navbar__desktop-nav" aria-label="Main Navigation">
          <ul className="navbar__links">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.to;
              return (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className={`navbar__link${isActive ? " navbar__link--active" : ""}`}
                    id={`nav-${link.label.toLowerCase().replace(" ", "-")}`}
                  >
                    {link.icon}
                    <span>{link.label}</span>
                    {link.badge !== undefined && link.badge > 0 && (
                      <span className="navbar__badge">{link.badge}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Right Controls: Search, Watchlist quick link, User / Auth */}
        <div className="navbar__right">
          {/* Live Search */}
          <div
            ref={searchRef}
            className={`navbar__search-wrap${searchOpen ? " navbar__search-wrap--open" : ""}`}
          >
            <form onSubmit={handleSearch} className="navbar__search-form">
              <Search size={16} className="navbar__search-icon-hint" />
              <input
                type="text"
                id="navbar-search-input"
                placeholder="Search movies, genres..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="navbar__search-input"
                onFocus={() => {
                  if (searchQuery.trim().length >= 2) {
                    const q = searchQuery.toLowerCase().trim();
                    setSearchResults(mockMovies.filter((m) => m.title.toLowerCase().includes(q)).slice(0, 5));
                  }
                }}
              />
              <button type="submit" className="navbar__search-btn" aria-label="Search">
                <Search size={16} />
              </button>
            </form>

            {/* Instant Search Suggestions Dropdown */}
            {searchResults.length > 0 && (
              <div className="navbar__search-dropdown">
                <div className="navbar__search-dropdown-header">Matching Movies</div>
                {searchResults.map((item) => (
                  <div
                    key={item._id || item.id}
                    className="navbar__search-item"
                    onClick={() => handleSelectSuggestion(item._id || item.id)}
                  >
                    <img
                      src={item.poster}
                      alt={item.title}
                      className="navbar__search-item-thumb"
                    />
                    <div className="navbar__search-item-details">
                      <div className="navbar__search-item-title">{item.title}</div>
                      <div className="navbar__search-item-meta">
                        <span className="navbar__search-item-rating">
                          <Star size={11} fill="#ffc107" color="#ffc107" /> {item.rating}
                        </span>
                        <span>·</span>
                        <span>{Array.isArray(item.genre) ? item.genre.join(", ") : item.genre}</span>
                      </div>
                    </div>
                  </div>
                ))}
                <div
                  className="navbar__search-dropdown-footer"
                  onClick={handleSearch}
                >
                  View all results for &ldquo;{searchQuery}&rdquo; →
                </div>
              </div>
            )}
          </div>

          {/* User Account / Profile */}
          {user ? (
            <div className="navbar__user-wrap">
              <button
                className="navbar__user-btn"
                onClick={() => setUserDropdown((prev) => !prev)}
                id="navbar-user-btn"
                aria-expanded={userDropdown}
              >
                <div className="navbar__avatar">{userInitial}</div>
                <span className="navbar__username">{user.name.split(" ")[0]}</span>
                <ChevronDown
                  size={14}
                  className={`navbar__user-chevron${userDropdown ? " navbar__user-chevron--open" : ""}`}
                />
              </button>

              {userDropdown && (
                <div className="navbar__dropdown">
                  <div className="navbar__dropdown-header">
                    <p className="navbar__dropdown-name">{user.name}</p>
                    <p className="navbar__dropdown-email">{user.email}</p>
                  </div>
                  <div className="navbar__dropdown-divider" />
                  <Link to="/my-bookings" className="navbar__dropdown-item" onClick={() => setUserDropdown(false)}>
                    <Ticket size={15} /> My Bookings
                  </Link>
                  <Link to="/watchlist" className="navbar__dropdown-item" onClick={() => setUserDropdown(false)}>
                    <Heart size={15} /> My Watchlist ({watchlist.length})
                  </Link>
                  <div className="navbar__dropdown-divider" />
                  <button
                    className="navbar__dropdown-item navbar__dropdown-item--logout"
                    onClick={() => {
                      setUserDropdown(false);
                      logout();
                    }}
                  >
                    <LogOut size={15} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="navbar__auth-actions">
              <Link to="/login" className="navbar__btn navbar__btn--ghost" id="navbar-login-btn">
                Sign In
              </Link>
              <Link to="/register" className="navbar__btn navbar__btn--primary" id="navbar-register-btn">
                Get Tickets
              </Link>
            </div>
          )}

          {/* Mobile Menu Toggle Button */}
          <button
            className="navbar__mobile-toggle"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
            id="navbar-menu-toggle"
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {menuOpen && (
        <div className="navbar__mobile-menu">
          <ul className="navbar__mobile-links">
            {navLinks.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className={`navbar__mobile-link${
                    location.pathname === link.to ? " navbar__mobile-link--active" : ""
                  }`}
                  onClick={() => setMenuOpen(false)}
                >
                  <div className="navbar__mobile-link-left">
                    {link.icon}
                    <span>{link.label}</span>
                  </div>
                  {link.badge !== undefined && link.badge > 0 && (
                    <span className="navbar__badge">{link.badge}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>

          <div className="navbar__mobile-auth">
            {user ? (
              <div className="navbar__mobile-user-card">
                <div className="navbar__avatar">{userInitial}</div>
                <div className="navbar__mobile-user-info">
                  <span className="navbar__mobile-user-name">{user.name}</span>
                  <span className="navbar__mobile-user-email">{user.email}</span>
                </div>
                <button
                  className="navbar__mobile-logout"
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                  title="Sign out"
                >
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <div className="navbar__mobile-btns">
                <Link
                  to="/login"
                  className="navbar__btn navbar__btn--ghost"
                  onClick={() => setMenuOpen(false)}
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="navbar__btn navbar__btn--primary"
                  onClick={() => setMenuOpen(false)}
                >
                  Create Account
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
