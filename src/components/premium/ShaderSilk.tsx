import { useEffect, useRef } from 'react'

// Flowing "silk" backdrop — a tiny raw-WebGL fragment shader drifting warm
// cream/caramel/gold bands, like ribbons of batter. Renders at reduced
// resolution (it's a soft-focus background), pauses off-screen, and falls back
// to a static gradient when WebGL is unavailable or motion is reduced.

const FRAG = `
precision mediump float;
uniform vec2 u_res;
uniform float u_t;

// cheap value noise
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for(int i = 0; i < 4; i++){ v += a * noise(p); p *= 2.1; a *= 0.5; }
  return v;
}

void main(){
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = uv * vec2(u_res.x / u_res.y, 1.0);
  float t = u_t * 0.035;
  float flow = fbm(p * 1.6 + vec2(t, -t * 0.6) + fbm(p * 2.2 - t) * 0.9);

  vec3 cream    = vec3(0.984, 0.965, 0.937); // #FBF6EF warm cream backdrop
  vec3 champagne= vec3(0.969, 0.929, 0.882); // #F7EDE1
  vec3 caramel  = vec3(0.949, 0.788, 0.682); // #F2C9AE peach rose
  vec3 gold     = vec3(0.588, 0.376, 0.102); // #96601A logo gold

  vec3 rose     = vec3(0.910, 0.482, 0.627); // #E87BA0 logo pink

  vec3 col = mix(cream, champagne, smoothstep(0.25, 0.75, flow));
  col = mix(col, caramel, smoothstep(0.62, 0.95, flow) * 0.35);
  // a whisper of the logo's pink through the warm passages
  col = mix(col, rose, smoothstep(0.78, 1.0, flow) * 0.22);
  float vein = smoothstep(0.475, 0.5, flow) - smoothstep(0.5, 0.525, flow);
  col = mix(col, gold, vein * 0.16);
  // gentle vignette toward the page background so edges dissolve
  float vig = smoothstep(1.25, 0.35, distance(uv, vec2(0.5, 0.42)));
  col = mix(cream, col, vig);
  gl_FragColor = vec4(col, 1.0);
}
`

const VERT = `
attribute vec2 a_pos;
void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }
`

const FALLBACK =
  'radial-gradient(120% 90% at 50% 30%, #F7EDE1 0%, #FBF6EF 55%), linear-gradient(160deg, #FBF6EF 0%, #F4E9DC 50%, #F2C9AE 100%)'

export default function ShaderSilk({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const gl = canvas.getContext('webgl', { antialias: false, depth: false, stencil: false })
    if (!gl) return

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)
      if (!s) return null
      gl.shaderSource(s, src)
      gl.compileShader(s)
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null
    }
    const vs = compile(gl.VERTEX_SHADER, VERT)
    const fs = compile(gl.FRAGMENT_SHADER, FRAG)
    if (!vs || !fs) return
    const prog = gl.createProgram()
    if (!prog) return
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'a_pos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const uRes = gl.getUniformLocation(prog, 'u_res')
    const uT = gl.getUniformLocation(prog, 'u_t')

    // Quarter-resolution is plenty for a blurred-feeling backdrop.
    const scale = 0.25
    const resize = () => {
      const w = Math.max(2, Math.round(canvas.clientWidth * scale))
      const h = Math.max(2, Math.round(canvas.clientHeight * scale))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        gl.viewport(0, 0, w, h)
      }
    }

    resize()

    let visible = true
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting }, { threshold: 0 })
    io.observe(canvas)
    // resize() reads clientWidth/clientHeight — a layout read. Calling it from
    // frame() did that 60 times a second, on most subpages, forever. A
    // ResizeObserver reports the same thing only when it actually changes.
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    let raf = 0
    const t0 = performance.now()
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (!visible) return
      gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.uniform1f(uT, (now - t0) / 1000)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [])

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <div className="absolute inset-0" style={{ background: FALLBACK }} />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ filter: 'saturate(1.05)' }} />
    </div>
  )
}
