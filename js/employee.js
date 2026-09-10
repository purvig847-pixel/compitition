/* ============================================================
   employee.js — renders employee-role views
   ============================================================ */

const Employee = {
  render(view) {
    const main = document.getElementById("main");
    if (view === "my-tasks") return this.renderMyTasks(main);
    if (view === "create-task") return this.renderCreateTask(main);
    if (view === "calendar") return this.renderCalendar(main);
    if (view === "notifications") return this.renderNotifications(main);
  },

  renderMyTasks(main) {
    main.innerHTML = `
      <h1>My Tasks</h1>
      <div class="page-sub">Everything assigned to you, status-first.</div>
      <div class="quick-add">
        <input type="text" id="quick-add-input" placeholder="Type a task and hit Enter…">
        <button id="quick-add-btn">Add</button>
      </div>
      <div class="kanban" id="kanban-board">
        ${[
"ready_to_assign",
"in_progress",
"waiting_on_client",
"done"
].map(s => `
          <div class="kanban-col" data-status="${s}">
            <h3>${statusLabel(s)}</h3>
            <div class="kanban-cards" id="col-${s}"></div>
          </div>
        `).join("")}
      </div>
    `;

    const submit = async () => {
      const input = document.getElementById("quick-add-input");
      const title = input.value.trim();
      if (!title) return;
      input.value = "";
      await Data.createTask({ title, assignedTo: Auth.currentUser.id, createdBy: Auth.currentUser.id });
    };
    document.getElementById("quick-add-btn").onclick = submit;
    document.getElementById("quick-add-input").addEventListener("keydown", e => {
      if (e.key === "Enter") submit();
    });

    const unsub = Data.onTasks(all => {
      const mine = all.filter(t => t.assignedTo === Auth.currentUser.id);
      [[
"ready_to_assign",
"in_progress",
"waiting_on_client",
"done"
].forEach(status => {
        const col = document.getElementById(`col-${status}`);
        if (!col) return;
        const items = mine.filter(t => t.status === status);
        col.innerHTML = items.length ? "" : "";
        items.forEach(t => col.appendChild(this.taskCard(t)));
        if (!items.length) col.innerHTML = `<div class="empty-state">Nothing here</div>`;
      });
      this.wireDragDrop(mine);
    });
    App.activeUnsubs.push(unsub);
  },

  taskCard(task) {
    const el = document.createElement("div");
    const overdue = isOverdue(task);
    el.className = `task-card status-${task.status}${overdue ? " overdue" : ""}`;
    el.draggable = true;
    el.dataset.id = task.id;
    el.innerHTML = `
      <div class="title">${escapeHtml(task.title)}</div>
      <div class="meta">
        <span class="priority-dot ${task.priority}"></span>
        <span>${relativeDate(task.dueDate)}</span>
      </div>
    `;
    el.onclick = () => TaskPanel.open(task);
    el.addEventListener("dragstart", e => {
      e.dataTransfer.setData("text/plain", task.id);
    });
    return el;
  },

  wireDragDrop(tasks) {
    document.querySelectorAll(".kanban-col").forEach(col => {
      col.addEventListener("dragover", e => { e.preventDefault(); col.classList.add("drag-over"); });
      col.addEventListener("dragleave", () => col.classList.remove("drag-over"));
      col.addEventListener("drop", async e => {
        e.preventDefault();
        col.classList.remove("drag-over");
        const id = e.dataTransfer.getData("text/plain");
        const newStatus = col.dataset.status;
        const task = tasks.find(t => t.id === id);
        if (!task || task.status === newStatus) return;
        const cardEl = document.querySelector(`.task-card[data-id="${id}"]`);
        if (cardEl && newStatus === "done") cardEl.classList.add("leaving");
        await Data.updateTaskStatus(id, newStatus, Auth.currentUser.id, task.title);
        if (newStatus === "done") toast(`"${task.title}" marked complete`, "completed");
      });
    });
  },

  renderCreateTask(main) {
    main.innerHTML = `
      <h1>Create Task</h1>
      <div class="page-sub">A fuller form, for when quick-add isn't enough.</div>
      <div class="panel" style="width:420px;">
        <div class="panel-field"><label>Title</label><input type="text" id="ct-title"></div>
        <div class="panel-field"><label>Description</label><textarea id="ct-desc"></textarea></div>
        <div class="panel-field">
          <label>Assign to</label>
          <select id="ct-assignee">
            ${App.users.map(u => `<option value="${u.id}" ${u.id === Auth.currentUser.id ? "selected" : ""}>${u.name}</option>`).join("")}
          </select>
        </div>
        <div class="panel-field">
          <label>Priority</label>
          <select id="ct-priority">
            <option value="low">Low</option>
            <option value="medium" selected>Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div class="panel-field"><label>Due date</label><input type="date" id="ct-due"></div>
        <button class="btn btn-primary" id="ct-submit">Create task</button>
      </div>
    `;
    document.getElementById("ct-submit").onclick = async () => {
      const title = document.getElementById("ct-title").value.trim();
      if (!title) { toast("Title is required"); return; }
      await Data.createTask({
        title,
        description: document.getElementById("ct-desc").value,
        assignedTo: document.getElementById("ct-assignee").value,
        createdBy: Auth.currentUser.id,
        priority: document.getElementById("ct-priority").value,
        dueDate: document.getElementById("ct-due").value || null
      });
      toast("Task created");
      App.navigate("my-tasks");
    };
  },

  renderCalendar(main) {
    main.innerHTML = `<h1>Calendar</h1><div class="page-sub">Due dates for your tasks.</div><div id="cal-container"></div>`;
    const unsub = Data.onTasks(all => {
      const mine = all.filter(t => t.assignedTo === Auth.currentUser.id && t.dueDate);
      document.getElementById("cal-container").innerHTML = this.buildCalendarHtml(mine);
    });
    App.activeUnsubs.push(unsub);
  },

  buildCalendarHtml(tasks) {
    const now = new Date();
    const year = now.getFullYear(), month = now.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const byDay = {};
    tasks.forEach(t => {
      const d = t.dueDate.toDate ? t.dueDate.toDate() : new Date(t.dueDate);
      if (d.getFullYear() === year && d.getMonth() === month) {
        (byDay[d.getDate()] = byDay[d.getDate()] || []).push(t);
      }
    });
    let cells = "";
    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach(d => cells += `<div class="cal-head">${d}</div>`);
    for (let i = 0; i < startOffset; i++) cells += `<div class="cal-cell empty"></div>`;
    for (let day = 1; day <= daysInMonth; day++) {
      const items = byDay[day] || [];
      cells += `<div class="cal-cell"><div class="daynum">${day}</div>${items.map(t =>
        `<div class="cal-task ${isOverdue(t) ? "overdue" : ""}">${escapeHtml(t.title)}</div>`).join("")}</div>`;
    }
    return `<div class="calendar-grid">${cells}</div>`;
  },

  renderNotifications(main) {
    main.innerHTML = `<h1>Notifications</h1><div class="page-sub">Assigned, due soon, and overdue.</div><div id="notif-list"></div>`;
    const unsub = Data.onNotifications(Auth.currentUser.id, list => {
      const container = document.getElementById("notif-list");
      if (!list.length) {
        container.innerHTML = `<div class="empty-state">No notifications yet</div>`;
        return;
      }
      container.innerHTML = list.map(n => `
        <div class="notif-item ${n.read ? "" : "unread"}" data-id="${n.id}">
          <div class="notif-icon">${NOTIF_ICON[n.type] || "•"}</div>
          <div style="flex:1;">
            <div class="notif-text">${escapeHtml(n.message)}</div>
            <div class="notif-time">${fmtTimestamp(n.createdAt)}</div>
          </div>
        </div>
      `).join("");
      container.querySelectorAll(".notif-item").forEach(el => {
        el.onclick = () => Data.markNotificationRead(el.dataset.id);
      });
    });
    App.activeUnsubs.push(unsub);
  }
};

function statusLabel(status) {
  return { open: "Open", in_progress: "In Progress", blocked: "Blocked", done: "Done" }[status] || status;
}
