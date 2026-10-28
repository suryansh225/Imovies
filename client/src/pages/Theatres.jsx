import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  Star,
  MapPin,
  Wifi,
  Coffee,
  Volume2,
  Film,
  Sofa,
  Search,
  Sparkles,
  ArrowRight,
  Tv,
} from "lucide-react";
import { theatreAPI } from "../services/api";
import { theatres as fallbackTheatres } from "../data/movies";
import "./Theatres.css";

const ICON_MAP = {
  IMAX: <Film size={14} />,
  "4DX": <Volume2 size={14} />,
  "Dolby Atmos": <Volume2 size={14} />,
  "4K Laser": <Film size={14} />,
  "Recliner Seats": <Sofa size={14} />,
  "VIP Lounge": <Coffee size={14} />,
  "Fine Dining": <Coffee size={14} />,
  "RealD 3D": <Film size={14} />,
  "4K Projection": <Film size={14} />,
  "Atmos Sound": <Volume2 size={14} />,
  "Premium Seating": <Sofa size={14} />,
  "3D": <Film size={14} />,
  "Lounge Access": <Coffee size={14} />,
};

const CITIES = ["All Cities", "New Delhi", "Mumbai", "Bengaluru", "Hyderabad", "Chennai", "Noida"];

export default function Theatres() {
  const [theatres, setTheatres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCity, setSelectedCity] = useState("All Cities");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchTheatres = async () => {
    try {
      setLoading(true);
      const data = await theatreAPI.getTheatres();
      if (data && data.theatres && data.theatres.length > 0) {
        setTheatres(data.theatres);
      } else {
        setTheatres(fallbackTheatres);
      }
    } catch {
      setTheatres(fallbackTheatres);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTheatres();
  }, []);

  const filteredTheatres = useMemo(() => {
    return theatres.filter((th) => {
      const matchCity =
        selectedCity === "All Cities" ||
        (th.city && th.city.toLowerCase() === selectedCity.toLowerCase()) ||
        (th.location && th.location.toLowerCase().includes(selectedCity.toLowerCase()));

      const matchSearch =
        !searchQuery.trim() ||
        th.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        th.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        th.address?.toLowerCase().includes(searchQuery.toLowerCase());

      return matchCity && matchSearch;
    });
  }, [theatres, selectedCity, searchQuery]);

  return (
    <div className="theatres-page">
      {/* ── Page Header ── */}
      <div className="theatres-page__header">
        <div className="container">
          <div className="theatres-page__header-inner">
            <div className="theatres-page__title-group">
              <div className="theatres-page__icon-wrap">
                <Building2 size={26} />
              </div>
              <div>
                <h1>Premium Cinema Destinations</h1>
                <p>Equipped with IMAX 4K Laser, Dolby Atmos &amp; Luxury Lounges across India</p>
              </div>
            </div>

            {/* Quick search input */}
            <div className="theatres-page__search-wrap">
              <Search size={16} className="theatres-page__search-icon" />
              <input
                type="text"
                placeholder="Search cinema or city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="theatres-page__search-input"
              />
            </div>
          </div>

          {/* City Filter Pills */}
          <div className="theatres-page__city-tabs">
            {CITIES.map((city) => (
              <button
                key={city}
                className={`theatres-page__city-btn${
                  selectedCity === city ? " theatres-page__city-btn--active" : ""
                }`}
                onClick={() => setSelectedCity(city)}
              >
                {city}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container">
        {/* Theatres Grid */}
        <div className="theatres-page__grid">
          {filteredTheatres.map((theatre) => {
            const theatreId = theatre._id || theatre.id;
            return (
              <div key={theatreId} className="theatre-card" id={`theatre-card-${theatreId}`}>
                <div className="theatre-card__glow" />
                <div className="theatre-card__header">
                  <div className="theatre-card__icon">
                    <Building2 size={24} />
                  </div>
                  <div className="theatre-card__rating">
                    <Star size={13} fill="#ffc107" color="#ffc107" />
                    <span>{theatre.rating || 4.8}</span>
                  </div>
                </div>

                <h3 className="theatre-card__name">{theatre.name}</h3>

                <p className="theatre-card__location">
                  <MapPin size={14} className="theatre-card__loc-icon" />
                  <span>{theatre.location || `${theatre.address || ""}, ${theatre.city || ""}`}</span>
                </p>

                {theatre.screens && theatre.screens.length > 0 && (
                  <div className="theatre-card__screens-info">
                    <Tv size={13} />
                    <span>{theatre.screens.length} Auditoriums available</span>
                  </div>
                )}

                <div className="theatre-card__amenities">
                  {(theatre.amenities || []).map((a) => (
                    <span key={a} className="theatre-card__amenity">
                      {ICON_MAP[a] || <Wifi size={13} />} {a}
                    </span>
                  ))}
                </div>

                <div className="theatre-card__footer">
                  <Link to="/movies" className="theatre-card__book-btn">
                    <span>Explore Shows &amp; Book</span>
                    <ArrowRight size={15} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Info banner */}
        <div className="theatres-page__banner">
          <div className="theatres-page__banner-content">
            <div className="theatres-page__banner-badge">
              <Sparkles size={14} /> EXPANDING NATIONWIDE
            </div>
            <h2>Coming to More Cities Near You</h2>
            <p>
              We are partnering with 120+ leading multiplex chains across tier-1 and tier-2 cities to bring you unparalleled cinematic grandeur.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
