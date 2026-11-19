import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Sound } from './sounds.js';

// configuracion
const CONFIG = {
  VELOCIDAD: 5,
  VELOCIDAD_POCHITA: 2.8,
  VELOCIDAD_VULNERABLE: 1.7,
  VIDAS: 3,
  TAMANO_CELDA: 2.2,
  ALTURA_JUGADOR: 0.40,
  DURACION_POWERUP: 8,
  PUNTOS_FRUTA: 250,
  PUNTOS_GEMA: 100,
  PUNTOS_POCHITA: 400,
  RADIO_COLISION: 0.68,
  TIEMPO_INVULNERABILIDAD: 1.5
};

// 'X' = Muro solido 
//  '.' = Gema 
//  'P' = Inicio Reisen  
// 'F' = Pochita  
// 'U' = Fruta power-up

const TILEMAP = [
  "XXXXXXXXXXXXXXXXXXX",
  "X........X.....U..X",
  "X.XX.XXX.X.XXX.XX.X",
  "X.................X",
  "X.XX.X.XXXXX.X.XX.X",
  "X....X.......X....X",
  "XXXX.XXXX.XXXX.XXXX",
  "XXXX.X.......X.XXXX",
  "XXXX.X.XX.XX.X.XXXX",
  "XF......FUF......FX",
  "XXXX.X.XXXXX.X.XXXX",
  "XXXXX.........XXXXX",
  "XXXX..X.XXX.X..XXXX",
  "X........X........X",
  "X.XX.XXX.X.XXX.XX.X",
  "X..X.....P.....X..X",
  "XX.X.X.XXXXX.X.X.XX",
  "X.U..X...X...X....X",
  "X.XXXXXX.X.XXXXXX.X",
  "X.................X",
  "XXXXXXXXXXXXXXXXXXX"
];

let puntos = 0;
let vidas = CONFIG.VIDAS;
let estado = 'inicio'; 
let tiempoPowerUp = 0;
let tiempoInvulnerable = 0;
let ultimoTiempo = performance.now();

const divJuego = document.getElementById('game');
const hud = document.getElementById('hud');
const txtPuntos = document.getElementById('puntos');
const txtVidas = document.getElementById('vidas');
const txtFrutas = document.getElementById('frutas-restantes');
const txtPowerUp = document.getElementById('estado-powerup');
const txtMensaje = document.getElementById('mensaje');
const txtTituloFinal = document.getElementById('titulo-final');

const panelInicio = document.getElementById('pantalla-inicio');
const panelPausa = document.getElementById('pantalla-pausa');
const panelFinal = document.getElementById('pantalla-final');

const murosSet = new Set();
let gemas = [];
let frutasPowerUp = [];
let fantasmas = [];
let particulas = [];

let jugador = null;
let spawnJugador = new THREE.Vector3(0, CONFIG.ALTURA_JUGADOR, 0);
let plantillaReisen = null;
let plantillaPochita = null;
let plantillaGema = null;
let plantillaFruta = null;

//  escena, la camara y luce
const escena = new THREE.Scene();
escena.background = new THREE.Color(0x0b0f1d);
escena.fog = new THREE.FogExp2(0x0b0f1d, 0.018);

const camara = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 150);

const renderizador = new THREE.WebGLRenderer({ antialias: true });
renderizador.setSize(window.innerWidth, window.innerHeight);
renderizador.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderizador.shadowMap.enabled = true;
renderizador.shadowMap.type = THREE.PCFSoftShadowMap;
if (divJuego) divJuego.appendChild(renderizador.domElement);

const luzAmbiente = new THREE.HemisphereLight(0xaec6ff, 0x1e2438, 0.9);
escena.add(luzAmbiente);

const luzSol = new THREE.DirectionalLight(0xffffff, 2.2);
luzSol.position.set(16, 28, 18);
luzSol.castShadow = true;
luzSol.shadow.mapSize.set(2048, 2048);
luzSol.shadow.camera.left = -24;
luzSol.shadow.camera.right = 24;
luzSol.shadow.camera.top = 24;
luzSol.shadow.camera.bottom = -24;
luzSol.shadow.camera.near = 1;
luzSol.shadow.camera.far = 75;
escena.add(luzSol);
escena.add(luzSol.target);

//  texturas y 3D
const RUTA_TEXTURAS = './img/textura/';
const manager = new THREE.LoadingManager();

manager.onProgress = (_url, cargadas, total) => {
  const boton = document.getElementById('btn-jugar');
  if (boton && estado === 'inicio') {
    boton.textContent = `CARGANDO ${cargadas}/${total}`;
  }
};

manager.onLoad = () => {
  const boton = document.getElementById('btn-jugar');
  if (boton) {
    boton.textContent = 'JUGAR';
    boton.disabled = false;
  }
};

manager.onError = (url) => {
  console.warn('No se pudo cargar el recurso:', url);
};

const textureLoader = new THREE.TextureLoader(manager);

const texMuro = textureLoader.load(RUTA_TEXTURAS + 'muro.jpg');
texMuro.colorSpace = THREE.SRGBColorSpace;
texMuro.anisotropy = renderizador.capabilities.getMaxAnisotropy();

const texSuelo = textureLoader.load(RUTA_TEXTURAS + 'suelo.jpg');
texSuelo.colorSpace = THREE.SRGBColorSpace;
texSuelo.wrapS = THREE.RepeatWrapping;
texSuelo.wrapT = THREE.RepeatWrapping;
texSuelo.repeat.set(TILEMAP[0].length, TILEMAP.length);
texSuelo.anisotropy = renderizador.capabilities.getMaxAnisotropy();

function crearRespaldoReisen() {
  const g = new THREE.Group();
  const cuerpo = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.35, 0.55, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0xffd60a })
  );
  cuerpo.castShadow = true;
  g.add(cuerpo);
  return g;
}

function crearRespaldoPochita() {
  const g = new THREE.Group();
  const caja = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.75, 0.9),
    new THREE.MeshStandardMaterial({ color: 0xff6b35 })
  );
  caja.castShadow = true;
  g.add(caja);
  return g;
}

function crearRespaldoGema() {
  const m = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.01, 0),
    new THREE.MeshStandardMaterial({ color: 0x4cc9f0 })
  );
  m.castShadow = true;
  return m;
}

function crearRespaldoFruta() {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xff4d6d })
  );
  m.castShadow = true;
  return m;
}

const gltfLoader = new GLTFLoader(manager);

function cargarGLB(ruta, respaldoFn, guardar) {
  gltfLoader.load(
    ruta,
    (gltf) => {
      gltf.scene.traverse((obj) => {
        obj.visible = true;
        if (obj.isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });
      guardar(gltf.scene);
    },
    undefined,
    () => guardar(respaldoFn())
  );
}

function normalizarEscalaModelo(modelo, tamanoDeseado) {
  modelo.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(modelo);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 0) {
    const factor = tamanoDeseado / maxDim;
    modelo.scale.multiplyScalar(factor);
    modelo.updateMatrixWorld(true);
    return modelo.scale.x;
  }
  return 1;
}

function cargarModelosExternos(listo) {
  let hechos = 0;
  const fin = () => {
    hechos++;
    if (hechos === 4 && typeof listo === 'function') listo();
  };

  cargarGLB('./modelos/reisen.glb', crearRespaldoReisen, (m) => { plantillaReisen = m; fin(); });
  cargarGLB('./modelos/pochita.glb', crearRespaldoPochita, (m) => { plantillaPochita = m; fin(); });
  cargarGLB('./modelos/gema.glb', crearRespaldoGema, (m) => { plantillaGema = m; fin(); });
  cargarGLB('./modelos/fruta.glb', crearRespaldoFruta, (m) => { plantillaFruta = m; fin(); });
}

// CONSTRUCCION DEL NIVEL 
function celdaAPosicion(col, fila) {
  const offsetX = -(TILEMAP[0].length * CONFIG.TAMANO_CELDA) / 2 + CONFIG.TAMANO_CELDA / 2;
  const offsetZ = -(TILEMAP.length * CONFIG.TAMANO_CELDA) / 2 + CONFIG.TAMANO_CELDA / 2;
  return new THREE.Vector3(
    col * CONFIG.TAMANO_CELDA + offsetX,
    0,
    fila * CONFIG.TAMANO_CELDA + offsetZ
  );
}

function posicionACelda(x, z) {
  const offsetX = -(TILEMAP[0].length * CONFIG.TAMANO_CELDA) / 2 + CONFIG.TAMANO_CELDA / 2;
  const offsetZ = -(TILEMAP.length * CONFIG.TAMANO_CELDA) / 2 + CONFIG.TAMANO_CELDA / 2;
  return {
    col: Math.round((x - offsetX) / CONFIG.TAMANO_CELDA),
    fila: Math.round((z - offsetZ) / CONFIG.TAMANO_CELDA)
  };
}

function limpiarEscenaNivel() {
  for (const g of gemas) escena.remove(g.mesh);
  for (const f of frutasPowerUp) escena.remove(f.mesh);
  for (const p of fantasmas) escena.remove(p.mesh);
  for (const pt of particulas) escena.remove(pt.mesh);

  gemas = [];
  frutasPowerUp = [];
  fantasmas = [];
  particulas = [];
  murosSet.clear();

  if (jugador) {
    escena.remove(jugador.mesh);
    jugador = null;
  }

  const viejos = [];
  escena.traverse((obj) => {
    if (obj.userData && obj.userData.esNivel) viejos.push(obj);
  });
  for (const obj of viejos) escena.remove(obj);
}

function construirNivel() {
  limpiarEscenaNivel();

  const anchoTotal = TILEMAP[0].length * CONFIG.TAMANO_CELDA;
  const altoTotal = TILEMAP.length * CONFIG.TAMANO_CELDA;

  const suelo = new THREE.Mesh(
    new THREE.BoxGeometry(anchoTotal + 2, 0.5, altoTotal + 2),
    new THREE.MeshStandardMaterial({ map: texSuelo, roughness: 0.75 })
  );
  suelo.position.y = -0.25;
  suelo.receiveShadow = true;
  suelo.userData.esNivel = true;
  escena.add(suelo);

  const muroGeo = new THREE.BoxGeometry(CONFIG.TAMANO_CELDA * 0.96, 1.6, CONFIG.TAMANO_CELDA * 0.96);
  const muroMat = new THREE.MeshStandardMaterial({ map: texMuro, roughness: 0.45, metalness: 0.15 });

  let contadorGemas = 0;
  let contadorFrutas = 0;

  for (let fila = 0; fila < TILEMAP.length; fila++) {
    for (let col = 0; col < TILEMAP[fila].length; col++) {
      const simbolo = TILEMAP[fila][col];
      const pos = celdaAPosicion(col, fila);

      if (simbolo === 'X') {
        const muro = new THREE.Mesh(muroGeo, muroMat);
        muro.position.set(pos.x, 0.8, pos.z);
        muro.castShadow = true;
        muro.receiveShadow = true;
        muro.userData.esNivel = true;
        escena.add(muro);
        murosSet.add(`${col},${fila}`);
      } else if (simbolo === '.') {
        const meshGema = (plantillaGema || crearRespaldoGema()).clone();
        normalizarEscalaModelo(meshGema, CONFIG.TAMANO_CELDA * 0.22);
        meshGema.position.set(pos.x, 0.55, pos.z);
        escena.add(meshGema);
        gemas.push({ mesh: meshGema, activa: true, fase: contadorGemas++ * 0.45 });
      } else if (simbolo === 'P') {
        spawnJugador.set(pos.x, CONFIG.ALTURA_JUGADOR, pos.z);
        const meshReisen = (plantillaReisen || crearRespaldoReisen()).clone();
        meshReisen.scale.multiplyScalar(0.85);
        meshReisen.position.copy(spawnJugador);
        escena.add(meshReisen);
        jugador = {
          mesh: meshReisen,
          dir: new THREE.Vector3(),
          siguienteDir: new THREE.Vector3()
        };
      } else if (simbolo === 'F') {
        const meshPochita = (plantillaPochita || crearRespaldoPochita()).clone();
        const escalaBase = normalizarEscalaModelo(meshPochita, CONFIG.TAMANO_CELDA * 0.75);
        meshPochita.position.set(pos.x, 0.55, pos.z);
        meshPochita.visible = true;
        escena.add(meshPochita);
        fantasmas.push({
          mesh: meshPochita,
          spawn: new THREE.Vector3(pos.x, 0.55, pos.z),
          dir: new THREE.Vector3(),
          ultimaCelda: `${col},${fila}`,
          escalaBase
        });
      } else if (simbolo === 'U') {
        const meshFruta = (plantillaFruta || crearRespaldoFruta()).clone();
        meshFruta.scale.multiplyScalar(0.75);
        meshFruta.position.set(pos.x, 0.68, pos.z);
        escena.add(meshFruta);
        frutasPowerUp.push({ mesh: meshFruta, activo: true, fase: contadorFrutas++ * 0.7 });
      }
    }
  }

  actualizarHUD();
}

// MUSICA Y EFECTOS DE SONIDO
const sonidoNivel = new Sound(
  ['./sonidos/ambiente.mp3'],
  Infinity,
  escena,
  { volume: 0.4 }
);
const sonidoGameOver = new Sound(
  ['./sonidos/death.mp3'],
  Infinity,
  escena,
  { volume: 0.7 }
);
const sonidoFruta = new Sound(
  ['./sonidos/fruta.mp3'],
  Infinity,
  escena,
  { volume: 0.7 }
);
const sonidoGanar = new Sound(
  ['./sonidos/ganar.mp3'],
  Infinity,
  escena,
  { volume: 0.7 }
);

sonidoNivel.audio.loop = true;
sonidoGameOver.audio.loop = false;
sonidoFruta.audio.loop = false;
sonidoGanar.audio.loop = false;

function reproducirEfecto(sonido) {
  sonido.audio.currentTime = 0;
  sonido.play();
}

function emitirParticulas(origen, colorHex = 0xffd166, cantidad = 14) {
  const geo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
  const mat = new THREE.MeshBasicMaterial({ color: colorHex });

  for (let i = 0; i < cantidad; i++) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(origen);
    escena.add(mesh);

    const angulo = (Math.PI * 2 * i) / cantidad + Math.random() * 0.4;
    const velocidad = 2 + Math.random() * 3.5;

    particulas.push({
      mesh,
      vel: new THREE.Vector3(Math.cos(angulo) * velocidad, 2.5 + Math.random() * 3, Math.sin(angulo) * velocidad),
      vida: 0.45 + Math.random() * 0.25
    });
  }
}

function actualizarParticulas(dt) {
  for (let i = particulas.length - 1; i >= 0; i--) {
    const p = particulas[i];
    p.vida -= dt;
    if (p.vida <= 0) {
      escena.remove(p.mesh);
      particulas.splice(i, 1);
      continue;
    }
    p.vel.y -= 9.8 * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.mesh.scale.setScalar(Math.max(0.05, p.vida * 2));
  }
}

// choques
window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();

  if (key === 'p' || key === 'escape') {
    if (estado === 'jugando') cambiarEstado('pausa');
    else if (estado === 'pausa') cambiarEstado('jugando');
  }

  if (!jugador) return;
  if (key === 'arrowup' || key === 'w') jugador.siguienteDir.set(0, 0, -1);
  if (key === 'arrowdown' || key === 's') jugador.siguienteDir.set(0, 0, 1);
  if (key === 'arrowleft' || key === 'a') jugador.siguienteDir.set(-1, 0, 0);
  if (key === 'arrowright' || key === 'd') jugador.siguienteDir.set(1, 0, 0);
});

function esMuro(col, fila) {
  if (fila < 0 || fila >= TILEMAP.length || col < 0 || col >= TILEMAP[0].length) return true;
  return murosSet.has(`${col},${fila}`);
}

function colisionaConMuro(x, z, radio = 0.55) {
  const halfW = (TILEMAP[0].length * CONFIG.TAMANO_CELDA) / 2;
  const halfH = (TILEMAP.length * CONFIG.TAMANO_CELDA) / 2;

  const minCol = Math.floor((x - radio + halfW) / CONFIG.TAMANO_CELDA);
  const maxCol = Math.floor((x + radio + halfW) / CONFIG.TAMANO_CELDA);
  const minFila = Math.floor((z - radio + halfH) / CONFIG.TAMANO_CELDA);
  const maxFila = Math.floor((z + radio + halfH) / CONFIG.TAMANO_CELDA);

  for (let f = minFila; f <= maxFila; f++) {
    for (let c = minCol; c <= maxCol; c++) {
      if (!esMuro(c, f)) continue;
      const centro = celdaAPosicion(c, f);
      const mitad = CONFIG.TAMANO_CELDA * 0.48;
      const closestX = Math.max(centro.x - mitad, Math.min(x, centro.x + mitad));
      const closestZ = Math.max(centro.z - mitad, Math.min(z, centro.z + mitad));
      const dx = x - closestX;
      const dz = z - closestZ;
      if (dx * dx + dz * dz < radio * radio) return true;
    }
  }
  return false;
}

function actualizarJugador(dt) {
  if (!jugador) return;

  const pos = jugador.mesh.position;
  const celdaActual = posicionACelda(pos.x, pos.z);
  const centroCelda = celdaAPosicion(celdaActual.col, celdaActual.fila);

  if (jugador.siguienteDir.lengthSq() > 0) {
    const pruebaX = pos.x + jugador.siguienteDir.x * 0.25;
    const pruebaZ = pos.z + jugador.siguienteDir.z * 0.25;
    if (!colisionaConMuro(pruebaX, pruebaZ, 0.52)) {
      if (jugador.siguienteDir.x !== 0) {
        pos.z = THREE.MathUtils.lerp(pos.z, centroCelda.z, Math.min(1, dt * 14));
      } else if (jugador.siguienteDir.z !== 0) {
        pos.x = THREE.MathUtils.lerp(pos.x, centroCelda.x, Math.min(1, dt * 14));
      }
      jugador.dir.copy(jugador.siguienteDir);
    }
  }

  if (jugador.dir.lengthSq() > 0) {
    const nextX = pos.x + jugador.dir.x * CONFIG.VELOCIDAD * dt;
    const nextZ = pos.z + jugador.dir.z * CONFIG.VELOCIDAD * dt;

    if (!colisionaConMuro(nextX, pos.z, 0.52)) pos.x = nextX;
    else jugador.dir.x = 0;

    if (!colisionaConMuro(pos.x, nextZ, 0.52)) pos.z = nextZ;
    else jugador.dir.z = 0;

    jugador.mesh.rotation.y = Math.atan2(-jugador.dir.z, jugador.dir.x);
  }
}

function direccionesDisponibles(col, fila) {
  const candidatas = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 0, -1)
  ];
  return candidatas.filter((d) => !esMuro(col + d.x, fila + d.z));
}

function actualizarFantasmas(dt) {
  if (!jugador) return;
  const esVulnerable = tiempoPowerUp > 0;
  const velActual = esVulnerable ? CONFIG.VELOCIDAD_VULNERABLE : CONFIG.VELOCIDAD_POCHITA;

  for (const fantasma of fantasmas) {
    const fPos = fantasma.mesh.position;
    const celda = posicionACelda(fPos.x, fPos.z);
    const claveCelda = `${celda.col},${celda.fila}`;
    const centro = celdaAPosicion(celda.col, celda.fila);

    const cercaDelCentro = Math.hypot(fPos.x - centro.x, fPos.z - centro.z) < 0.28;
    const sinDireccion = fantasma.dir.lengthSq() === 0;

    if ((cercaDelCentro && claveCelda !== fantasma.ultimaCelda) || sinDireccion) {
      fantasma.ultimaCelda = claveCelda;
      let opciones = direccionesDisponibles(celda.col, celda.fila);

      if (opciones.length > 1 && fantasma.dir.lengthSq() > 0) {
        const sinReversa = opciones.filter((d) => !(d.x === -fantasma.dir.x && d.z === -fantasma.dir.z));
        if (sinReversa.length > 0) opciones = sinReversa;
      }

      if (opciones.length > 0) {
        opciones.sort((a, b) => {
          const distA = Math.hypot(
            centro.x + a.x * CONFIG.TAMANO_CELDA - jugador.mesh.position.x,
            centro.z + a.z * CONFIG.TAMANO_CELDA - jugador.mesh.position.z
          );
          const distB = Math.hypot(
            centro.x + b.x * CONFIG.TAMANO_CELDA - jugador.mesh.position.x,
            centro.z + b.z * CONFIG.TAMANO_CELDA - jugador.mesh.position.z
          );
          return esVulnerable ? distB - distA : distA - distB;
        });
        fantasma.dir.copy(opciones[0]);
      }
    }

    const nextX = fPos.x + fantasma.dir.x * velActual * dt;
    const nextZ = fPos.z + fantasma.dir.z * velActual * dt;

    if (!colisionaConMuro(nextX, nextZ, 0.46)) {
      fPos.x = nextX;
      fPos.z = nextZ;
    } else {
      fantasma.ultimaCelda = '';
      fantasma.dir.set(0, 0, 0);
    }

    const mult = esVulnerable ? 0.72 : 1.0;
    fantasma.mesh.scale.setScalar((fantasma.escalaBase || 1) * mult);

    fantasma.mesh.position.y = 0.5 + Math.sin(performance.now() * 0.008) * 0.08;
    if (fantasma.dir.lengthSq() > 0) {
      fantasma.mesh.rotation.y = Math.atan2(-fantasma.dir.z, fantasma.dir.x);
    }

    if (tiempoInvulnerable <= 0) {
      const dist = Math.hypot(jugador.mesh.position.x - fPos.x, jugador.mesh.position.z - fPos.z);
      if (dist < CONFIG.RADIO_COLISION + 0.45) {
        if (esVulnerable) {
          puntos += CONFIG.PUNTOS_POCHITA;
          reproducirEfecto(sonidoFruta);
          emitirParticulas(fPos.clone(), 0x4cc9f0, 18);
          fPos.copy(fantasma.spawn);
          fantasma.dir.set(0, 0, 0);
          fantasma.ultimaCelda = '';
          actualizarHUD();
        } else {
          perderVida();
          break;
        }
      }
    }
  }
}

function actualizarColeccionables(dt, tiempoTotal) {
  if (!jugador) return;

  let gemasRestantes = 0;
  for (const gema of gemas) {
    if (!gema.activa) continue;
    gemasRestantes++;
    gema.mesh.rotation.y += 2.2 * dt;
    gema.mesh.position.y = 0.55 + Math.sin(tiempoTotal * 4 + gema.fase) * 0.08;

    const dist = Math.hypot(jugador.mesh.position.x - gema.mesh.position.x, jugador.mesh.position.z - gema.mesh.position.z);
    if (dist < CONFIG.RADIO_COLISION + 0.32) {
      gema.activa = false;
      gema.mesh.visible = false;
      gemasRestantes--;
      puntos += CONFIG.PUNTOS_GEMA;
      emitirParticulas(gema.mesh.position.clone(), 0x4cc9f0, 8);
      actualizarHUD();
    }
  }

  for (const fruta of frutasPowerUp) {
    if (!fruta.activo) continue;
    fruta.mesh.rotation.y += 1.9 * dt;
    fruta.mesh.position.y = 0.68 + Math.sin(tiempoTotal * 3.2 + fruta.fase) * 0.14;

    const dist = Math.hypot(jugador.mesh.position.x - fruta.mesh.position.x, jugador.mesh.position.z - fruta.mesh.position.z);
    if (dist < CONFIG.RADIO_COLISION + 0.42) {
      fruta.activo = false;
      fruta.mesh.visible = false;
      puntos += CONFIG.PUNTOS_FRUTA;
      tiempoPowerUp = CONFIG.DURACION_POWERUP;
      reproducirEfecto(sonidoFruta);
      emitirParticulas(fruta.mesh.position.clone(), 0xff4d6d, 20);
      actualizarHUD();
    }
  }

  if (gemasRestantes === 0 && estado === 'jugando') {
    reproducirEfecto(sonidoGanar);
    cambiarEstado('victoria');
  }
}

function perderVida() {
  vidas--;
  tiempoInvulnerable = CONFIG.TIEMPO_INVULNERABILIDAD;
  reproducirEfecto(sonidoGameOver);
  if (jugador) {
    emitirParticulas(jugador.mesh.position.clone(), 0xff4d6d, 22);
    jugador.mesh.position.copy(spawnJugador);
    jugador.dir.set(0, 0, 0);
    jugador.siguienteDir.set(0, 0, 0);
  }
  actualizarHUD();

  if (vidas <= 0) cambiarEstado('gameover');
}

function actualizarHUD() {
  const restantes = gemas.filter((g) => g.activa).length;
  if (txtPuntos) txtPuntos.textContent = puntos;
  if (txtVidas) txtVidas.textContent = Math.max(0, vidas);
  if (txtFrutas) txtFrutas.textContent = restantes;
  if (txtPowerUp) txtPowerUp.textContent = tiempoPowerUp > 0 ? `${tiempoPowerUp.toFixed(1)}s` : 'Inactivo';
}

function cambiarEstado(nuevoEstado) {
  estado = nuevoEstado;

  if (nuevoEstado === 'pausa' || nuevoEstado === 'gameover' || nuevoEstado === 'victoria') {
    sonidoNivel.pause();
  } else if (nuevoEstado === 'jugando') {
    sonidoNivel.play();
  }

  if (panelInicio) {
    panelInicio.classList.toggle('oculto', estado !== 'inicio');
    panelInicio.classList.toggle('visible', estado === 'inicio');
  }
  if (panelPausa) {
    panelPausa.classList.toggle('oculto', estado !== 'pausa');
    panelPausa.classList.toggle('visible', estado === 'pausa');
  }
  if (panelFinal) {
    panelFinal.classList.toggle('oculto', estado !== 'gameover' && estado !== 'victoria');
    panelFinal.classList.toggle('visible', estado === 'gameover' || estado === 'victoria');
  }
  if (hud) hud.classList.toggle('oculto', estado === 'inicio');

  if (estado === 'victoria') {
    if (txtTituloFinal) txtTituloFinal.textContent = '¡Victoria!';
    if (txtMensaje) txtMensaje.textContent = `Recogiste todas las gemas. Puntaje final: ${puntos}`;
  } else if (estado === 'gameover') {
    if (txtTituloFinal) txtTituloFinal.textContent = 'Game Over';
    if (txtMensaje) txtMensaje.textContent = `Te quedaste sin vidas. Puntaje final: ${puntos}`;
  }
}

function reiniciarJuego() {
  sonidoNivel.play();
  puntos = 0;
  vidas = CONFIG.VIDAS;
  tiempoPowerUp = 0;
  tiempoInvulnerable = 0;
  construirNivel();
  cambiarEstado('jugando');
}

document.getElementById('btn-jugar')?.addEventListener('click', reiniciarJuego);
document.getElementById('btn-reiniciar')?.addEventListener('click', reiniciarJuego);
document.getElementById('btn-reiniciar-pausa')?.addEventListener('click', reiniciarJuego);
document.getElementById('btn-pausa')?.addEventListener('click', () => {
  if (estado === 'jugando') cambiarEstado('pausa');
});
document.getElementById('btn-reanudar')?.addEventListener('click', () => {
  if (estado === 'pausa') cambiarEstado('jugando');
});

// camara y loop
function actualizarCamara(dt) {
  if (!jugador) return;
  const targetPos = new THREE.Vector3(jugador.mesh.position.x, 18, jugador.mesh.position.z + 11);
  camara.position.lerp(targetPos, Math.min(1, dt * 6));
  camara.lookAt(jugador.mesh.position.x, 0, jugador.mesh.position.z);
}

function loop(ahora) {
  requestAnimationFrame(loop);

  const dt = Math.min((ahora - ultimoTiempo) / 1000, 0.05);
  ultimoTiempo = ahora;

  if (estado === 'jugando') {
    if (tiempoPowerUp > 0) {
      tiempoPowerUp = Math.max(0, tiempoPowerUp - dt);
      actualizarHUD();
    }
    if (tiempoInvulnerable > 0) {
      tiempoInvulnerable = Math.max(0, tiempoInvulnerable - dt);
    }

    actualizarJugador(dt);
    actualizarFantasmas(dt);
    actualizarColeccionables(dt, ahora / 1000);
    actualizarParticulas(dt);
  }

  actualizarCamara(dt);
  renderizador.render(escena, camara);
}

window.addEventListener('resize', () => {
  camara.aspect = window.innerWidth / window.innerHeight;
  camara.updateProjectionMatrix();
  renderizador.setSize(window.innerWidth, window.innerHeight);
});

cargarModelosExternos(() => {
  construirNivel();
  cambiarEstado('inicio');
  requestAnimationFrame(loop);
});