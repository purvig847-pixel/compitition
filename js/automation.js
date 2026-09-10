/* ============================================================
   automation.js
   Runs in the browser: on load + every 60s, scans open tasks
   for due-soon / overdue and writes notification docs.
   Every open tab picks these up instantly via onSnapshot in data.js.
   ============================================================ */

const Automation = {
  intervalId: null,
  running: false, // prevents overlapping sweeps if one run takes >60s

  start() {
    if (this.intervalId) return; // already started
    this.sweep();
    this.intervalId = setInterval(() => this.sweep(), 60 * 1000);
  },

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  },

  async sweep() {
    if (this.running) return; // avoid overlapping runs
    this.running = true;

    try {
      // NOTE: Firestore's "!=" excludes docs where "status" doesn't exist.
      // If tasks can be created without a status field, either default it
      // on creation or switch to `.where("status", "in", ["todo","in_progress"])`.
      const snap = await db.collection("tasks").where("status", "!=", "done").get();
      const now = new Date();
      const admins = (await Data.getUsers()).filter(u => u.role === "admin");

      for (const doc of snap.docs) {
        try {
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
        } catch (taskErr) {
          // One bad task shouldn't stop the rest of the sweep.
          console.warn(`Automation: failed processing task ${doc.id}`, taskErr);
        }
      }
    } catch (e) {
      console.warn("Automation sweep failed", e);
    } finally {
      this.running = false;
    }
  }
};
