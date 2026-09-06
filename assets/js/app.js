const DATA_URL = "data/app-data.json";
const MAX_MATCHES = 24;

const statusLabels = {
  Played: "Finalizado",
  Fixture: "Programado",
  Playing: "En vivo",
  Postponed: "Postergado",
  Cancelled: "Cancelado",
};

const tableTypeLabels = {
  total: "General",
  home: "Local",
  away: "Visitante",
};

const els = {
  fixtureCount: document.querySelector("#fixtureCount"),
  matchList: document.querySelector("#matchList"),
  filterDate: document.querySelector("#filterDate"),
  filterStage: document.querySelector("#filterStage"),
  filterStatus: document.querySelector("#filterStatus"),
  filterTeam: document.querySelector("#filterTeam"),
  filterSearch: document.querySelector("#filterSearch"),
  clearDateButton: document.querySelector("#clearDateButton"),
  stageSelect: document.querySelector("#stageSelect"),
  tableTypeSelect: document.querySelector("#tableTypeSelect"),
  standingsTables: document.querySelector("#standingsTables"),
  relegationTable: document.querySelector("#relegationTable"),
  championshipTable: document.querySelector("#championshipTable"),
  teamsGrid: document.querySelector("#teamsGrid"),
  teamCount: document.querySelector("#teamCount"),
  teamModal: document.querySelector("#teamModal"),
  teamModalLogo: document.querySelector("#teamModalLogo"),
  teamModalNickname: document.querySelector("#teamModalNickname"),
  teamModalLabel: document.querySelector("#teamModalLabel"),
  teamModalBody: document.querySelector("#teamModalBody"),
};

let appData = null;
let teamModal = null;

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#039;",
    '"': "&quot;",
  })[char]);
}

function formatDate(value) {
  if (!value) return "Sin fecha";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "2-digit", month: "short" }).format(date);
}

function todayIso() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}

function getScore(match) {
  const { home, away } = match.score || {};
  if (home === null || away === null || home === undefined || away === undefined) return "vs";
  return `${home} - ${away}`;
}

function crest(team, className = "crest") {
  if (!team?.logo) return `<span class="${className}" aria-hidden="true"></span>`;
  return `<img class="${className}" src="${escapeHtml(team.logo)}" alt="Escudo de ${escapeHtml(team.clubName || team.name)}" loading="lazy">`;
}

function setOptions(select, options, allLabel) {
  select.innerHTML = [`<option value="">${allLabel}</option>`, ...options.map((option) => (
    `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`
  ))].join("");
}

function setupFilters() {
  const stages = [...new Set(appData.matches.map((match) => match.stage).filter(Boolean))]
    .map((stage) => ({ value: stage, label: stage }));
  const statuses = [...new Set(appData.matches.map((match) => match.status).filter(Boolean))]
    .map((status) => ({ value: status, label: statusLabels[status] || status }));
  const teams = appData.teams.map((team) => ({ value: team.id, label: team.clubName || team.name }));

  els.filterDate.value = todayIso();
  setOptions(els.filterStage, stages, "Todas las etapas");
  setOptions(els.filterStatus, statuses, "Todos los estados");
  setOptions(els.filterTeam, teams, "Todos los equipos");

  [els.filterDate, els.filterStage, els.filterStatus, els.filterTeam, els.filterSearch].forEach((input) => {
    input.addEventListener("input", renderMatches);
    input.addEventListener("change", renderMatches);
  });
  els.clearDateButton.addEventListener("click", () => {
    els.filterDate.value = "";
    renderMatches();
  });
}

function filteredMatches() {
  const date = els.filterDate.value;
  const stage = els.filterStage.value;
  const status = els.filterStatus.value;
  const team = els.filterTeam.value;
  const query = els.filterSearch.value.trim().toLowerCase();

  return appData.matches.filter((match) => {
    const hasDate = !date || match.date === date;
    const hasStage = !stage || match.stage === stage;
    const hasStatus = !status || match.status === status;
    const hasTeam = !team || match.home.id === team || match.away.id === team;
    const text = `${match.home.clubName} ${match.home.name} ${match.away.clubName} ${match.away.name} ${match.venue.name} ${match.stage}`.toLowerCase();
    const hasQuery = !query || text.includes(query);
    return hasDate && hasStage && hasStatus && hasTeam && hasQuery;
  });
}

function renderMatches() {
  const matches = filteredMatches();
  els.fixtureCount.textContent = `${matches.length} partidos`;

  if (!matches.length) {
    els.matchList.innerHTML = `<div class="empty-state">No hay partidos para esos filtros. Podés borrar la fecha para ver el calendario completo.</div>`;
    return;
  }

  els.matchList.innerHTML = matches.slice(0, MAX_MATCHES).map((match) => `
    <article class="match-card">
      <div class="match-meta">
        <span>${escapeHtml(formatDate(match.date))} · ${escapeHtml(match.time || "")}</span>
        <span class="match-status">${escapeHtml(statusLabels[match.status] || match.status || "Sin dato")}</span>
      </div>
      <div class="match-teams">
        <div class="match-team home">
          ${crest(match.home)}
          <div class="team-name">${escapeHtml(match.home.shortName || match.home.clubName || match.home.name)}</div>
        </div>
        <div class="score-box">${escapeHtml(getScore(match))}</div>
        <div class="match-team away">
          <div class="team-name">${escapeHtml(match.away.shortName || match.away.clubName || match.away.name)}</div>
          ${crest(match.away)}
        </div>
      </div>
      <div class="match-footer">
        <span>Fecha ${escapeHtml(match.week)}</span>
        <span>${escapeHtml(match.stage || "")}</span>
      </div>
      <div class="match-footer mt-2">
        <span>${escapeHtml(match.venue.shortName || match.venue.name || "Sede a confirmar")}</span>
      </div>
    </article>
  `).join("");
}

function setupStandingsControls() {
  const stages = appData.standings.stages.map((stage, index) => ({ value: String(index), label: stage.name }));
  setOptions(els.stageSelect, stages, "Seleccionar etapa");
  els.stageSelect.value = stages.length > 1 ? "1" : "0";

  updateTableTypeOptions();
  els.stageSelect.addEventListener("change", () => {
    updateTableTypeOptions();
    renderStandings();
  });
  els.tableTypeSelect.addEventListener("change", renderStandings);
}

function updateTableTypeOptions() {
  const stage = appData.standings.stages[Number(els.stageSelect.value || 0)];
  const types = Object.keys(stage?.divisions || {}).filter((type) => ["total", "home", "away"].includes(type));
  els.tableTypeSelect.innerHTML = types.map((type) => (
    `<option value="${escapeHtml(type)}">${escapeHtml(tableTypeLabels[type] || type)}</option>`
  )).join("");
  if (!els.tableTypeSelect.value) els.tableTypeSelect.value = "total";
}

function renderStandings() {
  const stage = appData.standings.stages[Number(els.stageSelect.value || 0)];
  const type = els.tableTypeSelect.value || "total";
  const groups = stage?.divisions?.[type] || [];

  els.standingsTables.innerHTML = groups.map((group) => `
    <div class="data-panel">
      <div class="group-title">
        <h3>${escapeHtml(group.groupName)}</h3>
        <span>${escapeHtml(tableTypeLabels[type] || type)}</span>
      </div>
      <div class="table-responsive">
        <table class="table app-table">
          ${standingsRows(group.rows)}
        </table>
      </div>
    </div>
  `).join("") || `<div class="empty-state">No hay tabla disponible.</div>`;
}

function standingsRows(rows = []) {
  return `
    <thead>
      <tr>
        <th>#</th><th>Equipo</th><th>Pts</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>Dif</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map((row) => `
        <tr>
          <td class="rank">${escapeHtml(row.rank ?? "")}</td>
          <td class="team-cell">${crest(row, "table-crest")}${escapeHtml(row.clubName || row.shortName || row.team)}</td>
          <td><strong>${escapeHtml(row.points ?? "")}</strong></td>
          <td>${escapeHtml(row.played ?? "")}</td>
          <td>${escapeHtml(row.won ?? "")}</td>
          <td>${escapeHtml(row.drawn ?? "")}</td>
          <td>${escapeHtml(row.lost ?? "")}</td>
          <td>${escapeHtml(row.goalsFor ?? "")}</td>
          <td>${escapeHtml(row.goalsAgainst ?? "")}</td>
          <td>${escapeHtml(row.goalDifference ?? "")}</td>
        </tr>
      `).join("")}
    </tbody>
  `;
}

function findSpecialDivision(type) {
  for (const stage of appData.standings.stages) {
    const group = stage.divisions?.[type]?.[0];
    if (group?.rows?.length) return group.rows;
  }
  return [];
}

function renderSpecialTables() {
  const relegationRows = findSpecialDivision("relegation").slice(-10).reverse();
  const championshipRows = findSpecialDivision("championship");
  els.relegationTable.innerHTML = specialRows(relegationRows, "promedio");
  els.championshipTable.innerHTML = specialRows(championshipRows, "puntos");
}

function specialRows(rows, mode) {
  return `
    <thead><tr><th>#</th><th>Equipo</th><th>${mode === "promedio" ? "Prom." : "Pts"}</th><th>PJ</th><th>GF</th><th>GC</th><th>Dif</th></tr></thead>
    <tbody>
      ${rows.map((row) => `
        <tr>
          <td class="rank">${escapeHtml(row.rank ?? "")}</td>
          <td class="team-cell">${crest(row, "table-crest")}${escapeHtml(row.clubName || row.shortName || row.team)}</td>
          <td><strong>${escapeHtml(mode === "promedio" ? Number(row.relegationAverage).toFixed(3) : row.points)}</strong></td>
          <td>${escapeHtml(row.played ?? "")}</td>
          <td>${escapeHtml(row.goalsFor ?? "")}</td>
          <td>${escapeHtml(row.goalsAgainst ?? "")}</td>
          <td>${escapeHtml(row.goalDifference ?? "")}</td>
        </tr>
      `).join("")}
    </tbody>
  `;
}

function renderTeams() {
  els.teamCount.textContent = `${appData.teams.length} equipos`;
  els.teamsGrid.innerHTML = appData.teams.map((team) => `
    <button class="team-card" type="button" data-team-id="${escapeHtml(team.id)}">
      ${crest(team, "team-card-crest")}
      <strong>${escapeHtml(team.clubName || team.name)}</strong>
      <small>${escapeHtml(team.homeVenue || "Estadio a confirmar")}</small>
    </button>
  `).join("");

  els.teamsGrid.querySelectorAll(".team-card").forEach((card) => {
    card.addEventListener("click", () => openTeamModal(card.dataset.teamId));
  });
}

function openTeamModal(teamId) {
  const team = appData.teams.find((item) => item.id === teamId);
  if (!team) return;
  const stats = team.stats || {};
  els.teamModalLogo.src = team.logo || "";
  els.teamModalLogo.alt = `Escudo de ${team.clubName || team.name}`;
  els.teamModalNickname.textContent = team.nickname || "Equipo LPF";
  els.teamModalLabel.textContent = team.clubName || team.name;
  els.teamModalBody.innerHTML = `
    <div class="team-facts">
      <div class="team-fact"><strong>Nombre oficial:</strong> ${escapeHtml(team.officialName || team.name)}</div>
      <div class="team-fact"><strong>Estadio:</strong> ${escapeHtml(team.homeVenue || "No disponible en el fixture")}</div>
    </div>
    <div class="modal-stat-grid">
      <div class="modal-stat"><strong>${escapeHtml(stats.played ?? 0)}</strong><span>Partidos jugados</span></div>
      <div class="modal-stat"><strong>${escapeHtml(stats.won ?? 0)}</strong><span>Ganados</span></div>
      <div class="modal-stat"><strong>${escapeHtml(stats.goalsFor ?? 0)}</strong><span>Goles a favor</span></div>
      <div class="modal-stat"><strong>${escapeHtml(stats.goalDifference ?? 0)}</strong><span>Diferencia</span></div>
    </div>
    <div class="table-responsive">
      <table class="table app-table compact">
        <thead><tr><th>Fecha</th><th>Partido</th><th>Resultado</th></tr></thead>
        <tbody>
          ${(team.recentMatches || []).map((match) => `
            <tr>
              <td>${escapeHtml(formatDate(match.date))}</td>
              <td>${escapeHtml(match.home)} vs ${escapeHtml(match.away)}</td>
              <td><strong>${escapeHtml(match.score)}</strong></td>
            </tr>
          `).join("") || `<tr><td colspan="3">Sin partidos finalizados.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
  teamModal.show();
}

async function init() {
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    appData = await response.json();
    teamModal = new bootstrap.Modal(els.teamModal);
    setupFilters();
    renderMatches();
    setupStandingsControls();
    renderStandings();
    renderSpecialTables();
    renderTeams();
  } catch (error) {
    document.body.innerHTML = `<main class="container py-5"><div class="empty-state">No se pudo cargar <strong>${DATA_URL}</strong>. Ejecutá la web desde localhost para permitir la lectura del JSON.</div></main>`;
    console.error(error);
  }
}

init();


