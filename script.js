const DEFAULT_STATUSES = [
  { id: 'garde', name: 'Garde', color: '#64748b' },
  { id: 'repos', name: 'Repos', color: '#65a30d' },
  { id: 'palais', name: 'Palais', color: '#db2777' },
  { id: 'reserve', name: 'Réserve', color: '#ea580c' }
];

const WEEKDAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

let statuses = JSON.parse(localStorage.getItem('planning_statuses')) || DEFAULT_STATUSES;
let events = JSON.parse(localStorage.getItem('planning_events')) || {};
let rdvs = JSON.parse(localStorage.getItem('planning_rdvs')) || {};
let todoLists = JSON.parse(localStorage.getItem('planning_todolists')) || [];

let selectedTool = statuses.length > 0 ? statuses[0].id : 'RDV';
let currentDate = new Date();
let activeRdvDate = null;
let activeTodoListId = null;
let activeTodoDateKey = null;

const save = () => {
  localStorage.setItem('planning_statuses', JSON.stringify(statuses));
  localStorage.setItem('planning_events', JSON.stringify(events));
  localStorage.setItem('planning_rdvs', JSON.stringify(rdvs));
  localStorage.setItem('planning_todolists', JSON.stringify(todoLists));
};

const hexToRgba = (hex, alpha) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

function renderStatuses() {
  const container = document.getElementById('statusList');
  container.innerHTML = '';

  // Outil RDV
  const rdvPill = document.createElement('div');
  rdvPill.className = `status-pill ${selectedTool === 'RDV' ? 'active' : ''}`;
  rdvPill.style.backgroundColor = '#ffffff';
  rdvPill.style.border = selectedTool === 'RDV' ? '2px solid #1e293b' : '1px solid #cbd5e1';
  rdvPill.innerHTML = `<span>📅 RDV</span>`;
  rdvPill.onclick = () => { selectedTool = 'RDV'; renderStatuses(); };
  container.appendChild(rdvPill);

  // Outil Effacer statut
  const clearPill = document.createElement('div');
  clearPill.className = `status-pill ${selectedTool === 'CLEAR' ? 'active' : ''}`;
  clearPill.style.backgroundColor = '#f1f5f9';
  clearPill.innerHTML = `<span>Effacer</span>`;
  clearPill.onclick = () => { selectedTool = 'CLEAR'; renderStatuses(); };
  container.appendChild(clearPill);

  statuses.forEach(status => {
    const pill = document.createElement('div');
    pill.className = `status-pill ${selectedTool === status.id ? 'active' : ''}`;
    pill.style.backgroundColor = hexToRgba(status.color, 0.22);
    pill.style.color = status.color;

    pill.innerHTML = `
      <span class="status-dot" style="background:${status.color}"></span>
      <span>${status.name}</span>
      <span class="delete-status" title="Supprimer">✕</span>
    `;

    pill.onclick = (e) => {
      if (e.target.classList.contains('delete-status')) {
        statuses = statuses.filter(s => s.id !== status.id);
        if (selectedTool === status.id) selectedTool = statuses[0]?.id || 'RDV';
        save();
        renderStatuses();
        renderCalendar();
      } else {
        selectedTool = status.id;
        renderStatuses();
      }
    };
    container.appendChild(pill);
  });
}

function getListsForDate(dateObj, dateKey) {
  const dayOfWeek = dateObj.getDay(); // 0 = Dim, 1 = Lun...
  const dayOfMonth = dateObj.getDate();

  return todoLists.filter(list => {
    if (list.recurrence === 'weekly') return Number(list.weekday) === dayOfWeek;
    if (list.recurrence === 'monthly') return Number(list.monthDay) === dayOfMonth;
    if (list.recurrence === 'once') return list.exactDate === dateKey;
    return false;
  });
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

    // Header de la case (Chiffre + statut à droite sans cube)
    const headerDiv = document.createElement('div');
    headerDiv.className = 'day-header';
    headerDiv.innerHTML = `<span class="day-number">${day}</span>${statusTextHtml}`;
    cell.appendChild(headerDiv);

    // Bas de la case (Badges Listes To-Do + RDV)
    const bottomDiv = document.createElement('div');
    bottomDiv.className = 'day-bottom';

    // 1. Listes To-Do affectées à ce jour
    const matchingLists = getListsForDate(dateObj, dateKey);
    matchingLists.forEach(list => {
      const badge = document.createElement('div');
      badge.className = 'todo-list-badge';
      badge.textContent = `📋 ${list.name}`;
      badge.onclick = (e) => {
        e.stopPropagation(); // Empêche de changer le statut de la journée
        openTodoDetailModal(list.id, dateKey);
      };
      bottomDiv.appendChild(badge);
    });

    // 2. Rendez-vous (RDV) ponctuels
    const dayRdvs = rdvs[dateKey] || [];
    dayRdvs.slice(0, 2).forEach(r => {
      const pill = document.createElement('div');
      pill.className = 'rdv-pill';
      pill.textContent = r;
      bottomDiv.appendChild(pill);
    });
    if (dayRdvs.length > 2) {
      const more = document.createElement('div');
      more.className = 'rdv-pill';
      more.textContent = `+${dayRdvs.length - 2} RDV`;
      bottomDiv.appendChild(more);
    }

    cell.appendChild(bottomDiv);

    // Clic sur le fond de la case
    cell.onclick = () => {
      if (selectedTool === 'RDV') {
        openRdvModal(dateKey, dateObj);
        return;
      }
      if (selectedTool === 'CLEAR' || events[dateKey] === selectedTool) {
        delete events[dateKey];
      } else {
        events[dateKey] = selectedTool;
      }
      save();
      renderCalendar();
    };

    grid.appendChild(cell);
  }

  renderSummary(year, month, daysInMonth);
}

/* --- GESTION DES RDV --- */
function openRdvModal(dateKey, dateObj) {
  activeRdvDate = dateKey;
  document.getElementById('rdvDateTitle').textContent = 'RDV - ' + new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(dateObj);
  renderModalRdvs();
  document.getElementById('rdvModal').classList.add('open');
  document.getElementById('newRdvInput').focus();
}

function renderModalRdvs() {
  const list = document.getElementById('modalRdvList');
  list.innerHTML = '';
  const dayRdvs = rdvs[activeRdvDate] || [];

  if (dayRdvs.length === 0) {
    list.innerHTML = '<p style="color:#64748b; font-size:0.85rem;">Aucun rendez-vous ce jour.</p>';
    return;
  }

  dayRdvs.forEach((text, idx) => {
    const item = document.createElement('div');
    item.className = 'item-row';
    item.innerHTML = `<span>${text}</span><button type="button">Suppr.</button>`;
    item.querySelector('button').onclick = () => {
      rdvs[activeRdvDate].splice(idx, 1);
      if (rdvs[activeRdvDate].length === 0) delete rdvs[activeRdvDate];
      save();
      renderModalRdvs();
      renderCalendar();
    };
    list.appendChild(item);
  });
}

document.getElementById('addRdvForm').onsubmit = (e) => {
  e.preventDefault();
  const input = document.getElementById('newRdvInput');
  const val = input.value.trim();
  if (!val || !activeRdvDate) return;
  if (!rdvs[activeRdvDate]) rdvs[activeRdvDate] = [];
  rdvs[activeRdvDate].push(val);
  input.value = '';
  save();
  renderModalRdvs();
  renderCalendar();
};

document.getElementById('closeRdvModalBtn').onclick = () => document.getElementById('rdvModal').classList.remove('open');

/* --- GESTIONNAIRE DES LISTES TO-DO --- */
const recTypeSelect = document.getElementById('listRecurrenceType');
const weekdaySelect = document.getElementById('listWeekdaySelect');
const monthDayInput = document.getElementById('listMonthDayInput');
const exactDateInput = document.getElementById('listExactDateInput');

recTypeSelect.onchange = () => {
  weekdaySelect.style.display = recTypeSelect.value === 'weekly' ? 'block' : 'none';
  monthDayInput.style.display = recTypeSelect.value === 'monthly' ? 'block' : 'none';
  exactDateInput.style.display = recTypeSelect.value === 'once' ? 'block' : 'none';
};

document.getElementById('manageListsBtn').onclick = () => {
  renderSavedLists();
  document.getElementById('listsManagerModal').classList.add('open');
};

document.getElementById('closeListsManagerBtn').onclick = () => {
  document.getElementById('listsManagerModal').classList.remove('open');
};

function getRecurrenceLabel(list) {
  if (list.recurrence === 'weekly') return `Tous les ${WEEKDAYS_FR[list.weekday]}s`;
  if (list.recurrence === 'monthly') return `Le ${list.monthDay} de chaque mois`;
  if (list.recurrence === 'once') return `Le ${list.exactDate}`;
  return '';
}

function renderSavedLists() {
  const container = document.getElementById('savedListsContainer');
  container.innerHTML = '';

  if (todoLists.length === 0) {
    container.innerHTML = '<p style="color:#64748b; font-size:0.85rem;">Aucune liste créée. Créez votre première liste ci-dessus.</p>';
    return;
  }

  todoLists.forEach(list => {
    const card = document.createElement('div');
    card.className = 'saved-list-card';
    card.innerHTML = `
      <div class="saved-list-info">
        <strong>📋 ${list.name}</strong>
        <span>${getRecurrenceLabel(list)} • ${list.items.length} tâche(s)</span>
      </div>
      <button type="button" class="del-list-btn" style="color:#dc2626;">Suppr.</button>
    `;
    card.querySelector('.saved-list-info').onclick = () => {
      document.getElementById('listsManagerModal').classList.remove('open');
      openTodoDetailModal(list.id, new Date().toISOString().split('T')[0]);
    };
    card.querySelector('.del-list-btn').onclick = () => {
      todoLists = todoLists.filter(l => l.id !== list.id);
      save();
      renderSavedLists();
      renderCalendar();
    };
    container.appendChild(card);
  });
}

document.getElementById('createListForm').onsubmit = (e) => {
  e.preventDefault();
  const name = document.getElementById('listNameInput').value.trim();
  const recurrence = recTypeSelect.value;
  if (!name) return;

  const newList = {
    id: 'list_' + Date.now(),
    name,
    recurrence,
    weekday: Number(weekdaySelect.value),
    monthDay: Number(monthDayInput.value),
    exactDate: exactDateInput.value,
    items: [],
    completedByDate: {} // Mémorise les cases cochées par date précise
  };

  todoLists.push(newList);
  document.getElementById('listNameInput').value = '';
  save();
  renderSavedLists();
  renderCalendar();

  // Ouvre directement la liste pour y ajouter les tâches
  document.getElementById('listsManagerModal').classList.remove('open');
  openTodoDetailModal(newList.id, new Date().toISOString().split('T')[0]);
};

/* --- VUE DÉTAILLÉE D'UNE LISTE TO-DO (STYLE MICROSOFT TO DO) --- */
function openTodoDetailModal(listId, dateKey) {
  activeTodoListId = listId;
  activeTodoDateKey = dateKey;
  const list = todoLists.find(l => l.id === listId);
  if (!list) return;

  document.getElementById('todoDetailTitle').textContent = list.name;
  document.getElementById('todoDetailSubtitle').textContent = `${getRecurrenceLabel(list)} (Séance du ${dateKey})`;
  renderTodoItems();
  document.getElementById('todoDetailModal').classList.add('open');
}

function renderTodoItems() {
  const container = document.getElementById('todoItemsList');
  container.innerHTML = '';
  const list = todoLists.find(l => l.id === activeTodoListId);
  if (!list) return;

  if (!list.completedByDate) list.completedByDate = {};
  const completedIds = list.completedByDate[activeTodoDateKey] || [];

  // Trie pour mettre les tâches importantes (étoile) en haut, comme Microsoft To Do
  const sortedItems = [...list.items].sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0));

  sortedItems.forEach(item => {
    const isDone = completedIds.includes(item.id);
    const card = document.createElement('div');
    card.className = `todo-task-card ${isDone ? 'done' : ''}`;

    card.innerHTML = `
      <div class="todo-check">${isDone ? '✓' : ''}</div>
      <div class="todo-task-text">${item.text}</div>
      <button type="button" class="todo-star ${item.starred ? 'starred' : ''}">${item.starred ? '★' : '☆'}</button>
      <button type="button" class="todo-del" title="Supprimer">✕</button>
    `;

    // Cocher / décocher la tâche pour cette date
    card.querySelector('.todo-check').onclick = () => {
      const currentDone = list.completedByDate[activeTodoDateKey] || [];
      if (currentDone.includes(item.id)) {
        list.completedByDate[activeTodoDateKey] = currentDone.filter(id => id !== item.id);
      } else {
        list.completedByDate[activeTodoDateKey] = [...currentDone, item.id];
      }
      save();
      renderTodoItems();
    };

    // Étoile d'importance
    card.querySelector('.todo-star').onclick = () => {
      item.starred = !item.starred;
      save();
      renderTodoItems();
    };

    // Supprimer définitivement la tâche de la liste
    card.querySelector('.todo-del').onclick = () => {
      list.items = list.items.filter(i => i.id !== item.id);
      save();
      renderTodoItems();
    };

    container.appendChild(card);
  });
}

document.getElementById('addTodoTaskForm').onsubmit = (e) => {
  e.preventDefault();
  const input = document.getElementById('newTodoTaskInput');
  const text = input.value.trim();
  const list = todoLists.find(l => l.id === activeTodoListId);
  if (!text || !list) return;

  list.items.push({
    id: 'task_' + Date.now(),
    text,
    starred: false
  });
  input.value = '';
  save();
  renderTodoItems();
};

document.getElementById('backFromTodoBtn').onclick = () => {
  document.getElementById('todoDetailModal').classList.remove('open');
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
  selectedTool = newStatus.id;
  nameInput.value = '';
  save();
  renderStatuses();
  renderCalendar();
};

document.getElementById('exportBtn').onclick = () => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ statuses, events, rdvs, todoLists }, null, 2));
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
        todoLists = data.todoLists || [];
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
