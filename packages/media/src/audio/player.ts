/** See docs/plans/audio-player-customization-todo.md — theme/waveform are intentionally not configurable yet. */

export type AudioPlayerInput = {
  title: string;
  artist?: string;
  audioUrl: string;
  coverUrl?: string;
};

export function buildAudioPlayerHtml(input: AudioPlayerInput): string {
  const title = escapeHtml(input.title || 'Untitled');
  const artist = input.artist ? escapeHtml(input.artist) : '';
  const audioUrl = escapeHtml(input.audioUrl);
  const coverUrl = input.coverUrl ? escapeHtml(input.coverUrl) : '';
  const coverStyle = coverUrl
    ? `background-image:url('${coverUrl}');background-size:cover;background-position:center;`
  : 'background:linear-gradient(135deg,#1a1a1a,#0d0d0d);';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}${artist ? ` — ${artist}` : ''}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; background: #050505; color: #f4f4f4; }
  .card { width: min(100%, 440px); border: 1px solid #2c2c2c; border-radius: 14px; overflow: hidden; background: #111; }
  .art { height: 220px; ${coverStyle} }
  .body { padding: 18px 20px 22px; }
  h1 { margin: 0; font-size: 1.125rem; font-weight: 600; line-height: 1.35; }
  p.artist { margin: 6px 0 0; font-size: 0.875rem; color: #9a9a9a; }
  .controls { margin-top: 18px; display: flex; align-items: center; gap: 12px; }
  button.play { width: 42px; height: 42px; border: 0; border-radius: 999px; background: #f4f4f4; color: #111; font-size: 1rem; cursor: pointer; flex-shrink: 0; }
  button.play:disabled { opacity: 0.4; cursor: not-allowed; }
  input.seek { flex: 1; accent-color: #f4f4f4; }
  .times { display: flex; justify-content: space-between; margin-top: 6px; font-size: 0.75rem; color: #8a8a8a; font-variant-numeric: tabular-nums; }
  audio { display: none; }
</style>
</head>
<body>
  <div class="card">
    <div class="art" role="img" aria-label="Cover art"></div>
    <div class="body">
      <h1>${title}</h1>
      ${artist ? `<p class="artist">${artist}</p>` : ''}
      <div class="controls">
        <button type="button" class="play" id="play" aria-label="Play or pause">▶</button>
        <input type="range" class="seek" id="seek" min="0" max="1000" value="0" aria-label="Seek" />
      </div>
      <div class="times"><span id="cur">0:00</span><span id="dur">0:00</span></div>
      <audio id="audio" preload="metadata" src="${audioUrl}"></audio>
    </div>
  </div>
  <script>
    (function () {
      const audio = document.getElementById('audio');
      const play = document.getElementById('play');
      const seek = document.getElementById('seek');
      const cur = document.getElementById('cur');
      const dur = document.getElementById('dur');
      if (!audio || !play || !seek || !cur || !dur) return;
      function fmt(s) {
        if (!Number.isFinite(s) || s < 0) return '0:00';
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return m + ':' + String(sec).padStart(2, '0');
      }
      function sync() {
        const d = audio.duration;
        dur.textContent = fmt(d);
        if (Number.isFinite(d) && d > 0) seek.value = String(Math.floor((audio.currentTime / d) * 1000));
        cur.textContent = fmt(audio.currentTime);
        play.textContent = audio.paused ? '▶' : '❚❚';
      }
      play.addEventListener('click', function () {
        if (audio.paused) audio.play().catch(function () {});
        else audio.pause();
      });
      seek.addEventListener('input', function () {
        if (!Number.isFinite(audio.duration)) return;
        audio.currentTime = (Number(seek.value) / 1000) * audio.duration;
      });
      audio.addEventListener('timeupdate', sync);
      audio.addEventListener('loadedmetadata', sync);
      audio.addEventListener('play', sync);
      audio.addEventListener('pause', sync);
      sync();
    })();
  </script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}