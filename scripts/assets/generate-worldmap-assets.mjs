// ─────────────────────────────────────────────────────────────────────────────
// MapMonde — Générateur d'assets 3D (MYL-20, Stage 2 / Asset Creator)
//
// Produit deux .glb auto-suffisants (géométrie + texture embarquées, aucun
// fichier annexe) consommables par `useGLTF` de @react-three/fiber :
//
//   public/assets/worldmap/globe.glb   — sphère Terre texturée, rayon GLOBE_RADIUS
//   public/assets/worldmap/pin.glb     — marqueur "épingle" (tête + cône), neutre
//
// CONTRAT D'ÉCHELLE (globeConfig.ts) : GLOBE_RADIUS = 1.5. La sphère est bâtie
// avec la PARAMÉTRISATION three.js SphereGeometry par défaut (phiStart=0), qui
// coïncide exactement avec `latLonToVec3(lat, lon, GLOBE_RADIUS)` du Stage 1 :
//   a = phiStart + u·2π = (lon+180)·π/180,  t = v·π = (90−lat)·π/180
// → les pins posés via `latLonToVec3` tombent pile sur la bonne ville.
//
// UV : three encode v origine bas-gauche (uv.y = 1−v) ; glTF veut origine
// haut-gauche. On inverse donc uv.y → la texture équirectangulaire (ligne 0 =
// +90° N, gauche = −180°) s'aligne sur la même convention que les pins.
//
// Lancement :  node scripts/assets/generate-worldmap-assets.mjs
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from "three";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");
const OUT_DIR = resolve(ROOT, "public/assets/worldmap");
// Texture source équirectangulaire (NASA Blue Marble, domaine public — voir
// scripts/assets/textures/CREDITS.md). Versionnée → régénération hors-ligne.
const EARTH_TEX = resolve(__dirname, "textures/earth_atmos_2048.jpg");

const GLOBE_RADIUS = 1.5; // doit suivre globeConfig.ts

// ── Petit moteur d'écriture GLB (binaire mono-buffer) ────────────────────────
const COMP = { F32: 5126, U16: 5123, U32: 5125 };
const TARGET = { ARRAY_BUFFER: 34962, ELEMENT_ARRAY_BUFFER: 34963 };

function pad4(n) {
  return (4 - (n % 4)) % 4;
}

/** Construit un .glb à partir d'une liste de "parts" (mesh) + texture optionnelle. */
function buildGlb({ parts, image }) {
  const json = {
    asset: { version: "2.0", generator: "MapMonde MYL-20 asset generator" },
    scenes: [{ nodes: [] }],
    scene: 0,
    nodes: [],
    meshes: [],
    materials: [],
    accessors: [],
    bufferViews: [],
    buffers: [],
  };
  const chunks = []; // {data:Buffer, target?}
  let byteOffset = 0;

  const pushView = (buf, target) => {
    const padded = Buffer.concat([buf, Buffer.alloc(pad4(buf.length))]);
    const view = {
      buffer: 0,
      byteOffset,
      byteLength: buf.length,
    };
    if (target) view.target = target;
    json.bufferViews.push(view);
    byteOffset += padded.length;
    chunks.push(padded);
    return json.bufferViews.length - 1;
  };

  const pushAccessor = (acc) => {
    json.accessors.push(acc);
    return json.accessors.length - 1;
  };

  // Texture embarquée (jpeg) → bufferView → image → texture
  let textureIndex = null;
  if (image) {
    const imgView = pushView(image.data); // pas de target pour les images
    json.images = [{ bufferView: imgView, mimeType: image.mimeType }];
    json.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }];
    json.textures = [{ sampler: 0, source: 0 }];
    textureIndex = 0;
  }

  for (const part of parts) {
    const { geometry, material, name } = part;
    const pos = geometry.attributes.position.array; // Float32
    const nor = geometry.attributes.normal.array;
    const uv = geometry.attributes.uv ? geometry.attributes.uv.array : null;
    const idxAttr = geometry.index;

    // POSITION
    const posBuf = Buffer.from(
      new Float32Array(pos).buffer.slice(0),
    );
    let min = [Infinity, Infinity, Infinity];
    let max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < pos.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], pos[i + k]);
        max[k] = Math.max(max[k], pos[i + k]);
      }
    }
    const posView = pushView(posBuf, TARGET.ARRAY_BUFFER);
    const posAcc = pushAccessor({
      bufferView: posView,
      componentType: COMP.F32,
      count: pos.length / 3,
      type: "VEC3",
      min,
      max,
    });

    // NORMAL
    const norView = pushView(
      Buffer.from(new Float32Array(nor).buffer.slice(0)),
      TARGET.ARRAY_BUFFER,
    );
    const norAcc = pushAccessor({
      bufferView: norView,
      componentType: COMP.F32,
      count: nor.length / 3,
      type: "VEC3",
    });

    const attributes = { POSITION: posAcc, NORMAL: norAcc };

    // TEXCOORD_0 (uv.y inversé : three bas-gauche → glTF haut-gauche)
    if (uv) {
      const uvFlipped = new Float32Array(uv.length);
      for (let i = 0; i < uv.length; i += 2) {
        uvFlipped[i] = uv[i];
        uvFlipped[i + 1] = 1 - uv[i + 1];
      }
      const uvView = pushView(
        Buffer.from(uvFlipped.buffer.slice(0)),
        TARGET.ARRAY_BUFFER,
      );
      attributes.TEXCOORD_0 = pushAccessor({
        bufferView: uvView,
        componentType: COMP.F32,
        count: uv.length / 2,
        type: "VEC2",
      });
    }

    // INDEX
    const idxArr = idxAttr.array;
    const use32 = pos.length / 3 > 65535;
    const idxTyped = use32 ? new Uint32Array(idxArr) : new Uint16Array(idxArr);
    const idxView = pushView(
      Buffer.from(idxTyped.buffer.slice(0)),
      TARGET.ELEMENT_ARRAY_BUFFER,
    );
    const idxAcc = pushAccessor({
      bufferView: idxView,
      componentType: use32 ? COMP.U32 : COMP.U16,
      count: idxArr.length,
      type: "SCALAR",
    });

    // Material
    const matIndex = json.materials.length;
    json.materials.push(material);

    json.meshes.push({
      name,
      primitives: [
        {
          attributes,
          indices: idxAcc,
          material: matIndex,
        },
      ],
    });
    const nodeIndex = json.nodes.length;
    json.nodes.push({ mesh: json.meshes.length - 1, name });
    json.scenes[0].nodes.push(nodeIndex);
  }

  // Buffer binaire concaténé
  const bin = Buffer.concat(chunks);
  json.buffers.push({ byteLength: bin.length });

  // Sérialisation GLB
  let jsonStr = JSON.stringify(json);
  const jsonBuf = Buffer.from(jsonStr, "utf8");
  const jsonPadded = Buffer.concat([
    jsonBuf,
    Buffer.alloc(pad4(jsonBuf.length), 0x20),
  ]);
  const binPadded = Buffer.concat([bin, Buffer.alloc(pad4(bin.length), 0x00)]);

  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); // "glTF"
  header.writeUInt32LE(2, 4); // version
  header.writeUInt32LE(12 + 8 + jsonPadded.length + 8 + binPadded.length, 8);

  const jsonChunkHeader = Buffer.alloc(8);
  jsonChunkHeader.writeUInt32LE(jsonPadded.length, 0);
  jsonChunkHeader.writeUInt32LE(0x4e4f534a, 4); // "JSON"

  const binChunkHeader = Buffer.alloc(8);
  binChunkHeader.writeUInt32LE(binPadded.length, 0);
  binChunkHeader.writeUInt32LE(0x004e4942, 4); // "BIN\0"

  return Buffer.concat([
    header,
    jsonChunkHeader,
    jsonPadded,
    binChunkHeader,
    binPadded,
  ]);
}

// ── Helpers géométrie ────────────────────────────────────────────────────────
// NB : on NE recalcule PAS les normales — les primitives three (Cone/Sphere)
// portent déjà des normales unitaires correctes, et `rotateX`/`applyMatrix4` les
// transforment. Un `computeVertexNormals` sur géométrie indexée annulerait les
// normales aux pôles/apex (faces opposées) → erreurs ACCESSOR_VECTOR3_NON_UNIT.

/** Concatène plusieurs BufferGeometry (positions/normals indexés) en une seule. */
function mergeGeometries(geos) {
  let posLen = 0;
  let idxLen = 0;
  for (const g of geos) {
    posLen += g.attributes.position.count;
    idxLen += g.index.array.length;
  }
  const position = new Float32Array(posLen * 3);
  const normal = new Float32Array(posLen * 3);
  const index = new Uint16Array(idxLen);
  let vOff = 0;
  let iOff = 0;
  for (const g of geos) {
    const p = g.attributes.position.array;
    const n = g.attributes.normal.array;
    position.set(p, vOff * 3);
    normal.set(n, vOff * 3);
    const gi = g.index.array;
    for (let i = 0; i < gi.length; i++) index[iOff + i] = gi[i] + vOff;
    vOff += g.attributes.position.count;
    iOff += gi.length;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(position, 3));
  merged.setAttribute("normal", new THREE.BufferAttribute(normal, 3));
  merged.setIndex(new THREE.BufferAttribute(index, 1));
  return merged;
}

// ── 1) GLOBE ─────────────────────────────────────────────────────────────────
function makeGlobe() {
  const geometry = new THREE.SphereGeometry(GLOBE_RADIUS, 96, 64);
  // phiStart=0 par défaut → coïncide avec latLonToVec3 (cf. en-tête).
  const earth = readFileSync(EARTH_TEX);
  const material = {
    name: "globe_earth",
    pbrMetallicRoughness: {
      baseColorTexture: { index: 0 },
      baseColorFactor: [1, 1, 1, 1],
      metallicFactor: 0.0,
      roughnessFactor: 0.92,
    },
  };
  return buildGlb({
    parts: [{ geometry, material, name: "globe" }],
    image: { data: earth, mimeType: "image/jpeg" },
  });
}

// ── 2) PIN ───────────────────────────────────────────────────────────────────
// Épingle "map pin" : tête sphérique + cône effilé.
// Convention LOCALE : la POINTE est à l'origine (0,0,0) ; le corps monte le long
// de +Y. À l'intégration, orienter +Y vers la normale sortante de la sphère
// (radial), puis poser le node à la surface (cf. note d'intégration).
function makePin() {
  // Échelle calée sur GLOBE_RADIUS=1.5 : hauteur totale ≈ 0.19 → lisible au zoom
  // monde sans écraser le globe (le placeholder code était une sphère r=0.035).
  // Le node StudioPin peut affiner via `scale`.
  const HEIGHT = 0.12;
  const HEAD_R = 0.045;

  // Cône : pointe en bas (origine), base en haut.
  const cone = new THREE.ConeGeometry(0.042, HEIGHT, 24, 1, false);
  cone.rotateX(Math.PI); // apex (était +y) → -y
  cone.translate(0, HEIGHT / 2, 0); // apex à y=0, base à y=HEIGHT


  // Tête : sphère posée sur la base du cône.
  const head = new THREE.SphereGeometry(HEAD_R, 32, 24);
  head.translate(0, HEIGHT + HEAD_R * 0.55, 0);


  const geometry = mergeGeometries([cone, head]);

  // Matériau NEUTRE : la teinte/émissif d'état (éteint/allumé + accent de zone
  // §7) est pilotée par le code (StudioPin) en surchargeant le material. On
  // fournit un blanc cassé légèrement émissif pour que le pin reste visible même
  // sans surcharge.
  const material = {
    name: "pin_neutral",
    pbrMetallicRoughness: {
      baseColorFactor: [0.85, 0.88, 0.95, 1],
      metallicFactor: 0.1,
      roughnessFactor: 0.45,
    },
    emissiveFactor: [0.05, 0.06, 0.08],
  };

  return buildGlb({ parts: [{ geometry, material, name: "pin" }] });
}

// ── Run ──────────────────────────────────────────────────────────────────────
mkdirSync(OUT_DIR, { recursive: true });
const globe = makeGlobe();
writeFileSync(resolve(OUT_DIR, "globe.glb"), globe);
const pin = makePin();
writeFileSync(resolve(OUT_DIR, "pin.glb"), pin);

console.log("globe.glb", globe.length, "bytes");
console.log("pin.glb  ", pin.length, "bytes");
