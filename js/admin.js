/* ============================================================
   admin.js — renders admin-role views
   ============================================================ */

const Admin = {
  render(view) {
    const main = document.getElementById("main");
    if (view === "overview") return this.renderOverview(main);
    if (view === "all-tasks") return this.renderAllTasks(main);
    if (view === "employees") return this.renderEmployees(main);
    if (view === "reports") return this.renderReports(main);
    if (view === "activity") return this.renderActivity(main);
  },

  renderOverview(main) {
    main.innerHTML = `
      <h1>Overview</h1>
      <div class="page-sub">What needs attention right now.</div>
      <div class="pulse-bar" id="pulse-bar"></div>
      <div class="digest-card" id="digest-card"></div>
      <button class="btn btn-ghost" id="copy-summary-btn" style="margin-bottom:18px;">Copy ops summary</button>
      <h3 style="font-size:13px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">Recent activity</h3>
      <div id="recent-activity"></div>
    `;

    let latestTasks = [];
    const unsubTasks = Data.onTasks(all => {
      latestTasks = all;
      this.renderPulseBar(all);
      this.renderDigest(all);
    });
    const unsubActivity = Data.onActivity(list => this.renderActivityFeed(list, "recent-activity", 8));
    App.activeUnsubs.push(unsubTasks, unsubActivity);

    document.getElementById("copy-summary-btn").onclick = () => {
      const total = latestTasks.length;
      const inProgress = latestTasks.filter(t => t.status === "in_progress").length;
      const overdue = latestTasks.filter(isOverdue).length;
      const done = latestTasks.filter(t => t.status === "done").length;
      const summary = [
        "LALA TECH — OPERATIONS",
        "".padEnd(24, "─"),
        `TOTAL        ${total}`,
        `IN PROGRESS  ${inProgress}`,
        `OVERDUE      ${overdue}`,
        `COMPLETED    ${done}`,
        "".padEnd(24, "─"),
        `snapshot: ${new Date().toLocaleString()}`
      ].join("\n");
      navigator.clipboard.writeText(summary).then(
        () => toast("Ops summary copied"),
        () => toast("Couldn't copy — clipboard permission denied")
      );
    };
  },

  renderPulseBar(tasks) {
    const bar = document.getElementById("pulse-bar");
    if (!bar) return;
    const total = tasks.length;
    const inProgress = tasks.filter(t => t.status === "in_progress").length;
    const overdue = tasks.filter(isOverdue).length;
    const done = tasks.filter(t => t.status === "done").length;
    const stats = [
      ["Total Tasks", total, false],
      ["In Progress", inProgress, false],
      ["Overdue", overdue, overdue > 0],
      ["Completed", done, false]
    ];
    bar.innerHTML = stats.map(([label, num, active]) => `
      <div class="pulse-stat ${active ? "overdue-active" : ""}">
        <div class="num-display">${num}</div>
        <div class="label">${label}</div>
      </div>
    `).join("");
  },

  renderDigest(tasks) {
    const card = document.getElementById("digest-card");
    if (!card) return;
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1); yesterday.setHours(0, 0, 0, 0);
    const today0 = new Date(); today0.setHours(0, 0, 0, 0);
    const completedYesterday = tasks.filter(t => {
      if (t.status !== "done" || !t.updatedAt) return false;
      const d = t.updatedAt.toDate ? t.updatedAt.toDate() : new Date(t.updatedAt);
      return d >= yesterday && d < today0;
    }).length;
    const overdueCount = tasks.filter(isOverdue).length;

    const byEmployee = {};
    tasks.forEach(t => {
      if (t.status === "done") return;
      byEmployee[t.assignedTo] = byEmployee[t.assignedTo] || { open: 0, overdue: 0 };
      byEmployee[t.assignedTo].open++;
      if (isOverdue(t)) byEmployee[t.assignedTo].overdue++;
    });
    let onTrackName = "Everyone";
    let bestScore = -1;
    Object.entries(byEmployee).forEach(([uid, stat]) => {
      const score = stat.open - stat.overdue * 3;
      if (score > bestScore) { bestScore = score; onTrackName = App.usersById[uid] ? App.usersById[uid].name : "someone"; }
    });

    card.innerHTML = `<strong>${completedYesterday} completed</strong> yesterday, <strong>${overdueCount} overdue</strong> right now, <strong>${onTrackName}</strong> is on track.`;
  },

  renderActivityFeed(list, containerId, limit) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const items = limit ? list.slice(0, limit) : list;
    el.innerHTML = items.length ? items.map(a => `
      <div class="activity-item">
        <div class="activity-dot"></div>
        <div class="activity-time">${fmtTimestamp(a.timestamp)}</div>
        <div>${App.usersById[a.actorId] ? App.usersById[a.actorId].name : "Someone"} ${escapeHtml(a.action)}</div>
      </div>
    `).join("") : `<div class="empty-state">No activity yet</div>`;
  },

  renderAllTasks(main) {
    main.innerHTML = `
      <h1>All Tasks</h1>
      <div class="page-sub">Every task across the team.</div>
      <div class="table-toolbar">
        <input type="text" id="search-input" placeholder="Search tasks…">
        <select id="filter-employee"><option value="">All employees</option></select>
        <select id="filter-status">
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="blocked">Blocked</option>
          <option value="done">Done</option>
        </select>
        <select id="filter-priority">
          <option value="">All priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>
      <table>
        <thead><tr>
          <th data-sort="title">Task</th>
          <th data-sort="assignedTo">Employee</th>
          <th data-sort="dueDate">Due</th>
          <th data-sort="status">Status</th>
          <th data-sort="priority">Priority</th>
          <th data-sort="updatedAt">Last updated</th>
        </tr></thead>
        <tbody id="tasks-tbody"></tbody>
      </table>
    `;

    const empSelect = document.getElementById("filter-employee");
    App.users.filter(u => u.role === "employee").forEach(u => {
      const opt = document.createElement("option");
      opt.value = u.id; opt.textContent = u.name;
      empSelect.appendChild(opt);
    });

    let allTasks = [];
    let sortKey = "updatedAt", sortDir = -1;

    const rerender = () => {
      const q = document.getElementById("search-input").value.toLowerCase();
      const fEmp = empSelect.value;
      const fStatus = document.getElementById("filter-status").value;
      const fPriority = document.getElementById("filter-priority").value;

      let rows = allTasks.filter(t =>
        (!q || t.title.toLowerCase().includes(q)) &&
        (!fEmp || t.assignedTo === fEmp) &&
        (!fStatus || t.status === fStatus) &&
        (!fPriority || t.priority === fPriority)
      );

      rows.sort((a, b) => {
        let av = a[sortKey], bv = b[sortKey];
        if (av && av.toDate) av = av.toDate();
        if (bv && bv.toDate) bv = bv.toDate();
        if (av === undefined || av === null) av = "";
        if (bv === undefined || bv === null) bv = "";
        if (sortKey === "assignedTo") { av = App.usersById[a.assignedTo]?.name || ""; bv = App.usersById[b.assignedTo]?.name || ""; }
        if (av < bv) return -1 * sortDir;
        if (av > bv) return 1 * sortDir;
        return 0;
      });

      const tbody = document.getElementById("tasks-tbody");
      tbody.innerHTML = rows.length ? rows.map(t => `
        <tr data-id="${t.id}">
          <td>${escapeHtml(t.title)}</td>
          <td>${App.usersById[t.assignedTo] ? App.usersById[t.assignedTo].name : "—"}</td>
          <td>${relativeDate(t.dueDate)}</td>
          <td><div class="status-stripe-cell"><span class="status-stripe status-${t.status} ${isOverdue(t) ? "overdue" : ""}"></span>${statusLabel(t.status)}</div></td>
          <td><span class="priority-dot ${t.priority}"></span> ${t.priority}</td>
          <td>${fmtTimestamp(t.updatedAt)}</td>
        </tr>
      `).join("") : `<tr><td colspan="6"><div class="empty-state">No tasks match</div></td></tr>`;

      tbody.querySelectorAll("tr[data-id]").forEach(tr => {
        tr.onclick = () => {
          const task = allTasks.find(t => t.id === tr.dataset.id);
          if (task) TaskPanel.open(task);
        };
      });
    };

    ["search-input", "filter-employee", "filter-status", "filter-priority"].forEach(id => {
      document.getElementById(id).addEventListener("input", rerender);
    });

    document.querySelectorAll("th[data-sort]").forEach(th => {
      th.onclick = () => {
        const key = th.dataset.sort;
        sortDir = (sortKey === key) ? -sortDir : 1;
        sortKey = key;
        rerender();
      };
    });

    const unsub = Data.onTasks(list => { allTasks = list; rerender(); });
    App.activeUnsubs.push(unsub);
  },

  renderEmployees(main) {
    main.innerHTML = `<h1>Employees</h1><div class="page-sub">Load and completion rate, per person.</div><div class="employee-grid" id="employee-grid"></div>`;
    let tasks = [];
    const rerender = () => {
      const grid = document.getElementById("employee-grid");
      const employees = App.users.filter(u => u.role === "employee");
      grid.innerHTML = employees.map(u => {
        const mine = tasks.filter(t => t.assignedTo === u.id);
        const open = mine.filter(t => t.status !== "done").length;
        const overdue = mine.filter(isOverdue).length;
        const done = mine.filter(t => t.status === "done").length;
        const rate = mine.length ? Math.round((done / mine.length) * 100) : 0;
        const isOnline = App.presence[u.id] && (Date.now() - toMillis(App.presence[u.id].lastSeen)) < 45000;
        return `
          <div class="employee-card">
            <div class="top">
              <div class="avatar" style="background:${u.avatarColor || '#5B9CFF'};width:34px;height:34px;font-size:13px;">${initials(u.name)}</div>
              <div class="name">${u.name}</div>
              <div class="presence-dot ${isOnline ? "online" : ""}" style="margin-left:auto;"></div>
            </div>
            <div class="employee-stat-row"><span>Open tasks</span><b>${open}</b></div>
            <div class="employee-stat-row"><span>Overdue</span><b style="color:${overdue ? 'var(--red)' : 'inherit'}">${overdue}</b></div>
            <div class="employee-stat-row"><span>Completion rate</span><b>${rate}%</b></div>
          </div>
        `;
      }).join("");
    };
    const unsub = Data.onTasks(list => { tasks = list; rerender(); });
    const unsubP = Data.onPresence(() => rerender());
    App.activeUnsubs.push(unsub, unsubP);
  },

  renderReports(main) {
    main.innerHTML = `
      <h1>Reports</h1>
      <div class="page-sub">Completion trend and speed.</div>
      <div class="report-grid">
        <div class="report-card">
          <h3>Completed per day (last 7 days)</h3>
          <div id="report-chart"></div>
        </div>
        <div class="report-card">
          <h3>Avg. time to completion</h3>
          <div class="avg-stat" id="avg-completion">—</div>
        </div>
      </div>
    `;
    const unsub = Data.onTasks(all => {
      const done = all.filter(t => t.status === "done" && t.updatedAt && t.createdAt);
      document.getElementById("report-chart").innerHTML = this.buildBarChart(done);
      document.getElementById("avg-completion").textContent = this.avgCompletionTime(done);
    });
    App.activeUnsubs.push(unsub);
  },

  buildBarChart(doneTasks) {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
      days.push(d);
    }
    const counts = days.map(day => {
      const next = new Date(day); next.setDate(next.getDate() + 1);
      return doneTasks.filter(t => {
        const u = t.updatedAt.toDate ? t.updatedAt.toDate() : new Date(t.updatedAt);
        return u >= day && u < next;
      }).length;
    });
    const max = Math.max(1, ...counts);
    const w = 320, h = 140, barW = 32, gap = 14;
    let bars = "";
    counts.forEach((c, i) => {
      const barH = (c / max) * (h - 30);
      const x = i * (barW + gap);
      bars += `
        <rect x="${x}" y="${h - barH - 20}" width="${barW}" height="${barH}" fill="var(--orange, #FF7A29)" rx="2"></rect>
        <text x="${x + barW / 2}" y="${h - barH - 26}" fill="#F2EFEA" font-size="11" text-anchor="middle" font-family="IBM Plex Mono, monospace">${c}</text>
        <text x="${x + barW / 2}" y="${h - 4}" fill="#8A93A6" font-size="10" text-anchor="middle">${days[i].toLocaleDateString(undefined, { weekday: "short" })}</text>
      `;
    });
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="160" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;
  },

  avgCompletionTime(doneTasks) {
    if (!doneTasks.length) return "—";
    const totalMs = doneTasks.reduce((sum, t) => {
      const c = t.createdAt.toDate ? t.createdAt.toDate() : new Date(t.createdAt);
      const u = t.updatedAt.toDate ? t.updatedAt.toDate() : new Date(t.updatedAt);
      return sum + Math.max(0, u - c);
    }, 0);
    const avgHours = totalMs / doneTasks.length / 3600000;
    if (avgHours < 24) return `${avgHours.toFixed(1)}h`;
    return `${(avgHours / 24).toFixed(1)}d`;
  },

  renderActivity(main) {
    main.innerHTML = `<h1>Activity</h1><div class="page-sub">Global chronological log.</div><div id="full-activity"></div>`;
    const unsub = Data.onActivity(list => this.renderActivityFeed(list, "full-activity", null), 200);
    App.activeUnsubs.push(unsub);
  }
};

function toMillis(ts) {
  if (!ts) return 0;
  return ts.toMillis ? ts.toMillis() : new Date(ts).getTime();
}