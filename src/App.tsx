import { useState } from "react";
import { SetupScreen } from "@/components/SetupScreen";
import { LoginScreen } from "@/components/LoginScreen";
import { Nav } from "@/components/Nav";
import { Dashboard } from "@/components/Dashboard";
import { Settings } from "@/components/Settings";
import { getGoogleClientId } from "@/lib/localConfig";
import { getValidAccessToken, clearStoredToken, signOutGoogle } from "@/lib/googleAuth";

type View = "dashboard" | "settings";

export default function App() {
  const [clientId, setClientId] = useState<string | null>(getGoogleClientId());
  const [accessToken, setAccessToken] = useState<string | null>(getValidAccessToken());
  const [view, setView] = useState<View>("dashboard");

  function handleSignOut() {
    signOutGoogle();
    clearStoredToken();
    setAccessToken(null);
    setView("dashboard");
  }

  if (!clientId) {
    return <SetupScreen onSaved={() => setClientId(getGoogleClientId())} />;
  }

  if (!accessToken) {
    return (
      <LoginScreen
        clientId={clientId}
        onSignedIn={setAccessToken}
        onResetClientId={() => {
          setClientId(null);
          setAccessToken(null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <Nav view={view} onNavigate={setView} onSignOut={handleSignOut} />
      {view === "dashboard" ? (
        <Dashboard accessToken={accessToken} />
      ) : (
        <Settings onClientIdReset={() => { setClientId(null); setAccessToken(null); }} />
      )}
    </div>
  );
}
