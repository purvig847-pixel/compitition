/* ============================================================
   data.js — Firestore CRUD
   ============================================================ */

const Data = {
  // ---------- Users ----------
  async getUsers() {
    const snap = await db.collection("users").get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  onUsers(cb) {
    return db.collection("users").onSnapshot(snap => {
      cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  },

  async touchPresence(userId) {
    await db.collection("presence").doc(userId).set({
      lastSeen: firebase.firestore.FieldValue.serverTimestamp()
    });
  },

  onPresence(cb) {
    return db.collection("presence").onSnapshot(snap => {
      const map = {};
      snap.docs.forEach(d => (map[d.id] = d.data()));
      cb(map);
    });
  },

  // ---------- Tasks ----------
  onTasks(cb) {
    return db.collection("tasks").orderBy("createdAt", "desc").onSnapshot(snap => {
      cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  },

  async createTask({ title, description = "", assignedTo, createdBy, priority = "medium", dueDate = null }) {
    const now = firebase.firestore.FieldValue.serverTimestamp();
    const ref = await db.collection("tasks").add({
      title,
      description,
      assignedTo,
      createdBy,
      status: "open",
      priority,
      dueDate: dueDate ? firebase.firestore.Timestamp.fromDate(new Date(dueDate)) : null,
      createdAt: now,
      updatedAt: now
    });
    await Data.logActivity(ref.id, createdBy, `created task "${title}"`);
    if (assignedTo !== createdBy) {
      await Data.notify(assignedTo, "assigned", ref.id, `You were assigned: "${title}"`);
    }
    return ref.id;
  },

  async updateTaskStatus(taskId, status, actorId, taskTitle) {
    await db.collection("tasks").doc(taskId).update({
      status,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await Data.logActivity(taskId, actorId, `moved "${taskTitle}" to ${statusLabel(status)}`);
    if (status === "done") {
      const admins = (await Data.getUsers()).filter(u => u.role === "admin");
      for (const a of admins) {
        await Data.notify(a.id, "completed", taskId, `"${taskTitle}" was completed`);
      }
    }
  },

  async updateTask(taskId, fields, actorId, note) {
    await db.collection("tasks").doc(taskId).update({
      ...fields,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    if (note) await Data.logActivity(taskId, actorId, note);
  },

  async reassignTask(taskId, newAssignee, actorId, taskTitle) {
    await Data.updateTask(taskId, { assignedTo: newAssignee }, actorId, `reassigned "${taskTitle}"`);
    await Data.notify(newAssignee, "assigned", taskId, `You were assigned: "${taskTitle}"`);
  },

  // ---------- Comments ----------
  onComments(taskId, cb) {
    return db.collection("tasks").doc(taskId).collection("comments")
      .orderBy("createdAt", "asc")
      .onSnapshot(snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  },

  async addComment(taskId, authorId, text) {
    await db.collection("tasks").doc(taskId).collection("comments").add({
      authorId, text, createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await Data.logActivity(taskId, authorId, `commented: "${text.slice(0, 60)}"`);
  },

  // ---------- Activity ----------
  async logActivity(taskId, actorId, action) {
    await db.collection("activity").add({
      taskId, actorId, action, timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  },

  onActivity(cb, limit = 50) {
    return db.collection("activity").orderBy("timestamp", "desc").limit(limit)
      .onSnapshot(snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  },

  // ---------- Notifications ----------
  async notify(userId, type, taskId, message) {
    await db.collection("notifications").add({
      userId, type, taskId, message, read: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  },

  onNotifications(userId, cb) {
    return db.collection("notifications").where("userId", "==", userId)
      .orderBy("createdAt", "desc").limit(50)
      .onSnapshot(snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  },

  async markNotificationRead(id) {
    await db.collection("notifications").doc(id).update({ read: true });
  },

  async hasNotificationToday(taskId, type) {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const snap = await db.collection("notifications")
      .where("taskId", "==", taskId)
      .where("type", "==", type)
      .where("createdAt", ">=", firebase.firestore.Timestamp.fromDate(start))
      .limit(1).get();
    return !snap.empty;
  }
};

function statusLabel(status) {
  return { open: "Open", in_progress: "In Progress", blocked: "Blocked", done: "Done" }[status] || status;
}