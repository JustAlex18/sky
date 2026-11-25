/**
 * Sky — Bullet Journal Digital
 * app.js — Paso 4: Tareas, Objetivos, Ideas, Búsqueda, Ajustes + todo lo anterior.
 */
'use strict';

/* ═══════════════════════════════════════════════════════════
   CONSTANTES
═══════════════════════════════════════════════════════════ */
const MONTHS_ES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
];
const DAYS_SHORT_ES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

const STORAGE_KEYS = {
  notes:  'sky_notes',
  habits: 'sky_habits',
  cells:  'sky_habit_cells',
  tasks:  'sky_tasks',   // { "2026-07": [{ id, text, done }] }
  goals:  'sky_goals',   // [{ id, text, type, done, createdAt }]
  ideas:  'sky_ideas',   // { "2026-07": [{ id, text, colorIndex, createdAt }] }
};

const DEFAULT_HABITS = [
  { id: 'h1', name: 'Ejercicio',    color: '#10b981' },
  { id: 'h2', name: 'Lectura',      color: '#3b82f6' },
  { id: 'h3', name: 'Meditación',   color: '#8b5cf6' },
  { id: 'h4', name: 'Agua 8 vasos', color: '#06b6d4' },
  { id: 'h5', name: 'Sin azúcar',   color: '#f59e0b' },
];

const HABIT_COLORS = [
  '#10b981','#3b82f6','#8b5cf6','#06b6d4',
  '#f59e0b','#ef4444','#ec4899','#f97316',
  '#a3e635','#38bdf8','#fb923c','#e879f9',
];

const IDEA_ACCENT_COLORS = [
  { bg: 'rgba(16,185,129,0.07)',  border: 'rgba(16,185,129,0.28)',  dot: '#10b981' },
  { bg: 'rgba(59,130,246,0.07)',  border: 'rgba(59,130,246,0.28)',  dot: '#3b82f6' },
  { bg: 'rgba(139,92,246,0.07)', border: 'rgba(139,92,246,0.28)', dot: '#8b5cf6' },
  { bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.28)', dot: '#f59e0b' },
  { bg: 'rgba(236,72,153,0.07)', border: 'rgba(236,72,153,0.28)', dot: '#ec4899' },
  { bg: 'rgba(6,182,212,0.07)',  border: 'rgba(6,182,212,0.28)',  dot: '#06b6d4' },
];

/* ═══════════════════════════════════════════════════════════
   ESTADO GLOBAL
═══════════════════════════════════════════════════════════ */
let state = {
  currentYear:  new Date().getFullYear(),
  currentMonth: new Date().getMonth(),
  currentView:  'diary',
  taskFilter:   'all',
  notes:        {},
  habits:       [],
  habitCells:   {},
  tasks:        {},
  goals:        [],
  ideas:        {},
};

let consistencyChartInstance = null;  // Gráfica de rendimiento general

/* Debounce utilitario — evita llamadas excesivas en eventos 'input' */
function debounce(fn, ms = 300) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

/* ═══════════════════════════════════════════════════════════
   PERSISTENCIA
═══════════════════════════════════════════════════════════ */
const Storage = {
  save(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn('[Sky] localStorage error:', e);
      if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22) {
        showToast('⚠️ ¡Memoria del navegador llena! Exporta tus datos desde Ajustes y limpia meses antiguos.', 'warning');
      } else {
        showToast('⚠️ Error al guardar datos en el navegador.', 'warning');
      }
    }
  },

  load(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  },

  loadAll() {
    state.notes      = Storage.load(STORAGE_KEYS.notes,  {});
    state.habits     = Storage.load(STORAGE_KEYS.habits, DEFAULT_HABITS);
    state.habitCells = Storage.load(STORAGE_KEYS.cells,  {});
    state.tasks      = Storage.load(STORAGE_KEYS.tasks,  {});
    state.goals      = Storage.load(STORAGE_KEYS.goals,  []);
    state.ideas      = Storage.load(STORAGE_KEYS.ideas,  {});

    // Normalizar datos de versiones anteriores (string 'done' → boolean)
    Object.keys(state.habitCells).forEach(mk => {
      Object.keys(state.habitCells[mk]).forEach(hid => {
        Object.keys(state.habitCells[mk][hid]).forEach(d => {
          const v = state.habitCells[mk][hid][d];
          state.habitCells[mk][hid][d] = (v === true || v === 'done');
        });
      });
    });
  },

  saveAll() {
    Storage.save(STORAGE_KEYS.notes,  state.notes);
    Storage.save(STORAGE_KEYS.habits, state.habits);
    Storage.save(STORAGE_KEYS.cells,  state.habitCells);
    Storage.save(STORAGE_KEYS.tasks,  state.tasks);
    Storage.save(STORAGE_KEYS.goals,  state.goals);
    Storage.save(STORAGE_KEYS.ideas,  state.ideas);
  },
};

/* ═══════════════════════════════════════════════════════════
   HELPERS DE FECHA
═══════════════════════════════════════════════════════════ */
function getMonthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}
function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}
function getWeekdayShort(year, month, day) {
  return DAYS_SHORT_ES[new Date(year, month, day).getDay()];
}
function isToday(year, month, day) {
  const n = new Date();
  return n.getFullYear() === year && n.getMonth() === month && n.getDate() === day;
}
function isFutureDay(year, month, day) {
  const n = new Date();
  return new Date(year, month, day) > new Date(n.getFullYear(), n.getMonth(), n.getDate());
}
function getCountableDays(year, month) {
  const n = new Date();
  const total = getDaysInMonth(year, month);
  return (n.getFullYear() === year && n.getMonth() === month)
    ? Math.min(n.getDate(), total) : total;
}
function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function setEl(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/* ═══════════════════════════════════════════════════════════
   UI — MES Y ESTADÍSTICAS
═══════════════════════════════════════════════════════════ */
function updateMonthLabel() {
  const label = `${MONTHS_ES[state.currentMonth]} ${state.currentYear}`;
  ['month-label','diary-badge','habits-badge','review-badge','tasks-badge','ideas-badge']
    .forEach(id => setEl(id, label));
  const sub = document.getElementById('current-month-name');
  if (sub) sub.textContent = label;
  updateStats();
}

function updateStats() {
  const { currentYear: y, currentMonth: m } = state;
  const key   = getMonthKey(y, m);
  const total = getDaysInMonth(y, m);
  const notes = state.notes[key] || {};
  const notesCount = Object.values(notes).filter(v => v && v.trim()).length;

  setEl('stat-notes', notesCount);
  setEl('stat-notes-pct', `de ${total} días`);
  setEl('stat-habits', state.habits.length);

  const n = new Date();
  const dayInfo = document.getElementById('stat-day-info');
  if (n.getFullYear() === y && n.getMonth() === m) {
    setEl('stat-day', n.getDate());
    if (dayInfo) { dayInfo.textContent = '↑ Hoy'; dayInfo.className = 'stat-change up'; }
  } else {
    setEl('stat-day', total);
    if (dayInfo) { dayInfo.textContent = 'días en el mes'; dayInfo.className = 'stat-change'; }
  }

  // Racha
  let streak = 0, cy = n.getFullYear(), cm = n.getMonth(), cd = n.getDate();
  for (let i = 0; i < 120; i++) {
    const cKey = getMonthKey(cy, cm);
    const val  = (state.notes[cKey] || {})[cd];
    if (val && val.trim()) {
      streak++;
      const prev = new Date(cy, cm, cd - 1);
      cy = prev.getFullYear(); cm = prev.getMonth(); cd = prev.getDate();
    } else break;
  }
  setEl('stat-streak', streak);
}

/* ═══════════════════════════════════════════════════════════
   SECCIÓN: NOTAS DIARIAS
═══════════════════════════════════════════════════════════ */
function renderDaysGrid() {
  const container = document.getElementById('days-grid');
  if (!container) return;
  container.innerHTML = '';

  const { currentYear: y, currentMonth: m } = state;
  const key   = getMonthKey(y, m);
  const notes = state.notes[key] || {};
  const total = getDaysInMonth(y, m);

  for (let day = 1; day <= total; day++) {
    const todayDay = isToday(y, m, day);
    const noteVal  = notes[day] || '';

    const entry = document.createElement('div');
    entry.className = ['day-entry', todayDay ? 'today' : '', noteVal.trim() ? 'has-note' : ''].filter(Boolean).join(' ');
    entry.setAttribute('role', 'listitem');
    entry.innerHTML = `
      <div class="day-number">
        <span class="day-num">${String(day).padStart(2,'0')}</span>
        <span class="day-weekday">${getWeekdayShort(y, m, day)}</span>
      </div>
      <div class="day-separator" aria-hidden="true"></div>
      <div class="day-input-wrap">
        <textarea class="day-note-input" id="note-day-${day}" rows="1"
          placeholder="${todayDay ? '¿Qué destacas de hoy?' : 'Escribe algo memorable…'}"
          aria-label="Nota del día ${day}" data-day="${day}"></textarea>
      </div>`;

    const ta = entry.querySelector('textarea');
    ta.value = noteVal;
    autoResizeTextarea(ta);

    const debouncedStats = debounce(updateStats, 350);
    ta.addEventListener('input', () => {
      autoResizeTextarea(ta);
      saveNoteForDay(day, ta.value);
      entry.classList.toggle('has-note', ta.value.trim().length > 0);
      debouncedStats();
    });
    ta.addEventListener('blur', () => Storage.saveAll());
    container.appendChild(entry);
  }

  requestAnimationFrame(() => {
    const todayEl = container.querySelector('.today');
    if (todayEl) todayEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

function saveNoteForDay(day, value) {
  const key = getMonthKey(state.currentYear, state.currentMonth);
  if (!state.notes[key]) state.notes[key] = {};
  state.notes[key][day] = value;
}
function flushCurrentNotes() {
  document.querySelectorAll('.day-note-input').forEach(ta => {
    saveNoteForDay(Number(ta.dataset.day), ta.value);
  });
}
function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 80) + 'px';
}

/* ═══════════════════════════════════════════════════════════
   SECCIÓN: HÁBITOS
═══════════════════════════════════════════════════════════ */
function renderHabitsTable() {
  const { currentYear: y, currentMonth: m } = state;
  const key   = getMonthKey(y, m);
  const total = getDaysInMonth(y, m);
  if (!state.habitCells[key]) state.habitCells[key] = {};

  const labelsEl = document.getElementById('habits-day-labels');
  if (labelsEl) {
    labelsEl.innerHTML = '';
    for (let d = 1; d <= total; d++) {
      const span = document.createElement('span');
      span.className = 'habit-day-label' + (isToday(y, m, d) ? ' today-label' : '');
      span.textContent = d;
      labelsEl.appendChild(span);
    }
  }

  const container = document.getElementById('habits-rows-container');
  if (!container) return;
  container.innerHTML = '';

  if (state.habits.length === 0) {
    container.innerHTML = `<div class="habits-empty-state"><div class="habits-empty-icon">✅</div>
      <p>No hay hábitos configurados.</p><p style="font-size:0.78rem;">Usa el botón de abajo para agregar tu primer hábito.</p></div>`;
    return;
  }

  state.habits.forEach(habit => {
    if (!state.habitCells[key][habit.id]) state.habitCells[key][habit.id] = {};
    const cells = state.habitCells[key][habit.id];
    const countable = getCountableDays(y, m);
    let doneCount = 0;
    for (let d = 1; d <= countable; d++) { if (cells[d]) doneCount++; }
    const pct = countable > 0 ? Math.round((doneCount / countable) * 100) : 0;

    const row = document.createElement('div');
    row.className = 'habit-row';
    row.dataset.habitId = habit.id;

    const nameCol = document.createElement('div');
    nameCol.className = 'habit-name';
    nameCol.innerHTML = `
      <span class="habit-dot" style="background:${habit.color}"></span>
      <span class="habit-name-text" title="${habit.name}">${habit.name}</span>
      <span class="habit-row-pct" style="color:${habit.color}">${pct}%</span>`;

    const delBtn = document.createElement('button');
    delBtn.className = 'delete-habit-btn';
    delBtn.setAttribute('aria-label', `Eliminar ${habit.name}`);
    delBtn.innerHTML = '×';
    delBtn.addEventListener('click', e => { e.stopPropagation(); deleteHabit(habit.id, habit.name); });
    nameCol.appendChild(delBtn);
    row.appendChild(nameCol);

    const cellsWrap = document.createElement('div');
    cellsWrap.className = 'habit-cells';
    for (let d = 1; d <= total; d++) {
      const done   = !!cells[d];
      const future = isFutureDay(y, m, d);
      const cell   = document.createElement('button');
      cell.type = 'button';
      cell.className = ['habit-cell', done ? 'done' : '', future ? 'future' : ''].filter(Boolean).join(' ');
      cell.setAttribute('aria-label', `${habit.name} día ${d}`);
      cell.setAttribute('aria-pressed', String(done));
      cell.dataset.day = d;
      if (!future) cell.addEventListener('click', () => toggleHabitCell(habit.id, d, cell, nameCol, y, m));
      cellsWrap.appendChild(cell);
    }
    row.appendChild(cellsWrap);
    container.appendChild(row);
  });
}

function toggleHabitCell(habitId, day, cellEl, nameCol, year, month) {
  const key = getMonthKey(year, month);
  if (!state.habitCells[key])          state.habitCells[key] = {};
  if (!state.habitCells[key][habitId]) state.habitCells[key][habitId] = {};
  const next = !state.habitCells[key][habitId][day];
  state.habitCells[key][habitId][day] = next;
  cellEl.classList.toggle('done', next);
  cellEl.setAttribute('aria-pressed', String(next));

  const cells = state.habitCells[key][habitId];
  const countable = getCountableDays(year, month);
  let doneCount = 0;
  for (let d = 1; d <= countable; d++) { if (cells[d]) doneCount++; }
  const pct = countable > 0 ? Math.round((doneCount / countable) * 100) : 0;
  const pctLabel = nameCol.querySelector('.habit-row-pct');
  if (pctLabel) pctLabel.textContent = `${pct}%`;
  Storage.saveAll();
  updateStats();
}

function addHabit() {
  const name = window.prompt('Nombre del hábito o meta:');
  if (!name?.trim()) return;
  if (name.trim().length > 50) { showToast('⚠️ Máximo 50 caracteres.', 'warning'); return; }
  if (state.habits.find(h => h.name.toLowerCase() === name.trim().toLowerCase())) {
    showToast('⚠️ Ya existe ese hábito.', 'warning'); return;
  }
  const color = HABIT_COLORS[state.habits.length % HABIT_COLORS.length];
  state.habits.push({ id: 'h_' + Date.now(), name: name.trim(), color });
  Storage.saveAll(); renderHabitsTable(); updateStats();
  showToast(`✨ "${name.trim()}" añadido`, 'success');
}

function deleteHabit(id, name) {
  if (!confirm(`¿Eliminar "${name}"? Se borrarán todos sus registros.`)) return;
  state.habits = state.habits.filter(h => h.id !== id);
  Object.keys(state.habitCells).forEach(mk => delete state.habitCells[mk][id]);
  Storage.saveAll(); renderHabitsTable(); updateStats();
  showToast(`🗑️ "${name}" eliminado`, 'warning');
}

/* ═══════════════════════════════════════════════════════════
   SECCIÓN: TAREAS
═══════════════════════════════════════════════════════════ */
function renderTasks() {
  const { currentYear: y, currentMonth: m } = state;
  const key    = getMonthKey(y, m);
  const tasks  = state.tasks[key] || [];
  const filter = state.taskFilter;

  const filtered = tasks.filter(t =>
    filter === 'pending' ? !t.done : filter === 'done' ? t.done : true
  );

  const container = document.getElementById('tasks-list');
  const emptyEl   = document.getElementById('tasks-empty');
  if (!container) return;
  container.innerHTML = '';

  // Badge con pendientes
  const pending = tasks.filter(t => !t.done).length;
  setEl('tasks-badge', pending > 0 ? `${pending} pendiente${pending !== 1 ? 's' : ''}` : 'Al día ✓');

  if (filtered.length === 0) {
    if (emptyEl) emptyEl.style.display = '';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  filtered.forEach(task => {
    const item = document.createElement('div');
    item.className = 'task-item' + (task.done ? ' done' : '');
    item.setAttribute('role', 'listitem');
    item.innerHTML = `
      <button class="task-check ${task.done ? 'checked' : ''}"
              aria-label="${task.done ? 'Desmarcar' : 'Completar'} tarea"
              aria-pressed="${task.done}" type="button">
        ${task.done ? '✓' : ''}
      </button>
      <span class="task-text ${task.done ? 'done' : ''}">${escapeHtml(task.text)}</span>
      <button class="item-delete-btn" aria-label="Eliminar tarea" type="button">×</button>`;

    item.querySelector('.task-check').addEventListener('click', () => toggleTask(task.id, key));
    item.querySelector('.item-delete-btn').addEventListener('click', () => deleteTask(task.id, key));
    container.appendChild(item);
  });
}

function addTask() {
  const input = document.getElementById('task-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) { input.focus(); return; }
  const key = getMonthKey(state.currentYear, state.currentMonth);
  if (!state.tasks[key]) state.tasks[key] = [];
  state.tasks[key].push({ id: 't_' + Date.now(), text, done: false });
  input.value = '';
  Storage.saveAll(); renderTasks();
  showToast('📋 Tarea agregada', 'success');
}

function toggleTask(id, key) {
  const task = (state.tasks[key] || []).find(t => t.id === id);
  if (task) { task.done = !task.done; Storage.saveAll(); renderTasks(); }
}

function deleteTask(id, key) {
  state.tasks[key] = (state.tasks[key] || []).filter(t => t.id !== id);
  Storage.saveAll(); renderTasks();
}

function setTaskFilter(filter) {
  state.taskFilter = filter;
  document.querySelectorAll('#task-filter-tabs .filter-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  renderTasks();
}

/* ═══════════════════════════════════════════════════════════
   SECCIÓN: OBJETIVOS
═══════════════════════════════════════════════════════════ */
function renderGoals() {
  const shortList  = document.getElementById('goals-short-list');
  const longList   = document.getElementById('goals-long-list');
  if (!shortList || !longList) return;

  shortList.innerHTML = '';
  longList.innerHTML  = '';

  const shorts = state.goals.filter(g => g.type === 'short');
  const longs  = state.goals.filter(g => g.type === 'long');

  const sDone = shorts.filter(g => g.done).length;
  const lDone = longs.filter(g => g.done).length;

  setEl('goals-short-count', `${sDone}/${shorts.length}`);
  setEl('goals-long-count',  `${lDone}/${longs.length}`);

  const shortEmpty = document.getElementById('goals-short-empty');
  const longEmpty  = document.getElementById('goals-long-empty');
  if (shortEmpty) shortEmpty.style.display = shorts.length === 0 ? '' : 'none';
  if (longEmpty)  longEmpty.style.display  = longs.length  === 0 ? '' : 'none';

  const renderGoalItem = (goal, container) => {
    const item = document.createElement('div');
    item.className = 'task-item goal-item' + (goal.done ? ' done' : '');
    item.innerHTML = `
      <button class="task-check ${goal.done ? 'checked' : ''}"
              aria-label="${goal.done ? 'Reabrir' : 'Completar'} objetivo"
              aria-pressed="${goal.done}" type="button">
        ${goal.done ? '✓' : ''}
      </button>
      <div class="goal-content">
        <span class="task-text ${goal.done ? 'done' : ''}">${escapeHtml(goal.text)}</span>
      </div>
      <button class="item-delete-btn" aria-label="Eliminar objetivo" type="button">×</button>`;

    item.querySelector('.task-check').addEventListener('click', () => toggleGoal(goal.id));
    item.querySelector('.item-delete-btn').addEventListener('click', () => deleteGoal(goal.id, goal.text));
    container.appendChild(item);
  };

  shorts.forEach(g => renderGoalItem(g, shortList));
  longs.forEach(g  => renderGoalItem(g, longList));
}

function addGoal() {
  const input  = document.getElementById('goal-input');
  const typeEl = document.getElementById('goal-type');
  if (!input || !typeEl) return;
  const text = input.value.trim();
  if (!text) { input.focus(); return; }
  state.goals.push({ id: 'g_' + Date.now(), text, type: typeEl.value, done: false, createdAt: new Date().toISOString() });
  input.value = '';
  Storage.saveAll(); renderGoals();
  showToast(`🎯 Objetivo añadido`, 'success');
}

function toggleGoal(id) {
  const goal = state.goals.find(g => g.id === id);
  if (goal) { goal.done = !goal.done; Storage.saveAll(); renderGoals(); }
}

function deleteGoal(id, text) {
  if (!confirm(`¿Eliminar el objetivo "${text}"?`)) return;
  state.goals = state.goals.filter(g => g.id !== id);
  Storage.saveAll(); renderGoals();
  showToast('🗑️ Objetivo eliminado', 'warning');
}

/* ═══════════════════════════════════════════════════════════
   SECCIÓN: IDEAS SUELTAS
═══════════════════════════════════════════════════════════ */
function renderIdeas() {
  const { currentYear: y, currentMonth: m } = state;
  const key   = getMonthKey(y, m);
  const ideas = [...(state.ideas[key] || [])].reverse(); // más recientes primero

  const grid  = document.getElementById('ideas-grid');
  const empty = document.getElementById('ideas-empty');
  if (!grid) return;
  grid.innerHTML = '';

  setEl('ideas-badge', ideas.length > 0 ? `${ideas.length} idea${ideas.length !== 1 ? 's' : ''}` : `${MONTHS_ES[m]} ${y}`);

  if (ideas.length === 0) {
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  ideas.forEach((idea, idx) => {
    const color = IDEA_ACCENT_COLORS[idea.colorIndex ?? (idx % IDEA_ACCENT_COLORS.length)];
    const card  = document.createElement('div');
    card.className = 'idea-card';
    card.setAttribute('role', 'listitem');
    card.style.cssText = `background:${color.bg};border-color:${color.border};`;

    const date    = new Date(idea.createdAt);
    const dateStr = date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour:'2-digit', minute:'2-digit' });

    card.innerHTML = `
      <div class="idea-card-header">
        <span class="idea-dot" style="background:${color.dot}"></span>
        <span class="idea-date">${dateStr}</span>
        <button class="idea-delete-btn" aria-label="Eliminar idea" type="button">×</button>
      </div>
      <p class="idea-text">${escapeHtml(idea.text)}</p>`;

    card.querySelector('.idea-delete-btn').addEventListener('click', () => deleteIdea(idea.id));
    grid.appendChild(card);
  });
}

function addIdea() {
  const input = document.getElementById('idea-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) { input.focus(); return; }

  const { currentYear: y, currentMonth: m } = state;
  const key = getMonthKey(y, m);
  if (!state.ideas[key]) state.ideas[key] = [];

  const colorIndex = state.ideas[key].length % IDEA_ACCENT_COLORS.length;
  state.ideas[key].push({ id: 'i_' + Date.now(), text, colorIndex, createdAt: new Date().toISOString() });

  input.value = '';
  input.style.height = 'auto';
  Storage.saveAll(); renderIdeas();
  showToast('💡 Idea guardada', 'success');
}

function deleteIdea(id) {
  const key = getMonthKey(state.currentYear, state.currentMonth);
  state.ideas[key] = (state.ideas[key] || []).filter(i => i.id !== id);
  Storage.saveAll(); renderIdeas();
}

/* ═══════════════════════════════════════════════════════════
   SECCIÓN: REVISIÓN MENSUAL
═══════════════════════════════════════════════════════════ */
function renderReview() {
  const { currentYear: y, currentMonth: m } = state;
  const key         = getMonthKey(y, m);
  const total       = getDaysInMonth(y, m);
  const countable   = getCountableDays(y, m);
  const monthCells  = state.habitCells[key] || {};

  const habitStats = state.habits.map(habit => {
    const cells = monthCells[habit.id] || {};
    let done = 0;
    for (let d = 1; d <= countable; d++) { if (cells[d]) done++; }
    const pct = countable > 0 ? Math.round((done / countable) * 100) : 0;
    return { ...habit, done, total: countable, pct };
  });

  const totalPossible = state.habits.length * countable;
  const totalDone     = habitStats.reduce((s, h) => s + h.done, 0);
  const overallPct    = totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : 0;
  const bestHabit     = habitStats.length > 0 ? habitStats.reduce((b, h) => h.pct > b.pct ? h : b) : null;

  let maxDay = 0, maxDayCount = 0;
  for (let d = 1; d <= countable; d++) {
    let count = 0;
    state.habits.forEach(h => { if ((monthCells[h.id] || {})[d]) count++; });
    if (count > maxDayCount) { maxDayCount = count; maxDay = d; }
  }

  const notes      = state.notes[key] || {};
  const notesCount = Object.values(notes).filter(v => v && v.trim()).length;
  const tasks      = state.tasks[key] || [];
  const tasksDone  = tasks.filter(t => t.done).length;

  const color = overallPct >= 75 ? '#10b981' : overallPct >= 50 ? '#f59e0b' : '#ef4444';
  const statsGrid = document.getElementById('review-stats-grid');
  if (statsGrid) {
    statsGrid.innerHTML = `
      <div class="stat-card">
        <span class="stat-label">Cumplimiento Global</span>
        <span class="stat-value" style="color:${color}">${overallPct}%</span>
        <span class="stat-change">${totalDone}/${totalPossible} posibles</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Mejor Hábito</span>
        <span class="stat-value" style="font-size:1rem;line-height:1.4">${bestHabit ? escapeHtml(bestHabit.name) : '—'}</span>
        <span class="stat-change up">${bestHabit ? bestHabit.pct + '% cumplimiento' : 'Sin datos'}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Tareas Completadas</span>
        <span class="stat-value accent">${tasksDone}</span>
        <span class="stat-change">de ${tasks.length} tareas del mes</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Notas Escritas</span>
        <span class="stat-value">${notesCount}</span>
        <span class="stat-change">de ${total} días</span>
      </div>`;
  }

  renderConsistencyChart();
}


/* ═══════════════════════════════════════════════════════════
   GRÁFICA DE RENDIMIENTO GENERAL DIARIO
   Una sola línea: eje X = días del mes,
   eje Y = total de hábitos cumplidos ese día (0 … n_hábitos).
   Los puntos se conectan formando la curva de constancia.
═══════════════════════════════════════════════════════════ */
function renderConsistencyChart() {
  const canvas = document.getElementById('consistency-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  if (consistencyChartInstance) {
    consistencyChartInstance.destroy();
    consistencyChartInstance = null;
  }

  const { currentYear: y, currentMonth: m } = state;
  const key        = getMonthKey(y, m);
  const total      = getDaysInMonth(y, m);
  const countable  = getCountableDays(y, m);
  const monthCells = state.habitCells[key] || {};
  const nHabits    = state.habits.length;
  const labels     = Array.from({ length: total }, (_, i) => i + 1);

  /* ── Sin hábitos → estado vacío ───────────────────────── */
  if (nHabits === 0) {
    const wrap = canvas.closest('.chart-container');
    if (wrap) wrap.innerHTML = `<div class="chart-empty"><span style="font-size:2rem">📈</span><p>Agrega hábitos para ver el rendimiento.</p></div>`;
    const legendEl = document.getElementById('consistency-legend');
    if (legendEl) legendEl.innerHTML = '';
    return;
  }

  /* ── Calcular: hábitos cumplidos por día ───────────────── */
  const dailyDone = labels.map(day => {
    if (day > countable) return null;   // días futuros → sin punto
    let done = 0;
    for (const habit of state.habits) {
      if ((monthCells[habit.id] || {})[day]) done++;
    }
    return done;
  });

  /* ── Racha: días consecutivos con ≥1 hábito ───────────── */
  let streak = 0;
  for (let d = countable; d >= 1; d--) {
    const anyDone = state.habits.some(h => (monthCells[h.id] || {})[d]);
    if (anyDone) streak++;
    else break;
  }

  /* ── Mejor día del mes ───────────────────────────────── */
  const bestDayIdx = dailyDone.reduce((best, v, i) =>
    v !== null && v > (dailyDone[best] ?? -1) ? i : best, 0);
  const bestVal = dailyDone[bestDayIdx] ?? 0;

  /* Promedio diario */
  const filled  = dailyDone.filter(v => v !== null);
  const avgDone = filled.length
    ? (filled.reduce((s, v) => s + v, 0) / filled.length).toFixed(1)
    : 0;

  /* ── Chips de info ──────────────────────────────────── */
  const streakChip = document.getElementById('consistency-streak-chip');
  if (streakChip) {
    if (streak > 0) {
      streakChip.textContent = `✦ ${streak} día${streak !== 1 ? 's' : ''} seguido${streak !== 1 ? 's' : ''}`;
      streakChip.style.display = '';
    } else {
      streakChip.style.display = 'none';
    }
  }
  const badge = document.getElementById('consistency-badge');
  if (badge) badge.textContent = `Promedio: ${avgDone} / ${nHabits} hábitos`;

  /* ── Leyenda informativa ────────────────────────────── */
  const legendEl = document.getElementById('consistency-legend');
  if (legendEl) {
    const pct = nHabits > 0 && countable > 0
      ? Math.round((filled.reduce((s, v) => s + v, 0) / (nHabits * countable)) * 100)
      : 0;
    legendEl.innerHTML = [
      { icon: '🏆', label: `Mejor día: ${bestVal} / ${nHabits}` },
      { icon: '📊', label: `Cumplimiento global: ${pct}%` },
      { icon: '📅', label: `Días registrados: ${filled.length} / ${total}` },
    ].map(({ icon, label }) =>
      `<span style="display:flex;align-items:center;gap:5px;font-size:0.72rem;
        color:var(--text-secondary);background:rgba(255,255,255,0.04);
        border:1px solid var(--glass-border);border-radius:99px;padding:3px 10px;">
        ${icon} ${label}
      </span>`
    ).join('');
  }

  /* ── Gradiente bajo la curva ─────────────────────────── */
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 160);
  gradient.addColorStop(0,   'rgba(16,185,129,0.35)');
  gradient.addColorStop(0.6, 'rgba(16,185,129,0.08)');
  gradient.addColorStop(1,   'rgba(16,185,129,0.00)');

  /* Radios: normal=3, mejor día=7 (amarillo), hoy=5 */
  const radii = dailyDone.map((v, i) => {
    if (v === null) return 0;
    if (i === bestDayIdx && bestVal > 0) return 7;
    if (i === countable - 1) return 5;
    return v > 0 ? 3 : 2;
  });
  const dotColors = dailyDone.map((_, i) =>
    i === bestDayIdx && bestVal > 0 ? '#fbbf24' : '#10b981'
  );

  Chart.defaults.color = '#8b949e';
  Chart.defaults.font.family = "'Inter', system-ui, sans-serif";

  consistencyChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label:                'Hábitos cumplidos',
        data:                 dailyDone,
        borderColor:          '#10b981',
        backgroundColor:      gradient,
        borderWidth:          2.5,
        tension:              0.35,
        fill:                 true,
        pointRadius:          radii,
        pointHoverRadius:     7,
        pointBackgroundColor: dotColors,
        pointBorderColor:     'rgba(10,14,20,0.5)',
        pointBorderWidth:     1.5,
        spanGaps:             false,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      animation:   { duration: 600, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(10,14,20,0.90)',
          borderColor:     'rgba(255,255,255,0.08)',
          borderWidth:     1,
          titleColor:      '#e6edf3',
          bodyColor:       '#8b949e',
          padding:         10,
          callbacks: {
            title: items => `Día ${items[0].label}`,
            label: item => {
              const v = item.raw;
              if (v === null) return '  Sin registro';
              const pctDay = nHabits > 0 ? Math.round((v / nHabits) * 100) : 0;
              return `  ${v} de ${nHabits} hábitos (${pctDay}%)`;
            },
          },
        },
      },
      scales: {
        x: {
          grid:   { color: 'rgba(255,255,255,0.03)', drawTicks: false },
          border: { color: 'rgba(255,255,255,0.05)' },
          ticks:  {
            color: '#4a5568',
            font:  { size: 10 },
            maxTicksLimit: 10,
            callback: (_, i) => (i + 1) % 5 === 0 || i === 0 ? labels[i] : '',
          },
        },
        y: {
          min:    0,
          max:    nHabits,
          grid:   { color: 'rgba(255,255,255,0.03)', drawTicks: false },
          border: { display: false },
          ticks:  {
            color:     '#4a5568',
            font:      { size: 10 },
            stepSize:  1,
            precision: 0,
            callback:  v => Number.isInteger(v) ? v : '',
          },
        },
      },
    },
  });
}

/* ═══════════════════════════════════════════════════════════
   BÚSQUEDA
═══════════════════════════════════════════════════════════ */
function openSearch() {
  const modal = document.getElementById('search-modal');
  if (!modal) return;
  modal.removeAttribute('hidden');
  modal.classList.add('open');
  const input = document.getElementById('search-input');
  if (input) { input.value = ''; input.focus(); }
  const results = document.getElementById('search-results');
  if (results) results.innerHTML = getSearchHint();
}

function closeSearch() {
  const modal = document.getElementById('search-modal');
  if (!modal) return;
  modal.classList.remove('open');
  setTimeout(() => modal.setAttribute('hidden', ''), 200);
}

function getSearchHint() {
  return `<div class="search-hint">
    <span class="search-hint-icon">🔍</span>
    <p>Busca en <strong>notas diarias</strong>, <strong>tareas</strong>, <strong>objetivos</strong> e <strong>ideas</strong>.</p>
    <p class="search-hint-sub">Escribe al menos 2 caracteres para comenzar.</p>
  </div>`;
}

function performSearch(rawQuery) {
  const q       = rawQuery.trim().toLowerCase();
  const results = document.getElementById('search-results');
  if (!results) return;

  if (!q || q.length < 2) { results.innerHTML = getSearchHint(); return; }

  const hits = [];

  // Notas diarias (todos los meses)
  Object.keys(state.notes).forEach(mk => {
    Object.entries(state.notes[mk] || {}).forEach(([day, text]) => {
      if (text && text.toLowerCase().includes(q)) {
        const [yr, mn] = mk.split('-').map(Number);
        hits.push({ section: `📓 Notas — ${MONTHS_ES[mn-1]} ${yr}`, text: `Día ${day}: ${text}`, view: 'diary', mk, yr, mn: mn-1 });
      }
    });
  });

  // Tareas (todos los meses)
  Object.keys(state.tasks).forEach(mk => {
    (state.tasks[mk] || []).forEach(t => {
      if (t.text.toLowerCase().includes(q)) {
        const [yr, mn] = mk.split('-').map(Number);
        hits.push({ section: `📋 Tareas — ${MONTHS_ES[mn-1]} ${yr}`, text: t.text, done: t.done, view: 'tasks', mk, yr, mn: mn-1 });
      }
    });
  });

  // Objetivos (globales)
  state.goals.forEach(g => {
    if (g.text.toLowerCase().includes(q))
      hits.push({ section: '🎯 Objetivos', text: g.text, done: g.done, view: 'goals' });
  });

  // Ideas (todos los meses)
  Object.keys(state.ideas).forEach(mk => {
    (state.ideas[mk] || []).forEach(i => {
      if (i.text.toLowerCase().includes(q)) {
        const [yr, mn] = mk.split('-').map(Number);
        hits.push({ section: `💡 Ideas — ${MONTHS_ES[mn-1]} ${yr}`, text: i.text, view: 'notes', mk, yr, mn: mn-1 });
      }
    });
  });

  if (hits.length === 0) {
    results.innerHTML = `<div class="search-no-results">
      <span style="font-size:2rem;">🔍</span>
      <p>Sin resultados para <strong>"${escapeHtml(rawQuery)}"</strong></p>
      <p class="search-hint-sub">Intenta con otras palabras clave.</p>
    </div>`;
    return;
  }

  // Resaltar coincidencias
  const hl = (text, q) => {
    const i = text.toLowerCase().indexOf(q);
    if (i === -1) return escapeHtml(text);
    return escapeHtml(text.slice(0, i)) +
      `<mark>${escapeHtml(text.slice(i, i + q.length))}</mark>` +
      escapeHtml(text.slice(i + q.length));
  };

  results.innerHTML = `
    <div class="search-count">${hits.length} resultado${hits.length !== 1 ? 's' : ''}</div>
    ${hits.map((h, idx) => `
      <div class="search-result-item" data-idx="${idx}">
        <div class="search-result-section">${h.section}${h.done ? ' <span class="search-done-chip">✓ completado</span>' : ''}</div>
        <div class="search-result-text">${hl(h.text, q)}</div>
      </div>`).join('')}`;

  results.querySelectorAll('.search-result-item').forEach((el, idx) => {
    el.addEventListener('click', () => {
      const h = hits[idx];
      if (h.yr !== undefined) {
        state.currentYear  = h.yr;
        state.currentMonth = h.mn;
        updateMonthLabel();
      }
      closeSearch();
      switchView(h.view);
    });
  });
}

/* ═══════════════════════════════════════════════════════════
   AJUSTES
═══════════════════════════════════════════════════════════ */
function openSettings() {
  const modal = document.getElementById('settings-modal');
  if (!modal) return;
  modal.removeAttribute('hidden');
  modal.classList.add('open');
}

function closeSettings() {
  const modal = document.getElementById('settings-modal');
  if (!modal) return;
  modal.classList.remove('open');
  setTimeout(() => modal.setAttribute('hidden', ''), 200);
}

function exportData() {
  const data = {
    version: '2.0', exportedAt: new Date().toISOString(),
    notes: state.notes, habits: state.habits, habitCells: state.habitCells,
    tasks: state.tasks, goals: state.goals, ideas: state.ideas,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href: url, download: `sky-backup-${new Date().toISOString().slice(0,10)}.json`
  });
  a.click();
  URL.revokeObjectURL(url);
  showToast('⬆️ Datos exportados correctamente', 'success');
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!confirm('¿Importar datos? Esto reemplazará todo lo que tienes actualmente.')) return;
      if (data.notes)      state.notes      = data.notes;
      if (data.habits)     state.habits     = data.habits;
      if (data.habitCells) state.habitCells = data.habitCells;
      if (data.tasks)      state.tasks      = data.tasks;
      if (data.goals)      state.goals      = data.goals;
      if (data.ideas)      state.ideas      = data.ideas;
      Storage.saveAll();
      updateMonthLabel();
      switchView(state.currentView);
      closeSettings();
      showToast('⬇️ Datos importados correctamente', 'success');
    } catch {
      showToast('⚠️ El archivo no es un JSON válido.', 'warning');
    }
  };
  reader.readAsText(file);
}

function clearCurrentMonth() {
  const { currentYear: y, currentMonth: m } = state;
  const name = `${MONTHS_ES[m]} ${y}`;
  if (!confirm(`¿Limpiar todos los datos de ${name}?\n\nSe borrarán: notas, tareas, ideas y registros de hábitos de ese mes.\nLos hábitos configurados y objetivos NO se borran.`)) return;
  const key = getMonthKey(y, m);
  delete state.notes[key];
  delete state.tasks[key];
  delete state.ideas[key];
  delete state.habitCells[key];
  Storage.saveAll();
  switchView(state.currentView);
  showToast(`🗓️ ${name} limpiado`, 'warning');
  closeSettings();
}

function clearAllData() {
  if (!confirm('⚠️ ¿Borrar TODOS los datos de Sky?\n\nEsto eliminará absolutamente todo:\nnotas, hábitos, tareas, objetivos e ideas.\n\nEsta acción NO se puede deshacer.')) return;
  if (!confirm('Última confirmación: ¿estás completamente seguro?')) return;
  localStorage.clear();
  location.reload();
}

/* ═══════════════════════════════════════════════════════════
   NAVEGACIÓN — VISTAS
═══════════════════════════════════════════════════════════ */
const VIEW_META = {
  diary:  { title: 'Notas del Mes',     subtitle: 'Registro diario' },
  habits: { title: 'Hábitos & Metas',   subtitle: 'Seguimiento mensual' },
  tasks:  { title: 'Tareas',            subtitle: 'Pendientes del mes' },
  goals:  { title: 'Objetivos',         subtitle: 'Metas a corto y largo plazo' },
  notes:  { title: 'Ideas Sueltas',     subtitle: 'Captura libre de ideas' },
  review: { title: 'Revisión Mensual',  subtitle: 'Análisis y estadísticas' },
};

function switchView(view) {
  state.currentView = view;
  document.querySelectorAll('.view-section').forEach(el => { el.style.display = 'none'; });
  const target = document.getElementById(`view-${view}`);
  if (target) target.style.display = '';

  const meta = VIEW_META[view] || { title: view, subtitle: '' };
  setEl('view-title', meta.title);
  const subEl = document.getElementById('view-subtitle');
  if (subEl) subEl.innerHTML = `${meta.subtitle} — <span id="current-month-name">${MONTHS_ES[state.currentMonth]} ${state.currentYear}</span>`;

  document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
    btn.setAttribute('aria-current', btn.dataset.view === view ? 'page' : 'false');
  });
  document.querySelectorAll('.bottom-nav-item[data-view]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  if (view === 'diary')  renderDaysGrid();
  if (view === 'habits') renderHabitsTable();
  if (view === 'tasks')  renderTasks();
  if (view === 'goals')  renderGoals();
  if (view === 'notes')  renderIdeas();
  if (view === 'review') renderReview();

  const mc = document.getElementById('main-content');
  if (mc) mc.scrollTop = 0;
}

/* ═══════════════════════════════════════════════════════════
   NAVEGACIÓN — MESES
═══════════════════════════════════════════════════════════ */
function changeMonth(delta) {
  flushCurrentNotes();
  Storage.saveAll();
  // Destruir gráfica antes de cambiar mes para que se reconstruya limpia
  if (consistencyChartInstance) { consistencyChartInstance.destroy(); consistencyChartInstance = null; }
  state.currentMonth += delta;
  if (state.currentMonth < 0)  { state.currentMonth = 11; state.currentYear--; }
  if (state.currentMonth > 11) { state.currentMonth = 0;  state.currentYear++; }
  updateMonthLabel();
  switchView(state.currentView);
  showToast(`${delta < 0 ? '◀ ' : ' ▶'} ${MONTHS_ES[state.currentMonth]} ${state.currentYear}`, 'success');
}

/* ═══════════════════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════════════════ */
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('hiding'); setTimeout(() => toast.remove(), 220); }, 2600);
}

/* ═══════════════════════════════════════════════════════════
   PREPARACIÓN PARA IMPRESIÓN / EXPORTACIÓN
═══════════════════════════════════════════════════════════ */
window.addEventListener('beforeprint', () => {
  // Guardar notas actuales antes de imprimir para asegurar que todo el texto esté en el DOM
  flushCurrentNotes();

  // Forzar que todos los textareas de notas se auto-ajusten a su scrollHeight completo
  document.querySelectorAll('.day-note-input').forEach(ta => {
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
    ta.style.maxHeight = 'none';
  });
});

window.addEventListener('afterprint', () => {
  // Restablecer alturas normales y límites después de la impresión
  document.querySelectorAll('.day-note-input').forEach(ta => {
    ta.style.maxHeight = '';
    autoResizeTextarea(ta);
  });
});

/* ═══════════════════════════════════════════════════════════
   SERVICE WORKER
═══════════════════════════════════════════════════════════ */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(r => console.log('[Sky SW]', r.scope))
      .catch(e => console.warn('[Sky SW] Error:', e));
  }
}

/* ═══════════════════════════════════════════════════════════
   INICIALIZACIÓN
═══════════════════════════════════════════════════════════ */
function init() {
  Storage.loadAll();

  // Splash → App
  setTimeout(() => {
    const splash = document.getElementById('splash');
    const app    = document.getElementById('app');
    if (splash) splash.classList.add('hidden');
    if (app)    app.removeAttribute('hidden');
    if (splash) setTimeout(() => splash.remove(), 450);
  }, 1300);

  updateMonthLabel();
  switchView('diary');

  // ── Mes ──
  document.getElementById('prev-month-btn')?.addEventListener('click', () => changeMonth(-1));
  document.getElementById('next-month-btn')?.addEventListener('click', () => changeMonth(+1));

  // ── Sidebar + Bottom Nav ──
  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.view) switchView(btn.dataset.view);
    });
  });

  // ── Guardar ──
  document.getElementById('save-btn')?.addEventListener('click', () => {
    flushCurrentNotes(); Storage.saveAll(); updateStats();
    showToast('✅ Todo guardado', 'success');
  });

  // ── TAREAS ──
  document.getElementById('add-habit-btn')?.addEventListener('click', addHabit);

  const taskInput = document.getElementById('task-input');
  document.getElementById('task-add-btn')?.addEventListener('click', addTask);
  taskInput?.addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });
  document.getElementById('task-filter-tabs')?.addEventListener('click', e => {
    const tab = e.target.closest('.filter-tab');
    if (tab?.dataset.filter) setTaskFilter(tab.dataset.filter);
  });

  // ── OBJETIVOS ──
  const goalInput = document.getElementById('goal-input');
  document.getElementById('goal-add-btn')?.addEventListener('click', addGoal);
  goalInput?.addEventListener('keydown', e => { if (e.key === 'Enter') addGoal(); });

  // ── IDEAS ──
  document.getElementById('idea-add-btn')?.addEventListener('click', addIdea);
  const ideaInput = document.getElementById('idea-input');
  ideaInput?.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addIdea(); });
  ideaInput?.addEventListener('input', () => autoResizeTextarea(ideaInput));

  // ── BÚSQUEDA ──
  document.getElementById('search-btn')?.addEventListener('click', openSearch);
  document.getElementById('search-close-btn')?.addEventListener('click', closeSearch);
  document.getElementById('search-input')?.addEventListener('input', e => performSearch(e.target.value));
  document.getElementById('search-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeSearch();
  });

  // ── AJUSTES ──
  document.getElementById('settings-btn')?.addEventListener('click', openSettings);
  document.getElementById('settings-close-btn')?.addEventListener('click', closeSettings);
  document.getElementById('settings-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeSettings();
  });
  document.getElementById('export-btn')?.addEventListener('click', exportData);
  document.getElementById('import-btn')?.addEventListener('click', () => {
    document.getElementById('import-file-input')?.click();
  });
  document.getElementById('import-file-input')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) { importData(file); e.target.value = ''; }
  });
  document.getElementById('clear-month-btn')?.addEventListener('click', clearCurrentMonth);
  document.getElementById('clear-all-btn')?.addEventListener('click', clearAllData);

  // ── IMPRESIÓN / PDF ──
  const triggerPrint = () => {
    closeSettings();
    window.print();
  };
  document.getElementById('print-btn')?.addEventListener('click', triggerPrint);
  document.getElementById('settings-print-btn')?.addEventListener('click', triggerPrint);

  // ── Atajos de teclado ──
  document.addEventListener('keydown', e => {
    if (e.altKey && e.key === 'ArrowLeft')  changeMonth(-1);
    if (e.altKey && e.key === 'ArrowRight') changeMonth(+1);
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); document.getElementById('save-btn')?.click(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') { e.preventDefault(); triggerPrint(); }
    if (e.key === 'Escape') { closeSearch(); closeSettings(); }
  });

  // ── Auto-guardado cada 30s ──
  setInterval(() => { flushCurrentNotes(); Storage.saveAll(); }, 30_000);

  registerServiceWorker();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
