/**
 * PicSpeeder - UI Component & Loop Engine
 * Renders the circular progress, creates toolbars, and executes drawing loops.
 */

window.ImagePlayerUI = {
  progressCircle: null,

  // Generates the long-press radial progress loader
  showProgress(x, y, delay) {
    this.removeProgress();
    const circle = document.createElement('div');
    this.progressCircle = circle;
    circle.style.cssText = `position:fixed; left:${x-16}px; top:${y-16}px; width:32px; height:32px; z-index:9999999; pointer-events:none;`;
    circle.innerHTML = `
      <svg width="32" height="32" viewBox="0 0 32 32" style="transform: rotate(-90deg);">
        <circle cx="16" cy="16" r="11" stroke="rgba(255,255,255,0.4)" stroke-width="10" fill="none" />
        <circle cx="16" cy="16" r="11" stroke="#007bff" stroke-width="10" fill="none" stroke-linecap="round" stroke-dasharray="70" stroke-dashoffset="70" id="js-progress-bar" />
      </svg>
    `;
    document.body.appendChild(circle);
    const bar = circle.querySelector('#js-progress-bar');
    bar.style.transition = `stroke-dashoffset ${delay}ms linear`;
    requestAnimationFrame(() => bar.style.strokeDashoffset = '0');
  },

  removeProgress() {
    if (this.progressCircle) { this.progressCircle.remove(); this.progressCircle = null; }
  },

  // Creates or restores the playback control panel
  async create(imgElement) {
    const manager = window.ImagePlayer;
    const p = manager.getOrCreate(imgElement);

    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    const rect = imgElement.getBoundingClientRect();
    
    const posX = `${rect.left + scrollX}px`;
    const posY = `${rect.bottom + scrollY + 6}px`;

    const canvasAbsoluteLeft = rect.left + scrollX;
    const canvasAbsoluteTop = rect.top + scrollY;

    // Restore hidden toolbar if it already exists
    if (p.toolbar) {
      p.toolbar.style.left = posX;
      p.toolbar.style.top = posY;
      p.toolbar.style.display = 'flex';
      if (p.canvas) {
        p.canvas.style.left = `${canvasAbsoluteLeft}px`;
        p.canvas.style.top = `${canvasAbsoluteTop}px`;
        p.canvas.style.display = 'block';
      }
      return;
    }

    // Pre-render the empty toolbar frame immediately to show loading feedback
    const toolbar = document.createElement('div');
    p.toolbar = toolbar;
    
    // Set a placeholder min-size to make the empty bar look like a sleek loading bar
    toolbar.style.cssText = `position:absolute; z-index:999999; background:#222; color:#fff; padding:6px 12px; border-radius:6px; box-shadow:0 4px 15px rgba(0,0,0,0.5); display:flex; align-items:center; gap:8px; font-family:sans-serif; font-size:12px; user-select:none; box-sizing:border-box; min-width:180px; min-height:28px; transition: min-width 0.1s ease, min-height 0.1s ease;`;

    document.body.appendChild(toolbar);
    toolbar.style.left = posX;
    toolbar.style.top = posY;

    // Begin network fetch and data decoding in the background
    if (!(await manager.decode(imgElement)) || p.frames.length === 0) {
      // Clean up and discard the placeholder frame if decoding fails
      manager.reset(imgElement);
      return;
    }

    // Verify image format from MIME type
    const instanceData = manager.instances.get(imgElement);
    const lastMime = instanceData?.lastMimeType || '';
    const isTargetFormat = lastMime.includes('png') || lastMime.includes('gif') || lastMime.includes('webp') || lastMime.includes('avif');
    
    if (!isTargetFormat || p.frames.length <= 1) {
      // Discard the placeholder if the image is a single static frame or unsupported
      manager.reset(imgElement);
      return;
    }

    // Clear placeholder constraints once full build begins
    toolbar.style.minWidth = "0";
    toolbar.style.minHeight = "0";

    // CSS Sanitation Base - Overrides host website styles completely
    const resetBase = "box-sizing:border-box; margin:0; padding:0; border:none; background:none; color:inherit; font-family:sans-serif; font-size:12px; line-height:1; height:auto; width:auto; min-width:0; min-height:0; box-shadow:none; text-shadow:none; vertical-align:middle;";

    const canvas = document.createElement('canvas');
    p.canvas = canvas;
    canvas.style.cssText = `position: absolute; left: ${canvasAbsoluteLeft}px; top: ${canvasAbsoluteTop}px; width: ${rect.width}px; height: ${rect.height}px; pointer-events: none; z-index: 999998;`;
    canvas.classList.add('js-decoder-canvas');

    const btnClose = document.createElement('button');
    btnClose.innerText = '✕';
    btnClose.style.cssText = resetBase + `cursor:pointer; color:#ff4d4d; font-weight:bold; font-size:14px; margin-left:4px; padding:2px;`;
    
    btnClose.onclick = () => { 
      toolbar.style.display = 'none'; 
      canvas.style.display = 'none';
    };

    document.body.appendChild(canvas);

    // Draw the active bitmap onto the canvas overlay
    const render = () => {
      if (p.frames.length === 0) return;
      const ctx = canvas.getContext('2d');
      const f = p.frames[p.currentIdx];
      if (canvas.width !== f.bitmap.width) { canvas.width = f.bitmap.width; canvas.height = f.bitmap.height; }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(f.bitmap, 0, 0);
    };
    render();

    // Combined multiplication/division multiplier calculator
    const calcTotalSpeed = () => {
      return p.speed1 < 1.0 ? (p.speed1 / p.speed2) : (p.speed1 * p.speed2);
    };

    // Ultra-stable loop: books the next frame immediately to eliminate rendering overhead latencies
    const loop = () => {
      if (!p.isPlaying || p.frames.length === 0) return;
      const currentSpeed = calcTotalSpeed();
      const delay = p.frames[p.currentIdx].duration / currentSpeed;
      p.currentIdx = (p.currentIdx + 1) % p.frames.length;
      p.timerId = setTimeout(loop, delay);
      render();
      info.innerText = `${p.currentIdx === 0 ? p.frames.length : p.currentIdx} / ${p.frames.length}`;
    };

    // Unified button styling enforced with sanitation CSS
    const btnStyle = resetBase + "cursor:pointer; background:#444; padding:4px 8px; border-radius:4px; text-align:center; font-weight:500;";

    const btnPrev = document.createElement('button');
    btnPrev.innerText = '◀';
    btnPrev.style.cssText = btnStyle;
    btnPrev.onclick = () => { p.isPlaying = false; btnPlay.innerText = 'PLAY'; p.currentIdx = (p.currentIdx - 1 + p.frames.length) % p.frames.length; render(); info.innerText = `${p.currentIdx + 1} / ${p.frames.length}`; };

    const btnPlay = document.createElement('button');
    btnPlay.innerText = 'PAUSE'; 
      btnPlay.style.cssText = btnStyle + "color:#fff; width:55px;";
      btnPlay.onclick = () => { p.isPlaying = !p.isPlaying; if (p.isPlaying) { btnPlay.innerText = 'PAUSE'; btnPlay.style.cssText = btnStyle + "color:#fff; width:55px;"; loop(); }else{ btnPlay.innerText='PLAY'; btnPlay.style.cssText = btnStyle + "color:#fff; width:55px;";clearTimeout(p.timerId); }};

    const btnNext = document.createElement('button');
    btnNext.innerText = '▶';
    btnNext.style.cssText = btnStyle;
    btnNext.onclick = () => { p.isPlaying = false; btnPlay.innerText = 'PLAY'; p.currentIdx = (p.currentIdx + 1) % p.frames.length; render(); info.innerText = `${p.currentIdx + 1} / ${p.frames.length}`; };

    const info = document.createElement('span');
    info.innerText = `1 / ${p.frames.length}`;
    info.style.cssText = resetBase + "min-width:50px; text-align:center; display:inline-block;";

    const totalSpeed = document.createElement('span');
    totalSpeed.style.cssText = resetBase + "min-width:45px; font-weight:bold; color:#00ff00; display:inline-block;";
    
    // Updates multiplier tags dynamically
    const upTxt = () => {
      v1Span.innerText = `${p.speed1.toFixed(2)}x`;
      v2Span.innerText = p.speed1 < 1.0 ? ` / ${p.speed2}` : ` x ${p.speed2}`;
      totalSpeed.innerText = `${calcTotalSpeed().toFixed(3)}x`;
    };

    // Slider 1: Linear speed adjustment (0.1x to 2.0x)
    const s1Cont = document.createElement('div');
    s1Cont.style.cssText = resetBase + "display:flex; align-items:center; gap:4px;";
    const s1 = document.createElement('input');
    s1.type='range'; s1.min='0.1'; s1.max='2.0'; s1.step='0.05'; s1.value='1.0'; s1.style.cssText = "width:100px; margin:0; padding:0; vertical-align:middle;";
    const v1Span = document.createElement('span');
    v1Span.style.cssText = resetBase + "min-width:40px; color:#fff; display:inline-block;";
    s1.oninput = (e) => { p.speed1 = parseFloat(e.target.value); upTxt(); };
    s1Cont.append(s1, v1Span);

    // Slider 2: Stepped increments for multiplication/division jumps
    const s2Cont = document.createElement('div');
    s2Cont.style.cssText = resetBase + "display:flex; align-items:center; gap:2px;";
    const s2 = document.createElement('input');
    const steps =[1, 2, 3, 4, 5, 8, 16, 32];
    s2.type='range'; s2.min='0'; s2.max=String(steps.length-1); s2.step='1'; s2.value='0'; s2.style.cssText = "width:50px; margin:0; padding:0; vertical-align:middle;";
    const v2Span = document.createElement('span');
    v2Span.style.cssText = resetBase + "min-width:25px; color:#fff; margin-right:4px; display:inline-block;";
    s2.oninput = (e) => { p.speed2 = steps[parseInt(e.target.value)]; upTxt(); };
    s2Cont.append(s2, v2Span);

    upTxt(); 

    toolbar.append(btnPrev, btnPlay, btnNext, info, s1Cont, s2Cont, totalSpeed, btnClose);

    p.isPlaying = true;
    loop();
  }
};
