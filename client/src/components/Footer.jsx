import { useState } from "react";
import { Link } from "react-router-dom";
import { Film, Mail, Phone, Send, Heart, Shield, Sparkles } from "lucide-react";
import { useApp } from "../context/AppContext";
import "./Footer.css";

export default function Footer() {
  const [email, setEmail] = useState("");
  const { showToast } = useApp();

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (email.trim()) {
      showToast("Thank you for subscribing to iMovies VIP Premiere updates!", "success");
      setEmail("");
    }
  };

  return (
    <footer className="footer">
      <div className="footer__glow" />

      <div className="container">
        {/* Newsletter Section */}
        <div className="footer__newsletter">
          <div className="footer__newsletter-text">
            <h3>Get VIP Premiere Alerts &amp; Offers</h3>
            <p>Subscribe to receive 20% off your next ticket and early IMAX festival access.</p>
          </div>
          <form className="footer__newsletter-form" onSubmit={handleSubscribe}>
            <input
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="footer__newsletter-input"
            />
            <button type="submit" className="footer__newsletter-btn">
              <span>Subscribe</span>
              <Send size={15} />
            </button>
          </form>
        </div>

        <div className="footer__inner">
          {/* Brand */}
          <div className="footer__brand">
            <Link to="/" className="footer__logo">
              <Film size={26} className="footer__logo-icon" />
              i<span>Movies</span>
            </Link>
            <p className="footer__tagline">
              Your ultimate cinematic portal. Reserve premium IMAX, 4DX, and Dolby Atmos seats at the finest multiplexes in India.
            </p>
            <div className="footer__features">
              <span className="footer__feature-chip">
                <Shield size={13} /> 100% Secure Payments
              </span>
              <span className="footer__feature-chip">
                <Sparkles size={13} /> Instant QR Entry
              </span>
            </div>
          </div>

          {/* Links */}
          <div className="footer__col">
            <h4>Explore</h4>
            <Link to="/movies">Now Showing</Link>
            <Link to="/movies?filter=upcoming">Upcoming Releases</Link>
            <Link to="/theatres">Cinema Theatres</Link>
            <Link to="/watchlist">Saved Watchlist</Link>
            <Link to="/my-bookings">My Ticket Wallet</Link>
          </div>

          <div className="footer__col">
            <h4>Experiences</h4>
            <a href="#imax">IMAX 4K Laser</a>
            <a href="#dolby">Dolby Atmos Sound</a>
            <a href="#4dx">4DX Motion &amp; Scent</a>
            <a href="#recliner">Director&apos;s Cut Recliners</a>
            <a href="#lounge">VIP Club CinePass</a>
          </div>

          <div className="footer__col">
            <h4>Customer Care</h4>
            <a href="mailto:support@imovies.in" className="footer__contact-link">
              <Mail size={14} /> support@imovies.in
            </a>
            <a href="tel:18001234567" className="footer__contact-link">
              <Phone size={14} /> 1800-123-4567 (Toll Free)
            </a>
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
            <a href="#">Refund &amp; Cancellation Policy</a>
          </div>
        </div>

        <div className="footer__bottom">
          <p>© {new Date().getFullYear()} iMovies Entertainment Ltd. All rights reserved.</p>
          <p className="footer__credits">
            Crafted with <Heart size={13} className="footer__heart-icon" fill="currentColor" /> for cinema enthusiasts worldwide.
          </p>
        </div>
      </div>
    </footer>
  );
}
