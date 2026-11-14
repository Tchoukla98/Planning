const DEFAULT_STATUSES = [
  { id: 'bureau', name: 'Bureau', color: '#3b82f6' },
  { id: 'teletravail', name: 'Télétravail', color: '#10b981' },
  { id: 'conges', name: 'Congés', color: '#f59e0b' },
  { id: 'repos', name: 'Repos / Férié', color: '#94a3b8' }
];

let statuses = JSON.parse(localStorage.getItem('planning_statuses')) || DEFAULT_STATUSES;
let events = JSON.parse(localStorage.getItem('planning_events')) || {};
let selectedStatusId = statuses.length > 0 ? statuses[0].id : null;
let currentDate = new Date();

const save = () => {
  localStorage.setItem('planning_statuses', JSON.stringify(statuses));
  localStorage.setItem('planning_events', JSON.stringify(events));
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

  const clearPill = document.createElement('div');
  clearPill.className = `status-pill ${selectedStatusId === 'CLEAR' ? 'active' : ''}`;
  clearPill.style.backgroundColor = '#f1f5f9';
  clearPill.innerHTML = `<span>Effacer</span>`;
  clearPill.onclick = () => { selectedStatusId = 'CLEAR'; renderStatuses(); };
  container.appendChild(clearPill);

  statuses.forEach(status => {
    const pill = document.createElement('div');
    pill.className = `status-pill ${selectedStatusId === status.id ? 'active' : ''}`;
    pill.style.backgroundColor = hexToRgba(status.color, 0.15);
    pill.style.color = status.color;

    pill.innerHTML = `
      <span class="status-dot" style="background:${status.color}"></span>
      <span>${status.name}</span>
      <span class="delete-status" title="Supprimer ce statut">✕</span>
    `;

    pill.onclick = (e) => {
      if (e.target.classList.contains('delete-status')) {
        statuses = statuses.filter(s => s.id !== status.id);
        if (selectedStatusId === status.id) selectedStatusId = statuses[0]?.id || null;
        save();
        renderStatuses();
        renderCalendar();
      } else {
        selectedStatusId = status.id;
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

    let badgeHtml = '';
    if (statusObj) {
      cell.style.backgroundColor = hexToRgba(statusObj.color, 0.12);
      badgeHtml = `<div class="day-badge" style="background:${statusObj.color}; color:#fff;">${statusObj.name}</div>`;
    }

    cell.innerHTML = `
      <div class="day-number">${day}</div>
      ${badgeHtml}
    `;

    cell.onclick = () => {
      if (!selectedStatusId) return;
      if (selectedStatusId === 'CLEAR' || events[dateKey] === selectedStatusId) {
        delete events[dateKey];
      } else {
        events[dateKey] = selectedStatusId;
      }
      save();
      renderCalendar();
    };

    grid.appendChild(cell);
  }

  renderSummary(year, month, daysInMonth);
}

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
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ statuses, events }, null, 2));
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
