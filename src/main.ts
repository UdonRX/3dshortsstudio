import './style.css';
import { createStudio } from './studio';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('アプリの起動領域が見つかりません。');

root.innerHTML = `
  <main class="shell">
    <header class="topbar">
      <a class="brand" href="./" aria-label="3D Shorts Studio ホーム">
        <span class="brand-mark"><span></span><span></span><span></span></span>
        <span>3D SHORTS <b>STUDIO</b></span>
      </a>
      <div class="phase-pill"><i></i> PHASE 01</div>
    </header>

    <section class="intro">
      <div class="eyebrow">YOUR POCKET 3D WORKFLOW</div>
      <h1>アイデアを、<span>3Dの世界へ。</span></h1>
      <p>iPhoneの中で動く、ショート動画制作スタジオ。</p>
    </section>

    <section class="workspace" aria-label="3Dプレビュー">
      <div class="preview-head">
        <div><span class="live-dot"></span><span>SCENE PREVIEW</span></div>
        <span class="ratio">9:16 VERTICAL</span>
      </div>
      <div class="preview-frame">
        <div class="scene-label"><span>SCENE 01</span><b>THE FIRST WALK</b></div>
        <div id="scene-mount" class="scene-mount"></div>
        <div class="preview-vignette"></div>
        <div class="preview-footer"><span>PROCEDURAL 3D</span><span id="render-state">準備中...</span></div>
        <div id="scene-error" class="scene-error" hidden></div>
      </div>
      <div class="preview-controls">
        <button id="play-toggle" class="control-button primary" type="button">
          <span class="play-icon">Ⅱ</span><span>一時停止</span>
        </button>
        <button id="camera-reset" class="control-button" type="button">
          <span class="reset-icon">↻</span><span>カメラを戻す</span>
        </button>
        <div class="fps-readout"><b id="fps-value">--</b><span>FPS</span></div>
      </div>
      <p class="gesture-hint">画面を上下左右にドラッグして、3Dシーンを見回せるよ</p>
    </section>

    <section class="status-grid" aria-label="動作状況">
      <article class="status-card">
        <span class="status-icon">◈</span>
        <div><small>3D ENGINE</small><b id="webgl-status">確認中</b></div>
      </article>
      <article class="status-card">
        <span class="status-icon">▣</span>
        <div><small>DISPLAY</small><b>9:16 PORTRAIT</b></div>
      </article>
      <article class="status-card">
        <span class="status-icon">⌁</span>
        <div><small>SCENE DATA</small><b>LOCAL / PROCEDURAL</b></div>
      </article>
    </section>

    <section class="next-section">
      <div class="section-heading"><div><span class="eyebrow">DEVELOPMENT ROADMAP</span><h2>制作機能を、順番に。</h2></div><span class="roadmap-count">01 / 06</span></div>
      <div class="roadmap">
        <div class="roadmap-item active"><span class="step-number">01</span><div><b>3Dプレビュー基盤</b><small>iPhone表示・シーン描画・操作</small></div><span class="step-state">NOW</span></div>
        <div class="roadmap-item"><span class="step-number">02</span><div><b>素材・キャラクター</b><small>モデル読み込み・素材ライブラリ</small></div><span class="step-state">NEXT</span></div>
        <div class="roadmap-item"><span class="step-number">03</span><div><b>AIシナリオ生成</b><small>プロンプトからシーン設計</small></div><span class="step-state">LATER</span></div>
        <div class="roadmap-item"><span class="step-number">04</span><div><b>アニメーション・演出</b><small>動き・カメラ・エフェクト</small></div><span class="step-state">LATER</span></div>
        <div class="roadmap-item"><span class="step-number">05</span><div><b>音声・字幕</b><small>ナレーション・BGM・テロップ</small></div><span class="step-state">LATER</span></div>
        <div class="roadmap-item"><span class="step-number">06</span><div><b>動画書き出し</b><small>iPhone内でMP4生成・保存</small></div><span class="step-state">LATER</span></div>
      </div>
    </section>

    <footer class="footer"><span>3D SHORTS STUDIO</span><span>BUILT FOR iPHONE</span></footer>
  </main>
`;

const mount = document.querySelector<HTMLDivElement>('#scene-mount')!;
const status = document.querySelector<HTMLElement>('#render-state')!;
const error = document.querySelector<HTMLDivElement>('#scene-error')!;
const fps = document.querySelector<HTMLElement>('#fps-value')!;
const webglStatus = document.querySelector<HTMLElement>('#webgl-status')!;
const playButton = document.querySelector<HTMLButtonElement>('#play-toggle')!;
const resetButton = document.querySelector<HTMLButtonElement>('#camera-reset')!;

try {
  const studio = createStudio(mount, {
    onReady: () => {
      status.textContent = '描画中';
      webglStatus.textContent = 'WEBGL 2 / READY';
    },
    onFps: (value) => { fps.textContent = String(value); },
    onError: (message) => {
      status.textContent = 'エラー';
      webglStatus.textContent = '利用不可';
      error.hidden = false;
      error.textContent = message;
    }
  });

  playButton.addEventListener('click', () => {
    const playing = studio.togglePlayback();
    playButton.innerHTML = playing
      ? '<span class="play-icon">Ⅱ</span><span>一時停止</span>'
      : '<span class="play-icon">▶</span><span>再生</span>';
  });
  resetButton.addEventListener('click', () => studio.resetCamera());

  window.addEventListener('pagehide', () => studio.dispose(), { once: true });
} catch (cause) {
  const message = cause instanceof Error ? cause.message : '3Dエンジンを起動できませんでした。';
  status.textContent = '起動失敗';
  webglStatus.textContent = '利用不可';
  error.hidden = false;
  error.textContent = message;
}
