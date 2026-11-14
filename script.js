const DEFAULT_STATUSES = [
  { id: 'garde', name: 'Garde', color: '#64748b' },
  { id: 'repos', name: 'Repos', color: '#65a30d' },
  { id: 'palais', name: 'Palais', color: '#db2777' },
  { id: 'reserve', name: 'Réserve', color: '#ea580c' }
];

let statuses = JSON.parse(localStorage.getItem('planning_statuses')) || DEFAULT_STATUSES;
let events = JSON.parse(localStorage.getItem('planning_events')) || {};
let tasks = JSON.parse(localStorage.getItem('planning_tasks')) || {};
let selectedTool = statuses.length > 0 ? statuses[0].id : 'TASK';
let currentDate = new Date();
let activeModalDate = null;

const save = () => {
  localStorage.setItem('planning_statuses', JSON.stringify(statuses));
  localStorage.setItem('planning_events', JSON.stringify(events));
  localStorage.setItem('planning_tasks', JSON.stringify(tasks));
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

  const taskPill = document.createElement('div');
  taskPill.className = `status-pill ${selectedTool === 'TASK' ? 'active' : ''}`;
  taskPill.style.backgroundColor = '#ffffff';
  taskPill.style.border = selectedTool === 'TASK' ? '2px solid #1e293b' : '1px solid #cbd5e1';
  taskPill.innerHTML = `<span>📝 Tâche</span>`;
  taskPill.onclick = () => { selectedTool = 'TASK'; renderStatuses(); };
  container.appendChild(taskPill);

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
        if (selectedTool === status.id) selectedTool = statuses[0]?.id || 'TASK';
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

function renderSummary(year, month, daysInMonth) {
  const summaryContainer = document.getElementById('summaryList');
  summaryContainer.innerHTML = '';
  
  const counts = {};
  statuses.forEach(s => counts[s.id] = 0);

  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const stId = events[dateKey];
    if (stId && counts[stId] !== undefined) {
      counts[stId]++;
    }
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
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const cell = document.createElement('div');
    cell.className = `day-cell ${dateKey === todayStr ? 'today' : ''}`;

    const assignedStatusId = events[dateKey];
    const statusObj = statuses.find(s => s.id === assignedStatusId);

    let statusTextHtml = '';
    if (statusObj) {
      // Opacité à 0.22 (10% moins transparent que 0.12)
      cell.style.backgroundColor = hexToRgba(statusObj.color, 0.22);
      // Texte simple à droite du chiffre du jour, sans cube
      statusTextHtml = `<span class="day-status-text" style="color:${statusObj.color};">${statusObj.name}</span>`;
    }

    // Cubes pour les tâches en bas de la case
    const dayTasks = tasks[dateKey] || [];
    let tasksHtml = '';
    if (dayTasks.length > 0) {
      const visibleTasks = dayTasks.slice(0, 2).map(t => `<div class="task-pill">${t}</div>`).join('');
      const extra = dayTasks.length > 2 ? `<div class="task-pill">+${dayTasks.length - 2}</div>` : '';
      tasksHtml = `<div class="day-tasks">${visibleTasks}${extra}</div>`;
    }

    cell.innerHTML = `
      <div class="day-header">
        <span class="day-number">${day}</span>
        ${statusTextHtml}
      </div>
      ${tasksHtml}
    `;

    cell.onclick = () => {
      if (selectedTool === 'TASK') {
        openTaskModal(dateKey, day, month, year);
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

function openTaskModal(dateKey, day, month, year) {
  activeModalDate = dateKey;
  const dateObj = new Date(year, month, day);
  document.getElementById('modalDateTitle').textContent = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(dateObj);
  renderModalTasks();
  document.getElementById('taskModal').classList.add('open');
  document.getElementById('newTaskInput').focus();
}

function renderModalTasks() {
  const list = document.getElementById('modalTaskList');
  list.innerHTML = '';
  const dayTasks = tasks[activeModalDate] || [];

  if (dayTasks.length === 0) {
    list.innerHTML = '<p style="color:#64748b; font-size:0.85rem;">Aucune tâche pour ce jour.</p>';
    return;
  }

  dayTasks.forEach((taskText, idx) => {
    const item = document.createElement('div');
    item.className = 'task-item';
    item.innerHTML = `<span>${taskText}</span><button type="button">Suppr.</button>`;
    item.querySelector('button').onclick = () => {
      tasks[activeModalDate].splice(idx, 1);
      if (tasks[activeModalDate].length === 0) delete tasks[activeModalDate];
      save();
      renderModalTasks();
      renderCalendar();
    };
    list.appendChild(item);
  });
}

document.getElementById('addTaskForm').onsubmit = (e) => {
  e.preventDefault();
  const input = document.getElementById('newTaskInput');
  const val = input.value.trim();
  if (!val || !activeModalDate) return;
  if (!tasks[activeModalDate]) tasks[activeModalDate] = [];
  tasks[activeModalDate].push(val);
  input.value = '';
  save();
  renderModalTasks();
  renderCalendar();
};

document.getElementById('closeModalBtn').onclick = () => document.getElementById('taskModal').classList.remove('open');
document.getElementById('taskModal').onclick = (e) => {
  if (e.target.id === 'taskModal') document.getElementById('taskModal').classList.remove('open');
};

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
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ statuses, events, tasks }, null, 2));
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
        tasks = data.tasks || {};
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
