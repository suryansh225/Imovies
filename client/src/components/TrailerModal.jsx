import { useEffect } from "react";
import { useApp } from "../context/AppContext";
import { X, Play, Film } from "lucide-react";
import "./TrailerModal.css";

export default function TrailerModal() {
  const { trailerMovie, setTrailerMovie } = useApp();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setTrailerMovie(null);
      }
    };
    if (trailerMovie) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [trailerMovie, setTrailerMovie]);

  if (!trailerMovie) return null;

  const trailerUrl =
    trailerMovie.trailerUrl ||
    "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1";
  const embedUrl = trailerUrl.includes("autoplay=1")
    ? trailerUrl
    : `${trailerUrl}${trailerUrl.includes("?") ? "&" : "?"}autoplay=1`;

  return (
    <div className="trailer-modal-backdrop" onClick={() => setTrailerMovie(null)}>
      <div
        className="trailer-modal-box"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="trailer-modal__header">
          <div className="trailer-modal__title-group">
            <Film size={20} className="trailer-modal__icon" />
            <div>
              <h3>{trailerMovie.title}</h3>
              <p>Official Cinematic Trailer · {trailerMovie.duration || "2h"}</p>
            </div>
          </div>
          <button
            className="trailer-modal__close"
            onClick={() => setTrailerMovie(null)}
            aria-label="Close trailer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="trailer-modal__player-wrap">
          <iframe
            src={embedUrl}
            title={`${trailerMovie.title} Trailer`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}
