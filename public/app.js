/* =====================================================================
   NovaFit – app.js
   Workout tracker with progress charts and AI recommendations
   ===================================================================== */

// ─── PWA SERVICE WORKER ──────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('SW Registered', reg))
      .catch(err => console.error('SW Registration failed', err));
  });
}

// ─── DATA ─────────────────────────────────────────────────────────────────

const API_URL = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1') 
  ? 'http://localhost:3000/api' 
  : `${window.location.origin}/api`;

const API = {
  async get(endpoint) {
    try {
      const res = await fetch(`${API_URL}${endpoint}`);
      return res.ok ? await res.json() : null;
    } catch (e) { console.error('API Error:', e); return null; }
  },
  async post(endpoint, data) {
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res.ok ? await res.json() : null;
    } catch (e) { console.error('API Error:', e); return null; }
  }
};

// Curated Unsplash photo IDs per exercise (fmt: photo-ID?w=400&q=80&auto=format&fit=crop)
const EX_IMGS = {
  'bench-press':      'photo-1544033527-b192daee1f5b',
  'incline-bench':    'photo-1571019614242-c5c5dee9f50b',
  'dumbbell-fly':     'photo-1583454110551-21f2fa2afe61',
  'pushup':           'photo-1598971639058-fab3c3109a56',
  'cable-crossover':  'photo-1534438327276-14e5300c3a48',
  'deadlift':         'photo-1526506118085-60ce8714f8c5',
  'pullup':           'photo-1604480132736-44c188fe4d20',
  'barbell-row':      'photo-1581009137042-c552e485697a',
  'lat-pulldown':     'photo-1534367610401-9f5ed68180aa',
  'seated-cable-row': 'photo-1517963879433-6ad2b056d712',
  'ohp':              'photo-1541534741688-6078c6bfb5c5',
  'lateral-raise':    'photo-1583454155184-870a1f63aebc',
  'front-raise':      'photo-1574680096145-d05b474e2155',
  'face-pull':        'photo-1549476464-37392f717541',
  'barbell-curl':     'photo-1581009146145-b5ef050c2e1e',
  'dumbbell-curl':    'photo-1596357395217-80807f5b40e3',
  'hammer-curl':      'photo-1567597838027-c98db0a1bf21',
  'preacher-curl':    'photo-1590487988256-9ed24133863e',
  'skull-crusher':    'photo-1534258936925-c58bed479fcb',
  'tricep-pushdown':  'photo-1530822847156-5df684ec5105',
  'overhead-ext':     'photo-1576678927484-cc907957088c',
  'dips':             'photo-1598632640487-6ea4a4e8b963',
  'squat':            'photo-1574680178050-55c6a6a96e0a',
  'leg-press':        'photo-1540497077202-7c8a3999166f',
  'leg-curl':         'photo-1548690596-f1722c190938',
  'leg-extension':    'photo-1434682881908-b43d0467b798',
  'lunge':            'photo-1518611012118-696072aa579a',
  'calf-raise':       'photo-1571019613454-1cb2f99b2d8b',
  'hip-thrust':       'photo-1604480132715-d233d4d3b042',
  'cable-kickback':   'photo-1594381898411-846e7d193883',
  'rdl':              'photo-1507398941214-572c25f4b1dc',
  'plank':            'photo-1566241142559-40a9552c8b2e',
  'crunch':           'photo-1571019613576-2b22c76fd955',
  'russian-twist':    'photo-1549060279-7e168fcee0c2',
  'cable-crunch':     'photo-1571019614622-2f9f2ecdecc5',
};

function exImg(id) {
  const photoId = EX_IMGS[id];
  if (photoId) return `https://images.unsplash.com/${photoId}?w=400&h=260&q=75&auto=format&fit=crop`;
  return null;
}

const MUSCLE_IMGS = {
  chest:     'https://images.unsplash.com/photo-1544033527-b192daee1f5b?w=400&h=260&q=75&auto=format&fit=crop',
  back:      'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=400&h=260&q=75&auto=format&fit=crop',
  shoulders: 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=400&h=260&q=75&auto=format&fit=crop',
  biceps:    'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=400&h=260&q=75&auto=format&fit=crop',
  triceps:   'https://images.unsplash.com/photo-1530822847156-5df684ec5105?w=400&h=260&q=75&auto=format&fit=crop',
  legs:      'https://images.unsplash.com/photo-1574680178050-55c6a6a96e0a?w=400&h=260&q=75&auto=format&fit=crop',
  glutes:    'https://images.unsplash.com/photo-1604480132715-d233d4d3b042?w=400&h=260&q=75&auto=format&fit=crop',
  core:      'https://images.unsplash.com/photo-1566241142559-40a9552c8b2e?w=400&h=260&q=75&auto=format&fit=crop',
};

// Emoji fallback for each muscle group (used when images fail to load)
const MUSCLE_EMOJIS = {
  chest: '💪', back: '🔽', shoulders: '👐', biceps: '💪',
  triceps: '🔱', legs: '🦵', glutes: '🍑', core: '🧘'
};

function getExImg(ex) {
  return exImg(ex.id) || MUSCLE_IMGS[ex.muscle] || null;
}

// Build a colored emoji placeholder SVG data URI as image fallback
function emojiPlaceholder(ex) {
  const emoji = ex?.emoji || MUSCLE_EMOJIS[ex?.muscle] || '🏋️';
  const colors = {
    chest: ['#7c3aed','#a78bfa'], back: ['#06b6d4','#22d3ee'], shoulders: ['#f59e0b','#fbbf24'],
    biceps: ['#ec4899','#f472b6'], triceps: ['#8b5cf6','#a78bfa'], legs: ['#f97316','#fb923c'],
    glutes: ['#ef4444','#f87171'], core: ['#10b981','#34d399']
  };
  const [c1, c2] = colors[ex?.muscle] || ['#7c3aed','#a78bfa'];
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='400' height='260'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='${c1}' stop-opacity='0.3'/><stop offset='100%' stop-color='${c2}' stop-opacity='0.15'/></linearGradient></defs><rect width='400' height='260' fill='url(#g)'/><text x='200' y='140' font-size='64' text-anchor='middle' dominant-baseline='central'>${emoji}</text></svg>`)}`;
}

const EXERCISE_DB = [
  // CHEST
  { id: 'bench-press',     name: 'Press Banca',               muscle: 'chest',     equipment: 'barbell',    emoji: '🏋️' },
  { id: 'incline-bench',   name: 'Press Inclinado',           muscle: 'chest',     equipment: 'barbell',    emoji: '🏋️' },
  { id: 'dumbbell-fly',    name: 'Aperturas Mancuerna',       muscle: 'chest',     equipment: 'dumbbell',   emoji: '💪' },
  { id: 'pushup',          name: 'Flexiones',                 muscle: 'chest',     equipment: 'bodyweight', emoji: '🤸' },
  { id: 'cable-crossover', name: 'Cruce de cables',           muscle: 'chest',     equipment: 'cables',     emoji: '🤜' },
  // BACK
  { id: 'deadlift',        name: 'Peso Muerto',               muscle: 'back',      equipment: 'barbell',    emoji: '🏋️' },
  { id: 'pullup',          name: 'Dominadas',                 muscle: 'back',      equipment: 'bodyweight', emoji: '🤸' },
  { id: 'barbell-row',     name: 'Remo con Barra',            muscle: 'back',      equipment: 'barbell',    emoji: '🔽' },
  { id: 'lat-pulldown',    name: 'Jalón al Pecho',            muscle: 'back',      equipment: 'machine',    emoji: '⬇️' },
  { id: 'seated-cable-row',name: 'Remo Polea',                muscle: 'back',      equipment: 'cables',     emoji: '🔄' },
  // SHOULDERS
  { id: 'ohp',             name: 'Press Militar',             muscle: 'shoulders', equipment: 'barbell',    emoji: '⬆️' },
  { id: 'lateral-raise',   name: 'Elevaciones Laterales',     muscle: 'shoulders', equipment: 'dumbbell',   emoji: '👐' },
  { id: 'front-raise',     name: 'Elevaciones Frontales',     muscle: 'shoulders', equipment: 'dumbbell',   emoji: '☝️' },
  { id: 'face-pull',       name: 'Face Pull',                 muscle: 'shoulders', equipment: 'cables',     emoji: '😮' },
  // BICEPS
  { id: 'barbell-curl',    name: 'Curl con Barra',            muscle: 'biceps',    equipment: 'barbell',    emoji: '💪' },
  { id: 'dumbbell-curl',   name: 'Curl Mancuerna',            muscle: 'biceps',    equipment: 'dumbbell',   emoji: '💪' },
  { id: 'hammer-curl',     name: 'Curl Martillo',             muscle: 'biceps',    equipment: 'dumbbell',   emoji: '🔨' },
  { id: 'preacher-curl',   name: 'Curl Predicador',           muscle: 'biceps',    equipment: 'machine',    emoji: '🙏' },
  // TRICEPS
  { id: 'skull-crusher',   name: 'Rompecráneos',              muscle: 'triceps',   equipment: 'barbell',    emoji: '💀' },
  { id: 'tricep-pushdown', name: 'Extensión de Tríceps',      muscle: 'triceps',   equipment: 'cables',     emoji: '⬇️' },
  { id: 'overhead-ext',    name: 'Extensión Sobre la Cabeza', muscle: 'triceps',   equipment: 'dumbbell',   emoji: '🔱' },
  { id: 'dips',            name: 'Fondos',                    muscle: 'triceps',   equipment: 'bodyweight', emoji: '🤸' },
  // LEGS
  { id: 'squat',           name: 'Sentadilla',                muscle: 'legs',      equipment: 'barbell',    emoji: '🦵' },
  { id: 'leg-press',       name: 'Prensa de Piernas',         muscle: 'legs',      equipment: 'machine',    emoji: '🦵' },
  { id: 'leg-curl',        name: 'Curl Femoral',              muscle: 'legs',      equipment: 'machine',    emoji: '🦵' },
  { id: 'leg-extension',   name: 'Extensión de Pierna',       muscle: 'legs',      equipment: 'machine',    emoji: '🦵' },
  { id: 'lunge',           name: 'Zancadas',                  muscle: 'legs',      equipment: 'dumbbell',   emoji: '🚶' },
  { id: 'calf-raise',      name: 'Elevación de Talones',      muscle: 'legs',      equipment: 'machine',    emoji: '👟' },
  // GLUTES
  { id: 'hip-thrust',      name: 'Hip Thrust',                muscle: 'glutes',    equipment: 'barbell',    emoji: '🍑' },
  { id: 'cable-kickback',  name: 'Cable Kickback',            muscle: 'glutes',    equipment: 'cables',     emoji: '👟' },
  { id: 'rdl',             name: 'Peso Muerto Rumano',        muscle: 'glutes',    equipment: 'barbell',    emoji: '🏋️' },
  // CORE
  { id: 'plank',           name: 'Plancha',                   muscle: 'core',      equipment: 'bodyweight', emoji: '🧘' },
  { id: 'crunch',          name: 'Crunch Abdominal',          muscle: 'core',      equipment: 'bodyweight', emoji: '🤸' },
  { id: 'russian-twist',   name: 'Russian Twist',             muscle: 'core',      equipment: 'bodyweight', emoji: '🌀' },
  { id: 'cable-crunch',    name: 'Crunch en Polea',           muscle: 'core',      equipment: 'cables',     emoji: '⚡' },
];

const TEMPLATES = {
  fullbody: ['squat', 'bench-press', 'deadlift', 'ohp', 'barbell-row', 'dumbbell-curl'],
  push:     ['bench-press', 'incline-bench', 'ohp', 'lateral-raise', 'tricep-pushdown', 'dips'],
  pull:     ['deadlift', 'barbell-row', 'lat-pulldown', 'barbell-curl', 'hammer-curl', 'face-pull'],
  legs:     ['squat', 'leg-press', 'rdl', 'leg-curl', 'calf-raise'],
  custom:   [],
};

const MUSCLE_LABELS = {
  chest: 'Pecho', back: 'Espalda', shoulders: 'Hombros',
  biceps: 'Bíceps', triceps: 'Tríceps', legs: 'Piernas',
  glutes: 'Glúteos', core: 'Core'
};

// ─── STRENGTH TIERS ───────────────────────────────────────────────────────
// 1RM thresholds in kg for each tier (based on strength standards)
// Format: [Bronce, Plata, Oro, Platino, Diamante, Rubí, Élite]

const STRENGTH_TIERS = [
  { id: 'novice',   label: 'Novato',   icon: '🪨', color: '#78716c' },
  { id: 'bronze',   label: 'Bronce',   icon: '🥉', color: '#cd7f32' },
  { id: 'silver',   label: 'Plata',    icon: '🥈', color: '#a8a9ad' },
  { id: 'gold',     label: 'Oro',      icon: '🥇', color: '#f59e0b' },
  { id: 'platinum', label: 'Platino',  icon: '💠', color: '#38bdf8' },
  { id: 'diamond',  label: 'Diamante', icon: '💎', color: '#a78bfa' },
  { id: 'ruby',     label: 'Rubí',     icon: '❤️‍🔥', color: '#f43f5e' },
  { id: 'elite',    label: 'Élite',    icon: '⚡', color: '#fde68a' },
];

// Thresholds per exercise: [Bronce, Plata, Oro, Platino, Diamante, Rubí, Élite]
const EXERCISE_TIER_THRESHOLDS = {
  // CHEST
  'bench-press':      [40, 60, 80,  100, 120, 140, 165],
  'incline-bench':    [35, 52, 70,  88,  105, 122, 145],
  'dumbbell-fly':     [15, 22, 30,  38,  46,  55,  65],
  'pushup':           [0,  0,  0,   0,   0,   0,   0],   // BW: uses reps
  'cable-crossover':  [20, 30, 40,  52,  64,  76,  90],
  // BACK
  'deadlift':         [60, 90, 120, 155, 190, 225, 265],
  'pullup':           [0,  0,  0,   0,   0,   0,   0],
  'barbell-row':      [40, 60, 80,  100, 120, 140, 165],
  'lat-pulldown':     [35, 52, 70,  88,  106, 124, 145],
  'seated-cable-row': [35, 50, 67,  84,  100, 118, 138],
  // SHOULDERS
  'ohp':              [25, 38, 52,  66,  80,  95,  112],
  'lateral-raise':    [8,  12, 16,  20,  25,  30,  36],
  'front-raise':      [8,  12, 16,  20,  25,  30,  36],
  'face-pull':        [15, 22, 30,  38,  46,  55,  65],
  // BICEPS
  'barbell-curl':     [20, 30, 40,  52,  64,  76,  90],
  'dumbbell-curl':    [10, 16, 22,  28,  34,  42,  50],
  'hammer-curl':      [10, 16, 22,  28,  34,  42,  50],
  'preacher-curl':    [20, 28, 38,  48,  58,  70,  82],
  // TRICEPS
  'skull-crusher':    [20, 30, 42,  54,  66,  80,  95],
  'tricep-pushdown':  [20, 30, 42,  54,  66,  80,  95],
  'overhead-ext':     [15, 22, 30,  38,  46,  55,  65],
  'dips':             [0,  0,  0,   0,   0,   0,   0],
  // LEGS
  'squat':            [50, 75, 100, 130, 160, 195, 230],
  'leg-press':        [70, 105,140, 180, 220, 265, 310],
  'leg-curl':         [20, 32, 44,  56,  70,  84,  100],
  'leg-extension':    [25, 37, 50,  63,  77,  92,  108],
  'lunge':            [20, 30, 42,  54,  66,  80,  95],
  'calf-raise':       [40, 60, 80,  105, 130, 158, 190],
  // GLUTES
  'hip-thrust':       [50, 80, 110, 145, 180, 218, 260],
  'cable-kickback':   [10, 15, 22,  28,  35,  42,  50],
  'rdl':              [45, 68, 90,  115, 140, 170, 200],
  // CORE
  'plank':            [0,  0,  0,   0,   0,   0,   0],
  'crunch':           [0,  0,  0,   0,   0,   0,   0],
  'russian-twist':    [5,  8,  12,  16,  20,  25,  30],
  'cable-crunch':     [20, 30, 42,  54,  66,  80,  95],
};

function getStrengthTier(exerciseId, orm) {
  const thresholds = EXERCISE_TIER_THRESHOLDS[exerciseId];
  if (!thresholds || orm <= 0) return null;

  // Find current tier (0 = Novato, then 1-7 for each threshold crossed)
  let tierIndex = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (thresholds[i] === 0) continue; // bodyweight exercise skip
    if (orm >= thresholds[i]) tierIndex = i + 1;
  }
  tierIndex = Math.min(tierIndex, STRENGTH_TIERS.length - 1);
  const tier = STRENGTH_TIERS[tierIndex];

  // Progress to next tier
  const nextIndex = tierIndex + 1;
  const nextTier = nextIndex < STRENGTH_TIERS.length ? STRENGTH_TIERS[nextIndex] : null;
  const nextThreshold = thresholds[tierIndex] || null; // next threshold to cross
  const prevThreshold = tierIndex > 0 ? (thresholds[tierIndex - 1] || 0) : 0;
  const progressPct = nextThreshold && nextThreshold > 0
    ? Math.min(100, Math.round(((orm - prevThreshold) / (nextThreshold - prevThreshold)) * 100))
    : 100;
  const kgToNext = nextThreshold ? Math.max(0, nextThreshold - orm) : 0;

  return { tier, tierIndex, nextTier, nextThreshold, progressPct, kgToNext, orm };
}



// ─── STATE ────────────────────────────────────────────────────────────────

let state = {
  workouts: [],         // completed workouts
  customExercises: [],  // user-defined exercises
  activeWorkout: null,  // { name, exercises: [{id, sets:[{weight, reps, done}]}] }
  timerInterval: null,
  timerSeconds: 0,
  currentView: 'dashboard',
  charts: {},
  // Routines
  routines: [],         // [{ id, name, emoji, exercises: [] }]
  // Settings
  userSettings: {
    restTime: 60,       // default rest time in seconds
  },
  // Rest Timer State
  restTimerSeconds: 0,
  restTimerInterval: null,
  // Discipline System
  plannedDays: [],      // array of ints 0-6 (0=Sun, 1=Mon...)
  disciplinePoints: 100,
  lastDisciplineCheck: null, // YYYY-MM-DD
  pendingMissedDay: null, // Date object of a day that was missed and needs justification
};

// ─── REST TIMER LOGIC ─────────────────────────────────────────────────────

function startRestTimer(seconds = state.userSettings.restTime) {
  if (state.restTimerInterval) clearInterval(state.restTimerInterval);
  
  state.restTimerSeconds = seconds;
  const overlay = document.getElementById('rest-timer-overlay');
  const countEl = document.getElementById('rest-timer-countdown');
  const progressSvg = document.getElementById('rest-timer-progress-svg');
  
  if (!overlay || !countEl || !progressSvg) return;

  overlay.classList.remove('hidden');
  updateRestTimerUI();

  state.restTimerInterval = setInterval(() => {
    state.restTimerSeconds--;
    updateRestTimerUI();

    if (state.restTimerSeconds <= 0) {
      stopRestTimer(true);
    }
  }, 1000);
}

function updateRestTimerUI() {
  const countEl = document.getElementById('rest-timer-countdown');
  const progressSvg = document.getElementById('rest-timer-progress-svg');
  if (!countEl || !progressSvg) return;

  countEl.textContent = state.restTimerSeconds;
  
  const total = state.userSettings.restTime || 60;
  const pct = (state.restTimerSeconds / total);
  const offset = 283 * (1 - pct);
  progressSvg.style.strokeDashoffset = offset;
}

function stopRestTimer(finished = false) {
  clearInterval(state.restTimerInterval);
  state.restTimerInterval = null;
  document.getElementById('rest-timer-overlay')?.classList.add('hidden');
  
  if (finished && navigator.vibrate) {
    navigator.vibrate([200, 100, 200]);
  }
}

// ─── PERSISTENCE ─────────────────────────────────────────────────────────

async function saveData() {
  // Save to LocalStorage (Fallback)
  localStorage.setItem('novafit_workouts', JSON.stringify(state.workouts));
  localStorage.setItem('novafit_custom_exercises', JSON.stringify(state.customExercises));
  localStorage.setItem('novafit_planned_days', JSON.stringify(state.plannedDays));
  localStorage.setItem('novafit_discipline_pts', state.disciplinePoints);
  localStorage.setItem('novafit_routines', JSON.stringify(state.routines));
  localStorage.setItem('novafit_settings', JSON.stringify(state.userSettings));
  if (state.lastDisciplineCheck) localStorage.setItem('novafit_last_check', state.lastDisciplineCheck);
  if (state.pendingMissedDay) localStorage.setItem('novafit_pending_miss', state.pendingMissedDay);
  else localStorage.removeItem('novafit_pending_miss');

  // Sync with Backend
  if (window.serverAvailable) {
    // Note: In a real app we'd only sync changes. Here we sync everything for simplicity.
    // For workouts, we usually POST individual ones when finished.
    API.post('/settings/global', {
      plannedDays: state.plannedDays,
      disciplinePoints: state.disciplinePoints,
      lastDisciplineCheck: state.lastDisciplineCheck,
      pendingMissedDay: state.pendingMissedDay,
      userSettings: state.userSettings
    });
  }
}

async function loadData() {
  // 1. Try Backend
  const serverSettings = await API.get('/settings');
  if (serverSettings) {
    window.serverAvailable = true;
    const workouts = await API.get('/workouts');
    const customEx = await API.get('/custom-exercises');
    const routines = await API.get('/routines');

    if (workouts) state.workouts = workouts;
    if (customEx) state.customExercises = customEx;
    if (routines) state.routines = routines;

    const global = serverSettings.global || {};
    state.plannedDays = global.plannedDays || [];
    state.disciplinePoints = global.disciplinePoints ?? 100;
    state.lastDisciplineCheck = global.lastDisciplineCheck || null;
    state.pendingMissedDay = global.pendingMissedDay || null;
    state.userSettings = { ...state.userSettings, ...(global.userSettings || {}) };
  } else {
    // 2. Fallback to LocalStorage
    window.serverAvailable = false;
    try {
      state.workouts = JSON.parse(localStorage.getItem('novafit_workouts') || '[]');
      state.customExercises = JSON.parse(localStorage.getItem('novafit_custom_exercises') || '[]');
      state.plannedDays = JSON.parse(localStorage.getItem('novafit_planned_days') || '[]');
      state.routines = JSON.parse(localStorage.getItem('novafit_routines') || '[]');
      state.userSettings = JSON.parse(localStorage.getItem('novafit_settings') || '{"restTime":60}');
      
      const pts = localStorage.getItem('novafit_discipline_pts');
      if (pts) state.disciplinePoints = parseInt(pts);
      state.lastDisciplineCheck = localStorage.getItem('novafit_last_check') || null;
      state.pendingMissedDay = localStorage.getItem('novafit_pending_miss') || null;
    } catch {
      console.warn('Failed to load local data');
    }
  }

  // If no routines, add defaults
  if (state.routines.length === 0) {
    state.routines = [
      { id: 'fb-1', name: 'Full Body A', emoji: '💪', exercises: TEMPLATES.fullbody },
      { id: 'push-1', name: 'Empuje (Push)', emoji: '🔥', exercises: TEMPLATES.push },
      { id: 'pull-1', name: 'Tracción (Pull)', emoji: '🎣', exercises: TEMPLATES.pull },
      { id: 'legs-1', name: 'Pierna (Legs)', emoji: '🦵', exercises: TEMPLATES.legs },
    ];
  }
}

// ─── EXERCISE UTILS ───────────────────────────────────────────────────────

function getAllExercises() {
  return [...EXERCISE_DB, ...state.customExercises];
}

function getExercise(id) {
  return getAllExercises().find(e => e.id === id);
}

// Epley formula for estimated 1RM
function calc1RM(weight, reps) {
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

function getBestSet(sets) {
  return sets.reduce((best, s) => {
    const orm = calc1RM(Number(s.weight) || 0, Number(s.reps) || 0);
    return orm > best.orm ? { ...s, orm } : best;
  }, { orm: 0, weight: 0, reps: 0 });
}

function getWorkoutVolume(workout) {
  return workout.exercises.reduce((total, ex) => {
    return total + ex.sets.reduce((s, set) => s + ((Number(set.weight) || 0) * (Number(set.reps) || 0)), 0);
  }, 0);
}

// ─── EXERCISE STATS (PR, MAX VOLUME, WEIGHT RANGE) ───────────────────────

function getExerciseStats(id) {
  const allSets = [];  // { weight, reps, date }
  const sessionVolumes = [];  // volume per session

  state.workouts.forEach(w => {
    const ex = w.exercises.find(e => e.id === id);
    if (!ex) return;
    let sessionVol = 0;
    ex.sets.forEach(s => {
      const w_ = Number(s.weight) || 0;
      const r_ = Number(s.reps) || 0;
      allSets.push({ weight: w_, reps: r_, date: w.date });
      sessionVol += w_ * r_;
    });
    sessionVolumes.push(sessionVol);
  });

  if (!allSets.length) return null;

  // PR: best 1RM set
  let prSet = { weight: 0, reps: 0, orm: 0 };
  allSets.forEach(s => {
    const orm = calc1RM(s.weight, s.reps);
    if (orm > prSet.orm) prSet = { ...s, orm };
  });

  // Max volume in a single session
  const maxVolume = Math.max(...sessionVolumes);

  // Weight range used
  const weights = allSets.map(s => s.weight).filter(w => w > 0);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);

  // Suggested range for hypertrophy (8-12 reps) based on 1RM
  // 8 reps ≈ 80% 1RM, 12 reps ≈ 67% 1RM
  const suggestLow  = prSet.orm > 0 ? Math.round(prSet.orm * 0.65 / 2.5) * 2.5 : null;
  const suggestHigh = prSet.orm > 0 ? Math.round(prSet.orm * 0.82 / 2.5) * 2.5 : null;

  return { prSet, maxVolume, minWeight, maxWeight, suggestLow, suggestHigh, sessions: sessionVolumes.length };
}

// ─── STREAK ───────────────────────────────────────────────────────────────

function calcStreak() {
  if (!state.workouts.length) return 0;
  const today = dateOnly(new Date());
  const dates = [...new Set(state.workouts.map(w => dateOnly(new Date(w.date))))].sort((a, b) => b.localeCompare(a));
  let streak = 0;
  let current = today;
  for (const d of dates) {
    if (d === current) { streak++; current = addDays(current, -1); }
    else if (d < current) { if (streak === 0) { current = d; streak = 1; current = addDays(current, -1); } else break; }
  }
  return streak;
}

function dateOnly(date) {
  return date.toISOString().slice(0, 10);
}
function addDays(dateStr, n) {
  const d = new Date(dateStr); d.setDate(d.getDate() + n); return dateOnly(d);
}

// ─── AI RECOMMENDATIONS ───────────────────────────────────────────────────

function generateRecommendations() {
  const exerciseHistory = {};

  state.workouts.forEach(w => {
    w.exercises.forEach(ex => {
      if (!exerciseHistory[ex.id]) exerciseHistory[ex.id] = [];
      const best = getBestSet(ex.sets);
      exerciseHistory[ex.id].push({ date: w.date, weight: Number(best.weight) || 0, reps: Number(best.reps) || 0, orm: best.orm });
    });
  });

  const recommendations = [];

  Object.entries(exerciseHistory).forEach(([id, history]) => {
    if (history.length < 2) return;
    const ex = getExercise(id);
    if (!ex) return;

    const sorted = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));
    const recent = sorted.slice(-3);
    const last = recent[recent.length - 1];
    const prev = recent[recent.length - 2];

    const ormGain = last.orm - prev.orm;
    const repsLast = last.reps;
    const weightLast = last.weight;

    let type, msg, pill, suggestion;

    if (repsLast >= 12 && ormGain >= 0) {
      // Time to increase weight
      const suggestWeight = weightLast + (weightLast <= 20 ? 1 : weightLast <= 60 ? 2.5 : 5);
      type = 'up'; pill = 'increase';
      msg = `¡Hiciste ${repsLast} reps con ${weightLast}kg! Es hora de subir el peso.`;
      suggestion = `Prueba ${suggestWeight}kg × 8-10 reps`;
    } else if (repsLast < 6 && ormGain < 0) {
      // Deload or maintain
      type = 'maintain'; pill = 'maintain';
      msg = `Solo ${repsLast} reps con ${weightLast}kg. Consolida antes de subir.`;
      suggestion = `Mantén ${weightLast}kg, intenta ${repsLast + 2} reps`;
    } else if (repsLast >= 8 && repsLast < 12) {
      // More reps suggestion
      type = 'up'; pill = 'increase';
      msg = `Buen trabajo con ${repsLast} reps. Apunta a más repeticiones.`;
      suggestion = `Prueba ${repsLast + 2} reps con ${weightLast}kg`;
    } else if (ormGain > 5) {
      type = 'up'; pill = 'increase';
      msg = `¡Tu 1RM estimado subió ${ormGain}kg! Sigue progresando.`;
      suggestion = `Intenta ${weightLast + 2.5}kg la próxima vez`;
    } else {
      return; // No recommendation needed
    }

    recommendations.push({ id, exercise: ex.name, type, msg, suggestion, pill });
  });

  return recommendations.slice(0, 6);
}

// ─── RENDER HELPERS ───────────────────────────────────────────────────────

function fmt(date) {
  return new Date(date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}

function fmtDuration(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ─── VIEWS ────────────────────────────────────────────────────────────────

function switchView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
  document.getElementById(`view-${view}`).classList.add('active');
  document.getElementById(`nav-${view}`)?.classList.add('active');
  document.getElementById(`tab-${view}`)?.classList.add('active');
  state.currentView = view;
  closeSidebar();

  if (view === 'dashboard') renderDashboard();
  if (view === 'workout') renderRoutineGrid();
  if (view === 'history') renderHistory();
  if (view === 'progress') renderProgressView();
  if (view === 'library') renderLibrary();
}

function renderRoutineGrid() {
  const grid = document.getElementById('routine-grid');
  if (!grid) return;
  
  if (state.routines.length === 0) {
    grid.innerHTML = '<div class="empty-state" style="grid-column: 1/-1;">No tienes rutinas propias aún.</div>';
    return;
  }

  grid.innerHTML = state.routines.map(r => `
    <div class="template-card" data-routine-id="${r.id}">
      <div class="template-emoji">${r.emoji || '💪'}</div>
      <div class="template-name">${r.name}</div>
      <div class="template-info">${r.exercises.length} ejercicios</div>
      <div class="template-actions" style="margin-top:8px; display:flex; gap:8px;">
        <button class="btn btn-ghost btn-xs edit-routine-btn" data-id="${r.id}">Editar</button>
        <button class="btn btn-primary btn-xs start-routine-btn" data-id="${r.id}">Empezar</button>
      </div>
    </div>
  `).join('');

  // Bind new buttons
  grid.querySelectorAll('.edit-routine-btn').forEach(b => {
    b.onclick = (e) => { e.stopPropagation(); openRoutineEditor(b.dataset.id); };
  });
  grid.querySelectorAll('.start-routine-btn').forEach(b => {
    b.onclick = (e) => { e.stopPropagation(); startWorkout(b.dataset.id, true); };
  });
}

let editingRoutineId = null;

function openRoutineEditor(id = null) {
  editingRoutineId = id;
  const routine = id ? state.routines.find(r => r.id === id) : { name: '', emoji: '💪', exercises: [] };
  
  document.getElementById('routine-editor-title').textContent = id ? 'Editar Rutina' : 'Nueva Rutina';
  document.getElementById('routine-name-input').value = routine.name;
  document.getElementById('delete-routine-btn').style.display = id ? 'block' : 'none';
  
  renderRoutineEditorExercises(routine.exercises);
  document.getElementById('routine-editor-backdrop').classList.remove('hidden');
}

function renderRoutineEditorExercises(exerciseIds) {
  const el = document.getElementById('routine-exercise-list');
  el.innerHTML = exerciseIds.map((eid, idx) => {
    const ex = getExercise(eid);
    return `
      <div class="routine-ex-item" data-index="${idx}">
        <span class="routine-ex-name">${ex?.name || eid}</span>
        <span class="routine-ex-remove" onclick="removeExFromRoutine(${idx})">✕</span>
      </div>
    `;
  }).join('');
  
  // Store temporary list on the element
  el.dataset.exercises = JSON.stringify(exerciseIds);
}

function removeExFromRoutine(index) {
  const el = document.getElementById('routine-exercise-list');
  const exercises = JSON.parse(el.dataset.exercises);
  exercises.splice(index, 1);
  renderRoutineEditorExercises(exercises);
}

function initRoutineEvents() {
    document.getElementById('create-routine-btn').onclick = () => openRoutineEditor();
    document.getElementById('close-routine-editor').onclick = () => document.getElementById('routine-editor-backdrop').classList.add('hidden');
    
    document.getElementById('routine-add-ex-btn').onclick = () => {
        // Open exercise picker with a callback
        openExercisePicker((exId) => {
            const el = document.getElementById('routine-exercise-list');
            const exercises = JSON.parse(el.dataset.exercises);
            exercises.push(exId);
            renderRoutineEditorExercises(exercises);
        });
    };

    document.getElementById('save-routine-btn').onclick = async () => {
        const name = document.getElementById('routine-name-input').value.trim();
        if (!name) return alert('Ponle un nombre a la rutina');
        
        const exercises = JSON.parse(document.getElementById('routine-exercise-list').dataset.exercises);
        if (exercises.length === 0) return alert('Añade al menos un ejercicio');

        const routine = {
            id: editingRoutineId || `rout-${Date.now()}`,
            name,
            emoji: '💪', // TODO: Allow emoji picker
            exercises
        };

        if (editingRoutineId) {
            const idx = state.routines.findIndex(r => r.id === editingRoutineId);
            state.routines[idx] = routine;
        } else {
            state.routines.unshift(routine);
        }

        if (window.serverAvailable) {
            await API.post('/routines', routine);
        }
        
        saveData();
        document.getElementById('routine-editor-backdrop').classList.add('hidden');
        renderRoutineGrid();
    };

    document.getElementById('delete-routine-btn').onclick = async () => {
        if (!confirm('¿Seguro que quieres borrar esta rutina?')) return;
        if (editingRoutineId) {
            state.routines = state.routines.filter(r => r.id !== editingRoutineId);
            if (window.serverAvailable) {
                await fetch(`${API_URL}/routines/${editingRoutineId}`, { method: 'DELETE' });
            }
            saveData();
        }
        document.getElementById('routine-editor-backdrop').classList.add('hidden');
        renderRoutineGrid();
    };
}

function updateSidebarStreak() {
  const streak = calcStreak();
  const sidebarEl = document.getElementById('sidebar-streak-num');
  const topbarEl = document.getElementById('topbar-streak-num');
  if (sidebarEl) sidebarEl.textContent = streak;
  if (topbarEl) topbarEl.textContent = streak;
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────

function renderDashboard() {
  // Greeting
  const hour = new Date().getHours();
  const greet = hour < 12 ? '¡Buenos días!' : hour < 18 ? '¡Buenas tardes!' : '¡Buenas noches!';
  document.getElementById('greeting').textContent = greet + ' 💪';

  // Stats
  const totalWorkouts = state.workouts.length;
  const totalVolume = state.workouts.reduce((t, w) => t + getWorkoutVolume(w), 0);
  const streak = calcStreak();
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const weekPRs = countWeeklyPRs();

  document.getElementById('stat-total-workouts').textContent = totalWorkouts;
  document.getElementById('stat-total-volume').textContent = totalVolume >= 1000 ? `${(totalVolume/1000).toFixed(1)}t` : `${Math.round(totalVolume)}kg`;
  document.getElementById('stat-streak').textContent = streak;
  document.getElementById('stat-prs').textContent = weekPRs;
  document.getElementById('sidebar-streak-num').textContent = streak;

  // Last workout
  if (state.workouts.length > 0) {
    const last = [...state.workouts].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    document.getElementById('last-workout-date').textContent = fmt(last.date);
    document.getElementById('last-workout-content').innerHTML = `
      <div style="font-size:15px; font-weight:700; margin-bottom:10px;">${last.name}</div>
      ${last.exercises.slice(0, 4).map(ex => {
        const exInfo = getExercise(ex.id);
        const best = getBestSet(ex.sets);
        return `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);font-size:13px;">
          <span>${exInfo?.emoji || '💪'} ${exInfo?.name || ex.id}</span>
          <span style="color:var(--text-secondary)">${ex.sets.length} series · ${best.weight}kg × ${best.reps}</span>
        </div>`;
      }).join('')}
      ${last.exercises.length > 4 ? `<div style="color:var(--text-muted);font-size:12px;margin-top:8px;">+${last.exercises.length - 4} ejercicios más</div>` : ''}
    `;
  }

  // Recommendations
  renderRecommendations();

  // Weekly chart
  // Add renderDiscipline to renderDashboard
  renderDiscipline();
  renderWeeklyChart();
}

function countWeeklyPRs() {
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const weekWorkouts = state.workouts.filter(w => new Date(w.date) >= weekAgo);
  const olderWorkouts = state.workouts.filter(w => new Date(w.date) < weekAgo);
  let prs = 0;
  weekWorkouts.forEach(w => {
    w.exercises.forEach(ex => {
      const best = getBestSet(ex.sets);
      const prevBest = olderWorkouts.flatMap(ow => ow.exercises.filter(e => e.id === ex.id)).flatMap(e => e.sets);
      if (prevBest.length === 0) return;
      const prevOrm = Math.max(...prevBest.map(s => calc1RM(Number(s.weight) || 0, Number(s.reps) || 0)));
      if (best.orm > prevOrm) prs++;
    });
  });
  return prs;
}

function renderRecommendations() {
  const recs = generateRecommendations();
  const el = document.getElementById('recommendations-list');
  if (!recs.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🤖</div><p>Haz al menos 2 entrenamientos del mismo ejercicio para recibir recomendaciones</p></div>`;
    return;
  }
  el.innerHTML = recs.map(r => `
    <div class="recommendation-item">
      <div class="rec-type ${r.type}">${r.type === 'up' ? '⬆️' : r.type === 'maintain' ? '✋' : '⬇️'}</div>
      <div class="rec-body">
        <div class="rec-exercise">${r.exercise}</div>
        <div class="rec-msg">${r.msg}</div>
        <span class="rec-pill ${r.pill}">${r.suggestion}</span>
      </div>
    </div>
  `).join('');
}

function renderWeeklyChart() {
  const ctx = document.getElementById('weekly-chart');
  if (!ctx) return;
  if (state.charts.weekly) { state.charts.weekly.destroy(); }

  const days = [];
  const volumes = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const dateStr = dateOnly(d);
    days.push(d.toLocaleDateString('es-ES', { weekday: 'short' }));
    const vol = state.workouts.filter(w => dateOnly(new Date(w.date)) === dateStr)
      .reduce((t, w) => t + getWorkoutVolume(w), 0);
    volumes.push(Math.round(vol));
  }

  state.charts.weekly = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: days,
      datasets: [{
        label: 'Volumen (kg)',
        data: volumes,
        backgroundColor: volumes.map(v => v > 0 ? 'rgba(124,58,237,0.8)' : 'rgba(42,42,62,0.6)'),
        borderRadius: 8,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#9090b8' } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#9090b8' }, beginAtZero: true },
      },
    }
  });
}

// ─── HISTORY ──────────────────────────────────────────────────────────────

function renderHistory() {
  const el = document.getElementById('history-list');
  if (!state.workouts.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><p>Aún no tienes entrenamientos guardados</p></div>`;
    return;
  }
  const sorted = [...state.workouts].sort((a, b) => new Date(b.date) - new Date(a.date));
  el.innerHTML = sorted.map(w => {
    const vol = getWorkoutVolume(w);
    const exCount = w.exercises.length;
    const setCount = w.exercises.reduce((t, e) => t + e.sets.length, 0);
    const emoji = ['💪','🔥','⚡','🏆','🦾'][Math.floor(Math.random() * 5)];
    return `
      <div class="history-card" onclick="openWorkoutDetail('${w.id}')">
        <div class="history-icon">${emoji}</div>
        <div class="history-info">
          <div class="history-name">${w.name}</div>
          <div class="history-meta">${exCount} ejercicios · ${setCount} series · ${Math.round(vol)}kg de volumen${w.duration ? ` · ${fmtDuration(w.duration)}` : ''}</div>
          <div class="history-stats">
            ${w.exercises.slice(0, 3).map(ex => {
              const exInfo = getExercise(ex.id);
              return `<span class="history-badge">${exInfo?.name || ex.id}</span>`;
            }).join('')}
            ${w.exercises.length > 3 ? `<span class="history-badge">+${w.exercises.length-3}</span>` : ''}
          </div>
        </div>
        <div class="history-date">${fmt(w.date)}</div>
      </div>
    `;
  }).join('');
}

function openWorkoutDetail(id) {
  const w = state.workouts.find(wk => wk.id === id);
  if (!w) return;
  document.getElementById('workout-detail-title').textContent = w.name;
  document.getElementById('workout-detail-content').innerHTML = `
    <div style="color:var(--text-secondary);font-size:13px;margin-bottom:18px;">${fmt(w.date)} ${w.duration ? `· ${fmtDuration(w.duration)}` : ''}</div>
    ${w.exercises.map(ex => {
      const exInfo = getExercise(ex.id);
      return `
        <div class="detail-exercise">
          <div class="detail-ex-name">${exInfo?.emoji || '💪'} ${exInfo?.name || ex.id}</div>
          <div class="detail-sets">
            ${ex.sets.map((s, i) => `
              <div class="detail-set">
                <span>Serie ${i+1}:</span>
                <strong>${s.weight}kg × ${s.reps} reps</strong>
                <span style="color:var(--text-muted)">(~${calc1RM(Number(s.weight),Number(s.reps))}kg 1RM)</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('')}
    <button class="btn btn-ghost" style="color:var(--danger);margin-top:8px" onclick="deleteWorkout('${w.id}')">🗑 Eliminar entrenamiento</button>
  `;
  document.getElementById('workout-detail-backdrop').classList.remove('hidden');
}

function deleteWorkout(id) {
  state.workouts = state.workouts.filter(w => w.id !== id);
  saveData();
  document.getElementById('workout-detail-backdrop').classList.add('hidden');
  renderHistory();
  renderDashboard();
}

// ─── PROGRESS ─────────────────────────────────────────────────────────────

let progressPeriod = 'month';

function renderProgressView() {
  const select = document.getElementById('progress-exercise-select');
  const exercises = getAllExercises().filter(ex => {
    return state.workouts.some(w => w.exercises.some(e => e.id === ex.id));
  });

  const prevVal = select.value;
  select.innerHTML = '<option value="">— Selecciona un ejercicio —</option>' +
    exercises.map(ex => `<option value="${ex.id}">${ex.name}</option>`).join('');
  if (prevVal) select.value = prevVal;

  renderPRs();
  renderMuscleHeatmap(progressPeriod);
  renderAnatomicalMap(progressPeriod);
  if (select.value) renderProgressCharts(select.value, progressPeriod);
}

function renderAnatomicalMap(period) {
  let cutoff = null;
  if (period === 'month') { cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 1); }
  if (period === '3months') { cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 3); }

  const muscleVolume = {
    chest: 0, back: 0, shoulders: 0, biceps: 0, triceps: 0, legs: 0, glutes: 0, core: 0
  };
  
  state.workouts
    .filter(w => !cutoff || new Date(w.date) >= cutoff)
    .forEach(w => {
      w.exercises.forEach(ex => {
        const exInfo = getExercise(ex.id);
        if (!exInfo || !muscleVolume.hasOwnProperty(exInfo.muscle)) return;
        
        let vol = 0;
        ex.sets.forEach(s => { vol += (Number(s.weight) || 0) * (Number(s.reps) || 0); });
        if (vol === 0) {
           ex.sets.forEach(s => { vol += (Number(s.reps) || 1) * 5; });
        }
        muscleVolume[exInfo.muscle] += vol;
      });
    });

  if (window.renderBodyMap) window.renderBodyMap(muscleVolume);
}

function renderMuscleHeatmap(period) {
  const ctx = document.getElementById('heatmap-chart');
  if (!ctx) return;
  if (state.charts.heatmap) state.charts.heatmap.destroy();

  let cutoff = null;
  if (period === 'month') { cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 1); }
  if (period === '3months') { cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 3); }

  const muscleVolume = {};
  
  state.workouts
    .filter(w => !cutoff || new Date(w.date) >= cutoff)
    .forEach(w => {
      w.exercises.forEach(ex => {
        const exInfo = getExercise(ex.id);
        if (!exInfo || exInfo.muscle === 'other') return;
        
        let vol = 0;
        ex.sets.forEach(s => { vol += (Number(s.weight) || 0) * (Number(s.reps) || 0); });
        // If bodyweight or untracked weight, count sets * reps instead of 0
        if (vol === 0) {
           ex.sets.forEach(s => { vol += (Number(s.reps) || 1) * 5; }); // arbitrary baseline
        }
        
        const label = MUSCLE_LABELS[exInfo.muscle] || exInfo.muscle;
        muscleVolume[label] = (muscleVolume[label] || 0) + vol;
      });
    });

  const mLabels = Object.keys(muscleVolume);
  const mData = Object.values(muscleVolume);

  if (mLabels.length === 0) {
    ctx.style.display = 'none';
    return;
  }
  ctx.style.display = 'block';

  // Sort by volume descending
  const sorted = mLabels.map((lbl, i) => ({ lbl, val: mData[i] })).sort((a,b) => b.val - a.val);

  state.charts.heatmap = new Chart(ctx, {
    type: 'polarArea',
    data: {
      labels: sorted.map(i => i.lbl),
      datasets: [{
        data: sorted.map(i => i.val),
        backgroundColor: [
          'rgba(124, 58, 237, 0.7)', // violet
          'rgba(6, 182, 212, 0.7)', // cyan
          'rgba(244, 114, 182, 0.7)', // pink
          'rgba(245, 158, 11, 0.7)', // amber
          'rgba(16, 185, 129, 0.7)', // emerald
          'rgba(239, 68, 68, 0.7)', // red
          'rgba(99, 102, 241, 0.7)', // indigo
          'rgba(20, 184, 166, 0.7)' // teal
        ],
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)'
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        r: {
          ticks: { display: false },
          grid: { color: 'rgba(255,255,255,0.05)' },
          angleLines: { color: 'rgba(255,255,255,0.05)' }
        }
      },
      plugins: {
        legend: { position: 'right', labels: { color: '#e2e8f0', font: { family: 'Outfit', size: 12 } } }
      }
    }
  });
}

function renderProgressCharts(exerciseId, period) {
  if (!exerciseId) return;

  let cutoff = null;
  if (period === 'month') { cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 1); }
  if (period === '3months') { cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 3); }

  const points = [];
  state.workouts
    .filter(w => !cutoff || new Date(w.date) >= cutoff)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .forEach(w => {
      const ex = w.exercises.find(e => e.id === exerciseId);
      if (!ex) return;
      const best = getBestSet(ex.sets);
      const totalVol = ex.sets.reduce((t, s) => t + (Number(s.weight)||0)*(Number(s.reps)||0), 0);
      const maxReps = Math.max(...ex.sets.map(s => Number(s.reps)||0));
      points.push({
        date: fmt(w.date),
        orm: best.orm,
        weight: Number(best.weight) || 0,
        volume: Math.round(totalVol),
        maxReps,
      });
    });

  const labels = points.map(p => p.date);
  const chartConfigs = [
    { id: 'orm-chart', key: 'orm', label: '1RM Estimado (kg)', color: '#7c3aed' },
    { id: 'maxweight-chart', key: 'weight', label: 'Peso Máximo (kg)', color: '#06b6d4' },
    { id: 'volume-chart', key: 'volume', label: 'Volumen (kg)', color: '#f472b6' },
    { id: 'maxreps-chart', key: 'maxReps', label: 'Repeticiones Máximas', color: '#10b981' },
  ];

  chartConfigs.forEach(cfg => {
    const ctx = document.getElementById(cfg.id);
    if (!ctx) return;
    if (state.charts[cfg.id]) state.charts[cfg.id].destroy();
    state.charts[cfg.id] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: cfg.label,
          data: points.map(p => p[cfg.key]),
          borderColor: cfg.color,
          backgroundColor: cfg.color + '20',
          borderWidth: 2.5,
          pointBackgroundColor: cfg.color,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.35,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#9090b8', maxRotation: 45 } },
          y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#9090b8' }, beginAtZero: false },
        },
      }
    });
  });
}

function renderPRs() {
  const prs = {};
  state.workouts.forEach(w => {
    w.exercises.forEach(ex => {
      ex.sets.forEach(s => {
        const orm = calc1RM(Number(s.weight)||0, Number(s.reps)||0);
        if (!prs[ex.id] || orm > prs[ex.id].orm) {
          prs[ex.id] = { orm, weight: s.weight, reps: s.reps, date: w.date };
        }
      });
    });
  });

  const prList = document.getElementById('prs-list');
  const entries = Object.entries(prs);
  if (!entries.length) {
    prList.innerHTML = `<div class="empty-state"><p>Completa entrenamientos para ver tus records</p></div>`;
    return;
  }
  prList.innerHTML = entries.map(([id, pr]) => {
    const ex = getExercise(id);
    return `<div class="pr-item">
      <div class="pr-exercise">${ex?.emoji || '💪'} ${ex?.name || id}</div>
      <div class="pr-value">${pr.weight}kg × ${pr.reps}</div>
      <div class="pr-label">~${pr.orm}kg 1RM · ${fmt(pr.date)}</div>
    </div>`;
  }).join('');
}

// ─── LIBRARY ──────────────────────────────────────────────────────────────

let libraryFilter = 'all';
let librarySearch = '';

function renderLibrary() {
  const all = getAllExercises();
  const filtered = all.filter(ex => {
    const matchMuscle = libraryFilter === 'all' || ex.muscle === libraryFilter;
    const matchSearch = ex.name.toLowerCase().includes(librarySearch.toLowerCase());
    return matchMuscle && matchSearch;
  });
  document.getElementById('library-grid').innerHTML = filtered.map(ex => {
    const img = getExImg(ex) || emojiPlaceholder(ex);
    const isCustom = state.customExercises.some(c => c.id === ex.id);
    return `
    <div class="library-item${isCustom ? ' custom' : ''}">
      <div class="lib-img-wrap">
        <img class="lib-img" src="${img}" alt="${ex.name}" loading="lazy" onerror="this.src='${emojiPlaceholder(ex)}'" />
        <div class="lib-muscle-tag">${MUSCLE_LABELS[ex.muscle] || ex.muscle}</div>
      </div>
      <div class="lib-info">
        <div class="lib-name">${ex.name}</div>
        <div class="lib-equipment">${ex.equipment}</div>
      </div>
    </div>`;
  }).join('');
}

// ─── WORKOUT ──────────────────────────────────────────────────────────────

function startWorkout(id, isRoutine = false) {
  clearInterval(state.timerInterval);
  state.timerSeconds = 0;
  
  let exercises = [];
  let name = 'Entrenamiento';

  if (isRoutine) {
    const routine = state.routines.find(r => r.id === id);
    if (routine) {
      exercises = routine.exercises;
      name = routine.name;
    }
  } else if (id && TEMPLATES[id]) {
    exercises = TEMPLATES[id];
    name = document.querySelector(`[data-template="${id}"] .template-name`)?.textContent || `Entrenamiento ${id.charAt(0).toUpperCase()+id.slice(1)}`;
  } else if (id === 'custom') {
    name = 'Mi Entrenamiento';
  }

  state.activeWorkout = {
    name,
    exercises: [],
    startTime: Date.now(),
  };

  document.getElementById('workout-name').value = state.activeWorkout.name;
  document.getElementById('workout-idle').classList.add('hidden');
  document.getElementById('workout-active').classList.remove('hidden');

  if (exercises.length > 0) {
    exercises.forEach(exId => addExerciseToWorkout(exId));
  }

  state.timerInterval = setInterval(() => {
    state.timerSeconds++;
    document.getElementById('workout-timer').textContent = fmtDuration(state.timerSeconds);
  }, 1000);
}

function addExerciseToWorkout(exerciseId) {
  const prevSets = getLastSetsForExercise(exerciseId);
  const defaultSets = prevSets.length ? prevSets : [{ weight: '', reps: '', done: false }];
  state.activeWorkout.exercises.push({ id: exerciseId, sets: defaultSets.map(s => ({...s, done: false})) });
  renderActiveWorkout();
}

function getLastSetsForExercise(id) {
  const past = state.workouts.filter(w => w.exercises.some(e => e.id === id));
  if (!past.length) return [];
  const last = [...past].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  const ex = last.exercises.find(e => e.id === id);
  return ex ? ex.sets.map(s => ({ weight: s.weight, reps: s.reps, done: false })) : [];
}

function buildStatsBar(exerciseId) {
  const stats = getExerciseStats(exerciseId);
  if (!stats) return '';

  const prLabel     = `${stats.prSet.weight}kg × ${stats.prSet.reps} reps`;
  const ormLabel    = `~${stats.prSet.orm}kg 1RM`;
  const volLabel    = `${Math.round(stats.maxVolume).toLocaleString('es')}kg`;
  const rangeLabel  = stats.minWeight === stats.maxWeight
    ? `${stats.minWeight}kg`
    : `${stats.minWeight}–${stats.maxWeight}kg`;
  const suggestLabel = stats.suggestLow && stats.suggestHigh
    ? `${stats.suggestLow}–${stats.suggestHigh}kg`
    : '—';

  // Tier section
  const tierInfo = getStrengthTier(exerciseId, stats.prSet.orm);
  let tierHTML = '';
  if (tierInfo) {
    const { tier, nextTier, progressPct, kgToNext } = tierInfo;
    const nextLabel = nextTier
      ? `${nextTier.icon} ${nextTier.label} · faltan ${kgToNext}kg`
      : '¡Nivel máximo alcanzado! 🎉';
    tierHTML = `
      <div class="ex-tier-banner" style="--tier-color: ${tier.color}">
        <div class="ex-tier-left">
          <div class="ex-tier-badge">${tier.icon}</div>
          <div>
            <div class="ex-tier-name" style="color:${tier.color}">${tier.label}</div>
            <div class="ex-tier-sub">${ormLabel}</div>
          </div>
        </div>
        <div class="ex-tier-right">
          <div class="ex-tier-next">${nextLabel}</div>
          <div class="ex-tier-bar-wrap">
            <div class="ex-tier-bar-fill" style="width:${progressPct}%; background:${tier.color}"></div>
          </div>
          <div class="ex-tier-pct">${progressPct}%</div>
        </div>
      </div>`;
  }

  return `${tierHTML}
    <div class="ex-stats-bar">
      <div class="ex-stat-item">
        <span class="ex-stat-icon">🏆</span>
        <div>
          <div class="ex-stat-value">${prLabel}</div>
          <div class="ex-stat-label">PR · ${ormLabel}</div>
        </div>
      </div>
      <div class="ex-stat-sep"></div>
      <div class="ex-stat-item">
        <span class="ex-stat-icon">📦</span>
        <div>
          <div class="ex-stat-value">${volLabel}</div>
          <div class="ex-stat-label">Volumen máx.</div>
        </div>
      </div>
      <div class="ex-stat-sep"></div>
      <div class="ex-stat-item">
        <span class="ex-stat-icon">⚖️</span>
        <div>
          <div class="ex-stat-value">${rangeLabel}</div>
          <div class="ex-stat-label">Rango usado</div>
        </div>
      </div>
      <div class="ex-stat-sep"></div>
      <div class="ex-stat-item">
        <span class="ex-stat-icon">🎯</span>
        <div>
          <div class="ex-stat-value suggest-range">${suggestLabel}</div>
          <div class="ex-stat-label">Sugerido 8-12 reps</div>
        </div>
      </div>
    </div>`;
}

function renderActiveWorkout() {

  const list = document.getElementById('exercise-list');
  list.innerHTML = state.activeWorkout.exercises.map((ex, ei) => {
    const exInfo = getExercise(ex.id);
    const prev   = getLastSetsForExercise(ex.id);
    const img    = exInfo ? (getExImg(exInfo) || emojiPlaceholder(exInfo)) : '';
    const statsBar = buildStatsBar(ex.id);
    const imgFallback = exInfo ? emojiPlaceholder(exInfo) : '';
    return `
      <div class="exercise-card" id="ex-card-${ei}">
        ${img
          ? `<div class="ex-card-img-wrap"><img class="ex-card-img" src="${img}" alt="${exInfo?.name || ''}" loading="lazy" onerror="this.src='${imgFallback}'" /><div class="ex-card-img-overlay"><span class="exercise-card-title">${exInfo?.emoji || '💪'} ${exInfo?.name || ex.id}</span><span class="exercise-card-muscle">${MUSCLE_LABELS[exInfo?.muscle] || ''}</span></div></div>`
          : `<div class="exercise-card-header"><div><div class="exercise-card-title">${exInfo?.emoji || '💪'} ${exInfo?.name || ex.id}</div><div class="exercise-card-muscle">${MUSCLE_LABELS[exInfo?.muscle] || ''}</div></div></div>`}
        <div class="exercise-card-actions"><button class="exercise-card-remove" onclick="removeExercise(${ei})">✕ Quitar</button></div>
        ${statsBar}
        <table class="sets-table">
          <thead><tr><th>#</th><th>Anterior</th><th>Peso (kg)</th><th>Reps</th><th>✓</th></tr></thead>
          <tbody id="sets-body-${ei}">
            ${ex.sets.map((set, si) => renderSetRow(ei, si, set, prev[si])).join('')}
          </tbody>
        </table>
        <button class="btn-add-set" onclick="addSet(${ei})">+ Agregar serie</button>
      </div>`;
  }).join('');
}


function renderSetRow(ei, si, set, prev) {
  return `
    <tr class="set-row${set.done ? ' completed' : ''}" id="set-${ei}-${si}">
      <td class="set-num">${si + 1}</td>
      <td class="set-prev">${prev ? `<span class="prev-highlight">${prev.weight}kg × ${prev.reps}</span>` : '—'}</td>
      <td><input type="number" class="set-input" min="0" step="0.5" placeholder="0" value="${set.weight || ''}"
        oninput="updateSet(${ei},${si},'weight',this.value)" /></td>
      <td><input type="number" class="set-input" min="0" step="1" placeholder="0" value="${set.reps || ''}"
        oninput="updateSet(${ei},${si},'reps',this.value)" /></td>
      <td>
        <button class="btn-check-set${set.done ? ' checked' : ''}" onclick="toggleSet(${ei},${si})">
          ${set.done ? '✓' : ''}
        </button>
      </td>
    </tr>
  `;
}

function updateSet(ei, si, field, value) {
  state.activeWorkout.exercises[ei].sets[si][field] = value;
}

function toggleSet(ei, si) {
  const set = state.activeWorkout.exercises[ei].sets[si];
  set.done = !set.done;
  const row = document.getElementById(`set-${ei}-${si}`);
  if (row) {
    row.className = `set-row${set.done ? ' completed' : ''}`;
    const btn = row.querySelector('.btn-check-set');
    if (btn) {
      btn.className = `btn-check-set${set.done ? ' checked' : ''}`;
      btn.textContent = set.done ? '✓' : '';
    }
  }
  if (set.done) {
    startRestTimer();
  } else {
    stopRestTimer();
  }
}

let restHintTimeout = null;
function showRestHint(ei, si) {
  const card = document.getElementById(`ex-card-${ei}`);
  const existing = card?.querySelector('.rest-hint');
  if (existing) existing.remove();
  if (restHintTimeout) clearTimeout(restHintTimeout);
  const hint = document.createElement('div');
  hint.className = 'rest-hint';
  hint.innerHTML = '⏱ Descansa 60-90 segundos';
  card?.querySelector('.sets-table').after(hint);
  restHintTimeout = setTimeout(() => hint.remove(), 8000);
}

function addSet(ei) {
  const ex = state.activeWorkout.exercises[ei];
  const last = ex.sets[ex.sets.length - 1] || {};
  ex.sets.push({ weight: last.weight || '', reps: last.reps || '', done: false });
  const tbody = document.getElementById(`sets-body-${ei}`);
  const prev = getLastSetsForExercise(ex.id);
  const si = ex.sets.length - 1;
  tbody.insertAdjacentHTML('beforeend', renderSetRow(ei, si, ex.sets[si], prev[si]));
}

function removeExercise(ei) {
  state.activeWorkout.exercises.splice(ei, 1);
  renderActiveWorkout();
}

function finishWorkout() {
  if (!state.activeWorkout) return;
  const duration = state.timerSeconds;
  clearInterval(state.timerInterval);

  const nonEmpty = state.activeWorkout.exercises.map(ex => ({
    ...ex,
    sets: ex.sets.filter(s => s.weight || s.reps)
  })).filter(ex => ex.sets.length > 0);

  if (!nonEmpty.length) { cancelWorkout(); return; }

  const workout = {
    id: Date.now().toString(),
    name: document.getElementById('workout-name').value || 'Entrenamiento',
    date: new Date().toISOString(),
    duration,
    exercises: nonEmpty,
  };

  state.workouts.push(workout);
  
  if (window.serverAvailable) {
    API.post('/workouts', workout);
  }

  saveData();
  cancelWorkout();
  showCompletionBanner(workout);
  switchView('dashboard');
}

function cancelWorkout() {
  clearInterval(state.timerInterval);
  state.timerInterval = null;
  state.timerSeconds = 0;
  state.activeWorkout = null;
  document.getElementById('workout-timer').textContent = '00:00';
  document.getElementById('workout-idle').classList.remove('hidden');
  document.getElementById('workout-active').classList.add('hidden');
  document.getElementById('exercise-list').innerHTML = '';
}

function showCompletionBanner(workout) {
  const banner = document.createElement('div');
  banner.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:9999;
    background:linear-gradient(135deg,#7c3aed,#06b6d4);
    color:#fff;border-radius:16px;padding:16px 24px;
    font-family:var(--font);font-weight:700;font-size:15px;
    box-shadow:0 8px 32px rgba(124,58,237,0.5);
    animation:fadeUp 0.4s ease;display:flex;align-items:center;gap:12px;
  `;
  banner.innerHTML = `<span style="font-size:28px">🎉</span><div>
    <div>¡Entrenamiento completado!</div>
    <div style="font-size:12px;opacity:0.85;font-weight:400">${workout.exercises.length} ejercicios · ${fmtDuration(workout.duration)}</div>
  </div>`;
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 4000);
}

// ─── DISCIPLINE SYSTEM ───────────────────────────────────────────────────

function bindDisciplineEvents() {
  document.querySelectorAll('.day-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const d = parseInt(e.target.dataset.day);
      if (state.plannedDays.includes(d)) {
        state.plannedDays = state.plannedDays.filter(x => x !== d);
      } else {
        state.plannedDays.push(d);
      }
      saveData();
      renderDiscipline();
    });
  });

  document.getElementById('submit-discipline-btn')?.addEventListener('click', () => {
    const reason = document.getElementById('discipline-reason').value;
    
    // Evaluate deduction based on reason
    if (reason === 'none') {
      state.disciplinePoints = Math.max(0, state.disciplinePoints - 15);
    } else if (reason === 'sick' || reason === 'work') {
      // Justified, minor or no penalty
      state.disciplinePoints = Math.max(0, state.disciplinePoints - 2); 
    } else if (reason === 'swap') {
      // Must train today
      alert('¡Día canjeado! Asegúrate de registrar un entrenamiento HOY para no perder los puntos.');
    }

    state.pendingMissedDay = null; // Clear pending
    saveData();
    renderDiscipline();
    document.getElementById('discipline-modal-backdrop').classList.add('hidden');
    checkDiscipline(); // Check if there are more pending days
  });
}

function renderDiscipline() {
  const scoreEl = document.getElementById('discipline-score');
  if (scoreEl) {
    scoreEl.innerHTML = `${Math.round(state.disciplinePoints)} <span style="font-size:12px;color:initial;">pts</span>`;
    if (state.disciplinePoints >= 80) scoreEl.style.color = 'var(--success)';
    else if (state.disciplinePoints >= 50) scoreEl.style.color = 'var(--warning)';
    else scoreEl.style.color = 'var(--danger)';
  }

  document.querySelectorAll('.day-btn').forEach(btn => {
    const d = parseInt(btn.dataset.day);
    if (state.plannedDays.includes(d)) btn.classList.add('active');
    else btn.classList.remove('active');
  });
}

function checkDiscipline() {
  if (state.pendingMissedDay) {
    // Show modal if there is a pending missed day
    document.getElementById('discipline-modal-backdrop').classList.remove('hidden');
    return;
  }

  const today = new Date();
  today.setHours(0,0,0,0);
  const todayStr = dateOnly(today);

  // If first time or reset, just init last check to today
  if (!state.lastDisciplineCheck) {
    state.lastDisciplineCheck = todayStr;
    saveData();
    return;
  }

  const lastCheck = new Date(state.lastDisciplineCheck);
  lastCheck.setHours(0,0,0,0);

  // If we already checked today, do nothing
  if (lastCheck.getTime() === today.getTime()) return;

  // We need to check all days between lastCheck and yesterday (inclusive)
  const d = new Date(lastCheck);
  d.setDate(d.getDate() + 1); // Start checking from day after last check
  
  let missedDayFound = false;

  while (d < today && !missedDayFound) {
    const dow = d.getDay(); // 0 is Sun, 1 is Mon...
    if (state.plannedDays.includes(dow)) {
      // It was a planned day, did they train?
      const targetDateStr = dateOnly(d);
      const trained = state.workouts.some(w => dateOnly(new Date(w.date)) === targetDateStr);
      
      if (!trained) {
        state.pendingMissedDay = targetDateStr;
        missedDayFound = true;
      } else {
        // Give points for training!
        state.disciplinePoints = Math.min(150, state.disciplinePoints + 5); 
      }
    }
    d.setDate(d.getDate() + 1);
  }

  if (missedDayFound) {
    // Update last check to the day BEFORE the missed day so we don't skip days next time
    const prevDay = new Date(state.pendingMissedDay);
    prevDay.setDate(prevDay.getDate() - 1);
    state.lastDisciplineCheck = dateOnly(prevDay);
    saveData();
    // Show modal immediately
    document.getElementById('discipline-modal-backdrop').classList.remove('hidden');
  } else {
    // All caught up
    state.lastDisciplineCheck = todayStr;
    saveData();
  }
}

// ─── EXERCISE PICKER ──────────────────────────────────────────────────────

let pickerFilter = 'all';

function openExercisePicker() {
  document.getElementById('exercise-picker-backdrop').classList.remove('hidden');
  document.getElementById('picker-search').value = '';
  pickerFilter = 'all';
  renderPickerCategories();
  renderPickerList();
}

function renderPickerCategories() {
  const cats = [{ id: 'all', label: 'Todos' }, ...Object.entries(MUSCLE_LABELS).map(([k, v]) => ({ id: k, label: v }))];
  document.getElementById('picker-categories').innerHTML = cats.map(c =>
    `<button class="picker-cat-chip${pickerFilter === c.id ? ' active' : ''}" data-muscle="${c.id}">${c.label}</button>`
  ).join('');
  document.querySelectorAll('.picker-cat-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      pickerFilter = btn.dataset.muscle;
      document.querySelectorAll('.picker-cat-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderPickerList();
    });
  });
}

function renderPickerList() {
  const search = document.getElementById('picker-search').value.toLowerCase();
  const all = getAllExercises();
  const filtered = all.filter(ex => {
    const matchMuscle = pickerFilter === 'all' || ex.muscle === pickerFilter;
    const matchSearch = ex.name.toLowerCase().includes(search) || (MUSCLE_LABELS[ex.muscle] || '').toLowerCase().includes(search);
    return matchMuscle && matchSearch;
  });
  document.getElementById('picker-list').innerHTML = filtered.map(ex => {
    const img = getExImg(ex);
    return `
    <div class="picker-item" onclick="selectExercise('${ex.id}')">
      <div class="picker-thumb-wrap">
        <img class="picker-thumb" src="${img}" alt="${ex.name}" loading="lazy" onerror="this.parentElement.innerHTML='<span style=font-size:22px>${ex.emoji}</span>'" />
      </div>
      <div>
        <div class="picker-item-name">${ex.name}</div>
        <div class="picker-item-muscle">${MUSCLE_LABELS[ex.muscle] || ex.muscle}</div>
      </div>
    </div>`;
  }).join('');
}

function selectExercise(id) {
  if (!state.activeWorkout) return;
  addExerciseToWorkout(id);
  document.getElementById('exercise-picker-backdrop').classList.add('hidden');
}

// ─── MOBILE ───────────────────────────────────────────────────────────────

function openSidebar() { document.getElementById('sidebar').classList.add('open'); }
function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); }

// ─── EVENT LISTENERS ──────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  loadData();
  initEvents();
  bindSettingsEvents();
  bindDisciplineEvents();
  checkDiscipline();
  renderDashboard();
  renderHistory();
  updateSidebarStreak();
  showApp();
});

function showApp() {
  const splash = document.getElementById('splash');
  const app = document.getElementById('app');
  setTimeout(() => {
    splash.style.opacity = '0';
    splash.style.transition = 'opacity 0.4s ease';
    setTimeout(() => {
      splash.classList.add('hidden');
      app.classList.remove('hidden');
      switchView('dashboard');
    }, 400);
  }, 1900);
}

function initEvents() {
  // Nav
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  // Dashboard
  document.getElementById('start-workout-btn')?.addEventListener('click', () => switchView('workout'));
  document.getElementById('empty-start-btn')?.addEventListener('click', () => switchView('workout'));

  // Workout templates
  document.querySelectorAll('.template-card').forEach(card => {
    card.addEventListener('click', () => startWorkout(card.dataset.template));
  });
  document.getElementById('add-exercise-btn')?.addEventListener('click', openExercisePicker);
  document.getElementById('cancel-workout-btn')?.addEventListener('click', () => {
    if (state.activeWorkout?.exercises.length && !confirm('¿Cancelar entrenamiento?')) return;
    cancelWorkout();
  });
  document.getElementById('finish-workout-btn')?.addEventListener('click', finishWorkout);
  document.getElementById('workout-name')?.addEventListener('input', e => {
    if (state.activeWorkout) state.activeWorkout.name = e.target.value;
  });

  // Exercise picker
  document.getElementById('picker-search')?.addEventListener('input', renderPickerList);
  document.getElementById('close-exercise-picker')?.addEventListener('click', () => {
    document.getElementById('exercise-picker-backdrop').classList.add('hidden');
  });
  document.getElementById('exercise-picker-backdrop')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) document.getElementById('exercise-picker-backdrop').classList.add('hidden');
  });

  // Workout detail modal
  document.getElementById('close-workout-detail')?.addEventListener('click', () => {
    document.getElementById('workout-detail-backdrop').classList.add('hidden');
  });
  document.getElementById('workout-detail-backdrop')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) document.getElementById('workout-detail-backdrop').classList.add('hidden');
  });

  // Progress
  document.getElementById('progress-exercise-select')?.addEventListener('change', e => {
    renderProgressCharts(e.target.value, progressPeriod);
  });
  document.querySelectorAll('.period-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.period-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      progressPeriod = btn.dataset.period;
      const sel = document.getElementById('progress-exercise-select');
      if (sel?.value) renderProgressCharts(sel.value, progressPeriod);
    });
  });

  // Library
  document.getElementById('library-search')?.addEventListener('input', e => {
    librarySearch = e.target.value;
    renderLibrary();
  });
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      libraryFilter = chip.dataset.muscle;
      renderLibrary();
    });
  });

  // Custom exercise
  document.getElementById('add-custom-exercise-btn')?.addEventListener('click', () => {
    document.getElementById('custom-exercise-backdrop').classList.remove('hidden');
  });
  document.getElementById('close-custom-exercise')?.addEventListener('click', () => {
    document.getElementById('custom-exercise-backdrop').classList.add('hidden');
  });
  document.getElementById('custom-exercise-backdrop')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) document.getElementById('custom-exercise-backdrop').classList.add('hidden');
  });
  document.getElementById('save-custom-exercise-btn')?.addEventListener('click', () => {
    const name = document.getElementById('custom-ex-name').value.trim();
    if (!name) return alert('Introduce un nombre');
    const muscle = document.getElementById('custom-ex-muscle').value;
    const equipment = document.getElementById('custom-ex-equipment').value;
    const id = 'custom-' + Date.now();
    const emojis = { chest:'💪', back:'🔽', shoulders:'👐', biceps:'💪', triceps:'🔱', legs:'🦵', glutes:'🍑', core:'🧘' };
    state.customExercises.push({ id, name, muscle, equipment, emoji: emojis[muscle] || '💪' });
    saveData();
    document.getElementById('custom-exercise-backdrop').classList.add('hidden');
    document.getElementById('custom-ex-name').value = '';
    renderLibrary();
  });

  // Mobile sidebar
  document.getElementById('mobile-menu-btn')?.addEventListener('click', openSidebar);
  document.getElementById('tab-more')?.addEventListener('click', openSidebar);

  // Settings Rest Presets
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.userSettings.restTime = parseInt(btn.dataset.rest);
      saveData();
    };
  });

  // Rest Timer Controls
  document.getElementById('skip-rest-btn').onclick = () => stopRestTimer();
  document.getElementById('add-rest-btn').onclick = () => {
    state.restTimerSeconds += 30;
    updateRestTimerUI();
  };

  bindSettingsEvents();
  initRoutineEvents();
  bindDisciplineEvents();

  document.addEventListener('click', e => {
    if (!e.target.closest('.sidebar') && !e.target.closest('#mobile-menu-btn') && !e.target.closest('#tab-more')) closeSidebar();
  });

  // Bottom tab bar
  document.querySelectorAll('.tab-item[data-view]').forEach(tab => {
    tab.addEventListener('click', () => switchView(tab.dataset.view));
  });
}

// ─── SETTINGS & HEVY IMPORT ───────────────────────────────────────────────

const HEVY_EX_MAP = {
  'Bench Press (Barbell)': 'bench-press',
  'Incline Bench Press (Barbell)': 'incline-bench',
  'Chest Fly (Dumbbell)': 'dumbbell-fly',
  'Push Up': 'pushup',
  'Cable Crossover': 'cable-crossover',
  'Deadlift (Barbell)': 'deadlift',
  'Pull Up': 'pullup',
  'Bent Over Row (Barbell)': 'barbell-row',
  'Lat Pulldown (Cable)': 'lat-pulldown',
  'Seated Cable Row': 'seated-cable-row',
  'Overhead Press (Barbell)': 'ohp',
  'Lateral Raise (Dumbbell)': 'lateral-raise',
  'Front Raise (Dumbbell)': 'front-raise',
  'Face Pull (Cable)': 'face-pull',
  'Bicep Curl (Barbell)': 'barbell-curl',
  'Bicep Curl (Dumbbell)': 'dumbbell-curl',
  'Hammer Curl (Dumbbell)': 'hammer-curl',
  'Preacher Curl': 'preacher-curl',
  'Skullcrusher (Barbell)': 'skull-crusher',
  'Triceps Extension (Cable)': 'tricep-pushdown',
  'Overhead Triceps Extension': 'overhead-ext',
  'Dips': 'dips',
  'Squat (Barbell)': 'squat',
  'Leg Press': 'leg-press',
  'Leg Curl (Machine)': 'leg-curl',
  'Leg Extension (Machine)': 'leg-extension',
  'Walking Lunge': 'lunge',
  'Calf Raise': 'calf-raise',
  'Hip Thrust (Barbell)': 'hip-thrust',
  'Glute Kickback (Cable)': 'cable-kickback',
  'Romanian Deadlift (Barbell)': 'rdl',
  'Plank': 'plank',
  'Crunch': 'crunch',
  'Russian Twist': 'russian-twist',
  'Crunch (Cable)': 'cable-crunch'
};

function parseHevyCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return { workouts: [], customExercises: [] };

  // Parse header - handle quoted fields properly
  const parseCSVRow = (line) => {
    const row = [];
    let cur = '';
    let inQuotes = false;
    for (let char of line) {
      if (char === '"') inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) { row.push(cur.trim()); cur = ''; }
      else cur += char;
    }
    row.push(cur.trim());
    return row;
  };

  const headers = parseCSVRow(lines[0]).map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());
  
  // Robustness for Spanish headers or variants
  const getCol = (possible) => {
    for (let p of possible) {
      const idx = headers.indexOf(p);
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const dateIdx = getCol(['start_time', 'fecha_inicio', 'fecha', 'date']);
  const nameIdx = getCol(['workout_name', 'nombre_entrenamiento', 'name', 'rutina', 'title']);
  const exNameIdx = getCol(['exercise_name', 'nombre_ejercicio', 'ejercicio', 'exercise', 'exercise_title']);
  const weightIdx = getCol(['weight_kg', 'peso_kg', 'peso', 'weight', 'weight (kg)']);
  const repsIdx = getCol(['reps', 'repeticiones', 'repeticion']);
  const setOrderIdx = getCol(['set_order', 'orden_serie', 'set']);

  if (dateIdx === -1 || exNameIdx === -1) {
    throw new Error(`El CSV no tiene las columnas necesarias. Columnas detectadas: ${headers.join(', ')}`);
  }

  const workoutsMap = {};
  const newCustomSet = new Set();
  const newCustomExercises = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue; // skip empty lines
    const row = parseCSVRow(lines[i]);
    if (row.length <= Math.max(dateIdx, exNameIdx)) continue;

    const cleanField = str => (str || '').replace(/^"|"$/g, '').trim();
    
    const dateRaw = cleanField(row[dateIdx]); 
    if (!dateRaw) continue;

    // Parse date - handle multiple formats
    let workoutDate = new Date(dateRaw);
    if (isNaN(workoutDate.getTime())) {
      // Try DD/MM/YYYY or DD/MM/YYYY HH:MM
      const dateTimeParts = dateRaw.split(' ');
      const datePart = dateTimeParts[0];
      const parts = datePart.split('/');
      if (parts.length === 3) {
        const timePart = dateTimeParts[1] || '12:00';
        workoutDate = new Date(`${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}T${timePart}:00`);
      }
    }
    if (isNaN(workoutDate.getTime())) continue;

    const workoutName = nameIdx !== -1 ? cleanField(row[nameIdx]) : 'Entrenamiento Hevy';
    const hevyExName = cleanField(row[exNameIdx]);
    if (!hevyExName) continue;
    const weight = weightIdx !== -1 ? parseFloat(cleanField(row[weightIdx])) || 0 : 0;
    const reps = repsIdx !== -1 ? parseInt(cleanField(row[repsIdx])) || 0 : 0;

    let exerciseId = HEVY_EX_MAP[hevyExName];
    if (!exerciseId) {
      // Try case-insensitive match
      const lowerName = hevyExName.toLowerCase();
      const matchKey = Object.keys(HEVY_EX_MAP).find(k => k.toLowerCase() === lowerName);
      if (matchKey) {
        exerciseId = HEVY_EX_MAP[matchKey];
      } else {
        // Try matching by NovaFit exercise name directly
        const directMatch = getAllExercises().find(e => e.name.toLowerCase() === lowerName);
        if (directMatch) {
          exerciseId = directMatch.id;
        } else {
          exerciseId = 'custom-' + hevyExName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
          if (!getExercise(exerciseId) && !newCustomSet.has(exerciseId)) {
            newCustomSet.add(exerciseId);
            newCustomExercises.push({
              id: exerciseId,
              name: hevyExName,
              muscle: 'other',
              equipment: 'other',
              emoji: '🏋️'
            });
          }
        }
      }
    }

    // Group by DATE (date-only) + WORKOUT NAME so multiple sets of the same session are grouped together
    const dateOnlyStr = workoutDate.toISOString().slice(0, 10);
    const wKey = `${dateOnlyStr}__${workoutName}`;
    if (!workoutsMap[wKey]) {
      workoutsMap[wKey] = {
        id: `hevy-${Date.now()}-${i}`,
        date: workoutDate.toISOString(),
        name: workoutName || 'Entrenamiento Hevy',
        exercises: []
      };
    }

    let exBlock = workoutsMap[wKey].exercises.find(e => e.id === exerciseId);
    if (!exBlock) {
      exBlock = { id: exerciseId, sets: [] };
      workoutsMap[wKey].exercises.push(exBlock);
    }

    if (reps > 0 || weight > 0) {
      exBlock.sets.push({ weight, reps: reps || 1, done: true });
    }
  }

  return {
    workouts: Object.values(workoutsMap).sort((a, b) => new Date(a.date) - new Date(b.date)),
    customExercises: newCustomExercises
  };
}

function exportToCSV() {
  if (!state.workouts.length) {
    alert('No hay entrenamientos para exportar.');
    return;
  }
  const rows = ['start_time,workout_name,exercise_name,set_order,weight_kg,reps'];
  state.workouts.forEach(w => {
    w.exercises.forEach(ex => {
      const exInfo = getExercise(ex.id);
      const exName = exInfo?.name || ex.id;
      ex.sets.forEach((s, si) => {
        const dateStr = new Date(w.date).toISOString().replace('T', ' ').slice(0, 19);
        rows.push(`"${dateStr}","${w.name}","${exName}",${si + 1},${s.weight || 0},${s.reps || 0}`);
      });
    });
  });
  const csv = rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `novafit_export_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function bindSettingsEvents() {
  const fileInput = document.getElementById('hevy-csv-input');
  const importBtn = document.getElementById('import-hevy-btn');
  const statusEl = document.getElementById('import-status');
  const wipeBtn = document.getElementById('wipe-data-btn');
  const exportBtn = document.getElementById('export-csv-btn');

  if (!fileInput) return;

  fileInput.addEventListener('change', e => {
    importBtn.disabled = !e.target.files.length;
  });

  exportBtn?.addEventListener('click', exportToCSV);

  importBtn.addEventListener('click', () => {
    const file = fileInput.files[0];
    if (!file) return;

    statusEl.style.display = 'block';
    statusEl.style.color = 'var(--text-secondary)';
    statusEl.innerText = 'Leyendo archivo...';

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const text = e.target.result;
        const { workouts, customExercises } = parseHevyCSV(text);

        if (workouts.length === 0) {
          statusEl.style.color = 'var(--warning)';
          statusEl.innerText = 'No se encontraron entrenamientos válidos. Revisa que el CSV tenga columnas como start_time y exercise_name.';
          return;
        }

        // Merge custom exercises
        customExercises.forEach(ce => {
          if (!state.customExercises.some(existing => existing.id === ce.id)) {
            state.customExercises.push(ce);
          }
        });

        // Merge workouts - check by dateOnly + name to avoid duplicates
        let added = 0;
        workouts.forEach(w => {
          const wDateOnly = new Date(w.date).toISOString().slice(0, 10);
          const isDuplicate = state.workouts.some(existing => {
            const existingDateOnly = new Date(existing.date).toISOString().slice(0, 10);
            return existingDateOnly === wDateOnly && existing.name === w.name;
          });
          if (!isDuplicate) {
            // Ensure workout has an id
            if (!w.id) w.id = `hevy-${Date.now()}-${added}`;
            state.workouts.push(w);
            added++;
          }
        });

        state.workouts.sort((a, b) => new Date(b.date) - new Date(a.date));

        saveData();
        renderDashboard();
        renderHistory();
        updateSidebarStreak();

        statusEl.style.color = 'var(--success)';
        statusEl.innerHTML = `✅ Importación completada: <strong>${added}</strong> entrenamientos añadidos${customExercises.length > 0 ? ` y <strong>${customExercises.length}</strong> ejercicios nuevos registrados` : ''}.`;
        fileInput.value = '';
        importBtn.disabled = true;

      } catch (err) {
        console.error('CSV Import Error:', err);
        statusEl.style.color = 'var(--danger)';
        statusEl.innerText = 'Error al importar: ' + err.message;
      }
    };
    reader.readAsText(file);
  });

  wipeBtn.addEventListener('click', () => {
    if (confirm('⚠️ ¿Estás totalmente seguro de que quieres BORRAR TODOS los entrenamientos y configuración locales?')) {
      state.workouts = [];
      state.customExercises = [];
      saveData();
      renderDashboard();
      renderHistory();
      updateSidebarStreak();
      alert('Tus datos han sido borrados de este dispositivo.');
    }
  });
}

