import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import "./SectionHeader.css";

export default function SectionHeader({
  eyebrow,
  title,
  subtitle,
  viewAllLink,
  actionText = "View All",
  actionTo,
}) {
  const targetLink = actionTo || viewAllLink;

  return (
    <div className="section-header">
      <div className="section-header__left">
        {eyebrow && <span className="section-header__eyebrow">{eyebrow}</span>}
        <h2 className="section-header__title">{title}</h2>
        {subtitle && <p className="section-header__subtitle">{subtitle}</p>}
      </div>
      {targetLink && (
        <Link to={targetLink} className="section-header__view-all">
          <span>{actionText}</span>
          <ArrowRight size={15} />
        </Link>
      )}
    </div>
  );
}
