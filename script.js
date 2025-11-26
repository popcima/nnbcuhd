// Default sample data (kept as fallbacks). These will be replaced
// by parsed contents of `data.json` if the file is present and valid.
let leagues = [
  { id: 'prem', name: 'Premier League' },
  { id: 'seriea', name: 'Serie A' },
  { id: 'bund', name: 'Bundesliga' },
  { id: 'laliga', name: 'La Liga' },
  { id: 'ucl', name: 'UEFA Champions League' },
  { id: 'f1', name: 'Formula 1' },
];

let sampleEvents = [
  {
    id: 'E1',
    leagueId: 'prem',
    league: 'Premier League',
    time: 'Oct 5, 14:00',
    home: { name: 'Leeds', badgeColor: '#2d6cdf' },
    away: { name: 'Tottenham', badgeColor: '#e7eaf0' },
    isLive: true,
  },
  {
    id: 'E2',
    leagueId: 'champ',
    league: 'Championship',
    time: 'Oct 5, 12:30',
    home: { name: 'Hull City', badgeColor: '#f4a300' },
    away: { name: 'Sheffield Utd', badgeColor: '#e63946' },
    isLive: false,
  },
  {
    id: 'E3',
    leagueId: 'f1',
    league: 'Formula-1',
    time: 'Oct 5, 14:00',
    title: 'Singapore Grand Prix',
    isLive: true,
  },
  {
    id: 'E4',
    leagueId: 'prem',
    league: 'Premier League',
    time: 'Oct 4, 12:30',
    home: { name: 'Wolves', badgeColor: '#e09600' },
    away: { name: 'Brighton', badgeColor: '#00a3ff' },
    isLive: false,
  },
];

let channels = [
  { id: 'C1', name: 'Sky Sports Main Event', category: 'Sports' },
  { id: 'C2', name: 'BT Sport 1', category: 'Sports' },
  { id: 'C3', name: 'ESPN', category: 'Sports' },
  { id: 'C4', name: 'Fox Sports', category: 'Sports' },
  { id: 'C5', name: 'DAZN 1', category: 'Sports' },
  { id: 'C6', name: 'Eurosport 1', category: 'Sports' },
  { id: 'C7', name: 'BBC One', category: 'General' },
  { id: 'C8', name: 'ITV', category: 'General' },
];

// Attempt to load data from `data.json` and map it to the structures above.
async function loadDataJson() {
  try {
    const res = await fetch('./data.json');
    if (!res.ok) throw new Error('data.json not found');
    const raw = await res.json();

    // Map LiveEvents -> sampleEvents format
    if (Array.isArray(raw.LiveEvents) && raw.LiveEvents.length) {
      const mapped = raw.LiveEvents.map((ev, i) => {
        // ev expected keys in data.json: Tim1Name, Tim2Name, Tim1Image, Tim2Image, EventTime, CategoryName, StreamingLinks
        const hasTeams = ev.Tim1Name || ev.Tim2Name;
        const id = ev.id || `J${i + 1}`;
        const leagueId = (ev.CategoryName || 'other').toString().toLowerCase().replace(/\s+/g, '-');
        const league = ev.CategoryName || leagueId;
        const time = ev.EventTime || '';
        const home = hasTeams ? { name: ev.Tim1Name || '', badgeColor: ev.Tim1Image || '' } : undefined;
        const away = hasTeams ? { name: ev.Tim2Name || '', badgeColor: ev.Tim2Image || '' } : undefined;
        const title = ev.Title || ev.EventTitle || (!hasTeams && ev.EventTime ? ev.EventTime : undefined);
        const isLive = !!ev.IsLive || !!ev.isLive || false;
        return { id, leagueId, league, time, home, away, title, isLive };
      });
      // Only replace if mapping produced items
      if (mapped.length) sampleEvents = mapped;

      // Build leagues solely from the loaded LiveEvents categories
      const categories = new Map();
      for (const e of mapped) {
        if (e.leagueId) categories.set(e.leagueId, e.league || e.leagueId);
      }
      if (categories.size) {
        leagues = Array.from(categories.entries()).map(([id, name]) => ({ id, name }));
      }
    }

    // Map LiveChannels -> channels format
    if (Array.isArray(raw.LiveChannels) && raw.LiveChannels.length) {
      const mappedChannels = raw.LiveChannels.map((ch, i) => {
        const id = ch.id || `CH${i + 1}`;
        const name = ch.ChannelName || ch.name || `Channel ${i + 1}`;
        const category = ch.CategoryName || ch.Category || 'General';
        const image = ch.ChannelImage || ch.image || '';
        return { id, name, category, image };
      });
      if (mappedChannels.length) channels = mappedChannels;
    }

    // Rebuild leagues list based on available event categories
    const known = new Map(leagues.map(l => [l.id, l.name]));
    for (const e of sampleEvents) {
      if (e.leagueId && !known.has(e.leagueId)) known.set(e.leagueId, e.league || e.leagueId);
    }
    leagues = Array.from(known.entries()).map(([id, name]) => ({ id, name }));
  } catch (err) {
    // If fetch fails, silently keep sample data as fallback.
    // (This keeps the app usable in file:// or when data.json is missing.)
    // console.warn('Could not load data.json — using sample data.', err);
  }
}

// Setup chips container (leagues list will be built from data.json during init)
const chipsContainer = document.getElementById('leagueChips');

function renderChips() {
  chipsContainer.innerHTML = '';
  const allChip = document.createElement('button');
  allChip.className = 'chip';
  allChip.textContent = 'All';
  allChip.setAttribute('aria-pressed', 'true');
  allChip.dataset.filter = 'all';
  chipsContainer.appendChild(allChip);

  for (const lg of leagues) {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.textContent = lg.name;
    chip.dataset.filter = lg.id;
    chipsContainer.appendChild(chip);
  }
}

function badge(color) {
  const span = document.createElement('span');
  span.className = 'badge';
  const v = color || '';
  // If value looks like an image URL, use it as background-image
  if (/^https?:\/\//i.test(v) || /\.(png|jpe?g|gif|svg)(\?|$)/i.test(v)) {
    span.style.backgroundImage = `url("${v}")`;
    span.style.backgroundSize = 'cover';
    span.style.backgroundPosition = 'center';
  } else if (v) {
    // treat as color
    span.style.background = v;
  } else {
    span.style.background = '#2a3b4d';
  }
  return span;
}

function teamMarkup(team) {
  const row = document.createElement('div');
  row.className = 'team';
  row.appendChild(badge(team.badgeColor));
  const name = document.createElement('div');
  name.textContent = team.name;
  row.appendChild(name);
  return row;
}

function renderEvents(filter = 'all', query = '') {
  const list = document.getElementById('eventsList');
  list.innerHTML = '';
  const q = query.trim().toLowerCase();

  const filtered = sampleEvents.filter(e =>
    (filter === 'all' || e.leagueId === filter)
    && (
      !q ||
      (e.title && e.title.toLowerCase().includes(q)) ||
      (e.home && e.home.name.toLowerCase().includes(q)) ||
      (e.away && e.away.name.toLowerCase().includes(q)) ||
      (e.league && e.league.toLowerCase().includes(q))
    )
  );

  let itemCount = 0;
  for (const e of filtered) {
    const card = document.createElement('article');
    card.className = 'card';
    card.addEventListener('click', () => {
      window.location.href = `watch.html?event=${encodeURIComponent(e.id)}`;
    });

    // Calculate if event is live or scheduled based on EventTime
    const now = new Date();
    const eventTime = new Date(e.time);
    const timeDiff = eventTime - now;
    const isLive = timeDiff <= 0 && timeDiff > -3 * 60 * 60 * 1000; // Live if started and within last 3 hours
    const isScheduled = timeDiff > 0; // Scheduled if in the future

    // Top row with status badge and calendar icon
    const top = document.createElement('div');
    top.className = 'card-top';
    
    const statusBadge = document.createElement('span');
    statusBadge.className = isLive ? 'badge-live' : 'badge-scheduled';
    statusBadge.textContent = isLive ? 'LIVE' : 'SCHEDULED';
    top.appendChild(statusBadge);
    
    // Only show calendar icon if event is scheduled (not live)
    if (isScheduled) {
      const calendarIcon = document.createElement('span');
      calendarIcon.className = 'calendar-icon';
      calendarIcon.innerHTML = '🔴';
      top.appendChild(calendarIcon);
    }
    
    card.appendChild(top);

    // Teams section with logos and play button
    const teamsWrapper = document.createElement('div');
    teamsWrapper.className = 'teams-wrapper';
    
    if (e.home && e.away) {
      const team1Logo = badge(e.home.badgeColor);
      teamsWrapper.appendChild(team1Logo);
      
      const playBtn = document.createElement('div');
      playBtn.className = 'play-button';
      playBtn.innerHTML = '▶';
      teamsWrapper.appendChild(playBtn);
      
      const team2Logo = badge(e.away.badgeColor);
      teamsWrapper.appendChild(team2Logo);
    } else {
      const only = document.createElement('div');
      only.textContent = e.title || 'Event';
      teamsWrapper.appendChild(only);
    }
    card.appendChild(teamsWrapper);

    // Title
    const title = document.createElement('div');
    title.className = 'card-title';
    if (e.home && e.away) {
      title.textContent = `${e.home.name} vs ${e.away.name}`;
    } else {
      title.textContent = e.title || 'Event';
    }
    card.appendChild(title);

    // Meta info
    const meta = document.createElement('div');
    meta.className = 'card-meta';
    meta.textContent = `${e.league || ''} | ${eventTime.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}`;
    card.appendChild(meta);

    // Scheduled info (bottom)
    const scheduledInfo = document.createElement('div');
    scheduledInfo.className = 'scheduled-info';
    const statusText = isLive ? 'LIVE' : 'SCHEDULED';
    const dateText = eventTime.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
    scheduledInfo.innerHTML = `📅 ${statusText} | ${dateText}`;
    card.appendChild(scheduledInfo);

    list.appendChild(card);
    itemCount++;

    // Insert ad banner after every 3rd item
    if (itemCount % 3 === 0) {
      const adContainer = document.createElement('div');
      adContainer.className = 'ad-banner-container';
      adContainer.innerHTML = `
        <script async="async" data-cfasync="false" src="//ancestorheadquarters.com/1b8817f4d9bcec9e9e34e22f441fe807/invoke.js"></script>
        <div id="container-1b8817f4d9bcec9e9e34e22f441fe807"></div>
      `;
      list.appendChild(adContainer);
    }
  }
}

function renderChannels(query = '') {
  const grid = document.getElementById('channelsGrid');
  grid.innerHTML = '';
  const q = query.trim().toLowerCase();
  const filtered = channels.filter(c => !q || c.name.toLowerCase().includes(q));

  for (const c of filtered) {
    const item = document.createElement('article');
    item.className = 'channel';
    item.style.cursor = 'pointer';
    
    // Make entire card clickable
    item.addEventListener('click', () => {
      const name = encodeURIComponent(c.name);
      window.location.href = `./watch.html?channel=${name}`;
    });

    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    
    // Add channel image if available
    if (c.image) {
      thumb.style.backgroundImage = `url("${c.image}")`;
      thumb.style.backgroundSize = 'contain';
      thumb.style.backgroundPosition = 'center';
      thumb.style.backgroundRepeat = 'no-repeat';
    }
    
    item.appendChild(thumb);

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = c.name;
    item.appendChild(name);

    const row = document.createElement('div');
    row.className = 'row';
    const cat = document.createElement('span');
    cat.style.color = '#9fb0c0';
    cat.textContent = c.category;
    row.appendChild(cat);

    item.appendChild(row);
    grid.appendChild(item);
  }
}

function setupTabs() {
  const buttons = Array.from(document.querySelectorAll('.nav-btn'));
  const panels = Array.from(document.querySelectorAll('.tab-panel'));
  function activate(targetSel) {
    for (const b of buttons) {
      const isActive = b.dataset.target === targetSel;
      b.classList.toggle('active', isActive);
      b.setAttribute('aria-selected', String(isActive));
    }
    for (const p of panels) {
      const isActive = '#' + p.id === targetSel;
      p.hidden = !isActive;
      p.classList.toggle('active', isActive);
    }
  }
  buttons.forEach(b => b.addEventListener('click', () => activate(b.dataset.target)));
}

function setupFilters() {
  chipsContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    for (const c of chipsContainer.querySelectorAll('.chip')) c.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-pressed', 'true');
    renderEvents(btn.dataset.filter);
  });
}

async function init() {
  await loadDataJson?.();
  renderChips();
  renderEvents('all');
  renderChannels();
  setupTabs();
  setupFilters();
}

document.addEventListener('DOMContentLoaded', init);