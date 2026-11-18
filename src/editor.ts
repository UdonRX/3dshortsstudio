import type { StudioController } from './studio';

type ProjectData = {
  version: 1;
  duration: 30;
  caption: string;
  effect: string;
  scene: number;
  models: { name: string; data: ArrayBuffer }[];
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
      <input id="model-file" type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" hidden>
      <p id="asset-status" class="field-note">GLB推奨。外部テクスチャを参照するglTFは読み込めない場合があるよ。</p>
      <button id="clear-models" class="text-button" type="button">読み込んだモデルをすべて外す</button>
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
  let modelFiles: { name: string; data: ArrayBuffer }[] = [];

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
  $('#model-file').addEventListener('change', async (event) => {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      await studio.loadModel(file);
      modelFiles.push({ name: file.name, data: await file.arrayBuffer() });
      $('#asset-status').textContent = `読み込み済み：${file.name}`;
      message.textContent = '3Dモデルをシーンに追加したよ。';
    } catch (error) {
      message.textContent = error instanceof Error ? `読み込み失敗：${error.message}` : 'モデルを読み込めなかったよ。';
    }
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
        await studio.loadModel(new File([model.data], model.name));
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

  updateCaption(); updateTime();
  return () => { disposed = true; cancelAnimationFrame(exportFrame); };
}
