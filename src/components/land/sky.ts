// The sky over the map, run from src/lib/sky.ts (India's clock): the sky dome with the sun, moon,
// stars and clouds, the sun / moon light and its colour, the fog, rain and snow falling round the
// camera, lightning in storms, and the lights of the town at night (street lamps, windows, lanterns
// in the jungle, the far towns). Changing the time or weather by hand plays out as a quick time-lapse.
import * as THREE from "three";
import { getSkyPicks, skyAt, sunDir, type SkyState } from "@/lib/sky";

type Key = { e: number; top: string; mid: string; hor: string; sun: string; sunI: number; hs: string; hg: string; hi: number };

// The clear sky by the sun's height (e = sine of its elevation).
const KEYS: Key[] = [
  { e: -0.3, top: "#060B22", mid: "#0E1838", hor: "#1C2848", sun: "#FF8A4A", sunI: 0, hs: "#3A4C80", hg: "#141C2A", hi: 0.6 },
  { e: -0.12, top: "#121B46", mid: "#262F68", hor: "#45466E", sun: "#FF8A4A", sunI: 0, hs: "#4C5492", hg: "#262838", hi: 0.66 },
  { e: -0.035, top: "#2C3976", mid: "#6A5D94", hor: "#C47F78", sun: "#FF7A3C", sunI: 0, hs: "#8E7AA8", hg: "#4E4248", hi: 0.78 },
  { e: 0.035, top: "#4C68AC", mid: "#DE987A", hor: "#F6AE78", sun: "#FF9A52", sunI: 0.95, hs: "#FFC4A0", hg: "#86704F", hi: 1.05 },
  { e: 0.14, top: "#6A9ED6", mid: "#B2CAE2", hor: "#EEDCC4", sun: "#FFD49C", sunI: 1.6, hs: "#F4ECE0", hg: "#A2AA78", hi: 1.32 },
  { e: 0.35, top: "#5F9FD6", mid: "#93C0E6", hor: "#DDE8EE", sun: "#FFF0D8", sunI: 2.0, hs: "#EAF4FF", hg: "#A3B57F", hi: 1.48 },
  { e: 0.8, top: "#4E93D3", mid: "#8DBDE6", hor: "#DDE8EE", sun: "#FFF4E0", sunI: 2.15, hs: "#EAF4FF", hg: "#A3B57F", hi: 1.55 },
];
const KEYC = KEYS.map((k) => ({
  ...k,
  cTop: new THREE.Color(k.top),
  cMid: new THREE.Color(k.mid),
  cHor: new THREE.Color(k.hor),
  cSun: new THREE.Color(k.sun),
  cHs: new THREE.Color(k.hs),
  cHg: new THREE.Color(k.hg),
}));

const RAIN_DAY = { top: new THREE.Color("#6F7A86"), mid: new THREE.Color("#8F99A3"), hor: new THREE.Color("#A9B1B8") };
const RAIN_NIGHT = { top: new THREE.Color("#0B0E14"), mid: new THREE.Color("#141922"), hor: new THREE.Color("#1D232C") };
const SNOW_HOR = new THREE.Color("#E6ECF2");
const SNOW_NIGHT = new THREE.Color("#2E3850");
const SNOW_GROUND = new THREE.Color("#C9D2DC");
const MOON_COL = new THREE.Color("#AFC3FF");
const CLOUD_NIGHT = new THREE.Color("#283152");
const CLOUD_RAIN = new THREE.Color("#7C868F");
const WHITE = new THREE.Color("#FFFFFF");

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Uniforms shared with every material patched by patchWorld.
export type WorldUniforms = {
  uNight: { value: number };
  uSnow: { value: number };
  uWet: { value: number };
  uGlass: { value: THREE.Color };
  uLampA: { value: THREE.Color };
  uLampB: { value: THREE.Color };
};

// A colour as it ends up in a vertex-colour buffer (linear, then bytes), so the shader can spot it.
const keyColor = (hex: string) => {
  const c = new THREE.Color(hex);
  return new THREE.Color(Math.round(c.r * 255) / 255, Math.round(c.g * 255) / 255, Math.round(c.b * 255) / 255);
};

export const newWorldUniforms = (): WorldUniforms => ({
  uNight: { value: 0 },
  uSnow: { value: 0 },
  uWet: { value: 0 },
  uGlass: { value: keyColor("#A9C3D3") }, // window glass (layout.GLASS)
  uLampA: { value: keyColor("#FFF3C4") }, // street lamp heads, jungle lanterns
  uLampB: { value: keyColor("#FFE9A0") }, // the lighthouse lamp
});

// Teaches a Lambert material the weather: windows and lamps light up at night, snow settles on
// whatever faces up (less on roads, none on water), and rain darkens the ground a little.
export const patchWorld = (mat: THREE.Material, u: WorldUniforms) => {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;\nvarying float vUp;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vec4 wq = vec4(transformed, 1.0);
        vec3 wn = objectNormal;
        #ifdef USE_INSTANCING
          wq = instanceMatrix * wq;
          mat3 im2 = mat3(instanceMatrix);
          wn /= vec3(dot(im2[0], im2[0]), dot(im2[1], im2[1]), dot(im2[2], im2[2]));
          wn = im2 * wn;
        #endif
        vWPos = (modelMatrix * wq).xyz;
        vUp = normalize(mat3(modelMatrix) * wn).y;`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vWPos;
        varying float vUp;
        uniform float uNight;
        uniform float uSnow;
        uniform float uWet;
        uniform vec3 uGlass;
        uniform vec3 uLampA;
        uniform vec3 uLampB;
        float wHash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float glassK = 0.0;
        float lampK = 0.0;
        #if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
        {
          vec3 vc = vColor.rgb;
          glassK = 1.0 - step(0.012, length(vc - uGlass));
          lampK = max(1.0 - step(0.012, length(vc - uLampA)), 1.0 - step(0.012, length(vc - uLampB)));
          vec3 dc = diffuseColor.rgb;
          float water = step(dc.r * 2.0, dc.b) * step(dc.g * 1.04, dc.b) * step(vWPos.y, 1.3);
          float lum = dot(dc, vec3(0.2126, 0.7152, 0.0722));
          float up = smoothstep(0.45, 0.9, vUp);
          float grain = wHash(vec3(floor(vWPos.xz * 0.35), 0.0));
          float sn = uSnow * up * (1.0 - water) * (1.0 - glassK) * (1.0 - lampK) * mix(0.38, 1.0, smoothstep(0.06, 0.16, lum)) * (0.94 + 0.06 * grain);
          dc = mix(dc, vec3(0.88, 0.92, 0.97), sn);
          dc = mix(dc, vec3(0.62, 0.76, 0.86), uSnow * water * 0.55);
          dc *= 1.0 - uWet * 0.22 * up * (1.0 - water);
          diffuseColor.rgb = dc;
        }
        #endif`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        if (glassK > 0.5) {
          float lit = step(0.33, wHash(floor(vWPos / 3.4)));
          totalEmissiveRadiance += vec3(1.0, 0.72, 0.36) * 0.95 * uNight * lit;
        }
        totalEmissiveRadiance += vec3(1.0, 0.86, 0.55) * 1.5 * uNight * lampK;`,
      );
  };
  mat.customProgramCacheKey = () => "world-sky-1";
  mat.needsUpdate = true;
};

const cloudTex = () => {
  const cv = document.createElement("canvas");
  cv.width = 1024;
  cv.height = 512;
  const g = cv.getContext("2d") as CanvasRenderingContext2D;
  let s = 7;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let n = 0; n < 90; n++) {
    const x = r() * 1024;
    const y = 150 + r() * 95;
    const rw = 20 + r() * 60;
    const rh = 4 + r() * 8;
    const rg = g.createRadialGradient(x, y, 0, x, y, rw);
    rg.addColorStop(0, "rgba(255,255,255,0.8)");
    rg.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = rg;
    g.save();
    g.translate(x, y);
    g.scale(1, rh / rw);
    g.translate(-x, -y);
    g.beginPath();
    g.arc(x, y, rw, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
};

const softDot = () => {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const g = cv.getContext("2d") as CanvasRenderingContext2D;
  const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  rg.addColorStop(0, "rgba(255,255,255,1)");
  rg.addColorStop(0.35, "rgba(255,255,255,0.45)");
  rg.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = rg;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

const DOME_VS = /* glsl */ `
varying vec3 vDir;
varying vec2 vUv;
void main() {
  vDir = normalize(position);
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const DOME_FS = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uMid;
uniform vec3 uHor;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform float uSunVis;
uniform vec3 uMoonDir;
uniform float uMoonVis;
uniform sampler2D uClouds;
uniform vec3 uCloudCol;
uniform float uCloudA;
uniform float uOvercast;
uniform vec3 uOverCol;
uniform float uFlash;
uniform float uTime;
varying vec3 vDir;
varying vec2 vUv;
void main() {
  vec3 d = normalize(vDir);
  float y = d.y;
  vec3 col = mix(uHor, uMid, smoothstep(0.0, 0.22, y));
  col = mix(col, uTop, smoothstep(0.18, 0.75, y));
  float sd = max(dot(d, uSunDir), 0.0);
  col += uSunCol * (pow(sd, 6.0) * 0.28 + pow(sd, 90.0) * 0.55) * uSunVis;
  col = mix(col, vec3(1.0, 0.96, 0.86), smoothstep(0.99965, 0.99985, sd) * uSunVis);
  float md = max(dot(d, uMoonDir), 0.0);
  col += vec3(0.5, 0.58, 0.85) * pow(md, 28.0) * 0.16 * uMoonVis;
  col = mix(col, vec3(0.93, 0.95, 1.0), smoothstep(0.99962, 0.99982, md) * uMoonVis);
  vec4 c = texture2D(uClouds, vec2(vUv.x + uTime * 0.0012, vUv.y));
  col = mix(col, uCloudCol, c.a * uCloudA);
  col = mix(col, uOverCol, uOvercast * smoothstep(-0.12, 0.3, y));
  col += vec3(0.7, 0.75, 0.95) * uFlash;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const STAR_VS = /* glsl */ `
attribute float aSize;
attribute float aPhase;
uniform float uStars;
uniform float uTime;
uniform float uPr;
varying float vA;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uPr;
  vA = uStars * (0.6 + 0.4 * sin(uTime * 1.6 + aPhase)) * smoothstep(0.02, 0.18, normalize(position).y);
}`;

const STAR_FS = /* glsl */ `
varying float vA;
void main() {
  float r = length(gl_PointCoord - 0.5);
  gl_FragColor = vec4(1.0, 0.97, 0.9, vA * smoothstep(0.5, 0.05, r));
}`;

// Rain: a line per drop, in a box round the camera's target that's fixed in the world (drops don't
// slide when you pan), falling and wrapping round.
const RAIN_VS = /* glsl */ `
attribute vec3 aSeed;
attribute float aEnd;
uniform vec3 uC;
uniform float uS;
uniform float uH;
uniform float uT;
uniform float uLen;
varying float vA;
void main() {
  float x = uC.x - uS * 0.5 + mod(aSeed.x * uS - (uC.x - uS * 0.5), uS);
  float z = uC.z - uS * 0.5 + mod(aSeed.z * uS - (uC.z - uS * 0.5), uS);
  float f = fract(aSeed.y - uT * 15.0 / uH);
  vec3 p = vec3(x, uC.y + f * uH, z) + vec3(0.18, 1.0, 0.1) * uLen * aEnd;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  vA = smoothstep(0.0, 0.05, f) * (1.0 - smoothstep(0.85, 1.0, f));
}`;

const RAIN_FS = /* glsl */ `
uniform float uA;
uniform vec3 uCol;
varying float vA;
void main() { gl_FragColor = vec4(uCol, uA * vA); }`;

const SNOW_VS = /* glsl */ `
attribute vec3 aSeed;
uniform vec3 uC;
uniform float uS;
uniform float uH;
uniform float uT;
uniform float uPx;
uniform float uSize;
varying float vA;
void main() {
  float f = fract(aSeed.y - uT * 1.1 / uH);
  float sx = sin(uT * 0.7 + aSeed.x * 40.0) * 0.9;
  float sz = cos(uT * 0.6 + aSeed.z * 30.0) * 0.9;
  float x = uC.x - uS * 0.5 + mod(aSeed.x * uS + sx - (uC.x - uS * 0.5), uS);
  float z = uC.z - uS * 0.5 + mod(aSeed.z * uS + sz - (uC.z - uS * 0.5), uS);
  vec4 mv = modelViewMatrix * vec4(x, uC.y + f * uH, z, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.6, uSize * uPx / max(0.5, -mv.z));
  vA = smoothstep(0.0, 0.06, f) * (1.0 - smoothstep(0.9, 1.0, f));
}`;

const SNOW_FS = /* glsl */ `
uniform float uA;
varying float vA;
void main() {
  float r = length(gl_PointCoord - 0.5);
  gl_FragColor = vec4(1.0, 1.0, 1.0, uA * vA * smoothstep(0.5, 0.12, r));
}`;

// Glowing points with a size in metres (lamps, far windows, fireflies).
const GLOW_VS = /* glsl */ `
attribute float aPhase;
uniform float uPx;
uniform float uSize;
uniform float uMin;
uniform float uT;
uniform float uBlink;
varying float vA;
void main() {
  vec3 p = position;
  p += uBlink * vec3(sin(uT * 0.7 + aPhase * 3.1), sin(uT * 0.9 + aPhase) * 0.5, cos(uT * 0.6 + aPhase * 1.7)) * 0.6;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(uMin, uSize * uPx / max(0.5, -mv.z));
  vA = mix(1.0, smoothstep(0.55, 1.0, sin(uT * 2.3 + aPhase * 6.0)), uBlink);
}`;

const GLOW_FS = /* glsl */ `
uniform vec3 uCol;
uniform float uA;
varying float vA;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float a = exp(-r * r * 4.0) * (1.0 - smoothstep(0.85, 1.0, r));
  gl_FragColor = vec4(uCol * a * uA * vA, 1.0);
}`;

type GlowUniforms = { uPx: { value: number }; uSize: { value: number }; uMin: { value: number }; uT: { value: number }; uBlink: { value: number }; uCol: { value: THREE.Color }; uA: { value: number } };

const glowMaterial = (col: string, size: number, min: number, blink = 0) =>
  new THREE.ShaderMaterial({
    uniforms: {
      uPx: { value: 1 },
      uSize: { value: size },
      uMin: { value: min },
      uT: { value: 0 },
      uBlink: { value: blink },
      uCol: { value: new THREE.Color(col) },
      uA: { value: 0 },
    } satisfies GlowUniforms,
    vertexShader: GLOW_VS,
    fragmentShader: GLOW_FS,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

const pointsOf = (pos: ArrayLike<number>, mat: THREE.ShaderMaterial) => {
  const g = new THREE.BufferGeometry();
  const p = new Float32Array(pos);
  g.setAttribute("position", new THREE.BufferAttribute(p, 3));
  const n = p.length / 3;
  const ph = new Float32Array(n);
  for (let i = 0; i < n; i++) ph[i] = (Math.sin(i * 91.7) * 0.5 + 0.5) * 6.283;
  g.setAttribute("aPhase", new THREE.BufferAttribute(ph, 1));
  g.computeBoundingSphere();
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  return pts;
};

export type SkyOptions = {
  scene: THREE.Scene;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  fog: THREE.Fog;
  lowPower: boolean;
  reduced: boolean;
  radius: number; // of the sky dome
};

export class SkySystem {
  readonly dome: THREE.Mesh;
  readonly world = newWorldUniforms();
  // Direction of the light that casts shadows (the sun by day, the moon at night).
  readonly keyDir = new THREE.Vector3(-0.45, 1, 0.6).normalize();
  state: SkyState;
  private o: SkyOptions;
  private domeU: Record<string, { value: unknown }>;
  private stars: THREE.Points;
  private starU: { uStars: { value: number }; uTime: { value: number }; uPr: { value: number } };
  private rain: THREE.LineSegments;
  private rainU: { uC: { value: THREE.Vector3 }; uS: { value: number }; uH: { value: number }; uT: { value: number }; uLen: { value: number }; uA: { value: number }; uCol: { value: THREE.Color } };
  private snow: THREE.Points;
  private snowU: { uC: { value: THREE.Vector3 }; uS: { value: number }; uH: { value: number }; uT: { value: number }; uPx: { value: number }; uSize: { value: number }; uA: { value: number } };
  private lampMat = glowMaterial("#FFC56E", 3.4, 1.5);
  private lamps: THREE.Points | null = null;
  private pools: THREE.InstancedMesh | null = null;
  private poolMat: THREE.MeshBasicMaterial;
  private farMat = glowMaterial("#FFC46B", 5.5, 1.3);
  private farLights: THREE.Points | null = null;
  private flyMat = glowMaterial("#D8FF7A", 0.55, 1.2, 1);
  private flies: THREE.Points | null = null;
  private dot: THREE.Texture;

  // Eased values (what's drawn now).
  private hour = -1;
  private rainAmt = 0;
  private snowAmt = 0;
  private frostAmt = 0;
  private stateAt = -Infinity;
  private flash = 0;
  private nextBolt = 0;
  private bolt = -1;
  private sunV = { x: 0, y: 0, z: 0 };
  private tmpC = new THREE.Color();
  private c1 = new THREE.Color();
  private c2 = new THREE.Color();
  private c3 = new THREE.Color();
  private cs = new THREE.Color();
  private chs = new THREE.Color();
  private chg = new THREE.Color();
  private tc = new THREE.Color();
  private moon = new THREE.Vector3();
  private sunVec = new THREE.Vector3();

  constructor(o: SkyOptions) {
    this.o = o;
    this.state = skyAt(Date.now(), getSkyPicks());
    this.dot = softDot();

    this.domeU = {
      uTop: { value: new THREE.Color() },
      uMid: { value: new THREE.Color() },
      uHor: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunCol: { value: new THREE.Color() },
      uSunVis: { value: 1 },
      uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
      uMoonVis: { value: 0 },
      uClouds: { value: cloudTex() },
      uCloudCol: { value: new THREE.Color("#FFFFFF") },
      uCloudA: { value: 0.75 },
      uOvercast: { value: 0 },
      uOverCol: { value: new THREE.Color() },
      uFlash: { value: 0 },
      uTime: { value: 0 },
    };
    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(o.radius, 48, 24),
      new THREE.ShaderMaterial({ uniforms: this.domeU, vertexShader: DOME_VS, fragmentShader: DOME_FS, side: THREE.BackSide, depthWrite: false }),
    );
    this.dome.renderOrder = -1;
    this.dome.frustumCulled = false;
    o.scene.add(this.dome);

    // Stars live on the dome, so they follow the camera with it.
    const n = o.lowPower ? 900 : 1800;
    const sp = new Float32Array(n * 3);
    const ss = new Float32Array(n);
    const sph = new Float32Array(n);
    let seed = 11;
    const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < n; i++) {
      const u = r() * 2 - 1;
      const y = Math.abs(u) * 0.98 + 0.02;
      const a = r() * Math.PI * 2;
      const rr = Math.sqrt(1 - y * y);
      sp.set([Math.cos(a) * rr * o.radius * 0.97, y * o.radius * 0.97, Math.sin(a) * rr * o.radius * 0.97], i * 3);
      ss[i] = 1 + r() * r() * 2.6;
      sph[i] = r() * 50;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    sg.setAttribute("aSize", new THREE.BufferAttribute(ss, 1));
    sg.setAttribute("aPhase", new THREE.BufferAttribute(sph, 1));
    this.starU = { uStars: { value: 0 }, uTime: { value: 0 }, uPr: { value: 1 } };
    this.stars = new THREE.Points(
      sg,
      new THREE.ShaderMaterial({ uniforms: this.starU, vertexShader: STAR_VS, fragmentShader: STAR_FS, transparent: true, depthWrite: false }),
    );
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -1;
    this.dome.add(this.stars);

    // Rain and snow.
    const drops = o.lowPower ? 3200 : 8000;
    const rs = new Float32Array(drops * 6);
    const re = new Float32Array(drops * 2);
    for (let i = 0; i < drops; i++) {
      const a = r();
      const b = r();
      const c = r();
      rs.set([a, b, c, a, b, c], i * 6);
      re[i * 2 + 1] = 1;
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(drops * 6), 3));
    rg.setAttribute("aSeed", new THREE.BufferAttribute(rs, 3));
    rg.setAttribute("aEnd", new THREE.BufferAttribute(re, 1));
    this.rainU = {
      uC: { value: new THREE.Vector3() },
      uS: { value: 100 },
      uH: { value: 50 },
      uT: { value: 0 },
      uLen: { value: 1 },
      uA: { value: 0 },
      uCol: { value: new THREE.Color(0.72, 0.78, 0.86) },
    };
    this.rain = new THREE.LineSegments(
      rg,
      new THREE.ShaderMaterial({ uniforms: this.rainU, vertexShader: RAIN_VS, fragmentShader: RAIN_FS, transparent: true, depthWrite: false }),
    );
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    o.scene.add(this.rain);

    const flakes = o.lowPower ? 2600 : 6500;
    const fs = new Float32Array(flakes * 3);
    for (let i = 0; i < flakes * 3; i++) fs[i] = r();
    const fg = new THREE.BufferGeometry();
    fg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(flakes * 3), 3));
    fg.setAttribute("aSeed", new THREE.BufferAttribute(fs, 3));
    this.snowU = {
      uC: { value: new THREE.Vector3() },
      uS: { value: 100 },
      uH: { value: 50 },
      uT: { value: 0 },
      uPx: { value: 500 },
      uSize: { value: 0.1 },
      uA: { value: 0 },
    };
    this.snow = new THREE.Points(
      fg,
      new THREE.ShaderMaterial({ uniforms: this.snowU, vertexShader: SNOW_VS, fragmentShader: SNOW_FS, transparent: true, depthWrite: false }),
    );
    this.snow.frustumCulled = false;
    this.snow.visible = false;
    o.scene.add(this.snow);

    this.poolMat = new THREE.MeshBasicMaterial({
      map: this.dot,
      color: "#FFB45A",
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
  }

  // Street lamps and lanterns of the town drawn in detail: heads at (x, y, z); pools of light below.
  setLamps(heads: ArrayLike<number>) {
    this.lamps?.geometry.dispose();
    this.lamps?.removeFromParent();
    this.pools?.dispose();
    this.pools?.removeFromParent();
    this.lamps = null;
    this.pools = null;
    const n = heads.length / 3;
    if (!n) return;
    this.lamps = pointsOf(heads, this.lampMat);
    this.o.scene.add(this.lamps);
    const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), this.poolMat, n);
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const y = heads[i * 3 + 1];
      // Lamp heads sit 4.75 m up on street lamps (pool on the pavement), lower on lanterns.
      const ground = y > 4.5 ? y - 4.75 + 0.06 : 0.12;
      const s = y > 4.5 ? 11 : 7;
      m.makeScale(s, 1, s).setPosition(heads[i * 3], ground, heads[i * 3 + 2]);
      pools.setMatrixAt(i, m);
    }
    pools.frustumCulled = false;
    pools.renderOrder = 2;
    this.pools = pools;
    this.o.scene.add(pools);
  }

  // A light in every house of the towns drawn in simple form.
  setFarLights(pos: ArrayLike<number>) {
    this.farLights?.geometry.dispose();
    this.farLights?.removeFromParent();
    this.farLights = pos.length ? pointsOf(pos, this.farMat) : null;
    if (this.farLights) this.o.scene.add(this.farLights);
  }

  // Fireflies in the jungle next to the town drawn in detail.
  setFireflies(pos: ArrayLike<number>) {
    this.flies?.geometry.dispose();
    this.flies?.removeFromParent();
    this.flies = pos.length ? pointsOf(pos, this.flyMat) : null;
    if (this.flies) this.o.scene.add(this.flies);
  }

  // The sky right now (refreshed once a second; the picks apply at once).
  refresh(force = false) {
    const now = performance.now();
    if (!force && now - this.stateAt < 1000) return this.state;
    this.stateAt = now;
    this.state = skyAt(Date.now(), getSkyPicks());
    return this.state;
  }

  // Ease towards the sky of this moment and set the lights, fog and weather. d: camera distance to
  // its target. Returns true while something is changing (so phones keep drawing).
  update(dt: number, timeSec: number, camera: THREE.PerspectiveCamera, target: THREE.Vector3, d: number, heightPx: number, pixelRatio: number) {
    const s = this.refresh();
    let moving = false;

    // The hour moves the short way round the clock: fast when you pick a new time, at once otherwise.
    if (this.hour < 0 || this.o.reduced) this.hour = s.hour;
    else {
      let diff = s.hour - this.hour;
      while (diff > 12) diff -= 24;
      while (diff < -12) diff += 24;
      if (Math.abs(diff) > 0.02) {
        const step = Math.sign(diff) * Math.min(Math.abs(diff), (Math.max(Math.abs(diff), 1.5) / 1.7) * dt);
        this.hour = (this.hour + step + 24) % 24;
        moving = true;
      } else this.hour = s.hour;
    }
    const k = this.o.reduced ? 1 : 1 - Math.exp(-dt * 1.6);
    const ease = (cur: number, to: number) => {
      const v = Math.abs(to - cur) < 0.002 ? to : cur + (to - cur) * k;
      if (v !== to) moving = true;
      return v;
    };
    this.rainAmt = ease(this.rainAmt, s.rain);
    this.snowAmt = ease(this.snowAmt, s.snow);
    this.frostAmt = ease(this.frostAmt, s.frost);
    const rain = this.rainAmt;
    const snow = this.snowAmt;
    const frost = this.frostAmt;

    // The clear sky for the sun's height.
    sunDir(this.hour, s.doy, this.sunV);
    const sun = this.sunVec.set(this.sunV.x, this.sunV.y, this.sunV.z).normalize();
    const e = sun.y;
    let i = 0;
    while (i < KEYC.length - 2 && e > KEYC[i + 1].e) i++;
    const A = KEYC[i];
    const B = KEYC[i + 1];
    const t = smooth(0, 1, (e - A.e) / (B.e - A.e));
    const top = this.c1.copy(A.cTop).lerp(B.cTop, t);
    const mid = this.c2.copy(A.cMid).lerp(B.cMid, t);
    const hor = this.c3.copy(A.cHor).lerp(B.cHor, t);
    const sunCol = this.cs.copy(A.cSun).lerp(B.cSun, t);
    let sunI = e < A.e ? A.sunI : lerp(A.sunI, B.sunI, t);
    const hs = this.chs.copy(A.cHs).lerp(B.cHs, t);
    const hg = this.chg.copy(A.cHg).lerp(B.cHg, t);
    let hi = e < A.e ? A.hi : lerp(A.hi, B.hi, t);
    const day = smooth(-0.1, 0.2, e);
    let moonI = 0.6 * smooth(-0.03, -0.14, e);
    let stars = smooth(-0.05, -0.2, e);
    let sunVis = smooth(-0.04, 0.02, e);
    let moonVis = smooth(-0.02, -0.12, e);
    let cloudA = 0.75;
    const cloudCol = this.tmpC.copy(CLOUD_NIGHT).lerp(WHITE, day);
    const night = smooth(0.08, -0.06, e);

    // Rain: grey and darker, a low sky, the sun hidden.
    if (rain > 0.001) {
      const g = RAIN_NIGHT;
      const gd = RAIN_DAY;
      top.lerp(this.tc.copy(g.top).lerp(gd.top, day), rain * 0.85);
      mid.lerp(this.tc.copy(g.mid).lerp(gd.mid, day), rain * 0.85);
      hor.lerp(this.tc.copy(g.hor).lerp(gd.hor, day), rain * 0.85);
      sunI *= 1 - 0.8 * rain;
      hi *= 1 - 0.28 * rain;
      moonI *= 1 - 0.85 * rain;
      stars *= 1 - rain;
      sunVis *= 1 - rain;
      moonVis *= 1 - rain;
      cloudA = lerp(cloudA, 0.95, rain);
      cloudCol.lerp(this.tc.copy(RAIN_NIGHT.mid).lerp(CLOUD_RAIN, day), rain);
    }
    // Snow: a pale, misty sky; snow on the ground lights things from below.
    if (snow > 0.001 || frost > 0.001) {
      const mist = Math.max(snow, frost * 0.4);
      hor.lerp(this.tc.copy(SNOW_NIGHT).lerp(SNOW_HOR, day), mist * 0.6);
      mid.lerp(this.tc.copy(SNOW_NIGHT).lerp(SNOW_HOR, day), mist * 0.3);
      sunI *= 1 - 0.35 * snow;
      stars *= 1 - snow * 0.9;
      sunVis *= 1 - snow * 0.7;
      moonVis *= 1 - snow * 0.6;
      hg.lerp(this.tc.copy(SNOW_GROUND).multiplyScalar(0.25 + 0.75 * day), frost * 0.55);
      cloudA = lerp(cloudA, 0.9, snow);
    }

    // Lightning, now and then in a storm.
    if (!this.o.reduced && rain > 0.5) {
      if (!this.nextBolt) this.nextBolt = timeSec + 4 + Math.random() * 10;
      if (timeSec > this.nextBolt) {
        this.bolt = timeSec;
        this.nextBolt = timeSec + 6 + Math.random() * 16;
      }
    } else this.nextBolt = 0;
    const since = timeSec - this.bolt;
    this.flash = this.bolt > 0 && since < 0.6 ? Math.max(0, Math.exp(-since * 14) + (since > 0.18 ? 0.7 * Math.exp(-(since - 0.18) * 10) : 0)) : 0;
    if (this.flash > 0.01) moving = true;

    // Sky dome.
    const u = this.domeU;
    (u.uTop.value as THREE.Color).copy(top);
    (u.uMid.value as THREE.Color).copy(mid);
    (u.uHor.value as THREE.Color).copy(hor);
    (u.uSunDir.value as THREE.Vector3).copy(sun);
    (u.uSunCol.value as THREE.Color).copy(sunCol);
    u.uSunVis.value = sunVis;
    this.moon.set(-sun.x + 0.25, Math.max(0.32, -sun.y), -sun.z - 0.2).normalize();
    (u.uMoonDir.value as THREE.Vector3).copy(this.moon);
    u.uMoonVis.value = moonVis;
    (u.uCloudCol.value as THREE.Color).copy(cloudCol);
    u.uCloudA.value = cloudA;
    u.uOvercast.value = rain * 0.7;
    (u.uOverCol.value as THREE.Color).copy(hor);
    u.uFlash.value = this.flash * 0.35;
    u.uTime.value = timeSec;
    this.starU.uStars.value = stars;
    this.starU.uTime.value = timeSec;
    this.starU.uPr.value = pixelRatio;

    // Lights: the sun by day, the moon at night. They swap where both are dark, near the horizon.
    const L = this.o.sun;
    if (e > -0.035) {
      this.keyDir.set(sun.x, Math.max(sun.y, 0.2), sun.z).normalize();
      L.color.copy(sunCol);
      L.intensity = sunI;
    } else {
      this.keyDir.copy(this.moon);
      L.color.copy(MOON_COL);
      L.intensity = moonI;
    }
    L.intensity += this.flash * 0.6;
    const H = this.o.hemi;
    H.color.copy(hs);
    H.groundColor.copy(hg);
    H.intensity = hi + this.flash * 2.2;

    // Fog takes the colour of the horizon, so the land fades into the sky; closer in bad weather.
    const fog = this.o.fog;
    fog.color.copy(hor);
    const thick = 1 - 0.55 * rain - 0.4 * snow;
    fog.near = (d * 1.6 + 60) * thick;
    fog.far = (d * 7 + 900) * Math.max(0.35, thick);

    // What the world's materials need to know.
    this.world.uNight.value = night;
    this.world.uSnow.value = frost;
    this.world.uWet.value = rain;

    // Rain and snow round the camera's target, scaled with the view.
    const pxPerM = heightPx / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    const box = THREE.MathUtils.clamp(d * 1.5, 50, 700);
    const high = THREE.MathUtils.clamp(d * 0.9, 28, 420);
    this.rain.visible = rain > 0.02 && !this.o.reduced && d < 1500;
    if (this.rain.visible) {
      const ru = this.rainU;
      ru.uC.value.set(target.x, Math.max(0, target.y - 6), target.z);
      ru.uS.value = box;
      ru.uH.value = high;
      ru.uT.value = timeSec;
      ru.uLen.value = THREE.MathUtils.clamp(d * 0.018, 0.7, 7);
      ru.uA.value = 0.42 * rain * (day * 0.6 + 0.4);
      moving = true;
    }
    this.snow.visible = snow > 0.02 && !this.o.reduced && d < 1500;
    if (this.snow.visible) {
      const su = this.snowU;
      su.uC.value.set(target.x, Math.max(0, target.y - 4), target.z);
      su.uS.value = box;
      su.uH.value = high;
      su.uT.value = timeSec;
      su.uPx.value = pxPerM * pixelRatio;
      su.uSize.value = 0.11 + d * 0.0016;
      su.uA.value = 0.9 * snow;
      moving = true;
    }

    // Night lights.
    for (const [mat, a] of [
      [this.lampMat, night * 0.85],
      [this.farMat, night * 0.8],
      [this.flyMat, night * (1 - rain) * (1 - snow * 0.8)],
    ] as [THREE.ShaderMaterial, number][]) {
      const gu = mat.uniforms as unknown as GlowUniforms;
      gu.uA.value = a;
      gu.uPx.value = pxPerM * pixelRatio;
      gu.uT.value = timeSec;
    }
    this.poolMat.opacity = night * 0.42;
    if (this.lamps) this.lamps.visible = night > 0.01 && d < 2200;
    if (this.pools) this.pools.visible = night > 0.01 && d < 1400;
    if (this.farLights) this.farLights.visible = night > 0.01;
    if (this.flies) {
      this.flies.visible = night > 0.05 && d < 700;
      if (this.flies.visible) moving = true;
    }
    return moving;
  }

  dispose() {
    for (const o of [this.rain, this.snow, this.stars, this.lamps, this.farLights, this.flies]) {
      if (!o) continue;
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
      o.removeFromParent();
    }
    this.pools?.dispose();
    this.pools?.geometry.dispose();
    this.poolMat.dispose();
    this.dot.dispose();
    (this.domeU.uClouds.value as THREE.Texture).dispose();
    this.dome.geometry.dispose();
    (this.dome.material as THREE.Material).dispose();
    this.dome.removeFromParent();
  }
}
