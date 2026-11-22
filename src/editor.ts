import type { StudioController } from './studio';
import JSZip from 'jszip';

type ProjectData = {
  version: 1;
  duration: 30;
  caption: string;
  effect: string;
  scene: number;
  models: { name: string; data: ArrayBuffer; resources?: { path: string; blob: Blob }[]; category?: string; position?: [number,number,number]; rotation?: [number,number,number]; scale?: number }[];
};

const DB_NAME = '3d-shorts-studio';
const STORE = 'projects';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveProject(project: ProjectData): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(project, 'autosave');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function readProject(): Promise<ProjectData | undefined> {
  const db = await openDatabase();
  const result = await new Promise<ProjectData | undefined>((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get('autosave');
    request.onsuccess = () => resolve(request.result as ProjectData | undefined);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result;
}

export function mountEditor(root: HTMLElement, studio: StudioController): () => void {
  root.innerHTML = `
    <div class="editor-heading"><div><span class="eyebrow">PHASE 02 / CREATION</span><h2>動画制作ワークスペース</h2></div><span class="editor-duration">30 SEC</span></div>
    <div class="editor-block">
      <div class="editor-label"><b>SCENE TIMELINE</b><span id="time-readout">00:00.0 / 00:30.0</span></div>
      <div class="scene-tabs">
        <button class="scene-tab selected" data-scene="0" type="button">01 <small>街を歩く</small></button>
        <button class="scene-tab" data-scene="1" type="button">02 <small>別アングル</small></button>
        <button class="scene-tab" data-scene="2" type="button">03 <small>俯瞰</small></button>
      </div>
      <input id="timeline" class="timeline" type="range" min="0" max="30" step="0.1" value="0" aria-label="タイムライン">
      <div class="timeline-scale"><span>00:00</span><span>00:10</span><span>00:20</span><span>00:30</span></div>
      <div class="editor-actions"><button id="editor-play" class="action-button accent" type="button">Ⅱ 一時停止</button><button id="editor-start" class="action-button" type="button">先頭へ</button></div>
    </div>
    <div class="editor-block">
      <div class="editor-label"><b>CAPTIONS</b><span>字幕テキスト</span></div>
      <input id="caption-text" class="text-field" maxlength="80" placeholder="ここに字幕を入力" value="新しい世界へ歩き出そう">
      <p class="field-note">字幕はプレビューに重ねて表示し、書き出し時に映像へ合成するよ。</p>
    </div>
    <div class="editor-block">
      <div class="editor-label"><b>VISUAL EFFECT</b><span>映像の雰囲気</span></div>
      <div class="effect-grid">
        <button class="effect-choice active" data-effect="none" type="button">Natural</button>
        <button class="effect-choice" data-effect="warm" type="button">Warm</button>
        <button class="effect-choice" data-effect="cool" type="button">Cool</button>
        <button class="effect-choice" data-effect="noir" type="button">Noir</button>
        <button class="effect-choice" data-effect="dreamy" type="button">Dreamy</button>
      </div>
    </div>
    <div class="editor-block">
      <div class="editor-label"><b>3D ASSET LIBRARY</b><span>GLB / glTF</span></div>
      <label class="upload-button" for="model-file">＋ 3Dモデルを読み込む</label>
      <input id="model-file" type="file" accept=".glb,.gltf,.zip,model/gltf-binary,model/gltf+json,application/zip" hidden>
      <p id="asset-status" class="field-note">ZIP / GLB / glTFを読み込み、素材ライブラリに保存するよ。</p><div id="asset-library" class="asset-library"></div><div class="asset-tools"><label class="asset-label">カテゴリ<select id="asset-category" class="asset-select"><option value="character">キャラクター</option><option value="building">建物</option><option value="prop">小物</option><option value="nature">自然</option><option value="other">その他</option></select></label><label class="asset-label">大きさ<input id="asset-scale" type="range" min="0.1" max="5" step="0.1" value="1"></label><div class="asset-transform"><label>位置 X<input id="asset-x" type="range" min="-5" max="5" step="0.1" value="0"></label><label>位置 Y<input id="asset-y" type="range" min="0" max="5" step="0.1" value="0"></label><label>位置 Z<input id="asset-z" type="range" min="-10" max="10" step="0.1" value="0"></label></div><div class="asset-transform"><label>回転 Y<input id="asset-rotation" type="range" min="-180" max="180" step="5" value="0"></label></div><div class="asset-animation"><label>アニメーション<select id="asset-animation" class="asset-select"><option value="-1">なし</option></select></label><button id="asset-anim-play" class="action-button" type="button">アニメーション再生</button></div></div><button id="clear-models" class="text-button" type="button">読み込んだモデルをすべて外す</button>
    </div>
    <div class="editor-footer">
      <button id="save-project" class="action-button" type="button">プロジェクトを保存</button>
      <button id="export-video" class="action-button accent" type="button">30秒のMP4を書き出す</button>
    </div>
    <p id="editor-message" class="editor-message" role="status">編集内容はこのiPhoneのブラウザ内に保存できるよ。</p>
    <div id="caption-preview" class="caption-preview" aria-live="polite">新しい世界へ歩き出そう</div>
  `;

  const $ = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const timeline = $('#timeline') as HTMLInputElement;
  const caption = $('#caption-text') as HTMLInputElement;
  const message = $('#editor-message');
  const captionPreview = document.querySelector<HTMLElement>('#caption-preview')!;
  let currentScene = 0;
  let currentEffect = 'none';
  let playing = true;
  let disposed = false;
  let exportFrame = 0;
  let modelFiles: { name: string; data: ArrayBuffer; resources?: { path: string; blob: Blob }[]; category?: string; position?: [number,number,number]; rotation?: [number,number,number]; scale?: number }[] = [];
  let selectedModel=-1, animationPlaying=false;
  const assetLibrary=$('#asset-library'), categoryInput=$('#asset-category') as HTMLSelectElement;
  const transformInputs=['#asset-x','#asset-y','#asset-z','#asset-rotation','#asset-scale'].map(s=>$(s) as HTMLInputElement);

  const updateTime = () => {
    const value = Number(timeline.value);
    $('#time-readout').textContent = `00:${String(Math.floor(value)).padStart(2, '0')}.${Math.round((value % 1) * 10)} / 00:30.0`;
  };
  const updateCaption = () => {
    captionPreview.textContent = caption.value;
    captionPreview.hidden = !caption.value.trim();
  };
  timeline.addEventListener('input', () => {
    studio.setTimelineTime(Number(timeline.value));
    updateTime();
  });
  $('#editor-play').addEventListener('click', () => {
    playing = !playing;
    studio.setPlaying(playing);
    $('#editor-play').textContent = playing ? 'Ⅱ 一時停止' : '▶ 再生';
  });
  $('#editor-start').addEventListener('click', () => {
    timeline.value = '0'; studio.setTimelineTime(0); updateTime();
  });
  root.querySelectorAll<HTMLButtonElement>('[data-scene]').forEach((button) => {
    button.addEventListener('click', () => {
      currentScene = Number(button.dataset.scene);
      studio.setScene(currentScene);
      root.querySelectorAll('[data-scene]').forEach((item) => item.classList.toggle('selected', item === button));
    });
  });
  caption.addEventListener('input', updateCaption);
  root.querySelectorAll<HTMLButtonElement>('[data-effect]').forEach((button) => {
    button.addEventListener('click', () => {
      currentEffect = button.dataset.effect ?? 'none';
      studio.setEffect(currentEffect);
      root.querySelectorAll('[data-effect]').forEach((item) => item.classList.toggle('active', item === button));
    });
  });
  const renderLibrary=()=>{assetLibrary.innerHTML='';modelFiles.forEach((m,i)=>{const row=document.createElement('div');row.className='asset-row'+(i===selectedModel?' selected':'');row.innerHTML='<button class="asset-select-row"><b></b><small></small></button><button class="asset-remove">×</button>';row.querySelector('b')!.textContent=m.name;row.querySelector('small')!.textContent=({character:'キャラクター',building:'建物',prop:'小物',nature:'自然',other:'その他'} as Record<string,string>)[m.category??'other'];row.querySelector('.asset-select-row')!.addEventListener('click',()=>selectAsset(i));row.querySelector('.asset-remove')!.addEventListener('click',()=>{studio.removeModel(i);modelFiles.splice(i,1);selectedModel=modelFiles.length?Math.min(i,modelFiles.length-1):-1;renderLibrary();selectAsset(selectedModel);});assetLibrary.append(row);});};
  const selectAsset=(i:number)=>{selectedModel=i;renderLibrary();const m=modelFiles[i];transformInputs.forEach(x=>x.disabled=!m);if(!m){($('#asset-animation') as HTMLSelectElement).innerHTML='<option value="-1">なし</option>';return;}categoryInput.value=m.category??'other';const p=m.position??[0,0,0],r=m.rotation??[0,0,0],scale=m.scale??1;[p[0],p[1],p[2],r[1]*180/Math.PI,scale].forEach((v,j)=>transformInputs[j].value=String(v));const sel=$('#asset-animation') as HTMLSelectElement;sel.innerHTML='<option value="-1">なし</option>';studio.getModelAnimations(i).forEach((name,j)=>{const o=document.createElement('option');o.value=String(j);o.textContent=name;sel.append(o);});};
  const applyTransform=()=>{if(selectedModel<0)return;const m=modelFiles[selectedModel];m.position=[+transformInputs[0].value,+transformInputs[1].value,+transformInputs[2].value];m.rotation=[0,+transformInputs[3].value*Math.PI/180,0];m.scale=+transformInputs[4].value;studio.setModelTransform(selectedModel,m.position,m.rotation,m.scale);};
  transformInputs.forEach(x=>x.addEventListener('input',applyTransform));categoryInput.addEventListener('change',()=>{if(selectedModel>=0){modelFiles[selectedModel].category=categoryInput.value;renderLibrary();}});
  $('#asset-animation').addEventListener('change',()=>{if(selectedModel>=0)studio.setModelAnimation(selectedModel,+($('#asset-animation') as HTMLSelectElement).value);});
  $('#asset-anim-play').addEventListener('click',()=>{if(selectedModel<0)return;animationPlaying=!animationPlaying;studio.setModelAnimationPlaying(selectedModel,animationPlaying);$('#asset-anim-play').textContent=animationPlaying?'アニメーション停止':'アニメーション再生';});
  $('#model-file').addEventListener('change', async event => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const category = categoryInput.value;
    try {
      if (file.name.toLowerCase().endsWith('.zip')) {
        $('#asset-status').textContent = 'ZIPを解析中...';
        message.textContent = 'ZIP内のモデルを検索しているよ。';
        const zip = await JSZip.loadAsync(file, { checkCRC32: true });
        const entries = Object.values(zip.files).filter(item => !item.dir && !item.name.startsWith('__MACOSX/') && !item.name.split('/').pop()?.startsWith('.'));
        const modelEntries = entries.filter(item => /\.(glb|gltf)$/i.test(item.name));
        if (!modelEntries.length) throw new Error('ZIP内にGLB/glTFモデルが見つからなかったよ。');
        const resourceBlobs = new Map<string, Blob>();
        const storedResources: { path: string; blob: Blob }[] = [];
        for (const entry of entries) {
          if (/\.(glb|gltf)$/i.test(entry.name)) continue;
          const blob = await entry.async('blob');
          storedResources.push({ path: entry.name, blob });
          resourceBlobs.set(entry.name, blob);
          const tail = entry.name.split('/').pop();
          if (tail) resourceBlobs.set(tail, blob);
        }
        const total = modelEntries.length;
        let completed = 0;
        let failures: string[] = [];
        const added: string[] = [];
        for (const entry of modelEntries) {
          const name = entry.name.split('/').pop() || entry.name;
          $('#asset-status').textContent = 'ZIP内モデル読み込み中 ' + (completed + 1) + ' / ' + total;
          try {
            const bytes = await entry.async('arraybuffer');
            const modelFile = new File([bytes], name, { type: name.toLowerCase().endsWith('.glb') ? 'model/gltf-binary' : 'model/gltf+json' });
            const modelResources = new Map<string, Blob>();
            const folder = entry.name.includes('/') ? entry.name.slice(0, entry.name.lastIndexOf('/') + 1) : '';
            // Resolve external glTF resources from the model's own directory first,
            // avoiding same-name textures from unrelated folders in large ZIP packs.
            const related = entries.filter(resourceEntry =>
              !/\.(glb|gltf)$/i.test(resourceEntry.name) &&
              folder && resourceEntry.name.startsWith(folder)
            );
            for (const resourceEntry of related) {
              const blob = resourceBlobs.get(resourceEntry.name);
              if (!blob) continue;
              modelResources.set(resourceEntry.name, blob);
              const relative = resourceEntry.name.slice(folder.length);
              modelResources.set(relative, blob);
              const tail = relative.split('/').pop();
              if (tail) modelResources.set(tail, blob);
            }
            // Fallback resources outside the model folder only when their basename
            // hasn't already been resolved locally.
            for (const resourceEntry of entries) {
              if (/\.(glb|gltf)$/i.test(resourceEntry.name)) continue;
              const blob = resourceBlobs.get(resourceEntry.name);
              if (!blob) continue;
              const tail = resourceEntry.name.split('/').pop();
              if (tail && !modelResources.has(tail)) modelResources.set(tail, blob);
            }
            await studio.loadModel(modelFile, modelResources, category);
            modelFiles.push({ name: modelFile.name, data: bytes, resources: storedResources, category, position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 });
            added.push(name);
          } catch (error) {
            failures.push(name + (error instanceof Error ? ' (' + error.message + ')' : ''));
          }
          completed++;
        }
        selectedModel = modelFiles.length ? modelFiles.length - 1 : -1;
        renderLibrary();
        selectAsset(selectedModel);
        $('#asset-status').textContent = 'ZIP読込完了：' + added.length + '件成功 / ' + failures.length + '件失敗';
        message.textContent = failures.length ? 'ZIP内' + total + '件中' + added.length + '件を追加。失敗したモデル：' + failures.join('、') : 'ZIP内の' + added.length + 'モデルをすべて素材ライブラリに追加したよ。';
      } else {
        const bytes = await file.arrayBuffer();
        await studio.loadModel(file, undefined, category);
        modelFiles.push({ name: file.name, data: bytes, category, position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 });
        selectedModel = modelFiles.length - 1;
        renderLibrary(); selectAsset(selectedModel);
        $('#asset-status').textContent = '素材登録：' + file.name;
        message.textContent = 'モデルを素材ライブラリに追加したよ。';
      }
    } catch (err) {
      $('#asset-status').textContent = 'ZIP / モデルの読み込みに失敗';
      message.textContent = err instanceof Error ? '読み込み失敗：' + err.message : '読み込み失敗';
    } finally { input.value = ''; }
  });
  $('#clear-models').addEventListener('click', () => {
    studio.clearImportedModels(); modelFiles = [];
    $('#asset-status').textContent = '読み込んだモデルはありません。';
  });

  const snapshot = (): ProjectData => ({
    version: 1, duration: 30, caption: caption.value, effect: currentEffect,
    scene: currentScene, models: modelFiles
  });
  $('#save-project').addEventListener('click', async () => {
    try { await saveProject(snapshot()); message.textContent = 'プロジェクトをこのiPhoneに保存したよ。'; }
    catch { message.textContent = '保存できなかったよ。空き容量とSafariの設定を確認してね。'; }
  });

  void readProject().then(async (saved) => {
    if (!saved || disposed) return;
    caption.value = saved.caption ?? '';
    currentEffect = saved.effect ?? 'none';
    currentScene = saved.scene ?? 0;
    studio.setScene(currentScene); studio.setEffect(currentEffect);
    root.querySelectorAll<HTMLButtonElement>('[data-scene]').forEach((item) => item.classList.toggle('selected', Number(item.dataset.scene) === currentScene));
    root.querySelectorAll<HTMLButtonElement>('[data-effect]').forEach((item) => item.classList.toggle('active', item.dataset.effect === currentEffect));
    for (const model of saved.models ?? []) {
      try {
        const resources = new Map<string, Blob>();
        for (const resource of model.resources ?? []) {
          resources.set(resource.path, resource.blob);
          const tail = resource.path.split('/').pop();
          if (tail) resources.set(tail, resource.blob);
        }
        await studio.loadModel(new File([model.data], model.name), resources.size ? resources : undefined, model.category ?? 'other');
        modelFiles.push(model);
      } catch { /* Keep the rest of the project usable if one asset is invalid. */ }
    }
    updateCaption();
    message.textContent = '前回のプロジェクトを復元したよ。';
  }).catch(() => { message.textContent = '保存済みプロジェクトを読み込めなかったよ。'; });

  $('#export-video').addEventListener('click', async () => {
    const button = $('#export-video') as HTMLButtonElement;
    if (!('MediaRecorder' in window) || !HTMLCanvasElement.prototype.captureStream) {
      message.textContent = 'このブラウザは動画録画に対応していないため、MP4を書き出せないよ。';
      return;
    }
    const mimeType = ['video/mp4;codecs=avc1.42E01E', 'video/mp4'].find((type) => MediaRecorder.isTypeSupported(type));
    if (!mimeType) {
      message.textContent = 'このiPhoneのSafariがMP4録画に対応していないみたい。別形式へ偽装せず停止したよ。';
      return;
    }
    const source = root.closest('.shell')?.querySelector<HTMLCanvasElement>('.scene-canvas');
    if (!source) { message.textContent = '3Dプレビューが見つからないよ。'; return; }
    button.disabled = true;
    message.textContent = '30秒の動画をリアルタイムで録画中。アプリを閉じずに待ってね。';
    studio.setTimelineTime(0); timeline.value = '0'; updateTime(); studio.setPlaying(true);
    playing = true;
    const output = document.createElement('canvas');
    output.width = 720; output.height = 1280;
    const context = output.getContext('2d');
    if (!context) { button.disabled = false; message.textContent = '動画用キャンバスを作れなかったよ。'; return; }
    const stream = output.captureStream(30);
    const chunks: BlobPart[] = [];
    let recorder: MediaRecorder;
    try { recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 }); }
    catch { stream.getTracks().forEach((track) => track.stop()); button.disabled = false; message.textContent = 'MP4録画を開始できなかったよ。'; return; }
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    recorder.onerror = () => { message.textContent = '録画中にエラーが発生したよ。'; button.disabled = false; stream.getTracks().forEach((track) => track.stop()); };
    recorder.onstop = () => {
      cancelAnimationFrame(exportFrame);
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunks, { type: 'video/mp4' });
      if (!blob.size) { message.textContent = '動画データが空だったため保存できなかったよ。'; button.disabled = false; return; }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = '3d-shorts-30sec.mp4'; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      message.textContent = `MP4を書き出したよ（${(blob.size / 1024 / 1024).toFixed(1)} MB）。ファイルアプリを確認してね。`;
      button.disabled = false;
    };
    const draw = () => {
      context.drawImage(source, 0, 0, 720, 1280);
      if (caption.value.trim()) {
        context.font = 'bold 42px -apple-system, sans-serif';
        context.textAlign = 'center'; context.textBaseline = 'middle';
        const text = caption.value.slice(0, 38);
        const y = 1120;
        context.lineWidth = 8; context.strokeStyle = 'rgba(0,0,0,.72)'; context.strokeText(text, 360, y, 650);
        context.fillStyle = '#ffffff'; context.fillText(text, 360, y, 650);
      }
      exportFrame = requestAnimationFrame(draw);
    };
    draw();
    recorder.start(1000);
    window.setTimeout(() => { if (recorder.state !== 'inactive') recorder.stop(); }, 30_000);
  });

  renderLibrary(); selectAsset(-1); updateCaption(); updateTime();
  return () => { disposed = true; cancelAnimationFrame(exportFrame); };
}
