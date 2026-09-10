/* ============================================================
   app.js — view router, init, shared helpers
   ============================================================ */

const App = {
  users: [],
  usersById: {},
  presence: {},
  activeUnsubs: [],
  currentView: null,

  async init() {
    const session = Auth.getSession();
    if (session) {
      Auth.currentUser = session;
      this.boot();
    } else {
      document.getElementById("login-screen").classList.remove("hidden");
      Auth.renderLogin();
    }
  },

  async boot() {
    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("app-shell").classList.remove("hidden");

    Data.onUsers(list => {
      this.users = list;
      this.usersById = {};
      list.forEach(u => (this.usersById[u.id] = u));
    });

    Data.onPresence(map => (this.presence = map));
    Data.touchPresence(Auth.currentUser.id);
    setInterval(() => Data.touchPresence(Auth.currentUser.id), 20000);

    this.renderShell();
    Automation.start();

    const home = Auth.currentUser.role === "admin" ? "overview" : "my-tasks";
    this.navigate(home);
  },

  renderShell() {
    const user = Auth.currentUser;
    const isAdmin = user.role === "admin";
    const sidebar = document.getElementById("sidebar");

    const employeeNav = [
      ["my-tasks", "☰", "My Tasks"],
      ["create-task", "✎", "Create Task"],
      ["calendar", "▦", "Calendar"],
      ["notifications", "◔", "Notifications"]
    ];
    const adminNav = [
      ["overview", "◆", "Overview"],
      ["all-tasks", "▤", "All Tasks"],
      ["employees", "◎", "Employees"],
      ["reports", "▲", "Reports"],
      ["activity", "≡", "Activity"]
    ];
    const nav = isAdmin ? adminNav : employeeNav;

    sidebar.innerHTML = `
      <div class="brand-mark">LALA TECH — <span>OPS</span></div>
      <nav id="nav-items"></nav>
      <div id="sidebar-footer">
        <div class="avatar" style="background:${user.avatarColor || '#5B9CFF'}">${initials(user.name)}</div>
        <div class="who">
          <div class="name">${user.name}</div>
          <div class="role">${user.role}</div>
        </div>
        <button id="logout-btn">Log out</button>
      </div>
    `;
    document.getElementById("logout-btn").onclick = () => Auth.logout();

    const navEl = document.getElementById("nav-items");
    nav.forEach(([id, icon, label]) => {
      const item = document.createElement("button");
      item.className = "nav-item";
      item.dataset.view = id;
      item.innerHTML = `<span class="icon">${icon}</span><span>${label}</span>${id === "notifications" ? '<span class="nav-badge hidden" id="notif-badge">0</span>' : ""}`;
      item.onclick = () => this.navigate(id);
      navEl.appendChild(item);
    });

    if (!isAdmin) {
      Data.onNotifications(user.id, list => {
        const unread = list.filter(n => !n.read).length;
        const badge = document.getElementById("notif-badge");
        if (badge) {
          badge.textContent = unread;
          badge.classList.toggle("hidden", unread === 0);
        }
      });
    }

    document.addEventListener("keydown", e => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "/") {
        e.preventDefault();
        const s = document.getElementById("search-input");
        if (s) s.focus();
      }
      if (e.key === "n") {
        const q = document.getElementById("quick-add-input");
        if (q) { e.preventDefault(); q.focus(); }
      }
    });
  },

  navigate(view) {
    this.currentView = view;
    document.querySelectorAll(".nav-item").forEach(el => {
      el.classList.toggle("active", el.dataset.view === view);
    });
    this.activeUnsubs.forEach(fn => fn && fn());
    this.activeUnsubs = [];

    const isAdmin = Auth.currentUser.role === "admin";
    if (isAdmin) {
      Admin.render(view);
    } else {
      Employee.render(view);
    }
  }
};

function initials(name) {
  return name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
}

function relativeDate(date) {
  if (!date) return "No due date";
  const d = date.toDate ? date.toDate() : new Date(date);
  const now = new Date();
  const startOfDay = x => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const diffDays = Math.round((startOfDay(d) - startOfDay(now)) / 86400000);
  const time = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (diffDays < 0) return `Overdue · ${time}`;
  if (diffDays === 0) return `Due today`;
  if (diffDays === 1) return `Due tomorrow`;
  return `Due ${time}`;
}

function isOverdue(task) {
  if (!task.dueDate || task.status === "done") return false;
  const d = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
  return d < new Date();
}

function fmtTimestamp(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function shortId(id) {
  return "TSK-" + id.slice(0, 5).toUpperCase();
}

function toast(message, type = "info") {
  const stack = document.getElementById("toast-stack");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 4500);
}

const NOTIF_ICON = { assigned: "→", due_soon: "◔", overdue: "⚠", completed: "✓" };

/* ---------- Shared task detail panel (used by admin + employee) ---------- */
const TaskPanel = {
  unsubComments: null,

  open(task, opts = {}) {
    const isAdmin = Auth.currentUser.role === "admin";
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.id = "task-overlay";

    const assigneeOptions = App.users.map(u =>
      `<option value="${u.id}" ${u.id === task.assignedTo ? "selected" : ""}>${u.name}</option>`).join("");

    overlay.innerHTML = `
      <div class="panel">
        <button class="panel-close">✕</button>
        <h2>${escapeHtml(task.title)}</h2>
        <div class="panel-id">${shortId(task.id)} · created ${fmtTimestamp(task.createdAt)}</div>

        <div class="panel-field">
          <label>Description</label>
          <textarea id="pf-desc">${escapeHtml(task.description || "")}</textarea>
        </div>

        <div class="panel-field">
          <label>Status</label>
          <select id="pf-status">
            ${["open", "in_progress", "blocked", "done"].map(s =>
              `<option value="${s}" ${s === task.status ? "selected" : ""}>${statusLabel(s)}</option>`).join("")}
          </select>
        </div>

        <div class="panel-field">
          <label>Priority</label>
          <select id="pf-priority">
            ${["low", "medium", "high"].map(p =>
              `<option value="${p}" ${p === task.priority ? "selected" : ""}>${p}</option>`).join("")}
          </select>
        </div>

        <div class="panel-field">
          <label>Due date</label>
          <input type="date" id="pf-due" value="${task.dueDate ? toDateInputValue(task.dueDate) : ""}">
        </div>

        ${isAdmin ? `
        <div class="panel-field">
          <label>Assigned to</label>
          <select id="pf-assignee">${assigneeOptions}</select>
        </div>` : ""}

        <div class="panel-actions">
          <button class="btn btn-primary" id="pf-save">Save changes</button>
          ${task.status !== "done" ? `<button class="btn btn-ghost" id="pf-complete">✓ Mark complete</button>` : ""}
        </div>

        <div class="panel-field">
          <label>Comments</label>
          <div class="comments-list" id="pf-comments"></div>
          <div class="comment-add">
            <input type="text" id="pf-comment-input" placeholder="Add a comment…">
            <button class="btn btn-ghost" id="pf-comment-send">Send</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector(".panel-close").onclick = () => this.close();
    overlay.addEventListener("click", e => { if (e.target === overlay) this.close(); });

    overlay.querySelector("#pf-save").onclick = async () => {
      const fields = {
        description: overlay.querySelector("#pf-desc").value,
        status: overlay.querySelector("#pf-status").value,
        priority: overlay.querySelector("#pf-priority").value,
        dueDate: overlay.querySelector("#pf-due").value
          ? firebase.firestore.Timestamp.fromDate(new Date(overlay.querySelector("#pf-due").value))
          : null
      };
      if (isAdmin) {
        const newAssignee = overlay.querySelector("#pf-assignee").value;
        if (newAssignee !== task.assignedTo) {
          await Data.reassignTask(task.id, newAssignee, Auth.currentUser.id, task.title);
        }
      }
      if (fields.status !== task.status) {
        await Data.updateTaskStatus(task.id, fields.status, Auth.currentUser.id, task.title);
        delete fields.status;
      }
      await Data.updateTask(task.id, fields, Auth.currentUser.id, `updated "${task.title}"`);
      toast("Task updated");
      this.close();
    };

    const completeBtn = overlay.querySelector("#pf-complete");
    if (completeBtn) {
      completeBtn.onclick = async () => {
        await Data.updateTaskStatus(task.id, "done", Auth.currentUser.id, task.title);
        toast(`"${task.title}" marked complete`, "completed");
        this.close();
      };
    }

    overlay.querySelector("#pf-comment-send").onclick = async () => {
      const input = overlay.querySelector("#pf-comment-input");
      const text = input.value.trim();
      if (!text) return;
      await Data.addComment(task.id, Auth.currentUser.id, text);
      input.value = "";
    };
    overlay.querySelector("#pf-comment-input").addEventListener("keydown", e => {
      if (e.key === "Enter") overlay.querySelector("#pf-comment-send").click();
    });

    this.unsubComments = Data.onComments(task.id, comments => {
      const list = overlay.querySelector("#pf-comments");
      if (!list) return;
      list.innerHTML = comments.length ? comments.map(c => `
        <div class="comment">
          <span class="author">${App.usersById[c.authorId] ? App.usersById[c.authorId].name : "Someone"}</span>
          <span class="time">${fmtTimestamp(c.createdAt)}</span>
          <div>${escapeHtml(c.text)}</div>
        </div>
      `).join("") : `<div class="empty-state" style="padding:10px 0;">No comments yet</div>`;
      list.scrollTop = list.scrollHeight;
    });
  },

  close() {
    if (this.unsubComments) this.unsubComments();
    const overlay = document.getElementById("task-overlay");
    if (overlay) overlay.remove();
  }
};

function toDateInputValue(ts) {
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toISOString().slice(0, 10);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

window.addEventListener("DOMContentLoaded", () => App.init());