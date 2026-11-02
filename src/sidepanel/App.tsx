import { useState } from "react";
import { Home } from "./views/Home";
import { Settings } from "./views/Settings";

export type TabId = "home" | "settings";

export function App() {
  const [tab, setTab] = useState<TabId>("home");

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-brand">
          <span className="app-logo" aria-hidden>
            स
          </span>
          <div>
            <h1 className="app-title">Sahayak</h1>
            <p className="app-tagline">Your reading companion</p>
          </div>
        </div>
      </header>

      <nav className="app-nav" aria-label="Main">
        <button
          type="button"
          className={tab === "home" ? "nav-tab nav-tab--active" : "nav-tab"}
          onClick={() => setTab("home")}
          aria-current={tab === "home" ? "page" : undefined}
        >
          Home
        </button>
        <button
          type="button"
          className={
            tab === "settings" ? "nav-tab nav-tab--active" : "nav-tab"
          }
          onClick={() => setTab("settings")}
          aria-current={tab === "settings" ? "page" : undefined}
        >
          Settings
        </button>
      </nav>

      <main className="app-main">
        {tab === "home" ? <Home /> : <Settings />}
      </main>
    </div>
  );
}
