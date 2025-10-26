import './EvorappLogo.css'

interface EvorappLogoProps {
  className?: string
  size?: "sm" | "md" | "lg" | "xl"
}

export default function EvorappLogo({ className = "", size = "md" }: EvorappLogoProps) {
  const sizeClasses = {
    sm: "text-4xl",
    md: "text-6xl",
    lg: "text-8xl",
    xl: "text-9xl",
  }

  const letterColors = [
    "#ef4444", // a - red
    "#f97316", // p - orange
    "#f59e0b", // p - amber
    "#10b981", // r - green
    "#06b6d4", // ↺ - cyan
    "#3b82f6", // v - blue
    "#8b5cf6", // e - purple
  ]

  return (
    <div className={`word-container ${sizeClasses[size]} ${className}`}>
      <div className="flipper">
        <div className="face front">
          {["a", "p", "p", "r", "o", "v", "e"].map((letter, i) => (
            <span 
              key={i} 
              className={`letter letter-animate ${i === 3 ? "letter-compact" : ""} ${i === 4 ? "letter-closer" : ""}`}
              style={{ 
                '--target-color': letterColors[i]
              } as React.CSSProperties}
            >
              {letter}
            </span>
          ))}
        </div>
        <div className="face back">
          {["e", "v", "↺", "r"].map((letter, i) => (
            <span 
              key={i} 
              className={`letter ${i === 3 ? "letter-spaced" : ""}`}
              style={{ color: letterColors[6 - i] }}
            >
              {letter}
            </span>
          ))}
          <div className="sub-flipper">
            <div className="face front">
              {["p", "p", "a"].map((letter, i) => (
                <span key={i} className="letter" style={{ color: letterColors[2 - i] }}>
                  {letter}
                </span>
              ))}
            </div>
            <div className="face back">
              {["a", "p", "p"].map((letter, i) => (
                <span key={i} className="letter" style={{ color: letterColors[i] }}>
                  {letter}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
