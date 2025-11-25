// watch.js — loads data.json, finds the target event/channel, and builds a player UI
// Plyr player instance will be created once during init
let player = null;
const serverList = document.getElementById('serverList');
const titleEl = document.getElementById('playerTitle');
const noStreams = document.getElementById('noStreams');


let hlsInstance = null;

// Global state for stream tracking, retry logic, and overlays
let currentStreams = [];
let currentServerIndex = -1;
let currentUrl = null;
let retryCount = 0;
const MAX_RETRY = 3;

let loadingOverlay = null;
let unmuteOverlay = null;
let hasUnmuted = false;

function showStatus(msg, isError = false) {
  try {
    const el = document.getElementById('playerStatus');
    if (el) {
      el.textContent = msg;
      el.style.color = isError ? 'var(--danger)' : 'var(--muted)';
    }
  } catch (e) { /* ignore */ }
  console.log('watch.status:', msg);
}

// Overlay helpers
function ensureOverlayStyles() {
  if (document.getElementById('fstv-overlay-styles')) return;
  const style = document.createElement('style');
  style.id = 'fstv-overlay-styles';
  style.textContent = `
    .fstv-overlay {
      position: absolute;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.45);
      z-index: 99998;
      pointer-events: none;
    }
    .fstv-spinner {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      border: 3px solid rgba(255,255,255,0.2);
      border-top-color: #ff7a00;
      animation: fstv-spin 0.8s linear infinite;
    }
    .fstv-unmute-badge {
      position: absolute;
      bottom: 16px;
      left: 16px;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(0,0,0,0.7);
      color: #fff;
      font-size: 11px;
      display: none;
      align-items: center;
      gap: 6px;
      z-index: 99999;
      cursor: pointer;
      pointer-events: auto;
    }
    .fstv-unmute-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #ff7a00;
    }
    @keyframes fstv-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}

function createLoadingOverlay(frame) {
  if (!frame || loadingOverlay) return;
  loadingOverlay = document.createElement('div');
  loadingOverlay.className = 'fstv-overlay';
  const spinner = document.createElement('div');
  spinner.className = 'fstv-spinner';
  loadingOverlay.appendChild(spinner);
  frame.appendChild(loadingOverlay);
}

function createUnmuteOverlay(frame) {
  if (!frame || unmuteOverlay) return;
  unmuteOverlay = document.createElement('div');
  unmuteOverlay.className = 'fstv-unmute-badge';
  const dot = document.createElement('div');
  dot.className = 'fstv-unmute-dot';
  const text = document.createElement('div');
  text.textContent = 'Tap to unmute';
  unmuteOverlay.appendChild(dot);
  unmuteOverlay.appendChild(text);
  unmuteOverlay.addEventListener('click', () => {
    try {
      if (player) {
        player.muted = false;
        hasUnmuted = true;
        player.play().catch(() => {});
      }
    } catch (e) {}
    if (unmuteOverlay) unmuteOverlay.style.display = 'none';
  });
  frame.appendChild(unmuteOverlay);
}

function showLoading(show) {
  if (!loadingOverlay) return;
  loadingOverlay.style.display = show ? 'flex' : 'none';
}

function showUnmute(show) {
  if (!unmuteOverlay) return;
  if (hasUnmuted) {
    unmuteOverlay.style.display = 'none';
    return;
  }
  unmuteOverlay.style.display = show ? 'flex' : 'none';
}

function clearHls() {
  if (hlsInstance) {
    try { hlsInstance.destroy(); } catch (e) {}
    hlsInstance = null;
  }
}


function handleStreamError(reason) {
  console.warn('Stream error:', reason);

  // If no stream loaded
  if (!currentUrl) {
    showStatus('Stream error: ' + reason, true);
    showLoading(false);
    return;
  }

  // Retry up to MAX_RETRY times
  if (retryCount < MAX_RETRY) {
    retryCount++;
    showStatus('Retrying (' + retryCount + '/' + MAX_RETRY + ')...', true);
    showLoading(true);

    const retryUrl = currentUrl;
    setTimeout(() => {
      playSource(retryUrl);
    }, 2000);
    return;
  }

  // After MAX_RETRY attempts fail
  showStatus('Stream failed after ' + MAX_RETRY + ' retries.', true);
  showLoading(false);
}

function playSource(url) {
  if (!url || !player) return;
  clearHls();
  currentUrl = url;
  showLoading(true);

  const isM3u8 = /\.m3u8(\?|$)/i.test(url);

  // For HLS streams, use hls.js
  if (isM3u8 && window.Hls && Hls.isSupported()) {
    hlsInstance = new Hls();
    hlsInstance.loadSource(url);
    hlsInstance.attachMedia(player.media);
    hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
      player.play().catch(() => {});
    });
    hlsInstance.on(Hls.Events.ERROR, (event, data) => {
      if (data && data.fatal) {
        handleStreamError(data.type + ':' + data.details);
      }
    });
  } else {
    // For native video or non-HLS streams
    player.source = {
      type: 'video',
      sources: [{ src: url, type: isM3u8 ? 'application/x-mpegURL' : 'video/mp4' }]
    };
    player.play().catch(() => {});
  }
}


function createServerButton(name, url, index) {
  const btn = document.createElement('button');
  btn.className = 'server-btn';
  btn.textContent = name || url;
  btn.dataset.index = index;
  btn.addEventListener('click', () => {
    playSourceForIndex(index);
  });
  return btn;
}

function setActiveServerButton(index) {
  const buttons = serverList.querySelectorAll('.server-btn');
  buttons.forEach((b, i) => {
    if (i === index) b.classList.add('active');
    else b.classList.remove('active');
  });
}

function playSourceForIndex(index) {
  if (!currentStreams || !currentStreams.length) return;
  if (index < 0 || index >= currentStreams.length) {
    showStatus('All servers failed. Please try again later.', true);
    showLoading(false);
    return;
  }
  currentServerIndex = index;
  retryCount = 0;
  const s = currentStreams[index];
  const url = (s && (s.ServerLink || s.link || '') || '').trim();
  if (!url) {
    playSourceForIndex(index + 1);
    return;
  }
  setActiveServerButton(index);
  const name = s.ServerName || 'Server ' + (index + 1);
  showStatus('Connecting to ' + name + '...');
  playSource(url);
}

async function init() {
  const params = new URLSearchParams(location.search);
  // support '?event=E1' or '?id=E1' and '?channel=ChannelName'
  const id = params.get('event') || params.get('id');
  const channelParamRaw = params.get('channel') || params.get('channelName');
  const channelParam = channelParamRaw ? decodeURIComponent(channelParamRaw).trim().toLowerCase() : null;

  let data = null;
  try {
    const res = await fetch('./data.json');
    data = await res.json();
  } catch (e) {
    titleEl.textContent = 'Could not load data.json';
    showStatus('Failed to load data.json: ' + (e && e.message));
    return;
  }

  try {
    const videoEl = document.getElementById('player');
    if (!videoEl) {
      showStatus('Player element not found', true);
      return;
    }

    const frame = videoEl.closest('.player-frame') || videoEl.parentElement;
    if (frame && !frame.style.position) {
      frame.style.position = 'relative';
    }
    ensureOverlayStyles();
    createLoadingOverlay(frame);
    createUnmuteOverlay(frame);

    // Initialize Plyr instance (single instance)
    player = new Plyr(videoEl, {
      controls: [
        'play-large',
        'play',
        'mute',
        'volume',
        'progress',
        'current-time',
        'captions',
        'settings',
        'fullscreen'
      ],
      settings: ['quality', 'speed']
    });

    // Autoplay, start muted for mobile autoplay policy, and show loading + unmute hints
    player.on('ready', () => {
      try {
        player.muted = true;
        showLoading(true);
        showUnmute(true);
        player.play().catch(() => {});
      } catch (e) {}
    });

    player.on('playing', () => {
      showLoading(false);
      showUnmute(true);
    });

    player.on('pause', () => {
      showLoading(false);
    });

    player.on('waiting', () => {
      showLoading(true);
    });

    player.on('ended', () => {
      showLoading(false);
      showUnmute(false);
    });

    player.on('volumechange', () => {
      try {
        if (!player.muted) {
          hasUnmuted = true;
          showUnmute(false);
        }
      } catch (e) {}
    });

    if (player && player.media) {
      player.media.addEventListener('error', () => handleStreamError('html5 error'));
      player.media.addEventListener('stalled', () => handleStreamError('stalled'));
    }
  } catch (err) {
    console.error('Player initialization failed', err);
    showStatus('Player initialization failed: ' + (err && err.message), true);
    return;
  }
  showStatus('Player ready');

  let item = null;
  if (id) {
    item = (data.LiveEvents || []).find(x => x.id === id) || (data.LiveChannels || []).find(x => x.id === id);
  }
  // if a channel param was provided, try to find channel by name (case-insensitive)
  if (!item && channelParam) {
    const needle = channelParam.toLowerCase();
    // try exact match first, then substring
    item = (data.LiveChannels || []).find(c => (c.ChannelName || c.Channel || '').toLowerCase() === needle);
    if (!item) {
      item = (data.LiveChannels || []).find(c => (c.ChannelName || c.Channel || '').toLowerCase().includes(needle));
    }
  }

  if (!item) {
    titleEl.textContent = 'Select a stream to play';
    // show a short selectable list of events/channels so user can click through
    const listWrap = document.createElement('div');
    listWrap.style.marginTop = '12px';
    const header = document.createElement('div'); header.textContent = 'Events'; header.style.marginBottom = '6px'; header.style.color = 'var(--muted)';
    listWrap.appendChild(header);
    const ul = document.createElement('div');
    ul.style.display = 'grid'; ul.style.gap = '8px';
    for (const ev of (data.LiveEvents || [])) {
      const a = document.createElement('a');
      a.href = `./watch.html?event=${encodeURIComponent(ev.id)}`;
      a.textContent = `${ev.Tim1Name || ''}${ev.Tim2Name ? ' vs ' + ev.Tim2Name : ''} — ${ev.CategoryName || ''}`;
      a.className = 'chip';
      a.style.display = 'inline-block';
      ul.appendChild(a);
    }
    listWrap.appendChild(ul);
    serverList.appendChild(listWrap);
    showStatus('No event selected — choose one from the list');
    return;
  }

  // found item — show title and servers
  const nameParts = [];
  if (item.Tim1Name) nameParts.push(item.Tim1Name);
  if (item.Tim2Name) nameParts.push('vs', item.Tim2Name);
  titleEl.textContent = nameParts.length ? nameParts.join(' ') : (item.ChannelName || item.title || item.EventTime || 'Stream');

  const streams = (item.StreamingLinks || []).filter(s => (s.ServerLink || s.link || '').trim());
  serverList.innerHTML = '';
  if (!streams.length) {
    noStreams.style.display = 'block';
    const hint = document.createElement('div');
    hint.style.color = 'var(--muted)';
    hint.textContent = 'No valid stream URLs found in the data for this item.';
    serverList.appendChild(hint);
    showStatus('No valid stream URLs found for this item', true);
    return;
  }
  noStreams.style.display = 'none';

  currentStreams = streams;

  // create buttons
  const header = document.createElement('div'); header.textContent = 'Available servers'; header.style.marginBottom = '8px'; header.style.color = 'var(--muted)';
  serverList.appendChild(header);

  let idx = 0;
  for (const s of currentStreams) {
    const name = s.ServerName || 'Server';
    const url = s.ServerLink || s.link || '';
    const btn = createServerButton(name, url, idx);
    serverList.appendChild(btn);
    idx++;
  }

  // autoplay first server
  if (currentStreams.length) {
    playSourceForIndex(0);
  }
}

document.addEventListener('DOMContentLoaded', init);
window.addEventListener('beforeunload', () => {
  try { if (player && player.destroy) player.destroy(); } catch(e){}
  try { clearHls(); } catch(e){}
});
