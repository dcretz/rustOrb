
import { useEffect, useRef } from "react";

type P = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
};

export default function SphereNetwork() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let particles: P[] = [];

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.max(70, Math.floor((window.innerWidth * window.innerHeight) / 22000));
      particles = Array.from({ length: count }, () => {
        const u = Math.random() * Math.PI * 2;
        const v = Math.acos(2 * Math.random() - 1);
        const speed = 0.008 + Math.random() * 0.014;
        return {
          x: Math.cos(u) * Math.sin(v),
          y: Math.sin(u) * Math.sin(v),
          z: Math.cos(v),
          vx: (Math.random() - 0.5) * speed,
          vy: (Math.random() - 0.5) * speed,
          vz: (Math.random() - 0.5) * speed,
        };
      });
    };

    const norm = (p: P) => {
      const l = Math.hypot(p.x, p.y, p.z) || 1;
      p.x /= l; p.y /= l; p.z /= l;
    };

    const draw = () => {
      const w = window.innerWidth, h = window.innerHeight;
      const cx = w / 2, cy = h / 2;
      const sphereR = Math.min(w, h) * 0.28;
      const perspective = sphereR * 2.3;

      ctx.clearRect(0, 0, w, h);
      const bg = ctx.createRadialGradient(cx, cy, sphereR * 0.1, cx, cy, Math.min(w, h) * 0.7);
      bg.addColorStop(0, "#050814");
      bg.addColorStop(1, "#020308");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      for (const p of particles) {
        p.x += p.vx; p.y += p.vy; p.z += p.vz;
        const drift = 0.0025;
        p.vx += -p.x * drift + (Math.random() - 0.5) * 0.001;
        p.vy += -p.y * drift + (Math.random() - 0.5) * 0.001;
        p.vz += -p.z * drift + (Math.random() - 0.5) * 0.001;
        norm(p);
      }

      const proj = particles.map(p => {
        const depth = perspective / (perspective - p.z * sphereR * 0.9);
        return {
          x: cx + p.x * sphereR * depth,
          y: cy + p.y * sphereR * depth,
          s: depth,
          z: p.z,
        };
      });

      const connections = 155;
      for (let i = 0; i < proj.length; i++) {
        for (let j = i + 1; j < proj.length; j++) {
          const a = proj[i], b = proj[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < connections) {
            const alpha = (1 - dist / connections) * 0.28 * Math.max(0.25, (a.s + b.s) / 2);
            ctx.strokeStyle = `rgba(110,180,255,${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      for (let i = 0; i < proj.length; i++) {
        const p = proj[i];
        const r = 1.8 * p.s;
        ctx.beginPath();
        ctx.fillStyle = "rgba(230,245,255,0.95)";
        ctx.shadowBlur = 10;
        ctx.shadowColor = "rgba(110,180,255,0.85)";
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(cx, cy, sphereR, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(160,220,255,0.12)";
      ctx.lineWidth = 2;
      ctx.shadowBlur = 24;
      ctx.shadowColor = "rgba(100,170,255,0.35)";
      ctx.stroke();

      raf = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  return <canvas ref={ref} className="block w-full h-full" />;
}
