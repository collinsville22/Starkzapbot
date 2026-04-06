import { useLocation, useNavigate } from "react-router-dom";
import { useTelegram } from "../hooks/useTelegram.js";
import { IconHome, IconTrade, IconEarn, IconActivity } from "./Icons.js";

const tabs = [
  { path: "/", label: "Wallet", Icon: IconHome },
  { path: "/trade", label: "Trade", Icon: IconTrade },
  { path: "/earn", label: "Earn", Icon: IconEarn },
  { path: "/activity", label: "Activity", Icon: IconActivity },
];

export function TabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { haptic } = useTelegram();

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <div className="pill-nav">
      {tabs.map((tab) => {
        const active = isActive(tab.path);
        return (
          <button
            key={tab.path}
            onClick={() => {
              haptic?.impactOccurred("light");
              navigate(tab.path);
            }}
            className={`pill-nav-item ${active ? "active" : ""}`}
          >
            <tab.Icon active={active} />
            <span className="pill-nav-label">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
