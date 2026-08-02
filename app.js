const SPOTIFY_AUTHORIZE = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN = "https://accounts.spotify.com/api/token";
const API_BASE = "https://api.spotify.com/v1";
const SONG_COUNT = 32;
const TOKEN_KEY = "toptrack_spotify_token";
const CLIENT_KEY = "toptrack_spotify_client_id";
const STATE_KEY = "toptrack_game_state_v1";
const VERIFIER_KEY = "toptrack_pkce_verifier";

const app = document.querySelector("#app");
const setupDialog = document.querySelector("#setupDialog");
const setupForm = document.querySelector("#setupForm");
const clientIdInput = document.querySelector("#clientIdInput");
const redirectUriText = document.querySelector("#redirectUriText");
const copyRedirectButton = document.querySelector("#copyRedirectButton");
const resetButton = document.querySelector("#resetButton");
const brandButton = document.querySelector("#brandButton");
const sessionUser = document.querySelector("#sessionUser");
const toastRegion = document.querySelector("#toastRegion");

let spotifyProfile = null;
let topCandidates = [];
let state = loadState();
let currentMatch = null;

const demoTracks = [
  ["Dreams", "Fleetwood Mac"], ["Blinding Lights", "The Weeknd"], ["Pink + White", "Frank Ocean"],
  ["Mr. Brightside", "The Killers"], ["Nights", "Frank Ocean"], ["Everybody Wants to Rule the World", "Tears for Fears"],
  ["Electric Feel", "MGMT"], ["I Wanna Dance with Somebody", "Whitney Houston"], ["505", "Arctic Monkeys"],
  ["Vienna", "Billy Joel"], ["The Less I Know the Better", "Tame Impala"], ["September", "Earth, Wind & Fire"],
  ["Style", "Taylor Swift"], ["Sweater Weather", "The Neighbourhood"], ["Superstition", "Stevie Wonder"],
  ["Something About Us", "Daft Punk"], ["Dog Days Are Over", "Florence + The Machine"], ["No Role Modelz", "J. Cole"],
  ["Take On Me", "a-ha"], ["Ribs", "Lorde"], ["Come and Get Your Love", "Redbone"],
  ["Creep", "Radiohead"], ["Midnight City", "M83"], ["Ain't No Mountain High Enough", "Marvin Gaye & Tammi Terrell"],
  ["Redbone", "Childish Gambino"], ["Somebody Else", "The 1975"], ["Fast Car", "Tracy Chapman"],
  ["Eventually", "Tame Impala"], ["Landslide", "Fleetwood Mac"], ["Love on the Brain", "Rihanna"],
  ["Space Song", "Beach House"], ["Don't Stop Me Now", "Queen"]
].map((track, index) => ({
  id: `demo-${index}`,
  name: track[0],
  artist: track[1],
  image: null,
  spotifyUrl: null,
  color: gradientFor(`${track[0]}${track[1]}`)
}));

function defaultState() {
  return {
    mode: "home",
    source: null,
    songs: [],
    selectedIds: [],
    comparisons: [],
    graph: {},
    champion: null,
    tournament: null,
    ranking: null,
    finalRanking: null,
    history: [],
    lastShownIds: [],
    appearanceCounts: {}
  };
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STATE_KEY));
    return parsed ? { ...defaultState(), ...parsed } : defaultState();
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
  resetButton.classList.toggle("hidden", state.mode === "home");
}

function hardReset() {
  state = defaultState();
  currentMatch = null;
  localStorage.removeItem(STATE_KEY);
  renderHome();
}

function toast(message, type = "normal") {
  const item = document.createElement("div");
  item.className = `toast ${type === "error" ? "error" : ""}`;
  item.textContent = message;
  toastRegion.append(item);
  setTimeout(() => item.remove(), 3200);
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function gradientFor(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) hash = input.charCodeAt(i) + ((hash << 5) - hash);
  const h1 = Math.abs(hash) % 360;
  const h2 = (h1 + 55 + (Math.abs(hash) % 70)) % 360;
  return `linear-gradient(145deg, hsl(${h1} 65% 44%), hsl(${h2} 72% 58%))`;
}

function artMarkup(song, className = "") {
  if (song.image) return `<img class="${className}" src="${escapeHtml(song.image)}" alt="${escapeHtml(song.name)} album art" />`;
  const initial = escapeHtml(song.name.trim().charAt(0).toUpperCase());
  return `<div class="generated-cover ${className}" style="background:${song.color || gradientFor(song.id)}" aria-label="${escapeHtml(song.name)} cover">${initial}</div>`;
}

function renderHome() {
  state.mode = "home";
  saveState();
  resetButton.classList.add("hidden");
  app.innerHTML = `
    <section class="hero">
      <div>
        <p class="eyebrow">Your music. Settled.</p>
        <h1>Find the one song that beats <span class="accent">everything.</span></h1>
        <p class="hero-copy">Connect Spotify, choose between your top songs head-to-head, and reveal your definitive favorite—then keep going to rank the entire list.</p>
        <div class="hero-actions">
          <button class="primary-button" id="connectButton">Connect Spotify</button>
          <button class="secondary-button" id="demoButton">Try the demo</button>
        </div>
        <div class="hero-proof">
          <span>32 songs</span><span>31 picks to find #1</span><span>Progress saves automatically</span>
        </div>
      </div>
      <div class="hero-visual" aria-hidden="true">
        <div class="vs-orbit">
          <div class="demo-cover left"><strong>Midnight Drive</strong><span>Neon Avenue</span></div>
          <div class="demo-cover right"><strong>Afterglow</strong><span>Northbound</span></div>
          <div class="vs-badge">VS</div>
          <div class="result-pill"><b>31 picks</b> to discover your #1</div>
        </div>
      </div>
    </section>`;

  document.querySelector("#connectButton").addEventListener("click", connectSpotify);
  document.querySelector("#demoButton").addEventListener("click", startDemo);
}

function renderLoading(title = "Reading your Spotify taste", description = "Collecting your top tracks and album art…") {
  app.innerHTML = `<section class="loading-screen"><div><div class="loading-ring"></div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></div></section>`;
}

function startDemo() {
  state = defaultState();
  state.source = "demo";
  state.songs = demoTracks;
  state.selectedIds = demoTracks.map(song => song.id);
  state.mode = "select";
  saveState();
  renderSelection();
}

function getRedirectUri() {
  return `${window.location.origin}${window.location.pathname}`;
}

async function connectSpotify() {
  const clientId = localStorage.getItem(CLIENT_KEY);
  if (!clientId) {
    clientIdInput.value = "";
    redirectUriText.textContent = getRedirectUri();
    setupDialog.showModal();
    return;
  }
  await redirectToSpotify(clientId);
}

async function redirectToSpotify(clientId) {
  const verifier = generateRandomString(64);
  const challenge = await sha256Base64Url(verifier);
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: getRedirectUri(),
    scope: "user-top-read user-read-private",
    code_challenge_method: "S256",
    code_challenge: challenge,
    show_dialog: "true"
  });
  window.location.href = `${SPOTIFY_AUTHORIZE}?${params}`;
}

function generateRandomString(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, value => chars[value % chars.length]).join("");
}

async function sha256Base64Url(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function exchangeCode(code) {
  const clientId = localStorage.getItem(CLIENT_KEY);
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  if (!clientId || !verifier) throw new Error("Spotify login session expired. Please connect again.");
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: "authorization_code",
    code,
    redirect_uri: getRedirectUri(),
    code_verifier: verifier
  });
  const response = await fetch(SPOTIFY_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!response.ok) throw new Error("Spotify could not complete the login.");
  const token = await response.json();
  token.expires_at = Date.now() + token.expires_in * 1000;
  localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
  sessionStorage.removeItem(VERIFIER_KEY);
  return token;
}

async function refreshToken(token) {
  const clientId = localStorage.getItem(CLIENT_KEY);
  if (!token.refresh_token || !clientId) throw new Error("Spotify session expired.");
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: "refresh_token",
    refresh_token: token.refresh_token
  });
  const response = await fetch(SPOTIFY_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!response.ok) throw new Error("Spotify session expired.");
  const next = await response.json();
  const merged = { ...token, ...next, refresh_token: next.refresh_token || token.refresh_token };
  merged.expires_at = Date.now() + merged.expires_in * 1000;
  localStorage.setItem(TOKEN_KEY, JSON.stringify(merged));
  return merged;
}

async function getValidToken() {
  const stored = localStorage.getItem(TOKEN_KEY);
  if (!stored) throw new Error("Connect Spotify to continue.");
  let token = JSON.parse(stored);
  if (Date.now() > token.expires_at - 60000) token = await refreshToken(token);
  return token.access_token;
}

async function spotifyFetch(path) {
  let accessToken = await getValidToken();
  let response = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (response.status === 401) {
    const oldToken = JSON.parse(localStorage.getItem(TOKEN_KEY));
    const newToken = await refreshToken(oldToken);
    accessToken = newToken.access_token;
    response = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  }
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Spotify request failed (${response.status}). ${body.slice(0, 120)}`);
  }
  return response.json();
}

async function loadSpotifyData() {
  renderLoading();
  const [profile, longTerm, mediumTerm] = await Promise.all([
    spotifyFetch("/me"),
    spotifyFetch("/me/top/tracks?time_range=long_term&limit=50"),
    spotifyFetch("/me/top/tracks?time_range=medium_term&limit=50")
  ]);
  spotifyProfile = profile;
  sessionUser.textContent = profile.display_name || "Spotify connected";
  sessionUser.classList.remove("hidden");

  const scored = new Map();
  const addItems = (items, weight) => items.forEach((track, index) => {
    const current = scored.get(track.id) || { track, score: 0 };
    current.score += weight * (50 - index);
    scored.set(track.id, current);
  });
  addItems(longTerm.items || [], 1);
  addItems(mediumTerm.items || [], 0.28);

  topCandidates = [...scored.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 50)
    .map(({ track }) => ({
      id: track.id,
      name: track.name,
      artist: track.artists?.map(artist => artist.name).join(", ") || "Unknown artist",
      image: track.album?.images?.[0]?.url || null,
      spotifyUrl: track.external_urls?.spotify || null,
      uri: track.uri,
      color: gradientFor(track.id)
    }));

  if (topCandidates.length < SONG_COUNT) throw new Error(`Spotify returned only ${topCandidates.length} top tracks. Try the demo for now.`);
  state = defaultState();
  state.source = "spotify";
  state.songs = topCandidates;
  state.selectedIds = topCandidates.slice(0, SONG_COUNT).map(song => song.id);
  state.mode = "select";
  saveState();
  renderSelection();
}

function renderSelection() {
  const selected = new Set(state.selectedIds);
  const exact = selected.size === SONG_COUNT;
  app.innerHTML = `
    <section class="screen">
      <div class="screen-heading">
        <div><p class="eyebrow">Build your field</p><h1 class="screen-title">Choose the 32.</h1></div>
        <p class="screen-description">We started with your strongest long-term Spotify picks. Swap anything that does not belong before the matchups begin.</p>
      </div>
      <div class="selection-toolbar">
        <div class="selection-count ${exact ? "good" : ""}" id="selectionCount">${selected.size} of ${SONG_COUNT} selected</div>
        <button class="primary-button" id="beginButton" ${exact ? "" : "disabled"}>Begin matchups</button>
      </div>
      <div class="song-grid">
        ${state.songs.map(song => `
          <button class="song-select-card ${selected.has(song.id) ? "selected" : ""}" data-id="${escapeHtml(song.id)}" aria-pressed="${selected.has(song.id)}">
            ${artMarkup(song)}
            <span class="select-check">${selected.has(song.id) ? "✓" : "+"}</span>
            <span class="song-select-copy"><span class="song-name">${escapeHtml(song.name)}</span><span class="song-artist">${escapeHtml(song.artist)}</span></span>
          </button>`).join("")}
      </div>
    </section>`;

  document.querySelectorAll(".song-select-card").forEach(card => card.addEventListener("click", () => toggleSong(card.dataset.id)));
  document.querySelector("#beginButton").addEventListener("click", beginTournament);
}

function toggleSong(id) {
  const selected = new Set(state.selectedIds);
  if (selected.has(id)) selected.delete(id);
  else if (selected.size < SONG_COUNT) selected.add(id);
  else return toast(`You already selected ${SONG_COUNT}. Remove one before adding another.`);
  state.selectedIds = [...selected];
  saveState();
  renderSelection();
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function beginTournament() {
  if (state.selectedIds.length !== SONG_COUNT) return;
  const ids = shuffle(state.selectedIds);
  state.mode = "tournament";
  state.comparisons = [];
  state.graph = {};
  state.champion = null;
  state.finalRanking = null;
  state.history = [];
  state.lastShownIds = [];
  state.appearanceCounts = {};
  state.tournament = {
    round: 1,
    currentRound: ids,
    nextRound: [],
    pairIndex: 0,
    decisions: 0,
    currentPair: null
  };
  saveState();
  nextTournamentMatch();
}

function getSong(id) {
  return state.songs.find(song => song.id === id);
}

function nextTournamentMatch() {
  const t = state.tournament;
  if (!t) return;
  if (t.pairIndex >= t.currentRound.length) {
    t.currentRound = shuffle(t.nextRound);
    t.nextRound = [];
    t.pairIndex = 0;
    t.round += 1;
  }
  if (t.currentRound.length === 1) {
    state.champion = t.currentRound[0];
    state.mode = "reveal";
    t.currentPair = null;
    saveState();
    renderReveal();
    return;
  }
  const pair = [t.currentRound[t.pairIndex], t.currentRound[t.pairIndex + 1]];
  t.currentPair = Math.random() > .5 ? pair : [pair[1], pair[0]];
  currentMatch = { phase: "tournament", ids: t.currentPair };
  state.lastShownIds = t.currentPair;
  t.currentPair.forEach(id => state.appearanceCounts[id] = (state.appearanceCounts[id] || 0) + 1);
  saveState();
  renderMatch();
}

function recordChoice(winner, loser, phase) {
  if (!state.graph[winner]) state.graph[winner] = [];
  if (!state.graph[winner].includes(loser)) state.graph[winner].push(loser);
  state.comparisons.push({ winner, loser, phase, at: Date.now() });
}

function chooseSong(winnerId) {
  if (!currentMatch || !currentMatch.ids.includes(winnerId)) return;
  const loserId = currentMatch.ids.find(id => id !== winnerId);
  const snapshotState = JSON.parse(JSON.stringify({ ...state, history: [] }));
  state.history.push(JSON.stringify({ state: snapshotState, currentMatch }));
  if (state.history.length > 10) state.history.shift();
  recordChoice(winnerId, loserId, currentMatch.phase);

  if (currentMatch.phase === "tournament") {
    const t = state.tournament;
    t.nextRound.push(winnerId);
    t.pairIndex += 2;
    t.decisions += 1;
    currentMatch = null;
    saveState();
    nextTournamentMatch();
  } else {
    applyRankingChoice(winnerId, loserId);
  }
}

function undoChoice() {
  const snapshot = state.history.pop();
  if (!snapshot) return toast("Nothing to undo yet.");
  const remainingHistory = [...state.history];
  const restored = JSON.parse(snapshot);
  state = restored.state;
  state.history = remainingHistory;
  currentMatch = restored.currentMatch;
  saveState();
  if (state.mode === "tournament" || state.mode === "ranking") renderMatch();
  else resume();
}

function renderMatch() {
  if (!currentMatch) return;
  const [leftId, rightId] = currentMatch.ids;
  const left = getSong(leftId);
  const right = getSong(rightId);
  const isTournament = currentMatch.phase === "tournament";
  const decisionCount = state.comparisons.length;
  const tournamentProgress = Math.min(100, ((state.tournament?.decisions || 0) / 31) * 100);
  const rankingProgress = state.ranking ? rankingProgressPercent() : 0;
  const progress = isTournament ? tournamentProgress : rankingProgress;
  const phaseText = isTournament
    ? `<b>Finding your #1</b> · Round ${state.tournament.round} of 5`
    : `<b>Building the full ranking</b> · Your #1 is locked`;
  const progressRight = isTournament ? `${state.tournament.decisions} of 31 picks` : `${decisionCount} total picks`;

  app.innerHTML = `
    <section class="screen game-screen">
      <div class="game-topline"><div class="phase-label">${phaseText}</div><div class="phase-label">Pick the song you would keep</div></div>
      <div class="progress-shell"><div class="progress-meta"><span>${isTournament ? "Favorite search" : "Full ranking"}</span><span>${progressRight}</span></div><div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div></div>
      <div class="matchup-stage">
        ${choiceMarkup(left)}
        <div class="match-vs">VS</div>
        ${choiceMarkup(right)}
      </div>
      <div class="game-controls"><button class="ghost-button" id="undoButton">Undo last pick</button></div>
    </section>`;

  document.querySelectorAll(".song-choice").forEach(button => button.addEventListener("click", () => chooseSong(button.dataset.id)));
  document.querySelector("#undoButton").addEventListener("click", undoChoice);
}

function choiceMarkup(song) {
  return `<button class="song-choice" data-id="${escapeHtml(song.id)}">
    ${artMarkup(song, "choice-art")}
    <div class="choice-copy"><h2 class="choice-title">${escapeHtml(song.name)}</h2><p class="choice-artist">${escapeHtml(song.artist)}</p><span class="choice-action">Choose this song</span></div>
  </button>`;
}

function renderReveal() {
  const champion = getSong(state.champion);
  app.innerHTML = `
    <section class="reveal-screen">
      <div class="winner-art-shell">${artMarkup(champion, "winner-art")}<div class="rank-one-badge">#1</div></div>
      <div>
        <p class="eyebrow">We found it</p>
        <h1 class="reveal-title">Your favorite song.</h1>
        <h2 class="winner-name">${escapeHtml(champion.name)}</h2>
        <p class="winner-artist">${escapeHtml(champion.artist)}</p>
        <p class="reveal-copy">It survived the full 32-song field without a loss. Your earlier choices already did part of the ranking work, so you can continue without seeing this song again.</p>
        <div class="reveal-actions">
          <button class="primary-button" id="continueRankingButton">Rank the other 31</button>
          ${champion.spotifyUrl ? `<a class="secondary-button" style="display:inline-flex;align-items:center;text-decoration:none" href="${escapeHtml(champion.spotifyUrl)}" target="_blank" rel="noopener">Open in Spotify</a>` : ""}
        </div>
      </div>
    </section>`;
  document.querySelector("#continueRankingButton").addEventListener("click", beginFullRanking);
}

function beginFullRanking() {
  const remaining = shuffle(state.selectedIds.filter(id => id !== state.champion));
  state.mode = "ranking";
  state.ranking = {
    level: 1,
    runs: remaining.map(id => [id]),
    jobs: [],
    carry: null,
    currentJobIndex: null,
    currentPair: null,
    completedJobs: 0,
    totalJobEstimate: remaining.length - 1
  };
  createRankingLevel();
  saveState();
  scheduleRankingMatch();
}

function createRankingLevel() {
  const r = state.ranking;
  r.jobs = [];
  r.carry = null;
  for (let i = 0; i < r.runs.length; i += 2) {
    if (!r.runs[i + 1]) {
      r.carry = r.runs[i];
      continue;
    }
    r.jobs.push({ left: r.runs[i], right: r.runs[i + 1], i: 0, j: 0, merged: [], done: false, waitingPair: null });
  }
}

function pathExists(from, to) {
  if (from === to) return true;
  const visited = new Set();
  const stack = [from];
  while (stack.length) {
    const node = stack.pop();
    if (visited.has(node)) continue;
    visited.add(node);
    for (const next of state.graph[node] || []) {
      if (next === to) return true;
      if (!visited.has(next)) stack.push(next);
    }
  }
  return false;
}

function knownWinner(a, b) {
  const aWins = pathExists(a, b);
  const bWins = pathExists(b, a);
  if (aWins && !bWins) return a;
  if (bWins && !aWins) return b;
  return null;
}

function advanceJob(job) {
  while (!job.done) {
    if (job.i >= job.left.length) {
      job.merged.push(...job.right.slice(job.j));
      job.done = true;
      job.waitingPair = null;
      return;
    }
    if (job.j >= job.right.length) {
      job.merged.push(...job.left.slice(job.i));
      job.done = true;
      job.waitingPair = null;
      return;
    }
    const a = job.left[job.i];
    const b = job.right[job.j];
    const known = knownWinner(a, b);
    if (!known) {
      job.waitingPair = [a, b];
      return;
    }
    job.merged.push(known);
    if (known === a) job.i += 1;
    else job.j += 1;
  }
}

function scheduleRankingMatch() {
  const r = state.ranking;
  if (!r) return;

  r.jobs.forEach(job => advanceJob(job));
  const unfinished = r.jobs.map((job, index) => ({ job, index })).filter(item => !item.job.done);

  if (!unfinished.length) {
    const nextRuns = r.jobs.map(job => job.merged);
    if (r.carry) nextRuns.push(r.carry);
    r.completedJobs += r.jobs.length;
    if (nextRuns.length === 1) {
      state.finalRanking = [state.champion, ...nextRuns[0]];
      state.mode = "results";
      currentMatch = null;
      saveState();
      renderResults();
      return;
    }
    r.runs = nextRuns;
    r.level += 1;
    createRankingLevel();
    saveState();
    scheduleRankingMatch();
    return;
  }

  const lastIds = new Set(state.lastShownIds || []);
  unfinished.sort((a, b) => {
    const aPair = a.job.waitingPair || [];
    const bPair = b.job.waitingPair || [];
    const repeatA = aPair.filter(id => lastIds.has(id)).length;
    const repeatB = bPair.filter(id => lastIds.has(id)).length;
    if (repeatA !== repeatB) return repeatA - repeatB;
    const appearancesA = aPair.reduce((sum, id) => sum + (state.appearanceCounts[id] || 0), 0);
    const appearancesB = bPair.reduce((sum, id) => sum + (state.appearanceCounts[id] || 0), 0);
    return appearancesA - appearancesB;
  });

  const selected = unfinished[0];
  let pair = selected.job.waitingPair;
  if (Math.random() > .5) pair = [pair[1], pair[0]];
  r.currentJobIndex = selected.index;
  r.currentPair = pair;
  currentMatch = { phase: "ranking", ids: pair };
  state.lastShownIds = pair;
  pair.forEach(id => state.appearanceCounts[id] = (state.appearanceCounts[id] || 0) + 1);
  saveState();
  renderMatch();
}

function applyRankingChoice(winnerId, loserId) {
  const r = state.ranking;
  const job = r.jobs[r.currentJobIndex];
  const a = job.left[job.i];
  const b = job.right[job.j];
  job.merged.push(winnerId);
  if (winnerId === a) job.i += 1;
  else if (winnerId === b) job.j += 1;
  else {
    if (loserId === a) job.j += 1;
    else job.i += 1;
  }
  job.waitingPair = null;
  r.currentPair = null;
  currentMatch = null;
  saveState();
  scheduleRankingMatch();
}

function rankingProgressPercent() {
  const r = state.ranking;
  if (!r) return 0;
  const completed = r.completedJobs + r.jobs.filter(job => job.done).length;
  return Math.min(98, (completed / Math.max(1, r.totalJobEstimate)) * 100);
}

function renderResults() {
  const ranking = state.finalRanking || [];
  const winner = getSong(ranking[0]);
  app.innerHTML = `
    <section class="screen">
      <div class="screen-heading"><div><p class="eyebrow">Ranking complete</p><h1 class="screen-title">Your top 32.</h1></div><p class="screen-description">Built from ${state.comparisons.length} head-to-head choices, with earlier results reused whenever the order was already clear.</p></div>
      <div class="results-layout">
        <aside class="results-hero">
          ${artMarkup(winner)}
          <h2>${escapeHtml(winner.name)}</h2><p>${escapeHtml(winner.artist)}</p>
          <div class="result-actions"><button class="primary-button" id="copyResultsButton">Copy ranking</button><button class="secondary-button" id="restartButton">Rank again</button></div>
        </aside>
        <div class="ranking-list">
          ${ranking.map((id, index) => {
            const song = getSong(id);
            return `<div class="ranking-row"><span class="rank-number">#${index + 1}</span>${artMarkup(song, "rank-art")}<span class="rank-copy"><span class="rank-title">${escapeHtml(song.name)}</span><span class="rank-artist">${escapeHtml(song.artist)}</span></span>${song.spotifyUrl ? `<a class="spotify-link" href="${escapeHtml(song.spotifyUrl)}" target="_blank" rel="noopener">Spotify ↗</a>` : ""}</div>`;
          }).join("")}
        </div>
      </div>
    </section>`;

  document.querySelector("#copyResultsButton").addEventListener("click", copyResults);
  document.querySelector("#restartButton").addEventListener("click", () => {
    state.mode = "select";
    state.comparisons = [];
    state.graph = {};
    state.champion = null;
    state.tournament = null;
    state.ranking = null;
    state.finalRanking = null;
    saveState();
    renderSelection();
  });
}

async function copyResults() {
  const lines = state.finalRanking.map((id, index) => {
    const song = getSong(id);
    return `${index + 1}. ${song.name} — ${song.artist}`;
  });
  await navigator.clipboard.writeText(`My Top 32 Songs\n\n${lines.join("\n")}`);
  toast("Ranking copied.");
}

function renderError(message) {
  app.innerHTML = `<section class="empty-state"><div><p class="eyebrow">Something went wrong</p><h2>Spotify did not cooperate.</h2><p>${escapeHtml(message)}</p><button class="primary-button" id="errorHomeButton">Back home</button></div></section>`;
  document.querySelector("#errorHomeButton").addEventListener("click", renderHome);
}

function resume() {
  resetButton.classList.toggle("hidden", state.mode === "home");
  switch (state.mode) {
    case "select": return renderSelection();
    case "tournament":
      if (state.tournament?.currentPair) {
        currentMatch = { phase: "tournament", ids: state.tournament.currentPair };
        return renderMatch();
      }
      return nextTournamentMatch();
    case "reveal": return renderReveal();
    case "ranking":
      if (state.ranking?.currentPair) {
        currentMatch = { phase: "ranking", ids: state.ranking.currentPair };
        return renderMatch();
      }
      return scheduleRankingMatch();
    case "results": return renderResults();
    default: return renderHome();
  }
}

setupForm.addEventListener("submit", async event => {
  event.preventDefault();
  const clientId = clientIdInput.value.trim();
  if (!clientId) return;
  localStorage.setItem(CLIENT_KEY, clientId);
  setupDialog.close();
  await redirectToSpotify(clientId);
});

copyRedirectButton.addEventListener("click", async () => {
  await navigator.clipboard.writeText(getRedirectUri());
  toast("Redirect URI copied.");
});

resetButton.addEventListener("click", () => {
  if (confirm("Start over and erase the current ranking?")) hardReset();
});
brandButton.addEventListener("click", () => {
  if (state.mode === "home" || confirm("Return home? Your current progress will remain saved.")) renderHome();
});

async function boot() {
  redirectUriText.textContent = getRedirectUri();
  const params = new URLSearchParams(window.location.search);
  const error = params.get("error");
  const code = params.get("code");
  if (error) {
    history.replaceState({}, "", getRedirectUri());
    return renderError(`Spotify authorization was cancelled or rejected: ${error}`);
  }
  if (code) {
    try {
      renderLoading("Finishing Spotify login", "Securely exchanging the authorization code…");
      await exchangeCode(code);
      history.replaceState({}, "", getRedirectUri());
      await loadSpotifyData();
    } catch (err) {
      history.replaceState({}, "", getRedirectUri());
      renderError(err.message);
    }
    return;
  }
  resume();
}

boot();
