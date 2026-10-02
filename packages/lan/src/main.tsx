import "./app.css";
import { useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import { GameClientLoader } from "./LanPlay";
import { ModeSelectScreen } from "./ModeSelectScreen";
import { LandingPage } from "./LandingPage";
import { loadProfile, requestGamePass, type Profile } from "./profile";

// The game server and this page are served from the same host:port,
// so the client always connects back to whoever served it.
(window as any).__GAME_SERVER_URL__ = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`;

type Screen = "landing" | "mode" | "game";

function App() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  const [session, setSession] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const play = useCallback(async () => {
    // A game pass lets the host credit kills and waves to this profile on the leaderboard.
    const token = await requestGamePass(profile);
    (window as any).__gameAuthToken = token;
    setNotice(token ? null : "Couldn't register your profile. This match won't count toward the leaderboard.");
    setSession((s) => s + 1);
    setScreen("mode");
  }, [profile]);

  const backToLanding = useCallback(() => {
    // Name/color may have been changed in-game; those panels save to the same keys.
    setProfile(loadProfile());
    setScreen("landing");
  }, []);

  if (screen === "mode") {
    return <ModeSelectScreen onReady={() => setScreen("game")} onBack={backToLanding} />;
  }
  if (screen === "game") {
    return <GameClientLoader key={session} onLeave={backToLanding} />;
  }
  return (
    <LandingPage
      profile={profile}
      onProfileChange={setProfile}
      onPlay={play}
      notice={notice}
    />
  );
}

createRoot(document.getElementById("root")!).render(<App />);
