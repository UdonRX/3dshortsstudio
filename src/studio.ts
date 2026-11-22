import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

type StudioCallbacks = {
  onReady: () => void;
  onFps: (fps: number) => void;
  onError: (message: string) => void;
};

export type StudioController = {
  togglePlayback: () => boolean;
  resetCamera: () => void;
  dispose: () => void;
  setTimelineTime: (seconds: number) => void;
  getTimelineTime: () => number;
  setPlaying: (playing: boolean) => void;
  setScene: (index: number) => void;
  setModelScene:(index:number,sceneIndex:number)=>void;
  setEffect: (effect: string) => void;
  loadModel: (file: File, resources?: Map<string,Blob>, category?: string) => Promise<void>;
  setModelVisible:(index:number,visible:boolean)=>void;
  applyTexture:(index:number,texture:Blob)=>void;
  attachModel:(index:number,targetIndex:number,slot:string)=>void;
  setModelTransform:(index:number,position:[number,number,number],rotation:[number,number,number],scale:number)=>void;
  removeModel:(index:number)=>void; getModelAnimations:(index:number)=>string[]; setModelAnimation:(index:number,clipIndex:number)=>void; setModelAnimationPlaying:(index:number,playing:boolean)=>void; clearImportedModels: () => void;
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
  let timelineTime = 0;
  let disposed = false;
  const importedModels = new THREE.Group();
  world.add(importedModels);
  let activeSceneIndex=0;
  const modelRecords:{root:THREE.Group;mixer?:THREE.AnimationMixer;clips:THREE.AnimationClip[];action?:THREE.AnimationAction;sceneIndex:number;userVisible:boolean}[]=[];
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
    if (event.pointerType === 'touch') return;
    pointerDown = true;
    lastX = event.clientX;
    lastY = event.clientY;
    renderer.domElement.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!pointerDown || event.pointerType === 'touch') return;
    targetYaw = THREE.MathUtils.clamp(targetYaw + (event.clientX - lastX) * 0.006, -0.72, 0.72);
    targetPitch = THREE.MathUtils.clamp(targetPitch + (event.clientY - lastY) * 0.004, -0.42, 0.42);
    lastX = event.clientX;
    lastY = event.clientY;
  };
  const onPointerUp = () => { pointerDown = false; };

  // Handle iPhone touch gestures directly on the 3D canvas. Prevent the
  // browser's default page scrolling only for touches that start here.
  const onTouchStart = (event: TouchEvent) => {
    if (event.cancelable) event.preventDefault();
    const touch = event.changedTouches[0];
    if (!touch) return;
    pointerDown = true;
    lastX = touch.clientX;
    lastY = touch.clientY;
  };
  const onTouchMove = (event: TouchEvent) => {
    if (!pointerDown) return;
    if (event.cancelable) event.preventDefault();
    const touch = event.touches[0];
    if (!touch) return;
    targetYaw = THREE.MathUtils.clamp(targetYaw + (touch.clientX - lastX) * 0.006, -0.72, 0.72);
    targetPitch = THREE.MathUtils.clamp(targetPitch + (touch.clientY - lastY) * 0.004, -0.42, 0.42);
    lastX = touch.clientX;
    lastY = touch.clientY;
  };
  const onTouchEnd = (event: TouchEvent) => {
    if (event.cancelable) event.preventDefault();
    pointerDown = false;
  };

  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('pointercancel', onPointerUp);
  renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: false });
  renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false });
  renderer.domElement.addEventListener('touchend', onTouchEnd, { passive: false });
  renderer.domElement.addEventListener('touchcancel', onTouchEnd, { passive: false });

  const render = () => {
    if (disposed) return;
    const delta = Math.min(clock.getDelta(), 0.05);
    if (playing) timelineTime = Math.min(30, timelineTime + delta);
    const elapsed = timelineTime;
    currentYaw = THREE.MathUtils.lerp(currentYaw, targetYaw, 0.055);
    currentPitch = THREE.MathUtils.lerp(currentPitch, targetPitch, 0.055);
    camera.position.x = cameraHome.x + currentYaw * 5.5;
    camera.position.y = cameraHome.y + currentPitch * 3.5;
    camera.lookAt(Math.sin(currentYaw) * 1.8, 1.05 + currentPitch * 1.2, -1.8);
    character.animate(elapsed, playing);
    modelRecords.forEach(record=>record.mixer?.update(delta));
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
    setTimelineTime: (seconds: number) => { timelineTime = THREE.MathUtils.clamp(seconds, 0, 30); },
    getTimelineTime: () => timelineTime,
    setPlaying: (value: boolean) => { playing = value; },
    setScene: (index: number) => {
      const presets = [
        { camera: [4.5, 3.1, 7.6] as [number, number, number], color: '#101923' },
        { camera: [-5.8, 2.8, 5.2] as [number, number, number], color: '#19202c' },
        { camera: [0.5, 5.2, 9.5] as [number, number, number], color: '#20202a' }
      ];
      activeSceneIndex=index;
      modelRecords.forEach(rec=>{rec.root.visible=rec.sceneIndex===index&&rec.userVisible;});
      const preset = presets[((index % presets.length) + presets.length) % presets.length];
      cameraHome.set(...preset.camera);
      scene.background = new THREE.Color(preset.color);
      scene.fog = new THREE.Fog(preset.color, 12, 34);
      targetYaw = 0; targetPitch = 0;
    },
    setEffect: (effect: string) => {
      const exposures: Record<string, number> = { none: 1.15, warm: 1.38, cool: 0.98, noir: 0.82, dreamy: 1.55 };
      renderer.toneMappingExposure = exposures[effect] ?? 1.15;
      const colors: Record<string, string> = { none: '#101923', warm: '#211b18', cool: '#101b28', noir: '#090b10', dreamy: '#252034' };
      scene.background = new THREE.Color(colors[effect] ?? colors.none);
      scene.fog = new THREE.Fog(colors[effect] ?? colors.none, 12, 34);
    },
    loadModel:async(file,resources,category='other')=>{const urls:string[]=[];const manager=new THREE.LoadingManager();if(resources?.size)manager.setURLModifier(url=>{const tail=decodeURIComponent(url).split('/').pop()??url;const blob=resources.get(url)??resources.get(tail);if(blob){const u=URL.createObjectURL(blob);urls.push(u);return u;}return url;});const loader=new GLTFLoader(manager);const data=await file.arrayBuffer();const gltf=await new Promise<{scene:THREE.Group;animations:THREE.AnimationClip[]}>( (resolve,reject)=>loader.parse(data,'',resolve,reject));urls.forEach(url=>URL.revokeObjectURL(url));const root=new THREE.Group();root.name=file.name;root.userData.category=category;const model=gltf.scene;root.add(model);const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),max=Math.max(size.x,size.y,size.z)||1;model.scale.setScalar(2.2/max);const scaled=new THREE.Box3().setFromObject(model);model.position.y-=scaled.min.y;root.position.x=(modelRecords.length%3-1)*1.1;root.position.z=.8;importedModels.add(root);modelRecords.push({root,mixer:gltf.animations.length?new THREE.AnimationMixer(model):undefined,clips:gltf.animations,sceneIndex:activeSceneIndex,userVisible:true});},
    setModelTransform:(i,p,r,scale)=>{const rec=modelRecords[i];if(rec){rec.root.position.set(...p);rec.root.rotation.set(...r);rec.root.scale.setScalar(scale);}},
    setModelVisible:(i,visible)=>{const rec=modelRecords[i];if(rec){rec.userVisible=visible;rec.root.visible=rec.sceneIndex===activeSceneIndex&&visible;}},
    setModelScene:(i,sceneIndex)=>{const rec=modelRecords[i];if(rec){rec.sceneIndex=sceneIndex;rec.root.visible=rec.sceneIndex===activeSceneIndex&&rec.userVisible;}},
    applyTexture:(i,blob)=>{const rec=modelRecords[i];if(!rec)return;const url=URL.createObjectURL(blob);new THREE.TextureLoader().load(url,texture=>{texture.colorSpace=THREE.SRGBColorSpace;rec.root.traverse(o=>{if(o instanceof THREE.Mesh){const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>{if(m instanceof THREE.MeshStandardMaterial){m.map=texture;m.needsUpdate=true;}});}});URL.revokeObjectURL(url);},undefined,()=>URL.revokeObjectURL(url));},
    attachModel:(i,targetIndex,slot)=>{const rec=modelRecords[i],target=modelRecords[targetIndex];if(!rec||!target||i===targetIndex)return;const box=new THREE.Box3().setFromObject(target.root),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),assetBox=new THREE.Box3().setFromObject(rec.root),assetSize=assetBox.getSize(new THREE.Vector3()),max=Math.max(assetSize.x,assetSize.y,assetSize.z)||1;const desired=slot==='head'?Math.max(size.y*.18,.22):slot==='hand'?Math.max(size.y*.12,.15):Math.max(size.y*.22,.25);rec.root.scale.setScalar(desired/max);importedModels.remove(rec.root);target.root.add(rec.root);rec.root.position.set(center.x-target.root.position.x,box.max.y-(slot==='head'?size.y*.12:size.y*.3)-target.root.position.y,center.z-target.root.position.z);rec.root.userData.attachedTo=targetIndex;rec.root.userData.attachSlot=slot;},
    removeModel:i=>{const rec=modelRecords[i];if(!rec)return;rec.mixer?.stopAllAction();rec.root.parent?.remove(rec.root);rec.root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>m.dispose());}});modelRecords.splice(i,1);},
    getModelAnimations:i=>modelRecords[i]?.clips.map(c=>c.name||'Animation')??[],
    setModelAnimation:(i,clipIndex)=>{const rec=modelRecords[i];if(!rec?.mixer)return;rec.action?.stop();rec.action=clipIndex>=0?rec.mixer.clipAction(rec.clips[clipIndex]):undefined;rec.action?.reset().play();},
    setModelAnimationPlaying:(i,value)=>{const rec=modelRecords[i];if(rec?.action)rec.action.paused=!value;},
    clearImportedModels:()=>{for(let i=modelRecords.length-1;i>=0;i--){const rec=modelRecords[i];rec.mixer?.stopAllAction();rec.root.parent?.remove(rec.root);rec.root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>m.dispose());}});}modelRecords.length=0;},
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
      renderer.domElement.removeEventListener('touchstart', onTouchStart);
      renderer.domElement.removeEventListener('touchmove', onTouchMove);
      renderer.domElement.removeEventListener('touchend', onTouchEnd);
      renderer.domElement.removeEventListener('touchcancel', onTouchEnd);
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
