import { useEffect, useRef, useState } from "react";

type JarvisState = "idle" | "listening" | "thinking" | "speaking";

interface Message {
  id: number;
  role: "user" | "jarvis";
  text: string;
}

const STATE_COLORS: Record<JarvisState, string> = {
  idle: "#4b5563",
  listening: "#22c55e",
  thinking: "#a855f7",
  speaking: "#06b6d4",
};

const STATE_GLOW: Record<JarvisState, string> = {
  idle: "transparent",
  listening: "rgba(34,197,94,0.5)",
  thinking: "rgba(168,85,247,0.5)",
  speaking: "rgba(6,182,212,0.5)",
};

interface Props {
  onStateChange?: (state: JarvisState) => void;
}

export default function JarvisWidget({ onStateChange }: Props) {
  const [state, setState] = useState<JarvisState>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [connected, setConnected] = useState(false);
  const msgIdRef = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ws: WebSocket;
    let retryTimer: ReturnType<typeof setTimeout>;
    let dead = false;

    const connect = () => {
      if (dead) return;
      ws = new WebSocket("ws://localhost:8765");

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        setState("idle");
        onStateChange?.("idle");
        retryTimer = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (ev) => {
        try {
          const event = JSON.parse(ev.data as string);
          if (event.type === "state") {
            setState(event.state as JarvisState);
            onStateChange?.(event.state as JarvisState);
          } else if (event.type === "message") {
            setMessages((prev) => [
              ...prev,
              { id: msgIdRef.current++, role: event.role, text: event.text },
            ]);
          }
        } catch {
          // ignore malformed messages
        }
      };
    };

    connect();
    return () => {
      dead = true;
      clearTimeout(retryTimer);
      ws?.close();
    };
  }, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages]);

  const color = STATE_COLORS[state];
  const glow = STATE_GLOW[state];
  const isPulsing = state === "speaking";

  return (
    <div
      style={{
        position: "fixed",
        top: "40px",
        right: "8px",
        width: "230px",
        zIndex: 50,
        background: "rgba(10, 10, 15, 0.88)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "10px",
        padding: "8px 10px",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
        userSelect: "none",
      }}
    >
      {/* Status row */}
      <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
        <div
          style={{
            width: "9px",
            height: "9px",
            borderRadius: "50%",
            background: color,
            boxShadow: `0 0 8px ${glow}`,
            animation: isPulsing ? "jarvis-pulse 0.85s ease-in-out infinite" : "none",
            transition: "background 0.25s, box-shadow 0.25s",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: "9px",
            fontFamily: "monospace",
            letterSpacing: "0.08em",
            color: connected ? color : "#4b5563",
            transition: "color 0.25s",
          }}
        >
          JARVIS · {connected ? state.toUpperCase() : "OFFLINE"}
        </span>
      </div>

      {/* Divider */}
      <div style={{ height: "1px", background: "rgba(255,255,255,0.06)" }} />

      {/* Conversation log */}
      <div
        ref={logRef}
        style={{
          height: "190px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "5px",
          scrollbarWidth: "none",
        }}
      >
        {messages.length === 0 && (
          <span
            style={{
              fontSize: "10px",
              color: "#374151",
              fontStyle: "italic",
              marginTop: "4px",
            }}
          >
            say "hey jarvis"…
          </span>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              display: "flex",
              justifyContent: m.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: "88%",
                padding: "4px 8px",
                borderRadius: m.role === "user" ? "8px 8px 2px 8px" : "8px 8px 8px 2px",
                fontSize: "10px",
                lineHeight: "1.45",
                background:
                  m.role === "user"
                    ? "rgba(59,130,246,0.18)"
                    : "rgba(139,92,246,0.15)",
                color: m.role === "user" ? "#93c5fd" : "#c4b5fd",
                border:
                  m.role === "user"
                    ? "1px solid rgba(59,130,246,0.25)"
                    : "1px solid rgba(139,92,246,0.25)",
              }}
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes jarvis-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%       { transform: scale(2.2); opacity: 0.35; }
        }
        div::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
