import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import IronmanPlan from "./App.jsx";
import SeasonPlan from "./Season.jsx";
import Sub3Plan from "./Sub3.jsx";
import TomakPlan from "./Tomak.jsx";

/* 四份課表,用 hash 路由分開 —— Zeabur 不用設 rewrite 規則就能直接用:
     /            三鐵通用產生器(226 / 113)
     #/season     Season 超長距離(游5k/騎205k/跑50k)
     #/sub3       Sub-3 全馬產生器(任何人都能填)
     #/tomak      tomak 專屬 Sub-3(2027/01/10 渣打)                       */
const ROUTES = [
  { hash: "",        label: "三鐵 226/113", el: <IronmanPlan /> },
  { hash: "#/season", label: "Season",      el: <SeasonPlan /> },
  { hash: "#/sub3",   label: "Sub-3 產生器", el: <Sub3Plan /> },
  { hash: "#/tomak",  label: "tomak",       el: <TomakPlan /> },
];

function Router() {
  const [hash, setHash] = useState(window.location.hash || "");
  useEffect(() => {
    const on = () => setHash(window.location.hash || "");
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  const route = ROUTES.find((r) => r.hash === hash) || ROUTES[0];

  return (
    <>
      <nav
        style={{
          display: "flex", gap: 6, padding: "8px 12px", flexWrap: "wrap",
          background: "#1a1a1a", position: "sticky", top: 0, zIndex: 50,
          borderBottom: "1px solid #333",
        }}
      >
        {ROUTES.map((r) => {
          const active = r.hash === route.hash;
          return (
            <a
              key={r.hash || "root"}
              href={r.hash || "#"}
              onClick={(e) => { if (!r.hash) { e.preventDefault(); window.location.hash = ""; } }}
              style={{
                fontSize: 12.5, fontWeight: 600, textDecoration: "none",
                padding: "5px 11px", borderRadius: 7,
                background: active ? "#fff" : "transparent",
                color: active ? "#111" : "#bbb",
                border: `1px solid ${active ? "#fff" : "#444"}`,
                fontFamily: "ui-sans-serif,system-ui,'Noto Sans TC',sans-serif",
              }}
            >
              {r.label}
            </a>
          );
        })}
      </nav>
      {route.el}
    </>
  );
}

createRoot(document.getElementById("root")).render(<Router />);
