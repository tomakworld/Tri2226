import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import IronmanPlan from "./App.jsx";
import SeasonPlan from "./Season.jsx";

/* 三份課表:
     /            三鐵 226/113 產生器
     #/season     Season 超長距離(游5k/騎205k/跑50k)
     run/         跑跑跑,向前跑 —— 獨立的單檔頁面,放在 public/run/
                  (不是 React 元件,所以用一般連結,不走 hash 路由)         */
const ROUTES = [
  { hash: "",         label: "三鐵 226/113", el: <IronmanPlan /> },
  { hash: "#/season", label: "Season",       el: <SeasonPlan /> },
];
const EXTERNAL = [{ href: "run/", label: "跑跑跑，向前跑" }];

function Router() {
  const [hash, setHash] = useState(window.location.hash || "");
  useEffect(() => {
    const on = () => setHash(window.location.hash || "");
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const route = ROUTES.find((r) => r.hash === hash) || ROUTES[0];
  const S = (active) => ({
    fontSize: 12.5, fontWeight: 600, textDecoration: "none",
    padding: "5px 11px", borderRadius: 7,
    background: active ? "#fff" : "transparent",
    color: active ? "#111" : "#bbb",
    border: `1px solid ${active ? "#fff" : "#444"}`,
    fontFamily: "ui-sans-serif,system-ui,'Noto Sans TC',sans-serif",
  });
  return (
    <>
      <nav style={{ display:"flex", gap:6, padding:"8px 12px", flexWrap:"wrap",
        background:"#1a1a1a", position:"sticky", top:0, zIndex:50, borderBottom:"1px solid #333" }}>
        {ROUTES.map((r) => (
          <a key={r.hash || "root"} href={r.hash || "#"}
            onClick={(e) => { if (!r.hash) { e.preventDefault(); window.location.hash = ""; } }}
            style={S(r.hash === route.hash)}>{r.label}</a>
        ))}
        {EXTERNAL.map((x) => (
          <a key={x.href} href={x.href} style={S(false)}>{x.label} ↗</a>
        ))}
      </nav>
      {route.el}
    </>
  );
}
createRoot(document.getElementById("root")).render(<Router />);
