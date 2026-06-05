import { useEffect, useRef } from "react";

type RGB = [number, number, number];

/**
 * Glassy energy orb with swirling ribbons, a soft glass shell and a small
 * flare. The main hue is driven by the `color` prop and transitions smoothly.
 */
export default function PlasmaOrb({ color = [0.10, 0.75, 0.80] as RGB }: { color?: RGB }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const targetColor = useRef<RGB>(color);

  // update the lerp target whenever the prop changes
  useEffect(() => {
    targetColor.current = color;
  }, [color]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: true, premultipliedAlpha: false });
    if (!gl) return;

    const vertSrc = `
      attribute vec2 aPos;
      void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
    `;

    const fragSrc = `
      precision highp float;
      uniform vec2  uRes;
      uniform float uTime;
      uniform vec3  uColor;

      float hash(vec2 p){
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }
      float noise(vec2 p){
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1,0)), u.x),
                   mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
      }
      float fbm(vec2 p){
        float v = 0.0, amp = 0.5;
        for (int i = 0; i < 6; i++){ v += amp * noise(p); p = p * 2.02 + 1.7; amp *= 0.5; }
        return v;
      }

      void main(){
        vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
        float t = uTime;

        float r   = length(uv);
        float radius = 0.28;

        vec3 C = uColor;            // theme hue
        vec3 white = vec3(1.0);
        vec3 col = vec3(0.0);       // transparent background

        // ---------- soft spherical volume (no hard contour) ----------
        float vol = exp(-pow(r / (radius * 0.95), 2.2) * 1.3);
        float z   = sqrt(max(radius * radius - r * r, 0.0)) / radius;
        vec2 sph  = uv / radius;

        // ---------- abstract energy waves (swirling ribbons) ----------
        float ti = t * 0.16;
        float rot = ti * 0.5 + (1.0 - z) * 1.5;
        float cs = cos(rot), sn = sin(rot);
        vec2 p = mat2(cs, -sn, sn, cs) * sph * 2.0;
        vec2 w = vec2(fbm(p + vec2(0.0, ti)), fbm(p + vec2(5.2, -ti)));
        vec2 q = p + 2.3 * w;

        float field = q.y + 0.6 * sin(q.x * 1.1 + t * 0.4)
                          + 0.4 * fbm(q * 1.1 + ti);
        float ribbon  = pow(1.0 - abs(fract(field * 0.9) - 0.5) * 2.0, 10.0);
        float ribbon2 = pow(1.0 - abs(fract(field * 0.5 + 0.3) - 0.5) * 2.0, 12.0);
        float ribbon3 = pow(1.0 - abs(fract(field * 1.4 + 0.6) - 0.5) * 2.0, 11.0);
        float core = ribbon + 0.7 * ribbon2 + 0.6 * ribbon3;

        float halo = pow(1.0 - abs(fract(field * 0.9) - 0.5) * 2.0, 3.0)
                   + 0.6 * pow(1.0 - abs(fract(field * 0.5 + 0.3) - 0.5) * 2.0, 3.0)
                   + 0.5 * pow(1.0 - abs(fract(field * 1.4 + 0.6) - 0.5) * 2.0, 3.0);

        float band = 0.75 + 0.25 * exp(-pow((sph.y - 0.25 * sin(sph.x * 2.2 + t * 0.3)) / 0.9, 2.0));
        core *= band * vol * (0.5 + 0.6 * z);
        halo *= band * vol;

        // ---------- color (driven by uColor) ----------
        vec3 coolCore = mix(C, white, core);          // hue -> white at the bright core
        col += coolCore * core * 1.8;                 // bright filament
        col += C * 0.75 * halo * 0.55;                // soft halo
        col += C * 0.6  * vol * 0.14 * (0.4 + 0.6 * z); // faint volumetric fill

        // ---------- glassy shell ----------
        float shell = exp(-pow((r - radius) / 0.05, 2.0));
        col += shell * C * 0.45;
        float inner = exp(-pow((r - radius * 0.82) / 0.06, 2.0));
        col += inner * C * 0.7 * 0.20;
        // glassy specular highlight (mostly white, slight tint)
        float spec = exp(-length(uv - vec2(-0.11, 0.12)) * 26.0);
        col += spec * mix(white, C, 0.25) * 0.55;
        // broad soft sheen on the upper half
        col += smoothstep(0.0, radius, radius - r) * max(0.0, sph.y) * C * 0.55 * 0.10;

        // ---------- small bright flare ----------
        vec2 fpos = vec2(0.24, 0.04);
        float flare = exp(-length(uv - fpos) * 22.0);
        col += flare * mix(white, C, 0.3) * 0.8;
        col += exp(-length(uv - fpos) * 45.0) * white * 0.9;   // hot center

        col = pow(col, vec3(0.95));

        float a = clamp(core * 1.8 + halo * 0.55 + shell * 0.40 + inner * 0.18
                        + spec * 0.55 + flare * 0.8 + vol * 0.12, 0.0, 1.0);
        gl_FragColor = vec4(col, a);
      }
    `;

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(sh));
      }
      return sh;
    };

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vertSrc));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragSrc));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "uRes");
    const uTime = gl.getUniformLocation(prog, "uTime");
    const uColor = gl.getUniformLocation(prog, "uColor");

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    let raf = 0;
    const start = performance.now();
    const cur: RGB = [...targetColor.current];   // currently displayed color
    const render = () => {
      const t = (performance.now() - start) / 1000;
      // smoothly ease current color toward the target
      const tgt = targetColor.current;
      cur[0] += (tgt[0] - cur[0]) * 0.06;
      cur[1] += (tgt[1] - cur[1]) * 0.06;
      cur[2] += (tgt[2] - cur[2]) * 0.06;

      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, t);
      gl.uniform3f(uColor, cur[0], cur[1], cur[2]);
      gl.clearColor(0.0, 0.0, 0.0, 0.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(render);
    };

    resize();
    render();
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 w-full h-full -z-10 bg-black" />;
}
