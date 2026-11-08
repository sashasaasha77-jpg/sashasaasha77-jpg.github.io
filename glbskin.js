// Маленький загрузчик GLB со скелетом и анимациями (без GLTFLoader): одна модель — много копий, у каждой свой AnimationMixer.
// Поддерживает то, что нужно для коней: один меш со skin, узлы TRS, текстура baseColor, клипы translation/rotation/scale (LINEAR/STEP).
const CACHE = new Map();
export function loadSkinned(url) {
  if (CACHE.has(url)) return CACHE.get(url);
  const THREE = window.W.THREE;
  const p = fetch(url).then(r => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.arrayBuffer(); }).then(async buf => {
    const dv = new DataView(buf), jl = dv.getUint32(12, true), j = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jl))), bin = 20 + jl + 8;
    const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }, TA = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array };
    const acc = i => { const a = j.accessors[i], v = j.bufferViews[a.bufferView], T = TA[a.componentType], n = NC[a.type], st = v.byteStride;
      const o = bin + (v.byteOffset || 0) + (a.byteOffset || 0);
      if (st && st !== n * T.BYTES_PER_ELEMENT) { const out = new T(a.count * n), src = new DataView(buf); for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) { const at = o + k * st + c * T.BYTES_PER_ELEMENT; out[k * n + c] = T === Float32Array ? src.getFloat32(at, true) : T === Uint16Array ? src.getUint16(at, true) : T === Uint32Array ? src.getUint32(at, true) : src.getUint8(at); } return { arr: out, n, norm: a.normalized }; }
      return { arr: new T(buf.slice(o, o + a.count * n * T.BYTES_PER_ELEMENT)), n, norm: a.normalized }; };
    const meshNode = j.nodes.findIndex(n => n.mesh != null), pr = j.meshes[j.nodes[meshNode].mesh].primitives[0], geo = new THREE.BufferGeometry();
    for (const [k, name] of [['POSITION', 'position'], ['NORMAL', 'normal'], ['TEXCOORD_0', 'uv'], ['JOINTS_0', 'skinIndex'], ['WEIGHTS_0', 'skinWeight']]) if (pr.attributes[k] != null) { const a = acc(pr.attributes[k]); geo.setAttribute(name, new THREE.BufferAttribute(a.arr, a.n, !!a.norm)); }
    if (pr.indices != null) geo.setIndex(new THREE.BufferAttribute(acc(pr.indices).arr, 1));
    const mt = j.materials?.[pr.material ?? 0], ti = mt?.pbrMetallicRoughness?.baseColorTexture?.index; let map = null;
    if (ti != null) { const img = j.images[j.textures[ti].source], v = j.bufferViews[img.bufferView]; const bmp = await createImageBitmap(new Blob([new Uint8Array(buf, bin + (v.byteOffset || 0), v.byteLength)], { type: img.mimeType }));
      map = new THREE.Texture(bmp); map.flipY = false; map.colorSpace = THREE.SRGBColorSpace; map.magFilter = THREE.NearestFilter; map.needsUpdate = true; }
    const mat = new THREE.MeshToonMaterial({ map, gradientMap: window.W.grad, side: mt?.doubleSided ? THREE.DoubleSide : THREE.FrontSide });
    const skin = j.skins[j.nodes[meshNode].skin], ibm = acc(skin.inverseBindMatrices).arr, inv = skin.joints.map((_, k) => new THREE.Matrix4().fromArray(ibm, k * 16));
    const clips = {}; for (const an of j.animations || []) { const tracks = [];
      for (const ch of an.channels) { const s = an.samplers[ch.sampler], t = acc(s.input).arr, v = acc(s.output).arr, nm = 'n' + ch.target.node, it = s.interpolation === 'STEP' ? THREE.InterpolateDiscrete : THREE.InterpolateLinear;
        if (ch.target.path === 'rotation') tracks.push(new THREE.QuaternionKeyframeTrack(nm + '.quaternion', t, v, it));
        else if (ch.target.path === 'translation') tracks.push(new THREE.VectorKeyframeTrack(nm + '.position', t, v, it));
        else if (ch.target.path === 'scale') tracks.push(new THREE.VectorKeyframeTrack(nm + '.scale', t, v, it)); }
      clips[an.name] = new THREE.AnimationClip(an.name, -1, tracks); }
    return { j, meshNode, geo, mat, skin, inv, clips };
  });
  CACHE.set(url, p); return p;
}
// новая копия: Group с костями и SkinnedMesh; userData.mixer и userData.play(name)
export function instSkinned(T) {
  const THREE = window.W.THREE, { j, meshNode, geo, mat, skin, inv, clips } = T, objs = [];
  j.nodes.forEach((n, i) => { const o = i === meshNode ? new THREE.SkinnedMesh(geo, mat) : new THREE.Bone(); o.name = 'n' + i;
    if (n.translation) o.position.fromArray(n.translation); if (n.rotation) o.quaternion.fromArray(n.rotation); if (n.scale) o.scale.fromArray(n.scale); if (n.matrix) new THREE.Matrix4().fromArray(n.matrix).decompose(o.position, o.quaternion, o.scale); objs[i] = o; });
  j.nodes.forEach((n, i) => (n.children || []).forEach(c => objs[i].add(objs[c])));
  const root = new THREE.Group(); for (const i of j.scenes[j.scene || 0].nodes) root.add(objs[i]);
  root.updateMatrixWorld(true); const mesh = objs[meshNode]; mesh.bind(new THREE.Skeleton(skin.joints.map(i => objs[i]), inv), mesh.matrixWorld); mesh.castShadow = true; mesh.frustumCulled = false;
  const mixer = new THREE.AnimationMixer(root), acts = {}; for (const k in clips) acts[k] = mixer.clipAction(clips[k]);
  let cur = null; root.userData = { mixer, play(name, fade = 0.25) { const a = acts[name]; if (!a || cur === a) return; a.reset().play(); if (cur) a.crossFadeFrom(cur, fade, false); cur = a; } };
  return root;
}
