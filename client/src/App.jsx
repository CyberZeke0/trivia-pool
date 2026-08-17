import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./screens/Home.jsx";
import Dashboard from "./screens/Dashboard.jsx";
import HostView from "./screens/HostView.jsx";
import PlayerView from "./screens/PlayerView.jsx";
import Login from "./screens/Login.jsx";
import Signup from "./screens/Signup.jsx";
import ResetPassword from "./screens/ResetPassword.jsx";
import LoadingScreen from "./components/LoadingScreen.jsx";
import { LanguageProvider } from "./LanguageContext.jsx";

export default function App() {
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAppReady(true), 1800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <LanguageProvider>
      {!appReady ? (
        <div className="app">
          <LoadingScreen title="Trivia Pool" />
        </div>
      ) : (
        <div className="app">
          <div className="jungle-bg">
            <div className="firefly-layer">
              {Array.from({ length: 18 }).map((_, i) => (
                <span
                  key={i}
                  className="firefly"
                  style={{
                    left: `${(i * 53) % 100}%`,
                    animationDelay: `${(i % 9) * 0.8}s`,
                    animationDuration: `${6 + (i % 5)}s`,
                  }}
                />
              ))}
            </div>
            <div className="foliage-frame">
              <div className="leaf-cluster corner-tl">🌿🍃🌱</div>
              <div className="leaf-cluster corner-tr">🍃🌿</div>
              <div className="leaf-cluster corner-bl">🍃🌱🌿</div>
              <div className="leaf-cluster corner-br">🌿🍃</div>
              <div className="leaf-cluster edge-top-1">🍃</div>
              <div className="leaf-cluster edge-top-2">🌿</div>
              <div className="leaf-cluster edge-bottom-1">🌱</div>
              <div className="leaf-cluster edge-bottom-2">🍃</div>
              <div className="leaf-cluster edge-left-1">🌿</div>
              <div className="leaf-cluster edge-right-1">🌿</div>
              <div className="leaf-silhouette leaf-left">🌿</div>
              <div className="leaf-silhouette leaf-right">🌿</div>
              <div className="leaf-silhouette leaf-left-2">🍃</div>
              <div className="leaf-silhouette leaf-right-2">🍃</div>
            </div>
          </div>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/host" element={<HostView />} />
            <Route path="/play" element={<PlayerView />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/reset-password" element={<ResetPassword />} />
          </Routes>
        </div>
      )}
    </LanguageProvider>
  );
}