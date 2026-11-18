import * as THREE from 'three';

type StudioCallbacks = {
  onReady: () => void;
  onFps: (fps: number) => void;
  onError: (message: string) => void;
};

export type StudioController = {
  togglePlayback: () => boolean;
  resetCamera: () => void;
  dispose: () => void;
};

function makeMaterial(color: THREE.ColorRepresentation, roughness = 0.82): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02 });
}

function addBox(
  parent: THREE.Group,
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function createCharacter(): { root: THREE.Group; animate: (time: number, playing: boolean) => void } {
  const root = new THREE.Group();
  const skin = makeMaterial('#e9b991');
  const jacket = makeMaterial('#e9f0f4');
  const pants = makeMaterial('#26364c');
  const shoes = makeMaterial('#f4f2eb');
  const dark = makeMaterial('#253044');
  const head = new THREE.Group();
  head.position.y = 1.48;
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.25, 24, 18), skin);
  headMesh.scale.set(0.88, 1.12, 0.92);
  headMesh.castShadow = true;
  head.add(headMesh);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.255, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.52), dark);
  hair.position.y = 0.07;
  hair.castShadow = true;
  head.add(hair);
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#172033', roughness: 0.4 });
  for (const x of [-0.075, 0.075]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), eyeMat);
    eye.position.set(x, -0.015, 0.218);
    head.add(eye);
  }
  root.add(head);

  const torso = addBox(root, [0.52, 0.62, 0.3], [0, 0.98, 0], jacket);
  torso.geometry.translate(0, 0, 0);
  const collar = addBox(root, [0.18, 0.13, 0.035], [0, 1.285, 0.16], makeMaterial('#c5d5df'));
  collar.castShadow = false;

  const armPivots: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.32, 1.2, 0);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.28, 4, 8), jacket);
    upper.position.y = -0.18;
    upper.castShadow = true;
    pivot.add(upper);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), skin);
    hand.position.y = -0.39;
    pivot.add(hand);
    root.add(pivot);
    armPivots.push(pivot);
  }

  const legPivots: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.14, 0.69, 0);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.35, 4, 8), pants);
    leg.position.y = -0.24;
    leg.castShadow = true;
    pivot.add(leg);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.105, 0.32), shoes);
    shoe.position.set(0, -0.47, 0.075);
    shoe.castShadow = true;
    pivot.add(shoe);
    root.add(pivot);
    legPivots.push(pivot);
  }

  return {
    root,
    animate: (time, playing) => {
      const walk = playing ? Math.sin(time * 4.2) : 0;
      legPivots[0].rotation.x = walk * 0.42;
      legPivots[1].rotation.x = -walk * 0.42;
      armPivots[0].rotation.x = -walk * 0.32 - 0.08;
      armPivots[1].rotation.x = walk * 0.32 - 0.08;
      root.position.y = playing ? Math.abs(Math.sin(time * 4.2)) * 0.035 : 0;
      root.rotation.y = Math.sin(time * 0.6) * 0.035;
      head.rotation.z = Math.sin(time * 1.4) * 0.025;
      void torso;
      void collar;
    }
  };
}

function buildScene(scene: THREE.Scene): THREE.Group {
  const world = new THREE.Group();
  scene.add(world);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), makeMaterial('#202a35'));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.025;
  ground.receiveShadow = true;
  world.add(ground);

  const road = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 80), makeMaterial('#303944'));
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0;
  road.receiveShadow = true;
  world.add(road);

  const lineMat = new THREE.MeshStandardMaterial({ color: '#d8cba9', roughness: 1 });
  for (let z = -24; z < 25; z += 4) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 1.8), lineMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(0, 0.012, z);
    world.add(dash);
  }

  const buildingColors = ['#47596b', '#586575', '#354657', '#6b7782'];
  for (let i = 0; i < 18; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const row = Math.floor(i / 2);
    const height = 2.8 + ((i * 7) % 5) * 0.62;
    const width = 1.6 + ((i * 3) % 3) * 0.35;
    const depth = 2.1 + ((i * 5) % 3) * 0.4;
    const building = new THREE.Group();
    building.position.set(side * (4.2 + (row % 2) * 0.8), 0, -row * 4.8 - 3);
    const body = addBox(building, [width, height, depth], [0, height / 2, 0], makeMaterial(buildingColors[i % buildingColors.length]));
    body.castShadow = true;
    const windowMat = new THREE.MeshStandardMaterial({ color: '#e5c994', emissive: '#80633b', emissiveIntensity: 0.24, roughness: 0.5 });
    for (let y = 0.8; y < height - 0.25; y += 0.72) {
      for (let x = -width / 2 + 0.32; x < width / 2 - 0.12; x += 0.48) {
        const windowMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.28), windowMat);
        windowMesh.position.set(x, y, depth / 2 + 0.008);
        building.add(windowMesh);
      }
    }
    world.add(building);
  }

  const treeMat = makeMaterial('#344e49');
  const trunkMat = makeMaterial('#665347');
  for (let i = 0; i < 10; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const tree = new THREE.Group();
    tree.position.set(side * (3.2 + (i % 3) * 0.4), 0, -i * 5 - 2);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 1.1, 8), trunkMat);
    trunk.position.y = 0.55;
    trunk.castShadow = true;
    tree.add(trunk);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.58, 1), treeMat);
    crown.position.y = 1.42;
    crown.scale.y = 1.22;
    crown.castShadow = true;
    tree.add(crown);
    world.add(tree);
  }

  const lampMat = new THREE.MeshStandardMaterial({ color: '#f2d8a3', emissive: '#e9b66b', emissiveIntensity: 0.6 });
  for (let i = 0; i < 8; i++) {
    for (const side of [-1, 1]) {
      const lamp = new THREE.Group();
      lamp.position.set(side * 3.15, 0, -i * 6 - 1);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 3.4, 8), makeMaterial('#48525e'));
      pole.position.y = 1.7;
      lamp.add(pole);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), lampMat);
      head.position.set(-side * 0.1, 3.38, 0);
      lamp.add(head);
      world.add(lamp);
    }
  }

  return world;
}

export function createStudio(mount: HTMLElement, callbacks: StudioCallbacks): StudioController {
  if (!('WebGL2RenderingContext' in window)) {
    const message = 'このSafariではWebGL 2が利用できないみたい。iOSを更新するか、Safariの設定を確認してね。';
    callbacks.onError(message);
    throw new Error(message);
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#101923');
  scene.fog = new THREE.Fog('#101923', 12, 34);

  const camera = new THREE.PerspectiveCamera(37, 9 / 16, 0.1, 100);
  const cameraHome = new THREE.Vector3(4.5, 3.1, 7.6);
  camera.position.copy(cameraHome);
  camera.lookAt(0, 1.05, -1.8);

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: false
    });
  } catch {
    const message = '3D描画を開始できなかったよ。SafariでWebGLが有効か確認してね。';
    callbacks.onError(message);
    throw new Error(message);
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
  renderer.setSize(mount.clientWidth || 360, mount.clientHeight || 640, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.domElement.className = 'scene-canvas';
  renderer.domElement.setAttribute('aria-label', 'アニメーションする3D街並みと人物');
  mount.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight('#d9e8ff', '#4b4a42', 2.1));
  const sun = new THREE.DirectionalLight('#ffe0b1', 3.1);
  sun.position.set(-4, 9, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -10;
  sun.shadow.camera.right = 10;
  sun.shadow.camera.top = 10;
  sun.shadow.camera.bottom = -10;
  scene.add(sun);

  const world = buildScene(scene);
  const character = createCharacter();
  character.root.position.set(0, 0, 1.3);
  world.add(character.root);

  const ambientParticles = new THREE.Group();
  const particleMaterial = new THREE.MeshBasicMaterial({ color: '#f0d8ae', transparent: true, opacity: 0.48 });
  for (let i = 0; i < 36; i++) {
    const particle = new THREE.Mesh(new THREE.SphereGeometry(0.018 + (i % 3) * 0.008, 6, 6), particleMaterial);
    particle.position.set(((i * 17) % 90) / 10 - 4.5, 0.5 + ((i * 13) % 45) / 10, -((i * 11) % 30));
    ambientParticles.add(particle);
  }
  scene.add(ambientParticles);

  let playing = true;
  let disposed = false;
  let pointerDown = false;
  let lastX = 0;
  let lastY = 0;
  let targetYaw = 0;
  let currentYaw = 0;
  let targetPitch = 0;
  let currentPitch = 0;
  let frameCount = 0;
  let lastFpsTime = performance.now();
  const clock = new THREE.Clock();

  const resize = () => {
    const width = Math.max(1, mount.clientWidth);
    const height = Math.max(1, mount.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(mount);
  resize();

  const onPointerDown = (event: PointerEvent) => {
    pointerDown = true;
    lastX = event.clientX;
    lastY = event.clientY;
    renderer.domElement.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!pointerDown) return;
    targetYaw = THREE.MathUtils.clamp(targetYaw + (event.clientX - lastX) * 0.006, -0.72, 0.72);
    targetPitch = THREE.MathUtils.clamp(targetPitch + (event.clientY - lastY) * 0.004, -0.42, 0.42);
    lastX = event.clientX;
    lastY = event.clientY;
  };
  const onPointerUp = () => { pointerDown = false; };
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('pointercancel', onPointerUp);

  const render = () => {
    if (disposed) return;
    const delta = Math.min(clock.getDelta(), 0.05);
    const elapsed = clock.elapsedTime;
    currentYaw = THREE.MathUtils.lerp(currentYaw, targetYaw, 0.055);
    currentPitch = THREE.MathUtils.lerp(currentPitch, targetPitch, 0.055);
    camera.position.x = cameraHome.x + currentYaw * 5.5;
    camera.position.y = cameraHome.y + currentPitch * 3.5;
    camera.lookAt(Math.sin(currentYaw) * 1.8, 1.05 + currentPitch * 1.2, -1.8);
    character.animate(elapsed, playing);
    ambientParticles.position.y = Math.sin(elapsed * 0.35) * 0.12;
    renderer.render(scene, camera);
    frameCount++;
    const now = performance.now();
    if (now - lastFpsTime >= 1000) {
      callbacks.onFps(Math.round((frameCount * 1000) / (now - lastFpsTime)));
      frameCount = 0;
      lastFpsTime = now;
    }
    void delta;
    renderer.setAnimationLoop(render);
  };

  try {
    renderer.render(scene, camera);
    callbacks.onReady();
    renderer.setAnimationLoop(render);
  } catch {
    const message = 'シーンの描画中にエラーが発生したよ。ページを再読み込みしてみてね。';
    callbacks.onError(message);
    throw new Error(message);
  }

  return {
    togglePlayback: () => {
      playing = !playing;
      return playing;
    },
    resetCamera: () => { targetYaw = 0; targetPitch = 0; },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerUp);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}
