/* ============================================================
   auth.js — seeded account picker + session
   No password backend: pick a seeded user from a hardcoded list
   and store the session in localStorage.
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
    // Hardcoded accounts — edit this list to change who shows up on the login screen.
    return [
      { id: "admin1", name: "Manager", role: "admin",    avatarColor: "#FF7A29" },
      { id: "rahul",  name: "Rahul",   role: "employee", avatarColor: "#5B9CFF" },
      { id: "aman",   name: "Aman",    role: "employee", avatarColor: "#3DDC97" },
      { id: "priya",  name: "Priya",   role: "employee", avatarColor: "#FFB627" }
    ];
  },

  async renderLogin() {
    const grid = document.getElementById("account-grid");
    if (!grid) {
      console.error('Auth.renderLogin: no element with id="account-grid" found in the DOM');
      return;
    }

    grid.innerHTML = "<div class='empty-state'>Loading accounts…</div>";

    let users = [];
    try {
      users = await this.loadAccounts();
    } catch (e) {
      console.error("Auth.renderLogin: loadAccounts failed", e);
      grid.innerHTML = "<div class='empty-state'>Couldn't load accounts. Check the console for details.</div>";
      return;
    }

    if (!users.length) {
      grid.innerHTML = "<div class='empty-state'>No accounts configured. Edit loadAccounts() in auth.js.</div>";
      return;
    }

    grid.innerHTML = "";
    users
      .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === "admin" ? -1 : 1))
      .forEach(u => {
        const card = document.createElement("button");
        card.type = "button";
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
    if (typeof App !== "undefined" && typeof App.boot === "function") {
      App.boot();
    } else {
      console.error("Auth.login: App.boot() is not defined — check that app.js is loaded before auth.js runs, and that App.boot exists.");
    }
  },

  logout() {
    this.clearSession();
    location.reload();
  }
};

function initials(name) {
  return name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
}

// Kick off the login screen once the DOM is ready.
document.addEventListener("DOMContentLoaded", () => {
  if (!Auth.getSession()) {
    Auth.renderLogin();
  } else {
    Auth.currentUser = Auth.getSession();
    if (typeof App !== "undefined" && typeof App.boot === "function") {
      App.boot();
    }
  }
});
