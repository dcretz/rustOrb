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
        for (int i = 0; i < 5; i++){ v += amp * noise(p); p *= 2.0; amp *= 0.5; }
        return v;
      }

      // neon ring color gradient: blue -> violet -> deep purple (matches ref)
      vec3 ringColor(float a){
        vec3 blue   = vec3(0.30, 0.30, 1.00);
        vec3 violet = vec3(0.55, 0.20, 1.00);
        vec3 purple = vec3(0.75, 0.15, 0.95);
        vec3 c = mix(blue, violet, smoothstep(0.0, 0.5, a));
        c = mix(c, purple, smoothstep(0.5, 1.0, a));
        return c;
      }

      void main(){
        vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
        float t = uTime;

        float r   = length(uv);
        float ang = atan(uv.y, uv.x);
        float radius = 0.34;

        vec3 col = vec3(0.0);

        // ---- dark glassy interior ----
        float inside = smoothstep(radius, radius - 0.02, r);
        float z = sqrt(max(radius * radius - r * r, 0.0)) / radius; // fake sphere
        // very subtle internal violet haze, brighter near rim
        float interiorHaze = inside * (0.04 + 0.10 * pow(1.0 - z, 2.0));
        col += interiorHaze * ringColor(0.4 + 0.3 * sin(ang + t * 0.3));

        // ---- liquid flow modulation around the ring ----
        vec2 fp = vec2(cos(ang), sin(ang)) * 1.6;
        float flow = fbm(fp * 2.0 + vec2(t * 0.35, -t * 0.25));
        float flow2 = fbm(fp * 3.0 - vec2(t * 0.2, t * 0.15));

        // ---- main neon rim ----
        float band = exp(-pow((r - radius) / 0.018, 2.0));   // thin glowing band
        float rimIntensity = 0.45 + 0.85 * flow;             // uneven, flowing light
        // a brighter concentrated region that slowly drifts (top-left feel)
        float hot = smoothstep(0.55, 1.0, sin(ang - t * 0.25 + flow2 * 2.0) * 0.5 + 0.5);
        rimIntensity += hot * 1.4;
        vec3 rimCol = ringColor(0.5 + 0.5 * sin(ang * 1.3 + t * 0.3));
        col += band * rimIntensity * rimCol * 1.6;

        // ---- bright energy arc sweeping across the interior ----
        float arcR = radius * (0.72 + 0.12 * sin(t * 0.4));
        float arc = exp(-pow((r - arcR) / 0.01, 2.0));
        float arcMask = smoothstep(0.2, 0.9, sin(ang * 0.8 + t * 0.6)) * inside;
        col += arc * arcMask * ringColor(0.7) * 1.3;

        // ---- glowing hotspot travelling along the rim ----
        float hotAng = t * 0.5;
        vec2 hp = vec2(cos(hotAng), sin(hotAng)) * radius;
        float hd = length(uv - hp);
        col += exp(-hd * 22.0) * ringColor(0.85) * 2.2;          // core point
        col += exp(-hd * 7.0)  * ringColor(0.8)  * 0.7;          // soft halo

        // ---- outer bloom / atmospheric glow ----
        float glow = exp(-max(r - radius, 0.0) * 9.0) * (1.0 - inside);
        col += glow * ringColor(0.5 + 0.4 * sin(ang + t * 0.2)) * (0.5 + 0.6 * flow);

        // tone / vignette
        col *= 1.0 - 0.15 * smoothstep(0.6, 1.1, r);
        col = pow(col, vec3(0.9));

        float alpha = clamp(max(inside, glow * 1.2) + band, 0.0, 1.0);
        gl_FragColor = vec4(col, alpha);
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
      gl.clearColor(0.0, 0.0, 0.01, 1.0);
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
