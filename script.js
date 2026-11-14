const DEFAULT_STATUSES = [
  { id: 'garde', name: 'Garde', color: '#64748b' },
  { id: 'repos', name: 'Repos', color: '#65a30d' },
  { id: 'palais', name: 'Palais', color: '#db2777' },
  { id: 'reserve', name: 'Réserve', color: '#ea580c' }
];

const WEEKDAYS_FR = ['dimanches', 'lundis', 'mardis', 'mercredis', 'jeudis', 'vendredis', 'samedis'];

let statuses = JSON.parse(localStorage.getItem('planning_statuses')) || DEFAULT_STATUSES;
let events = JSON.parse(localStorage.getItem('planning_events')) || {};
let rdvs = JSON.parse(localStorage.getItem('planning_rdvs')) || {};
let todos = JSON.parse(localStorage.getItem('planning_todos')) || [];

let isEditingStatus = false;
let selectedStatusId = statuses.length > 0 ? statuses[0].id : 'CLEAR';

let currentDate = new Date();
let activeDetailDateKey = null;
let activeTodoDateKey = null;

const save = () => {
  localStorage.setItem('planning_statuses', JSON.stringify(statuses));
  localStorage.setItem('planning_events', JSON.stringify(events));
  localStorage.setItem('planning_rdvs', JSON.stringify(rdvs));
  localStorage.setItem('planning_todos', JSON.stringify(todos));
};

const hexToRgba = (hex, alpha) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Normalise les anciens RDV (texte simple) et les nouveaux RDV ({ time, text })
const normalizeRdv = (item) => {
  if (typeof item === 'string') return { time: '', text: item };
  return { time: item.time || '', text: item.text || '' };
};

const formatRdvDisplay = (item) => {
  const r = normalizeRdv(item);
  return r.time ? `${r.time} ${r.text}` : r.text;
};

/* --- GESTION DU MODE ÉDITION DES STATUTS & COULEURS --- */
const toggleEditStatusBtn = document.getElementById('toggleEditStatusBtn');
const statusToolbar = document.getElementById('statusToolbar');
const doneEditStatusBtn = document.getElementById('doneEditStatusBtn');

function setEditStatusMode(active) {
  isEditingStatus = active;
  statusToolbar.style.display = active ? 'block' : 'none';
  toggleEditStatusBtn.classList.toggle('active', active);
  toggleEditStatusBtn.textContent = active ? '🎨 Édition en cours' : '🎨 Modifier statuts';
  if (active && !selectedStatusId && statuses.length > 0) {
    selectedStatusId = statuses[0].id;
  }
  renderStatuses();
}

toggleEditStatusBtn.onclick = () => setEditStatusMode(!isEditingStatus);
doneEditStatusBtn.onclick = () => setEditStatusMode(false);

function renderStatuses() {
  const container = document.getElementById('statusList');
  container.innerHTML = '';

  const clearPill = document.createElement('div');
  clearPill.className = `status-pill ${selectedStatusId === 'CLEAR' ? 'active' : ''}`;
  clearPill.style.backgroundColor = '#f1f5f9';
  clearPill.innerHTML = `<span>Effacer</span>`;
  clearPill.onclick = () => { selectedStatusId = 'CLEAR'; renderStatuses(); };
  container.appendChild(clearPill);

  statuses.forEach(status => {
    const pill = document.createElement('div');
    pill.className = `status-pill ${selectedStatusId === status.id ? 'active' : ''}`;
    pill.style.backgroundColor = hexToRgba(status.color, 0.22);
    pill.style.color = status.color;

    // Input color intégré pour modifier directement la couleur du statut existant
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'status-color-picker';
    colorInput.value = status.color;
    colorInput.title = 'Changer la couleur';
    colorInput.onclick = (e) => e.stopPropagation();
    colorInput.oninput = (e) => {
      status.color = e.target.value;
      pill.style.backgroundColor = hexToRgba(status.color, 0.22);
      pill.style.color = status.color;
      save();
      renderCalendar();
    };

    const nameSpan = document.createElement('span');
    nameSpan.textContent = status.name;

    const delSpan = document.createElement('span');
    delSpan.className = 'delete-status';
    delSpan.title = 'Supprimer';
    delSpan.textContent = '✕';
    delSpan.onclick = (e) => {
      e.stopPropagation();
      statuses = statuses.filter(s => s.id !== status.id);
      if (selectedStatusId === status.id) selectedStatusId = statuses[0]?.id || 'CLEAR';
      save();
      renderStatuses();
      renderCalendar();
    };

    pill.appendChild(colorInput);
    pill.appendChild(nameSpan);
    pill.appendChild(delSpan);

    pill.onclick = () => {
      selectedStatusId = status.id;
      renderStatuses();
    };

    container.appendChild(pill);
  });
}

function getTodosForDate(dateObj, dateKey) {
  const dayOfWeek = dateObj.getDay();
  const dayOfMonth = dateObj.getDate();

  return todos.filter(task => {
    if (task.startDate && dateKey < task.startDate) return false;

    if (task.recurrence === 'once') return task.startDate === dateKey;
    if (task.recurrence === 'weekly') return task.weekday === dayOfWeek;
    if (task.recurrence === 'monthly') return task.monthDay === dayOfMonth;
    return false;
  });
}

function getRecurrenceText(task) {
  if (task.recurrence === 'once') return `Le ${task.startDate}`;
  if (task.recurrence === 'weekly') return `Tous les ${WEEKDAYS_FR[task.weekday]}`;
  if (task.recurrence === 'monthly') return `Le ${task.monthDay} de chaque mois`;
  return '';
}

function renderSummary(year, month, daysInMonth) {
  const summaryContainer = document.getElementById('summaryList');
  summaryContainer.innerHTML = '';
  
  const counts = {};
  statuses.forEach(s => counts[s.id] = 0);

  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const stId = events[dateKey];
    if (stId && counts[stId] !== undefined) counts[stId]++;
  }

  statuses.forEach(status => {
    const item = document.createElement('div');
    item.className = 'summary-item';
    item.innerHTML = `
      <span class="status-dot" style="background:${status.color}"></span>
      <span>${status.name} : <strong>${counts[status.id]} j</strong></span>
    `;
    summaryContainer.appendChild(item);
  });
}

function renderCalendar() {
  const grid = document.getElementById('daysGrid');
  const title = document.getElementById('monthTitle');
  grid.innerHTML = '';

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  title.textContent = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(currentDate);

  const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = new Date().toISOString().split('T')[0];

  for (let i = 0; i < firstDayIndex; i++) {
    const empty = document.createElement('div');
    empty.className = 'day-cell empty';
    grid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(year, month, day);
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const cell = document.createElement('div');
    cell.className = `day-cell ${dateKey === todayStr ? 'today' : ''}`;

    const assignedStatusId = events[dateKey];
    const statusObj = statuses.find(s => s.id === assignedStatusId);

    let statusTextHtml = '';
    if (statusObj) {
      cell.style.backgroundColor = hexToRgba(statusObj.color, 0.22);
      statusTextHtml = `<span class="day-status-text" style="color:${statusObj.color};">${statusObj.name}</span>`;
    }

    const headerDiv = document.createElement('div');
    headerDiv.className = 'day-header';
    headerDiv.innerHTML = `<span class="day-number">${day}</span>${statusTextHtml}`;
    cell.appendChild(headerDiv);

    const bottomDiv = document.createElement('div');
    bottomDiv.className = 'day-bottom';

    const dayTodos = getTodosForDate(dateObj, dateKey);
    if (dayTodos.length > 0) {
      const doneCount = dayTodos.filter(t => (t.completedDates || []).includes(dateKey)).length;
      const badge = document.createElement('div');
      badge.className = `todo-badge ${doneCount === dayTodos.length ? 'all-done' : ''}`;
      badge.textContent = `☑️ ${doneCount}/${dayTodos.length} tâche${dayTodos.length > 1 ? 's' : ''}`;
      bottomDiv.appendChild(badge);
    }

    const dayRdvs = (rdvs[dateKey] || []).map(normalizeRdv).sort((a, b) => a.time.localeCompare(b.time));
    dayRdvs.slice(0, 2).forEach(r => {
      const pill = document.createElement('div');
      pill.className = 'rdv-pill';
      pill.textContent = formatRdvDisplay(r);
      bottomDiv.appendChild(pill);
    });
    if (dayRdvs.length > 2) {
      const more = document.createElement('div');
      more.className = 'rdv-pill';
      more.textContent = `+${dayRdvs.length - 2} RDV`;
      bottomDiv.appendChild(more);
    }

    cell.appendChild(bottomDiv);

    cell.onclick = () => {
      if (isEditingStatus) {
        if (selectedStatusId === 'CLEAR' || events[dateKey] === selectedStatusId) {
          delete events[dateKey];
        } else {
          events[dateKey] = selectedStatusId;
        }
        save();
        renderCalendar();
      } else {
        openDayDetailModal(dateKey, dateObj);
      }
    };

    grid.appendChild(cell);
  }

  renderSummary(year, month, daysInMonth);
}

/* --- POP-UP 1 : DÉTAILS DU JOUR (RDV AVEC HEURE + LIEN TODO-LIST) --- */
function openDayDetailModal(dateKey, dateObj) {
  activeDetailDateKey = dateKey;
  document.getElementById('dayDetailTitle').textContent = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(dateObj);
  renderDayDetailContent();
  document.getElementById('dayDetailModal').classList.add('open');
}

function renderDayDetailContent() {
  if (!activeDetailDateKey) return;

  const list = document.getElementById('modalRdvList');
  list.innerHTML = '';
  const rawRdvs = rdvs[activeDetailDateKey] || [];
  const sortedRdvs = rawRdvs
    .map((item, originalIdx) => ({ ...normalizeRdv(item), originalIdx }))
    .sort((a, b) => a.time.localeCompare(b.time));

  if (sortedRdvs.length === 0) {
    list.innerHTML = '<p style="color:#64748b; font-size:0.85rem;">Aucun rendez-vous prévu.</p>';
  } else {
    sortedRdvs.forEach((r) => {
      const item = document.createElement('div');
      item.className = 'item-row';
      const timeHtml = r.time ? `<span class="rdv-time-tag">${r.time}</span>` : '';
      item.innerHTML = `<div>${timeHtml}<span>${r.text}</span></div><button type="button">Suppr.</button>`;
      item.querySelector('button').onclick = () => {
        rdvs[activeDetailDateKey].splice(r.originalIdx, 1);
        if (rdvs[activeDetailDateKey].length === 0) delete rdvs[activeDetailDateKey];
        save();
        renderDayDetailContent();
        renderCalendar();
      };
      list.appendChild(item);
    });
  }

  const [y, m, d] = activeDetailDateKey.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const dayTodos = getTodosForDate(dateObj, activeDetailDateKey);
  const doneCount = dayTodos.filter(t => (t.completedDates || []).includes(activeDetailDateKey)).length;

  const badge = document.getElementById('detailTodoCountBadge');
  badge.textContent = `${doneCount}/${dayTodos.length}`;
  badge.className = `count-pill ${dayTodos.length > 0 && doneCount === dayTodos.length ? 'all-done' : ''}`;
}

document.getElementById('addRdvForm').onsubmit = (e) => {
  e.preventDefault();
  const timeInput = document.getElementById('newRdvTime');
  const textInput = document.getElementById('newRdvInput');
  const timeVal = timeInput.value;
  const textVal = textInput.value.trim();
  if (!textVal || !activeDetailDateKey) return;

  if (!rdvs[activeDetailDateKey]) rdvs[activeDetailDateKey] = [];
  rdvs[activeDetailDateKey].push({ time: timeVal, text: textVal });

  timeInput.value = '';
  textInput.value = '';
  save();
  renderDayDetailContent();
  renderCalendar();
};

document.getElementById('openTodoFromDetailBtn').onclick = () => {
  if (activeDetailDateKey) {
    openTodoModal(activeDetailDateKey);
  }
};

document.getElementById('closeDayDetailBtn').onclick = () => {
  document.getElementById('dayDetailModal').classList.remove('open');
};

/* --- POP-UP 2 : VUE TO-DO AVEC CHANGEMENT DE DATE --- */
document.getElementById('openAddTaskBtn').onclick = () => {
  const todayKey = new Date().toISOString().split('T')[0];
  openTodoModal(todayKey);
};

function openTodoModal(dateKey) {
  activeTodoDateKey = dateKey;
  const [y, m, d] = dateKey.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);

  document.getElementById('todoDateTitle').textContent = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(dateObj);
  document.getElementById('todoHeaderDatePicker').value = dateKey;
  document.getElementById('todoDateInput').value = dateKey;

  renderTodoItems();
  document.getElementById('todoModal').classList.add('open');
}

// Changement de date directement depuis l'en-tête du pop-up To-Do
document.getElementById('todoHeaderDatePicker').onchange = (e) => {
  if (e.target.value) openTodoModal(e.target.value);
};

function shiftTodoDate(daysOffset) {
  if (!activeTodoDateKey) return;
  const [y, m, d] = activeTodoDateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d + daysOffset);
  const nextKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  openTodoModal(nextKey);
}

document.getElementById('todoPrevDayBtn').onclick = () => shiftTodoDate(-1);
document.getElementById('todoNextDayBtn').onclick = () => shiftTodoDate(1);

function renderTodoItems() {
  const container = document.getElementById('todoItemsList');
  container.innerHTML = '';

  const [y, m, d] = activeTodoDateKey.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const dayTodos = getTodosForDate(dateObj, activeTodoDateKey);

  if (dayTodos.length === 0) {
    container.innerHTML = '<p style="color:#9ca3af; font-size:0.9rem; text-align:center; margin-top:20px;">Aucune tâche prévue à cette date.<br>Ajoutez-en une ci-dessous !</p>';
    return;
  }

  const sortedTodos = [...dayTodos].sort((a, b) => {
    const aDone = (a.completedDates || []).includes(activeTodoDateKey) ? 1 : 0;
    const bDone = (b.completedDates || []).includes(activeTodoDateKey) ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    return (b.starred ? 1 : 0) - (a.starred ? 1 : 0);
  });

  sortedTodos.forEach(task => {
    const completedDates = task.completedDates || [];
    const isDone = completedDates.includes(activeTodoDateKey);

    const card = document.createElement('div');
    card.className = `todo-task-card ${isDone ? 'done' : ''}`;

    card.innerHTML = `
      <div class="todo-check">${isDone ? '✓' : ''}</div>
      <div class="todo-task-info">
        <div class="todo-task-text">${task.text}</div>
        <span class="todo-task-rec">${getRecurrenceText(task)}</span>
      </div>
      <button type="button" class="todo-star ${task.starred ? 'starred' : ''}">${task.starred ? '★' : '☆'}</button>
      <button type="button" class="todo-del" title="Supprimer cette tâche">✕</button>
    `;

    card.querySelector('.todo-check').onclick = () => {
      if (!task.completedDates) task.completedDates = [];
      if (task.completedDates.includes(activeTodoDateKey)) {
        task.completedDates = task.completedDates.filter(dt => dt !== activeTodoDateKey);
      } else {
        task.completedDates.push(activeTodoDateKey);
      }
      save();
      renderTodoItems();
      renderDayDetailContent();
      renderCalendar();
    };

    card.querySelector('.todo-star').onclick = () => {
      task.starred = !task.starred;
      save();
      renderTodoItems();
    };

    card.querySelector('.todo-del').onclick = () => {
      todos = todos.filter(t => t.id !== task.id);
      save();
      renderTodoItems();
      renderDayDetailContent();
      renderCalendar();
    };

    container.appendChild(card);
  });
}

document.getElementById('addTodoForm').onsubmit = (e) => {
  e.preventDefault();
  const textInput = document.getElementById('newTodoTextInput');
  const recSelect = document.getElementById('todoRecurrenceType');
  const dateInput = document.getElementById('todoDateInput');

  const text = textInput.value.trim();
  const chosenDate = dateInput.value;
  if (!text || !chosenDate) return;

  const [y, m, d] = chosenDate.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);

  const newTask = {
    id: 'todo_' + Date.now(),
    text,
    recurrence: recSelect.value,
    startDate: chosenDate,
    weekday: dateObj.getDay(),
    monthDay: dateObj.getDate(),
    starred: false,
    completedDates: []
  };

  todos.push(newTask);
  textInput.value = '';
  save();

  if (chosenDate !== activeTodoDateKey) {
    openTodoModal(chosenDate);
  } else {
    renderTodoItems();
  }
  renderDayDetailContent();
  renderCalendar();
};

document.getElementById('closeTodoBtn').onclick = () => {
  document.getElementById('todoModal').classList.remove('open');
  renderDayDetailContent();
};

/* --- NAVIGATION & SAUVEGARDE --- */
document.getElementById('prevMonth').onclick = () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); };
document.getElementById('nextMonth').onclick = () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); };
document.getElementById('todayBtn').onclick = () => { currentDate = new Date(); renderCalendar(); };

document.getElementById('addStatusForm').onsubmit = (e) => {
  e.preventDefault();
  const nameInput = document.getElementById('newStatusName');
  const colorInput = document.getElementById('newStatusColor');
  const newStatus = {
    id: 'st_' + Date.now(),
    name: nameInput.value.trim(),
    color: colorInput.value
  };
  statuses.push(newStatus);
  selectedStatusId = newStatus.id;
  nameInput.value = '';
  save();
  renderStatuses();
  renderCalendar();
};

document.getElementById('exportBtn').onclick = () => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ statuses, events, rdvs, todos }, null, 2));
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute("href", dataStr);
  dlAnchor.setAttribute("download", `planning-${new Date().toISOString().slice(0,10)}.json`);
  dlAnchor.click();
};

document.getElementById('importBtn').onclick = () => document.getElementById('importFile').click();
document.getElementById('importFile').onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      if (data.statuses && data.events) {
        statuses = data.statuses;
        events = data.events;
        rdvs = data.rdvs || {};
        todos = data.todos || [];
        save();
        renderStatuses();
        renderCalendar();
      }
    } catch (err) { alert("Fichier JSON invalide."); }
  };
  reader.readAsText(file);
};

renderStatuses();
renderCalendar();
