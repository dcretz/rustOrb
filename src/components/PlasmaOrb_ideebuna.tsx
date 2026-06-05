import { useEffect, useRef } from "react";

/**
 * Dark glassy orb with a glowing neon (violet/blue/magenta) rim, a bright
 * energy arc sweeping across it and a glowing hotspot — smooth liquid flow
 * driven by animated fbm noise. Rendered with a WebGL fragment shader.
 */
export default function PlasmaOrb() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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
        float radius = 0.40;

        vec3 col = vec3(0.0);   // transparent background, no nebula

        // ---------- sphere geometry ----------
        float inside = smoothstep(radius, radius - 0.012, r);
        float z = sqrt(max(radius * radius - r * r, 0.0)) / radius; // fake normal.z
        vec2 sph = uv / radius;

        // ---------- abstract energy waves (flowing ribbons) ----------
        float ti = t * 0.16;
        // domain-warp the space so the ribbons swirl
        vec2 p = sph * 2.0;
        vec2 w = vec2(fbm(p + vec2(0.0, ti)), fbm(p + vec2(5.2, -ti)));
        vec2 q = p + 1.6 * w;

        // a few thin wave-bands: where a warped field crosses zero -> a ribbon
        float field = q.y + 0.55 * sin(q.x * 1.6 + t * 0.5)
                          + 0.35 * fbm(q * 1.4 + ti);
        float ribbon = pow(1.0 - abs(fract(field * 1.3) - 0.5) * 2.0, 14.0);   // sharp thin lines
        float ribbon2 = pow(1.0 - abs(fract(field * 0.7 + 0.3) - 0.5) * 2.0, 18.0);
        float waves = (ribbon + 0.7 * ribbon2) * inside;

        // concentrate energy in a central wavy band (sparse, not full)
        float band = exp(-pow((sph.y - 0.25 * sin(sph.x * 2.2 + t * 0.3)) / 0.55, 2.0));
        waves *= band * (0.5 + 0.6 * z);

        // ---------- two glowing red-pink hotspots (ends of the band) ----------
        vec2 hsL = vec2(-0.17 + 0.012 * sin(t * 0.7), -0.05);
        vec2 hsR = vec2( 0.16 + 0.012 * cos(t * 0.6),  0.03);
        float heat = exp(-length(uv - hsL) * 12.0) + exp(-length(uv - hsR) * 12.0);
        float heatWide = exp(-length(uv - hsL) * 5.5) + exp(-length(uv - hsR) * 5.5);

        // ---------- color the energy: white-blue, red near hotspots ----------
        vec3 cool = mix(vec3(0.45, 0.55, 1.0), vec3(0.9, 0.95, 1.0), waves);
        vec3 hotC = vec3(1.0, 0.16, 0.32);
        vec3 energy = mix(cool, hotC, clamp(heatWide * 1.3, 0.0, 1.0));
        col += energy * waves * 1.7;

        // hotspot cores
        col += hotC * heat * (0.5 + 2.0 * waves) * 1.8;
        col += vec3(1.0, 0.5, 0.6) * heat * heat * 0.9;

        // ---------- subtle glass shell ----------
        float fres = pow(1.0 - z, 3.5) * inside;
        col += fres * vec3(0.5, 0.65, 1.0) * 0.6;
        col += exp(-length(uv - vec2(-0.14, 0.16)) * 17.0) * vec3(0.8, 0.9, 1.0) * 0.35;

        col = pow(col, vec3(0.95));

        // alpha from energy -> transparent where there is nothing
        float a = clamp(max(max(waves * 1.7, heat * 1.5), fres * 0.6), 0.0, 1.0);
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
    const render = () => {
      const t = (performance.now() - start) / 1000;
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, t);
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
