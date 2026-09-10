/* ============================================================
   auth.js — seeded account picker + session
   No password backend: pick a seeded user from the `users`
   collection and store the session in localStorage.
   ============================================================ */

const AUTH_KEY = "lala_tech_session";/* ============================================================
   auth.js — seeded account picker + session
   No password backend: pick a seeded user from the `users`
   collection and store the session in localStorage.
   ============================================================ */

const AUTH_KEY = "lala_tech_session";

const Auth = {
  currentUser: null,

  getSession() {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  },

  setSession(user) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(user));
    this.currentUser = user;
  },

  clearSession() {
    localStorage.removeItem(AUTH_KEY);
    this.currentUser = null;
  },

  async loadAccounts() {
    // Hardcoded accounts — no Firestore seeding needed.
    // Add/remove/edit entries here to change who shows up on the login screen.
    return [
      { id: "admin1", name: "Manager", role: "admin",    avatarColor: "#FF7A29" },
      { id: "rahul",  name: "Rahul",   role: "employee", avatarColor: "#5B9CFF" },
      { id: "aman",   name: "Aman",    role: "employee", avatarColor: "#3DDC97" },
      { id: "priya",  name: "Priya",   role: "employee", avatarColor: "#FFB627" }
    ];
  },

  async renderLogin() {
    const grid = document.getElementById("account-grid");
    grid.innerHTML = "<div class='empty-state'>Loading accounts…</div>";
    let users = [];
    try {
      users = await this.loadAccounts();
    } catch (e) {
      grid.innerHTML = "<div class='empty-state'>Couldn't reach Firestore. Check firebase-config.js and your internet connection.</div>";
      return;
    }
    if (!users.length) {
      grid.innerHTML = "<div class='empty-state'>No seeded users found. Add documents to the <code>users</code> collection first (see README).</div>";
      return;
    }
    grid.innerHTML = "";
    users.sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === "admin" ? -1 : 1));
    users.forEach(u => {
      const card = document.createElement("button");
      card.className = "account-card";
      card.innerHTML = `
        <div class="avatar" style="background:${u.avatarColor || '#5B9CFF'}">${initials(u.name)}</div>
        <div class="account-name">${u.name}</div>
        <div class="account-role">${u.role}</div>
      `;
      card.onclick = () => this.login(u);
      grid.appendChild(card);
    });
  },

  login(user) {
    this.setSession(user);
    App.boot();
  },

  logout() {
    this.clearSession();
    location.reload();
  }
};

function initials(name) {
  return name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
}

const Auth = {
  currentUser: null,

  getSession() {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  },

  setSession(user) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(user));
    this.currentUser = user;
  },

  clearSession() {
    localStorage.removeItem(AUTH_KEY);
    this.currentUser = null;
  },

  async loadAccounts() {
    // Hardcoded accounts — no Firestore seeding needed.
    // Add/remove/edit entries here to change who shows up on the login screen.
    return [
      { id: "admin1", name: "Manager", role: "admin",    avatarColor: "#FF7A29" },
      { id: "rahul",  name: "Rahul",   role: "employee", avatarColor: "#5B9CFF" },
      { id: "aman",   name: "Aman",    role: "employee", avatarColor: "#3DDC97" },
      { id: "priya",  name: "Priya",   role: "employee", avatarColor: "#FFB627" }
    ];
  },

  async renderLogin() {
    const grid = document.getElementById("account-grid");
    grid.innerHTML = "<div class='empty-state'>Loading accounts…</div>";
    let users = [];
    try {
      users = await this.loadAccounts();
    } catch (e) {
      grid.innerHTML = "<div class='empty-state'>Couldn't reach Firestore. Check firebase-config.js and your internet connection.</div>";
      return;
    }
    if (!users.length) {
      grid.innerHTML = "<div class='empty-state'>No seeded users found. Add documents to the <code>users</code> collection first (see README).</div>";
      return;
    }
    grid.innerHTML = "";
    users.sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === "admin" ? -1 : 1));
    users.forEach(u => {
      const card = document.createElement("button");
      card.className = "account-card";
      card.innerHTML = `
        <div class="avatar" style="background:${u.avatarColor || '#5B9CFF'}">${initials(u.name)}</div>
        <div class="account-name">${u.name}</div>
        <div class="account-role">${u.role}</div>
      `;
      card.onclick = () => this.login(u);
      grid.appendChild(card);
    });
  },

  login(user) {
    this.setSession(user);
    App.boot();
  },

  logout() {
    this.clearSession();
    location.reload();
  }
};

function initials(name) {
  return name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
}
