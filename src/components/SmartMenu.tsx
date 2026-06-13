import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";

type RGB = [number, number, number];

type Theme = { label: string; hex: string; rgb: RGB };

// theme = orb shader color + line/menu color, indexed
const THEMES: Theme[] = [
  { label: "Proiecte",  hex: "#ff5a5a", rgb: [1.0, 0.18, 0.18] }, // red
  { label: "Find my",   hex: "#6fe6e6", rgb: [0.10, 0.75, 0.80] }, // cyan
  { label: "Exclusive", hex: "#ffa53a", rgb: [1.0, 0.55, 0.12] }, // orange
];

type MenuItem = {
  label: string;
  kind: "projects" | "theme" | "obsidian";
  themeIndex: number;
};

const MENU: MenuItem[] = [
  { label: "Proiecte",      kind: "projects", themeIndex: 0 },
  { label: "Find my",       kind: "theme",    themeIndex: 1 },
  { label: "Exclusive",     kind: "theme",    themeIndex: 2 },
  { label: "Open Obsidian", kind: "obsidian", themeIndex: -1 },
];

const DEFAULT_INDEX = 1; // cyan

const ORB_RADIUS  = 0.28;   // must match PlasmaOrb.tsx
const ORB_GAP     = 10;     // px gap before the orb edge
const MENU_FADE_S = 2;
const LINE_DELAY_S  = 2.1;
const LINE_DUR_S    = 0.9;
const LINE_STAGGER  = 0.25;

type LineData = { ux1: number; uy: number; ux2: number; ex: number; ey: number; totalLen: number };

type Project = { name: string; path: string | null; note: string; ssh: string | null };

export default function SmartMenu({
  onColorChange,
}: {
  onColorChange?: (rgb: RGB) => void;
}) {
  const spanRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [lineData, setLineData] = useState<LineData[]>([]);
  const [active, setActive] = useState(DEFAULT_INDEX);
  const [obsidianOpen, setObsidianOpen] = useState(false);
  const [view, setView] = useState<"menu" | "projects">("menu");
  const [projects, setProjects] = useState<Project[]>([]);

  const activeHex = THEMES[active].hex;
  // every view (menu / projects, including "back") replays the full intro:
  // text fades in one by one and the connector lines draw in cursively
  const intro = true;

  // items that get a connector line (depends on the view)
  const lineItems =
    view === "menu"
      ? MENU.map((m) => m.label)
      : projects.map((p) => p.name);

  // ---------- actions ----------
  const select = (i: number) => {
    setActive(i);
    onColorChange?.(THEMES[i].rgb);
  };

  const openObsidian = async () => {
    try {
      await openUrl("obsidian://");
      setObsidianOpen(true);
    } catch (err) {
      console.error("Failed to open Obsidian:", err);
    }
  };

  const closeObsidian = async () => {
    try {
      await invoke("close_obsidian");
    } catch (err) {
      console.error("Failed to close Obsidian:", err);
    }
    setObsidianOpen(false);
  };

  const enterProjects = async () => {
    try {
      const list = await invoke<Project[]>("list_projects");
      setProjects(list);
    } catch (err) {
      console.error("Failed to list projects:", err);
      setProjects([]);
    }
    setView("projects");
  };

  const openProject = async (p: Project) => {
    try {
      if (p.ssh) {
        // not a real project — open a terminal running the ssh command
        await invoke("open_ssh", { command: p.ssh });
      } else if (p.path) {
        // open in a fresh VSCode window, leaving the current session untouched
        await invoke("open_in_vscode", { path: p.path });
      } else {
        // no path yet — open the project's note in Obsidian to add a path.md
        await openUrl("obsidian://open?path=" + encodeURIComponent(p.note));
      }
    } catch (err) {
      console.error("Failed to open project:", err);
    }
  };

  const onMenuClick = (item: MenuItem) => {
    if (item.kind === "projects") {
      select(item.themeIndex);
      enterProjects();
    } else if (item.kind === "theme") {
      select(item.themeIndex);
    } else {
      openObsidian();
    }
  };

  // ---------- Obsidian process polling ----------
  useEffect(() => {
    if (!obsidianOpen) return;
    let seenRunning = false;
    const id = setInterval(async () => {
      try {
        const running = await invoke<boolean>("is_obsidian_running");
        if (running) seenRunning = true;
        else if (seenRunning) setObsidianOpen(false);
      } catch (err) {
        console.error(err);
      }
    }, 2000);
    return () => clearInterval(id);
  }, [obsidianOpen]);

  // ---------- connector line geometry ----------
  useLayoutEffect(() => {
    const compute = () => {
      const w  = window.innerWidth;
      const h  = window.innerHeight;
      const cx = w / 2;
      const cy = h / 2;
      const R  = ORB_RADIUS * Math.min(w, h);

      const next: LineData[] = [];
      for (let i = 0; i < lineItems.length; i++) {
        const el = spanRefs.current[i];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const ux1 = rect.left;
        const ux2 = rect.right;
        const uy  = rect.bottom + 2;
        const dx  = cx - ux2;
        const dy  = cy - uy;
        const len = Math.hypot(dx, dy) || 1;
        const ex  = cx - (dx / len) * (R + ORB_GAP);
        const ey  = cy - (dy / len) * (R + ORB_GAP);
        next.push({ ux1, uy, ux2, ex, ey, totalLen: (ux2 - ux1) + Math.hypot(ex - ux2, ey - uy) });
      }
      setLineData(next);
    };

    compute();
    const raf = requestAnimationFrame(compute);
    document.fonts.ready.then(compute);
    window.addEventListener("resize", compute);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", compute);
    };
    // recompute when the visible list changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, projects.length]);

  const fadeDur   = intro ? MENU_FADE_S : 0.5;
  const fadeDelay = (i: number) => (intro ? i * 0.3 : i * 0.05);
  const lineBegin = (i: number) => (intro ? LINE_DELAY_S + i * LINE_STAGGER : 0.12 + i * 0.1);

  return (
    <>
      <style>{`
        @keyframes fadeInMenu { from { opacity: 0; } to { opacity: 1; } }
        @keyframes drawLine { to { stroke-dashoffset: 0; } }
      `}</style>

      {/* connector lines */}
      <svg className="fixed inset-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }}>
        <defs>
          <filter id="lineGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {lineData.map((l, i) => (
          <path
            key={`${view}-${i}`}
            d={`M ${l.ux1},${l.uy} L ${l.ux2},${l.uy} L ${l.ex},${l.ey}`}
            stroke={activeHex}
            strokeWidth={1.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeOpacity={0.9}
            filter="url(#lineGlow)"
            style={{
              strokeDasharray: l.totalLen,
              strokeDashoffset: l.totalLen,
              transition: "stroke 0.5s ease",
              // CSS animation restarts on every (re)mount, so the cursive draw
              // replays each time the page/view changes — unlike SMIL, whose
              // begin time is anchored to the page-load timeline.
              animation: `drawLine ${LINE_DUR_S}s cubic-bezier(0.4,0,0.2,1) ${lineBegin(i)}s both`,
            }}
          />
        ))}
      </svg>

      {/* left column */}
      <div
        className="fixed left-12 top-1/2 -translate-y-1/2 flex flex-col items-start gap-20 select-none"
        style={{ zIndex: 6 }}
      >
        {view === "menu" &&
          MENU.map((item, i) => {
            const isActive = item.kind !== "obsidian" && item.themeIndex === active;
            return (
              <a
                key={`m-${item.label}`}
                href="#"
                onClick={(e) => { e.preventDefault(); onMenuClick(item); }}
                className="text-sm tracking-wide transition-all duration-500 cursor-pointer"
                style={{
                  textDecoration: "none",
                  color: activeHex,
                  textShadow: isActive
                    ? `0 0 12px ${activeHex}, 0 0 4px ${activeHex}`
                    : `0 0 6px ${activeHex}80`,
                  filter: isActive ? "brightness(1.3)" : item.kind === "obsidian" ? "brightness(1)" : "brightness(0.75)",
                  opacity: 0,
                  animation: `fadeInMenu ${fadeDur}s cubic-bezier(0.4,0,0.2,1) ${fadeDelay(i)}s forwards`,
                }}
              >
                <span ref={(el) => { spanRefs.current[i] = el; }}>{item.label}</span>
              </a>
            );
          })}

        {view === "projects" && (
          <>
            {projects.length === 0 && (
              <span className="text-sm" style={{ color: activeHex, opacity: 0.7 }}>
                Niciun proiect găsit
              </span>
            )}

            {projects.map((p, i) => (
              <a
                key={`p-${p.name}`}
                href="#"
                onClick={(e) => { e.preventDefault(); openProject(p); }}
                title={p.ssh ?? p.path ?? "Fără path — click pentru a-l seta în Obsidian"}
                className="text-sm tracking-wide transition-all duration-500 cursor-pointer"
                style={{
                  textDecoration: "none",
                  color: activeHex,
                  fontStyle: (p.path || p.ssh) ? "normal" : "italic",
                  textShadow: `0 0 6px ${activeHex}80`,
                  filter: (p.path || p.ssh) ? "brightness(1.1)" : "brightness(0.6)",
                  opacity: 0,
                  animation: `fadeInMenu ${fadeDur}s cubic-bezier(0.4,0,0.2,1) ${fadeDelay(i)}s forwards`,
                }}
              >
                <span ref={(el) => { spanRefs.current[i] = el; }}>{p.name}</span>
              </a>
            ))}
          </>
        )}
      </div>

      {/* back button — fixed below the title bar so it never covers the traffic lights */}
      {view === "projects" && (
        <button
          onClick={() => { setView("menu"); }}
          className="fixed left-12 top-10 text-xs tracking-wide cursor-pointer transition-colors hover:brightness-125"
          style={{ zIndex: 6, color: activeHex, opacity: 0.8, animation: "fadeInMenu 0.4s ease forwards" }}
        >
          ‹ Înapoi
        </button>
      )}

      {/* right-side Obsidian status */}
      {obsidianOpen && (
        <div
          className="fixed right-12 top-1/2 -translate-y-1/2"
          style={{ zIndex: 6, animation: "fadeInMenu 0.4s ease forwards" }}
        >
          <div
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg backdrop-blur-sm"
            style={{
              border: `1px solid ${activeHex}55`,
              background: "rgba(0,0,0,0.45)",
              boxShadow: `0 0 18px ${activeHex}33`,
            }}
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#39ff7d", boxShadow: "0 0 10px #39ff7d" }} />
            <div className="flex flex-col leading-tight">
              <span className="text-sm" style={{ color: activeHex }}>Obsidian</span>
              <span className="text-[11px] text-[#9ff2f2] opacity-70">Application open</span>
            </div>
            <button
              onClick={closeObsidian}
              aria-label="Close Obsidian"
              className="ml-2 w-6 h-6 flex items-center justify-center rounded-md text-[#9ff2f2] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Close Obsidian"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}
