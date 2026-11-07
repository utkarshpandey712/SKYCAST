"use strict";

/* ---------- Helpers & state ---------- */
const $ = id => document.getElementById(id);
const store = {
    get(key, fallback) {
        try { const v = localStorage.getItem("skycast." + key); return v === null ? fallback : JSON.parse(v); }
        catch (e) { return fallback; }
    },
    set(key, value) { try { localStorage.setItem("skycast." + key, JSON.stringify(value)); } catch (e) { /* private mode */ } }
};

const state = {
    unit: store.get("unit", "C"),
    favourites: store.get("favourites", []),
    data: null,
    requestId: 0
};

const WEATHER = {
    0: ["Clear sky", "☀️", "🌙", "clear"], 1: ["Mainly clear", "🌤️", "🌙", "clear"],
    2: ["Partly cloudy", "⛅", "☁️", "cloudy"], 3: ["Overcast", "☁️", "☁️", "cloudy"],
    45: ["Fog", "🌫️", "🌫️", "fog"], 48: ["Rime fog", "🌫️", "🌫️", "fog"],
    51: ["Light drizzle", "🌦️", "🌧️", "rain"], 53: ["Drizzle", "🌦️", "🌧️", "rain"], 55: ["Dense drizzle", "🌧️", "🌧️", "rain"],
    56: ["Freezing drizzle", "🌧️", "🌧️", "rain"], 57: ["Freezing drizzle", "🌧️", "🌧️", "rain"],
    61: ["Slight rain", "🌦️", "🌧️", "rain"], 63: ["Rain", "🌧️", "🌧️", "rain"], 65: ["Heavy rain", "🌧️", "🌧️", "rain"],
    66: ["Freezing rain", "🌧️", "🌧️", "rain"], 67: ["Heavy freezing rain", "🌧️", "🌧️", "rain"],
    71: ["Slight snow", "🌨️", "🌨️", "snow"], 73: ["Snow", "❄️", "❄️", "snow"], 75: ["Heavy snow", "❄️", "❄️", "snow"],
    77: ["Snow grains", "❄️", "❄️", "snow"], 80: ["Rain showers", "🌦️", "🌧️", "rain"],
    81: ["Rain showers", "🌧️", "🌧️", "rain"], 82: ["Violent showers", "⛈️", "⛈️", "storm"],
    85: ["Snow showers", "🌨️", "🌨️", "snow"], 86: ["Heavy snow showers", "❄️", "❄️", "snow"],
    95: ["Thunderstorm", "⛈️", "⛈️", "storm"], 96: ["Thunderstorm with hail", "⛈️", "⛈️", "storm"],
    99: ["Thunderstorm with hail", "⛈️", "⛈️", "storm"]
};

function describe(code, isDay = 1) {
    const w = WEATHER[Number(code)] || ["Weather conditions", "🌤️", "☁️", "cloudy"];
    return { text: w[0], icon: Number(isDay) === 1 ? w[1] : w[2], kind: w[3] };
}

function skyFor(code, isDay) {
    const kind = describe(code, isDay).kind;
    if (kind === "clear") return Number(isDay) === 1 ? "clear-day" : "clear-night";
    return kind;
}

const temp = c => Number.isFinite(Number(c)) ? Math.round(state.unit === "F" ? Number(c) * 9 / 5 + 32 : Number(c)) + "°" : "--°";
const wind = kmh => Number.isFinite(Number(kmh))
    ? (state.unit === "F" ? Math.round(Number(kmh) * 0.621371) + " mph" : Math.round(Number(kmh)) + " km/h") : "--";
const precip = mm => Number.isFinite(Number(mm))
    ? (state.unit === "F" ? (Number(mm) / 25.4).toFixed(2) + " in" : Number(mm).toFixed(1) + " mm") : "--";

const slugify = s => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const esc = s => String(s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

/* Times from Open-Meteo are already in the city's local time: "2026-11-07T14:00" — parse as text, not Date */
function hm(iso) { const [h, m] = iso.slice(11, 16).split(":").map(Number); return { h, m, mins: h * 60 + m }; }
function fmtTime(iso) {
    const { h, m } = hm(iso);
    return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
function fmtHour(iso) { const { h } = hm(iso); return `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`; }
function fmtDay(dateStr, i) {
    if (i === 0) return "Today";
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short" });
}
function uvLabel(v) {
    if (!Number.isFinite(v)) return "Max today";
    if (v < 3) return "Low";
    if (v < 6) return "Moderate";
    if (v < 8) return "High";
    if (v < 11) return "Very high";
    return "Extreme";
}
function compass(deg) {
    if (!Number.isFinite(Number(deg))) return "";
    return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(Number(deg) / 45) % 8];
}

/* ---------- Theme & units ---------- */
function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    $("themeToggle").textContent = theme === "dark" ? "☀️" : "🌙";
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === "dark" ? "#0b1220" : "#2563eb";
}
$("themeToggle").addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    try { localStorage.setItem("skycast.theme", next); } catch (e) { /* ignore */ }
    applyTheme(next);
});
applyTheme(document.documentElement.getAttribute("data-theme"));

function setUnit(unit) {
    state.unit = unit;
    store.set("unit", unit);
    $("unitC").classList.toggle("active", unit === "C");
    $("unitF").classList.toggle("active", unit === "F");
    $("unitC").setAttribute("aria-pressed", unit === "C");
    $("unitF").setAttribute("aria-pressed", unit === "F");
    if (state.data) render(state.data);
}
$("unitC").addEventListener("click", () => setUnit("C"));
$("unitF").addEventListener("click", () => setUnit("F"));
setUnit(state.unit);

/* ---------- Weather animation ---------- */
function buildFx(sky) {
    const fx = $("fx");
    fx.innerHTML = "";
    const add = (cls, style, parent = fx) => {
        const el = document.createElement("div");
        el.className = cls;
        Object.assign(el.style, style);
        parent.appendChild(el);
        return el;
    };
    const rnd = (a, b) => a + Math.random() * (b - a);

    if (sky === "clear-day") add("sun-glow", {});
    if (sky === "clear-night" || sky === "storm") {
        for (let i = 0; i < 40; i++) add("star", { left: rnd(0, 100) + "%", top: rnd(0, 80) + "%", animationDelay: rnd(0, 3) + "s" });
    }
    if (["cloudy", "rain", "storm", "snow", "clear-day"].includes(sky)) {
        const n = sky === "clear-day" ? 2 : 5;
        for (let i = 0; i < n; i++) {
            const w = rnd(120, 260);
            add("cloud", { width: w + "px", height: w / 3.2 + "px", top: rnd(0, 55) + "%",
                animationDuration: rnd(35, 70) + "s", animationDelay: -rnd(0, 60) + "s" });
        }
    }
    if (sky === "rain" || sky === "storm") {
        for (let i = 0; i < 70; i++) add("drop", { left: rnd(0, 100) + "%", animationDuration: rnd(0.55, 1.0) + "s", animationDelay: -rnd(0, 1.5) + "s", opacity: rnd(0.4, 1) });
    }
    if (sky === "storm") add("flash", {});
    if (sky === "snow") {
        for (let i = 0; i < 45; i++) {
            const s = rnd(3, 7);
            add("flake", { left: rnd(0, 100) + "%", width: s + "px", height: s + "px", animationDuration: rnd(5, 10) + "s", animationDelay: -rnd(0, 10) + "s" });
        }
    }
    if (sky === "fog") {
        for (let i = 0; i < 4; i++) add("fogband", { top: 10 + i * 24 + "%", animationDuration: rnd(9, 16) + "s", animationDelay: -rnd(0, 8) + "s" });
    }
}

/* ---------- Rendering ---------- */
function render(data) {
    state.data = data;
    const c = data.current, d = data.daily, h = data.hourly;
    const info = describe(c.weather_code, c.is_day);
    const place = [data.admin1, data.country].filter(Boolean).join(", ");

    const sky = skyFor(c.weather_code, c.is_day);
    const hero = $("hero");
    if (hero.dataset.sky !== sky) { hero.dataset.sky = sky; buildFx(sky); }

    $("placeName").textContent = data.city;
    $("placeMeta").textContent = place;
    $("temperature").textContent = temp(c.temperature_2m);
    $("condition").textContent = info.text;
    $("feelsLike").textContent = "Feels like " + temp(c.apparent_temperature);
    $("weatherIcon").textContent = info.icon;
    $("timezone").textContent = data.timezone ? "Timezone: " + data.timezone : "";
    $("updatedAt").textContent = c.time ? `Local time in ${data.city}: ${fmtTime(c.time)}` : "";

    $("humidity").textContent = Number.isFinite(Number(c.relative_humidity_2m)) ? c.relative_humidity_2m + "%" : "--";
    $("wind").textContent = wind(c.wind_speed_10m);
    $("windDir").textContent = compass(c.wind_direction_10m) ? "Direction: " + compass(c.wind_direction_10m) : "Near-surface wind";
    $("rain").textContent = precip(c.precipitation);
    const chance = (d.precipitation_probability_max || [])[0];
    $("rainChance").textContent = Number.isFinite(Number(chance)) ? `Chance today: ${chance}%` : "Current precipitation";
    $("pressure").textContent = Number.isFinite(Number(c.surface_pressure)) ? Math.round(c.surface_pressure) + " hPa" : "--";

    const uv = Number((d.uv_index_max || [])[0]);
    $("uv").textContent = Number.isFinite(uv) ? uv.toFixed(1) : "--";
    $("uvLabel").textContent = Number.isFinite(uv) ? uvLabel(uv) + " (max today)" : "Max today";

    renderSun(d, c);
    renderHourly(h, c);
    renderDaily(d);
    updateFavButton();
    updateMap(data);
    document.title = `Weather in ${data.city} Today – ${temp(c.temperature_2m)} ${info.text} | SkyCast`;
}

function renderSun(d, c) {
    const rise = (d.sunrise || [])[0], set = (d.sunset || [])[0];
    if (!rise || !set) return;
    $("sunrise").textContent = fmtTime(rise);
    $("sunset").textContent = fmtTime(set);
    const len = hm(set).mins - hm(rise).mins;
    $("dayLength").textContent = len > 0 ? `${Math.floor(len / 60)}h ${len % 60}m` : "";

    const now = c.time ? hm(c.time).mins : hm(rise).mins;
    const p = Math.min(1, Math.max(0, (now - hm(rise).mins) / (len || 1)));
    const theta = Math.PI * (1 - p);
    $("sunDot").setAttribute("cx", (100 + 90 * Math.cos(theta)).toFixed(1));
    $("sunDot").setAttribute("cy", (95 - 90 * Math.sin(theta)).toFixed(1));
    $("arcDone").setAttribute("stroke-dasharray", `${(p * 100).toFixed(1)} 100`);
}

function renderHourly(h, c) {
    const box = $("hourlyForecast");
    const times = h.time || [];
    // Compare local-time strings (same timezone, ISO format sorts correctly)
    let start = times.findIndex(t => t >= (c.time || "").slice(0, 13) + ":00");
    if (start < 0) start = 0;
    box.innerHTML = "";
    for (let i = start; i < Math.min(start + 24, times.length); i++) {
        const info = describe((h.weather_code || [])[i], (h.is_day || [])[i]);
        const el = document.createElement("div");
        el.className = "hour-item" + (i === start ? " now" : "");
        el.innerHTML = `<div class="hour-time">${i === start ? "Now" : fmtHour(times[i])}</div>
            <div class="hour-icon" title="${esc(info.text)}">${info.icon}</div>
            <div class="hour-temp">${temp(h.temperature_2m[i])}</div>
            <div class="hour-rain">💧 ${(h.precipitation_probability || [])[i] ?? 0}%</div>`;
        box.appendChild(el);
    }
}

function renderDaily(d) {
    const box = $("dailyForecast");
    box.innerHTML = "";
    (d.time || []).forEach((day, i) => {
        const info = describe(d.weather_code[i], 1);
        const row = document.createElement("div");
        row.className = "daily-row";
        row.innerHTML = `<span class="daily-day">${fmtDay(day, i)}</span>
            <span class="daily-icon" aria-hidden="true">${info.icon}</span>
            <span class="daily-desc">${esc(info.text)}</span>
            <span class="daily-high">${temp(d.temperature_2m_max[i])}</span>
            <span class="daily-low">${temp(d.temperature_2m_min[i])}</span>`;
        box.appendChild(row);
    });
}

const GENERIC_NAMES = ["Your location", "Selected location"];

/* ---------- Loading ---------- */
function showMessage(text) { $("message").textContent = text || ""; }

async function fetchWeather(url, urlPath) {
    const id = ++state.requestId;
    showMessage("");
    $("hero").classList.add("skeleton");
    try {
        const res = await fetch(url);
        let body = null;
        try { body = await res.json(); } catch (e) { /* non-JSON error */ }
        if (id !== state.requestId) return;           // a newer search started
        if (!res.ok) throw new Error((body && body.message) || "Unable to load weather for this city.");
        render(body);
        $("pageTitle").textContent = "Weather in " + body.city;
        $("cityInput").value = body.city;
        store.set("last", { name: body.city, admin1: body.admin1, country: body.country, latitude: body.latitude, longitude: body.longitude });
        if (urlPath !== false && !GENERIC_NAMES.includes(body.city)) history.replaceState(null, "", "/weather/" + slugify(body.city));
        if (!GENERIC_NAMES.includes(body.city)) updateCanonical(body.city);
    } catch (err) {
        if (id !== state.requestId) return;
        $("placeName").textContent = "Weather unavailable";
        $("placeMeta").textContent = "";
        showMessage(err.message || "Something went wrong. Please try again.");
    } finally {
        if (id === state.requestId) $("hero").classList.remove("skeleton");
    }
}

function updateCanonical(city) {
    const link = document.querySelector('link[rel="canonical"]');
    if (link) link.href = location.origin + "/weather/" + slugify(city);
}

const loadCity = (city, pushUrl) => fetchWeather("/api/weather?city=" + encodeURIComponent(city), pushUrl);
const loadPlace = p => fetchWeather(
    `/api/weather?lat=${p.latitude}&lon=${p.longitude}&name=${encodeURIComponent(p.name || "")}` +
    `&admin1=${encodeURIComponent(p.admin1 || "")}&country=${encodeURIComponent(p.country || "")}`);

/* ---------- Search + suggestions ---------- */
const input = $("cityInput"), list = $("suggestions");
let suggestions = [], activeIdx = -1, debounce;

function closeSuggestions() { list.hidden = true; activeIdx = -1; }
function pick(place) { closeSuggestions(); input.value = place.name; loadPlace(place); }

function showSuggestions(items) {
    suggestions = items;
    list.innerHTML = "";
    if (!items.length) return closeSuggestions();
    items.forEach((p, i) => {
        const li = document.createElement("li");
        li.setAttribute("role", "option");
        li.innerHTML = `<span>${esc(p.name)}</span><small>${esc([p.admin1, p.country].filter(Boolean).join(", "))}</small>`;
        li.addEventListener("mousedown", e => { e.preventDefault(); pick(p); });
        list.appendChild(li);
    });
    list.hidden = false;
}

input.addEventListener("input", () => {
    clearTimeout(debounce);
    const q = input.value.trim();
    if (q.length < 2) return closeSuggestions();
    debounce = setTimeout(async () => {
        try {
            const res = await fetch("/api/search?q=" + encodeURIComponent(q));
            if (res.ok && input.value.trim() === q) showSuggestions(await res.json());
        } catch (e) { /* suggestions are optional */ }
    }, 250);
});
input.addEventListener("keydown", e => {
    const items = [...list.children];
    if (list.hidden || !items.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        activeIdx = (activeIdx + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        items.forEach((li, i) => li.classList.toggle("active", i === activeIdx));
    } else if (e.key === "Enter" && activeIdx >= 0) {
        e.preventDefault();
        pick(suggestions[activeIdx]);
    } else if (e.key === "Escape") closeSuggestions();
});
input.addEventListener("blur", () => setTimeout(closeSuggestions, 120));

$("searchForm").addEventListener("submit", e => {
    e.preventDefault();
    closeSuggestions();
    const city = input.value.trim();
    if (!city) { showMessage("Please enter a city name."); input.focus(); return; }
    loadCity(city);
});

$("locateBtn").addEventListener("click", () => {
    if (!navigator.geolocation) return showMessage("Your browser does not support location.");
    showMessage("Finding your location…");
    navigator.geolocation.getCurrentPosition(
        pos => loadPlace({ name: "Your location", latitude: pos.coords.latitude.toFixed(4), longitude: pos.coords.longitude.toFixed(4) }),
        () => showMessage("Location permission denied. Please search for a city instead."),
        { timeout: 10000, maximumAge: 300000 });
});

/* ---------- Favourites ---------- */
const sameCity = (a, b) => Math.abs(a.latitude - b.latitude) < 0.05 && Math.abs(a.longitude - b.longitude) < 0.05;

function renderFavourites() {
    const box = $("favList");
    box.innerHTML = "";
    if (!state.favourites.length) {
        box.innerHTML = '<span class="muted">No favourites yet. Search a city and tap “Save city”.</span>';
        return;
    }
    state.favourites.forEach((f, i) => {
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.innerHTML = `<button type="button" class="go">${esc(f.name)}</button>
            <button type="button" class="rm" aria-label="Remove ${esc(f.name)} from favourites">×</button>`;
        chip.querySelector(".go").addEventListener("click", () => { input.value = f.name; loadPlace(f); });
        chip.querySelector(".rm").addEventListener("click", () => {
            state.favourites.splice(i, 1);
            store.set("favourites", state.favourites);
            renderFavourites();
            updateFavButton();
        });
        box.appendChild(chip);
    });
}

function updateFavButton() {
    const d = state.data;
    if (!d) return;
    const isFav = state.favourites.some(f => sameCity(f, d));
    $("favBtn").textContent = isFav ? "★ Saved" : "☆ Save city";
    $("favBtn").setAttribute("aria-pressed", isFav);
}

$("favBtn").addEventListener("click", () => {
    const d = state.data;
    if (!d) return;
    const idx = state.favourites.findIndex(f => sameCity(f, d));
    if (idx >= 0) state.favourites.splice(idx, 1);
    else {
        if (state.favourites.length >= 12) return showMessage("You can save up to 12 cities.");
        state.favourites.push({ name: d.city, admin1: d.admin1, country: d.country, latitude: d.latitude, longitude: d.longitude });
    }
    store.set("favourites", state.favourites);
    renderFavourites();
    updateFavButton();
});

/* ---------- Live map (Leaflet + OpenStreetMap + RainViewer radar) ---------- */
const mapState = { map: null, marker: null, frames: [], pastCount: 0, layers: [], idx: 0, timer: null, playing: true };

function updateMap(data) {
    const m = mapState;
    if (!m.map) return;
    const ll = [data.latitude, data.longitude];
    m.map.setView(ll, Math.max(m.map.getZoom(), 6));
    if (!m.marker) m.marker = L.circleMarker(ll, { radius: 9, color: "#fff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }).addTo(m.map);
    m.marker.setLatLng(ll);
    m.marker.bindTooltip(`${data.city}: ${temp(data.current.temperature_2m)}`, { direction: "top", offset: [0, -8] });
}

function initMap() {
    if (mapState.map || typeof L === "undefined" || !$("liveMap")) return;
    const map = L.map("liveMap", { minZoom: 2, worldCopyJump: true }).setView(state.data ? [state.data.latitude, state.data.longitude] : [22.5, 79], state.data ? 7 : 4);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18, className: "base-tiles", attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    mapState.map = map;
    map.on("click", e => {
        const ll = e.latlng.wrap();
        loadPlace({ name: "Selected location", latitude: ll.lat.toFixed(4), longitude: ll.lng.toFixed(4) });
        $("hero").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    if (state.data) updateMap(state.data);
    loadRadar();
}

async function loadRadar() {
    const m = mapState, label = $("radarLabel");
    try {
        const res = await fetch("https://api.rainviewer.com/public/weather-maps.json");
        const j = await res.json();
        const past = (j.radar && j.radar.past) || [], now = (j.radar && j.radar.nowcast) || [];
        m.frames = [...past, ...now];
        m.pastCount = past.length;
        if (!m.frames.length) throw new Error("no frames");
        m.layers = m.frames.map(f => L.tileLayer(`${j.host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`, {
            opacity: 0, maxNativeZoom: 7, maxZoom: 18, zIndex: 5,
            attribution: 'Radar &copy; <a href="https://www.rainviewer.com/">RainViewer</a>'
        }));
        $("radarSlider").max = m.frames.length - 1;
        showFrame(Math.max(0, m.pastCount - 1));
        if (m.playing) startRadar();
    } catch (e) {
        label.textContent = "Rain radar is unavailable right now.";
    }
}

function showFrame(i) {
    const m = mapState;
    if (!m.layers.length) return;
    m.layers.forEach((l, k) => { if (k !== i) l.setOpacity(0); });
    const layer = m.layers[i];
    if (!m.map.hasLayer(layer)) layer.addTo(m.map);
    layer.setOpacity($("radarToggle").checked ? 0.7 : 0);
    m.idx = i;
    $("radarSlider").value = i;
    const t = new Date(m.frames[i].time * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    $("radarLabel").textContent = `${t} · ${i < m.pastCount ? "past" : "forecast"}`;
}

function startRadar() {
    clearInterval(mapState.timer);
    mapState.playing = true;
    $("radarPlay").textContent = "⏸ Pause";
    mapState.timer = setInterval(() => showFrame((mapState.idx + 1) % mapState.frames.length), 800);
}
function stopRadar() {
    clearInterval(mapState.timer);
    mapState.playing = false;
    $("radarPlay").textContent = "▶ Play";
}
$("radarPlay").addEventListener("click", () => (mapState.playing ? stopRadar() : startRadar()));
$("radarSlider").addEventListener("input", e => { stopRadar(); showFrame(Number(e.target.value)); });
$("radarToggle").addEventListener("change", () => showFrame(mapState.idx));

// Load the map only when the user scrolls near it (keeps the page fast)
if ("IntersectionObserver" in window && $("map")) {
    const io = new IntersectionObserver(entries => {
        if (entries.some(e => e.isIntersecting)) { io.disconnect(); initMap(); }
    }, { rootMargin: "300px" });
    io.observe($("map"));
} else {
    initMap();
}

/* ---------- Start ---------- */
$("year").textContent = new Date().getFullYear();
renderFavourites();
const onCityPage = location.pathname.startsWith("/weather/");
const initial = document.body.dataset.initialCity || "Lucknow";
if (onCityPage || !store.get("last", null)) {
    input.value = initial;
    loadCity(initial, false);
} else {
    const last = store.get("last", null);
    input.value = last.name;
    loadPlace(last);
}
