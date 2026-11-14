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

let selectedTool = statuses.length > 0 ? statuses[0].id : 'RDV';
let currentDate = new Date();
let activeRdvDate = null;
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

function renderStatuses() {
  const container = document.getElementById('statusList');
  container.innerHTML = '';

  const rdvPill = document.createElement('div');
  rdvPill.className = `status-pill ${selectedTool === 'RDV' ? 'active' : ''}`;
  rdvPill.style.backgroundColor = '#ffffff';
  rdvPill.style.border = selectedTool === 'RDV' ? '2px solid #1e293b' : '1px solid #cbd5e1';
  rdvPill.innerHTML = `<span>📅 RDV</span>`;
  rdvPill.onclick = () => { selectedTool = 'RDV'; renderStatuses(); };
  container.appendChild(rdvPill);

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
