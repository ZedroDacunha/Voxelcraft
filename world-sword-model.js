const GRID_W = 21;
const GRID_H = 55;
// Grade base da espada (paleta de ferro). Cores metálicas são remapeadas por material.
const IRON_GRID = [
[null,null,null,null,null,null,null,null,null,"#273038","#273038","#273038",null,null,null,null,null,null,null,null,null],
[null,null,null,null,null,null,null,null,"#273038","#273038","#273038","#273038","#273038",null,null,null,null,null,null,null,null],
[null,null,null,null,null,null,null,null,"#273038","#273038","#273038","#273038","#273038",null,null,null,null,null,null,null,null],
[null,null,null,null,null,null,null,"#273038","#273038","#273038","#d7e0dd","#273038","#273038","#273038",null,null,null,null,null,null,null],
[null,null,null,null,null,null,null,"#273038","#273038","#d7e0dd","#d7e0dd","#9ba8ad","#273038","#273038",null,null,null,null,null,null,null],
[null,null,null,null,null,null,"#273038","#273038","#273038","#d7e0dd","#d7e0dd","#9ba8ad","#273038","#273038","#273038",null,null,null,null,null,null],
[null,null,null,null,null,null,"#273038","#273038","#d7e0dd","#d7e0dd","#d7e0dd","#9ba8ad","#9ba8ad","#273038","#273038",null,null,null,null,null,null],
[null,null,null,null,null,"#273038","#273038","#273038","#d7e0dd","#d7e0dd","#d7e0dd","#9ba8ad","#9ba8ad","#273038","#273038","#273038",null,null,null,null,null],
[null,null,null,null,null,"#273038","#273038","#d7e0dd","#d7e0dd","#d7e0dd","#d7e0dd","#9ba8ad","#9ba8ad","#9ba8ad","#273038","#273038",null,null,null,null,null],
[null,null,null,null,null,"#273038","#273038","#d7e0dd","#f1f3e9","#d7e0dd","#d7e0dd","#9ba8ad","#9ba8ad","#9ba8ad","#273038","#273038",null,null,null,null,null],
[null,null,null,null,null,"#273038","#273038","#d7e0dd","#f1f3e9","#d7e0dd","#d7e0dd","#9ba8ad","#9ba8ad","#9ba8ad","#273038","#273038",null,null,null,null,null],
[null,null,null,null,null,"#273038","#273038","#d7e0dd","#f1f3e9","#d7e0dd","#d7e0dd","#9ba8ad","#9ba8ad","#9ba8ad","#273038","#273038",null,null,null,null,null],
[null,null,null,null,null,"#273038","#273038","#d7e0dd","#f1f3e9","#d7e0dd","#d7e0dd","#9ba8ad","#9ba8ad","#9ba8ad","#273038","#273038",null,null,null,null,null],
[null,null,null,null,null,"#273038","#273038","#d7e0dd","#f1f3e9","#d7e0dd","#d7e0dd","#9ba8ad","#9ba8ad","#9ba8ad","#273038","#273038",null,null,null,null,null],
[null,null,null,null,null,"#273038","#273038","#d7e0dd","#f1f3e9","#d7e0dd","#d7e0dd","#9ba8ad","#9ba8ad","#9ba8ad","#273038","#273038",null,null,null,null,null],
[null,null,null,null,null,"#273038","#273038","#d7e0dd","#f1f3e9","#d7e0dd","#d7e0dd","#9ba8ad","#9ba8ad","#9ba8ad","#273038","#273038",null,null,null,null,null],
[null,null,null,null,null,"#273038","#273038","#d7e0dd","#f1f3e9","#d7e0dd","#d7e0dd","#9ba8ad","#9ba8ad","#9ba8ad","#273038","#273038",null,null,null,null,null],
[null,null,null,null,null,"#273038","#273038","#d7e0dd","#f1f3e9","#d7e0dd","#d7e0dd","#9ba8ad","#9ba8ad","#9ba8ad","#273038","#273038",null,null,null,null,null],
[null,null,null,null,null,"#273038","#273038","#d7e0dd","#f1f3e9","#d7e0dd","#d7e0dd","#9ba8ad","#9ba8ad","#9ba8ad","#273038","#273038",null,null,null,null,null],
[null,null,null,null,null,"#273038","#273038","#d7e0dd","#f1f3e9","#d7e0dd","#d7e0dd","#9ba8ad","#9ba8ad","#9ba8ad","#273038","#273038",null,null,null,null,null],
[null,null,null,null,null,"#273038","#273038","#d7e0dd","#f1f3e9","#d7e0dd","#d7e0dd","#9ba8ad","#9ba8ad","#9ba8ad","#273038","#273038",null,null,null,null,null],
[null,null,null,null,null,"#273038","#273038","#d7e0dd","#f1f3e9","#d7e0dd","#d7e0dd","#9ba8ad","#9ba8ad","#9ba8ad","#273038","#273038",null,null,null,null,null],
[null,null,null,null,null,"#273038","#273038","#d7e0dd","#f1f3e9","#d7e0dd","#d7e0dd","#9ba8ad","#9ba8ad","#9ba8ad","#273038","#273038",null,null,null,null,null],
[null,null,null,null,null,"#273038","#273038","#d7e0dd","#f1f3e9","#d7e0dd","#d7e0dd","#9ba8ad","#9ba8ad","#9ba8ad","#273038","#273038",null,null,null,null,null],
[null,null,null,null,null,"#273038","#273038","#d7e0dd","#f1f3e9","#d7e0dd","#d7e0dd","#9ba8ad","#9ba8ad","#9ba8ad","#273038","#273038",null,null,null,null,null],
[null,null,null,null,null,"#273038","#273038","#d7e0dd","#f1f3e9","#d7e0dd","#d7e0dd","#9ba8ad","#9ba8ad","#9ba8ad","#273038","#273038",null,null,null,null,null],
[null,null,null,null,null,"#273038","#273038","#d7e0dd","#f1f3e9","#d7e0dd","#d7e0dd","#9ba8ad","#9ba8ad","#9ba8ad","#273038","#273038",null,null,null,null,null],
[null,null,null,null,null,"#273038","#273038","#d7e0dd","#f1f3e9","#d7e0dd","#d7e0dd","#9ba8ad","#9ba8ad","#9ba8ad","#273038","#273038",null,null,null,null,null],
[null,null,null,null,null,"#273038","#273038","#d7e0dd","#f1f3e9","#d7e0dd","#d7e0dd","#9ba8ad","#9ba8ad","#9ba8ad","#273038","#273038",null,null,null,null,null],
[null,null,null,null,null,"#273038","#273038","#d7e0dd","#f1f3e9","#d7e0dd","#d7e0dd","#9ba8ad","#9ba8ad","#9ba8ad","#273038","#273038",null,null,null,null,null],
[null,null,null,null,null,"#273038","#273038","#d7e0dd","#f1f3e9","#d7e0dd","#d7e0dd","#9ba8ad","#9ba8ad","#9ba8ad","#273038","#273038",null,null,null,null,null],
[null,null,null,null,null,"#273038","#273038","#d7e0dd","#d7e0dd","#d7e0dd","#d7e0dd","#9ba8ad","#9ba8ad","#9ba8ad","#273038","#273038",null,null,null,null,null],
[null,null,null,null,null,"#273038","#273038","#d7e0dd","#d7e0dd","#d7e0dd","#d7e0dd","#9ba8ad","#9ba8ad","#9ba8ad","#273038","#273038",null,null,null,null,null],
[null,null,null,null,null,"#273038","#273038","#d7e0dd","#d7e0dd","#d7e0dd","#d7e0dd","#9ba8ad","#9ba8ad","#9ba8ad","#273038","#273038",null,null,null,null,null],
["#273038","#78868c","#78868c","#d7e0dd","#d7e0dd","#d7e0dd","#d7e0dd","#d7e0dd","#d7e0dd","#d7e0dd","#d7e0dd","#d7e0dd","#d7e0dd","#d7e0dd","#d7e0dd","#d7e0dd","#d7e0dd","#d7e0dd","#78868c","#78868c","#273038"],
["#273038","#78868c","#78868c","#78868c","#78868c","#78868c","#78868c","#78868c","#78868c","#78868c","#78868c","#78868c","#78868c","#78868c","#78868c","#78868c","#78868c","#78868c","#78868c","#78868c","#273038"],
["#273038","#78868c","#78868c","#78868c","#78868c","#78868c","#78868c","#78868c","#78868c","#78868c","#78868c","#78868c","#78868c","#78868c","#78868c","#78868c","#78868c","#78868c","#78868c","#78868c","#273038"],
["#273038","#273038","#273038","#273038","#273038","#273038","#273038","#273038","#273038","#273038","#273038","#273038","#273038","#273038","#273038","#273038","#273038","#273038","#273038","#273038","#273038"],
["#273038","#273038","#273038","#273038","#273038","#273038","#273038","#273038","#273038","#273038","#273038","#273038","#273038","#273038","#273038","#273038","#273038","#273038","#273038","#273038","#273038"],
[null,null,null,null,null,null,null,"#273038","#79583d","#a87b50","#a87b50","#79583d","#48372b","#273038",null,null,null,null,null,null,null],
[null,null,null,null,null,null,null,"#273038","#79583d","#a87b50","#a87b50","#79583d","#48372b","#273038",null,null,null,null,null,null,null],
[null,null,null,null,null,null,null,"#273038","#79583d","#a87b50","#a87b50","#79583d","#48372b","#273038",null,null,null,null,null,null,null],
[null,null,null,null,null,null,null,"#273038","#79583d","#a87b50","#a87b50","#79583d","#48372b","#273038",null,null,null,null,null,null,null],
[null,null,null,null,null,null,null,"#273038","#79583d","#a87b50","#a87b50","#79583d","#48372b","#273038",null,null,null,null,null,null,null],
[null,null,null,null,null,null,null,"#273038","#79583d","#a87b50","#a87b50","#79583d","#48372b","#273038",null,null,null,null,null,null,null],
[null,null,null,null,null,null,null,"#273038","#79583d","#a87b50","#a87b50","#79583d","#48372b","#273038",null,null,null,null,null,null,null],
[null,null,null,null,null,null,null,"#273038","#79583d","#a87b50","#a87b50","#79583d","#48372b","#273038",null,null,null,null,null,null,null],
[null,null,null,null,null,null,null,"#273038","#79583d","#a87b50","#a87b50","#79583d","#48372b","#273038",null,null,null,null,null,null,null],
[null,null,null,null,null,null,null,"#273038","#79583d","#a87b50","#a87b50","#79583d","#48372b","#273038",null,null,null,null,null,null,null],
[null,null,null,null,null,null,null,"#273038","#79583d","#a87b50","#a87b50","#79583d","#48372b","#273038",null,null,null,null,null,null,null],
[null,null,null,null,null,null,null,"#273038","#79583d","#79583d","#79583d","#79583d","#79583d","#273038",null,null,null,null,null,null,null],
[null,null,null,null,null,null,"#273038","#48372b","#48372b","#48372b","#48372b","#48372b","#48372b","#48372b","#273038",null,null,null,null,null,null],
[null,null,null,null,null,null,"#273038","#48372b","#48372b","#48372b","#48372b","#48372b","#48372b","#48372b","#273038",null,null,null,null,null,null],
[null,null,null,null,null,null,"#273038","#273038","#79583d","#79583d","#79583d","#79583d","#79583d","#273038","#273038",null,null,null,null,null,null],
[null,null,null,null,null,null,"#273038","#273038","#273038","#273038","#273038","#273038","#273038","#273038","#273038",null,null,null,null,null,null],
];

const OUTLINE = '#273038';
const WOOD = '#79583d', WOODDARK = '#48372b', WOODLIGHT = '#a87b50';

export const SWORD_MATERIALS = {
  iron:    { dark:'#56616a', mid:'#9ba8ad', light:'#d7e0dd', bright:'#f1f3e9', steel:'#78868c' },
  copper:  { dark:'#7a3e26', mid:'#be7042', light:'#d09260', bright:'#e8b282', steel:'#a85a38' },
  gold:    { dark:'#986210', mid:'#e8a61c', light:'#f2c648', bright:'#ffee80', steel:'#b88418' },
  diamond: { dark:'#106260', mid:'#22bcae', light:'#30d4c4', bright:'#5cf0dc', steel:'#1a9c92' },
  wood:    { dark:'#6b4a2d', mid:'#96704a', light:'#b48c60', bright:'#d4b07c', steel:'#7e5838' },
  stone:   { dark:'#52514e', mid:'#7e7c77', light:'#a3a098', bright:'#c4c0b8', steel:'#686662' },
};

function remapGrid(matKey) {
  const m = SWORD_MATERIALS[matKey] || SWORD_MATERIALS.iron;
  const map = { '#78868c': m.steel, '#9ba8ad': m.mid, '#d7e0dd': m.light, '#f1f3e9': m.bright, '#56616a': m.dark };
  return IRON_GRID.map(row => row.map(cell => cell ? (map[cell] || cell) : null));
}

function makeProceduralTexture(THREE, hex, kind, cache) {
  const key = hex + ':' + kind;
  if (cache.has(key)) return cache.get(key);
  const size = 32;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const base = new THREE.Color(hex);
  const r = Math.round(base.r * 255), gv = Math.round(base.g * 255), b = Math.round(base.b * 255);
  ctx.fillStyle = `rgb(${r},${gv},${b})`;
  ctx.fillRect(0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  let seed = parseInt(hex.slice(1), 16) || 1;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    let n = (rnd() - 0.5);
    if (kind === 'wood') { const grain = Math.sin((y + rnd() * 2) * 0.9) * 0.08 + Math.sin((y * 0.35 + x * 0.08)) * 0.04; n = grain + n * 0.06; }
    else if (kind === 'metal') { n = Math.sin(y * 1.2) * 0.018 + (rnd() - 0.5) * 0.05; }
    else { n = n * 0.04; }
    const f = 1 + n;
    d[i] = Math.max(0, Math.min(255, Math.round(d[i] * f)));
    d[i + 1] = Math.max(0, Math.min(255, Math.round(d[i + 1] * f)));
    d[i + 2] = Math.max(0, Math.min(255, Math.round(d[i + 2] * f)));
  }
  ctx.putImageData(img, 0, 0);
  if (kind === 'wood') {
    ctx.globalAlpha = 0.08; for (let y = 2; y < size; y += 4 + Math.floor(rnd() * 3)) { ctx.fillStyle = '#000'; ctx.fillRect(0, y, size, 1); }
    ctx.globalAlpha = 0.05; for (let y = 1; y < size; y += 7 + Math.floor(rnd() * 4)) { ctx.fillStyle = '#fff'; ctx.fillRect(0, y, size, 1); }
    ctx.globalAlpha = 1;
  }
  if (kind === 'metal') {
    ctx.globalAlpha = 0.05; for (let y = 0; y < size; y += 3) { ctx.fillStyle = (y % 6 === 0) ? '#ffffff' : '#000000'; ctx.fillRect(0, y, size, 1); }
    ctx.globalAlpha = 1;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
  if ('colorSpace' in tex && THREE.SRGBColorSpace !== undefined) tex.colorSpace = THREE.SRGBColorSpace;
  else if ('encoding' in tex && THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  cache.set(key, tex);
  return tex;
}

export function createSwordModel(THREE, matKey = 'iron') {
  const pal = SWORD_MATERIALS[matKey] || SWORD_MATERIALS.iron;
  const PALETTE = { ...pal, outline: OUTLINE, wood: WOOD, wooddark: WOODDARK, woodlight: WOODLIGHT };
  const GRID = remapGrid(matKey);
  const g = new THREE.Group();
  const textureCache = new Map();

  function materialKind(hex) {
    if (hex === PALETTE.wood || hex === PALETTE.wooddark || hex === PALETTE.woodlight) return 'wood';
    if (hex === PALETTE.outline) return 'outline';
    return 'metal';
  }
  function makeMaterial(hex) {
    const kind = materialKind(hex);
    const tex = makeProceduralTexture(THREE, hex, kind, textureCache);
    if (kind === 'wood') return new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, roughness: 0.82, metalness: 0.03, flatShading: true });
    if (kind === 'outline') return new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, roughness: 0.95, metalness: 0.02, flatShading: true });
    const isBright = (hex === PALETTE.bright || hex === PALETTE.light);
    const isDarkMetal = (hex === PALETTE.dark || hex === PALETTE.steel);
    return new THREE.MeshStandardMaterial({
      map: tex, color: 0xffffff,
      roughness: isBright ? 0.18 : (isDarkMetal ? 0.38 : 0.28),
      metalness: isBright ? 0.85 : (isDarkMetal ? 0.55 : 0.72),
      flatShading: true,
      emissive: isBright ? new THREE.Color(hex) : new THREE.Color(0x000000),
      emissiveIntensity: isBright ? 0.08 : 0,
    });
  }

  const rowInfo = [];
  for (let y = 0; y < GRID_H; y++) {
    let minX = 99, maxX = -1;
    for (let x = 0; x < GRID_W; x++) { if (GRID[y][x]) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); } }
    rowInfo[y] = { minX, maxX, mid: (minX + maxX) / 2, hw: (maxX - minX + 1) / 2 };
  }
  function depthFor(x, y, hex) {
    const info = rowInfo[y]; const mid = info ? info.mid : (GRID_W - 1) / 2; const hw = info ? info.hw : 1;
    const dist = Math.abs(x - mid) / Math.max(1, hw);
    const edgeFall = Math.pow(1 - Math.min(1, dist), 1.6);
    if (y >= 34 && y <= 38) { const guardTaper = 0.65 + 0.35 * Math.pow(1 - Math.min(1, Math.abs(x - mid) / 10), 1.2); const guardFace = 2.2 + 0.9 * guardTaper; return hex === PALETTE.outline ? guardFace - 0.25 : guardFace; }
    if (y >= 39 && y <= 50) { const grip = 1.2 + 1.2 * edgeFall; return hex === PALETTE.outline ? Math.max(0.9, grip - 0.2) : grip; }
    if (y >= 51) { const pommel = 1.4 + 1.4 * edgeFall; return hex === PALETTE.outline ? Math.max(1.0, pommel - 0.2) : pommel; }
    const tipTaper = Math.min(1, (y + 1) / 8);
    const ridge = (0.75 + 2.1 * edgeFall) * (0.55 + 0.45 * tipTaper);
    if (hex === PALETTE.outline) return Math.max(0.55, ridge - 0.25);
    if (hex === PALETTE.bright) return ridge + 0.12;
    return ridge;
  }

  const edgeMat = new THREE.LineBasicMaterial({ color: 0x1a2228, transparent: true, opacity: 0.22 });
  for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) {
    const hex = GRID[y][x]; if (!hex) continue;
    const d = depthFor(x, y, hex);
    const geo = new THREE.BoxGeometry(1, 1, d);
    const m = new THREE.Mesh(geo, makeMaterial(hex));
    const jitter = ((x * 37 + y * 17 + parseInt(hex.slice(1, 3), 16)) % 100) / 100;
    m.material = m.material.clone();
    m.material.color.setRGB(1 + (jitter - 0.5) * 0.05, 1 + (jitter - 0.5) * 0.05, 1 + (jitter - 0.5) * 0.05);
    const px = (x - (GRID_W - 1) / 2) * 1;
    const py = ((GRID_H - 1) / 2 - y) * 1;
    m.position.set(px, py, 0);
    g.add(m);
    const line = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat);
    line.position.copy(m.position);
    g.add(line);
  }

  // Altura equivalente a 18 pixels de ferramenta, com a origem no cabo.
  const s = (18 * 0.034) / GRID_H;
  g.scale.setScalar(s);
  const handleRow = 44, handleCol = 10;
  const handleLocalX = (handleCol - (GRID_W - 1) / 2) * s;
  const handleLocalY = (((GRID_H - 1) / 2) - handleRow) * s;
  g.position.set(-handleLocalX, -handleLocalY, 0);

  // Wrapper: permite que o chamador posicione no grip sem perder o offset do cabo.
  const root = new THREE.Group();
  root.add(g);
  root.userData.isSwordModel = true;
  return root;
}
