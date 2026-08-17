import { useEffect, useState } from "react";

const TIPS = [
  "Tip: faster correct answers earn more points!",
  "Tip: keep an eye on the timer bar.",
  "Tip: teams combine everyone's score.",
  "Tip: the highest score takes the whole pot.",
];

export default function LoadingScreen({ title = "Loading..." }) {
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((i) => (i + 1) % TIPS.length);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="screen center">
      <div className="loading-card">
        <h2>{title}</h2>
        <div className="brick-row">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="brick"
              style={{ animationDelay: `${i * 0.15}s` }}
            >
              <span className="brick-mark">?</span>
            </div>
          ))}
        </div>
        <p className="loading-tip">{TIPS[tipIndex]}</p>
      </div>
    </div>
  );
}