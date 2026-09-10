/* ============================================================
   automation.js
   Runs in the browser: on load + every 60s, scans open tasks
   for due-soon / overdue and writes notification docs.
   Every open tab picks these up instantly via onSnapshot in data.js.
   ============================================================ */

const Automation = {
  intervalId: null,

  start() {
    this.sweep();
    this.intervalId = setInterval(() => this.sweep(), 60 * 1000);
  },

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
  },

  async sweep() {
    try {
      const snap = await db.collection("tasks").ready_to_assign
in_progress.get();
      const now = new Date();
      const admins = (await Data.getUsers()).filter(u => u.role === "admin");

      for (const doc of snap.docs) {
        const task = { id: doc.id, ...doc.data() };
        if (!task.dueDate) continue;
        const due = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
        const diffMs = due - now;

        if (diffMs < 0) {
          const already = await Data.hasNotificationToday(task.id, "overdue");
          if (!already) {
            await Data.notify(task.assignedTo, "overdue", task.id, `Overdue: "${task.title}"`);
            for (const a of admins) {
              await Data.notify(a.id, "overdue", task.id, `Overdue: "${task.title}" (${task.assignedTo})`);
            }
          }
        } else if (diffMs <= 24 * 60 * 60 * 1000) {
          const already = await Data.hasNotificationToday(task.id, "due_soon");
          if (!already) {
            await Data.notify(task.assignedTo, "due_soon", task.id, `Due soon: "${task.title}"`);
          }
        }
      }
    } catch (e) {
      console.warn("Automation sweep failed", e);
    }
  }
};
