const $ = selector => document.querySelector(selector);
const $$ = selector => document.querySelectorAll(selector);

const KEY = "presentsir_database";

const starter = {
  students: [
    { id: "1", name: "Aarav Sharma", rollNo: "CS001", className: "Computer Science" },
    { id: "2", name: "Diya Patel", rollNo: "CS002", className: "Computer Science" },
    { id: "3", name: "Ishaan Reddy", rollNo: "CS003", className: "Computer Science" },
    { id: "4", name: "Meera Nair", rollNo: "CS004", className: "Computer Science" },
    { id: "5", name: "Kabir Khan", rollNo: "CS005", className: "Computer Science" }
  ],
  attendance: {}
};

let db;

try {
  db = JSON.parse(localStorage.getItem(KEY)) || structuredClone(starter);
} catch {
  db = structuredClone(starter);
}

function saveDB() {
  localStorage.setItem(KEY, JSON.stringify(db));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}


function toast(message) {
  const t = $("#toast");
  t.textContent = message;
  t.classList.add("show");

  clearTimeout(toast.timer);

  toast.timer = setTimeout(() => {
    t.classList.remove("show");
  }, 2500);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function metrics(student) {
  const records = Object.values(db.attendance)
    .map(day => day[student.id])
    .filter(Boolean);

  const present = records.filter(
    status => status === "Present" || status === "Late"
  ).length;

  const total = records.length;

  const percentage = total
    ? (present / total) * 100
    : 0;

  const risk = percentage >= 75
    ? "Safe"
    : percentage >= 65
      ? "Warning"
      : "Critical";

  let recovery = 0;

  while (
    percentage < 75 &&
    (present + recovery) / (total + recovery || 1) < 0.75 &&
    recovery < 10000
  ) {
    recovery++;
  }

  return {
    present,
    total,
    percentage,
    risk,
    recovery
  };
}

function go(page) {
  $$(".page").forEach(section => {
    section.classList.toggle("active", section.id === page);
  });

  $$(".nav-link").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.page === page
    );
  });

  render();
}

$$(".nav-link").forEach(button => {
  button.addEventListener("click", () => {
    go(button.dataset.page);
  });
});

$$("[data-go]").forEach(button => {
  button.addEventListener("click", () => {
    go(button.dataset.go);
  });
});

$("#menuToggle").addEventListener("click", () => {
  $("#sidebar").classList.toggle("open");
});

$("#todayText").textContent =
  new Date().toLocaleDateString();

$("#attendanceDate").value = today();

function render() {
  renderDashboard();
  renderStudents();
  renderAttendance();
  renderAlerts();
}

function renderDashboard() {
  const all = db.students.map(metrics);

  const safe = all.filter(x => x.risk === "Safe").length;
  const warning = all.filter(x => x.risk === "Warning").length;
  const critical = all.filter(x => x.risk === "Critical").length;

  const present = all.reduce((sum, x) => sum + x.present, 0);
  const total = all.reduce((sum, x) => sum + x.total, 0);

  const rate = total
    ? Math.round((present / total) * 100)
    : 0;

  $("#totalStudents").textContent = db.students.length;
  $("#safeCount").textContent = safe;
  $("#warningCount").textContent = warning;
  $("#criticalCount").textContent = critical;

  $("#overallRate").textContent = rate + "%";
  $("#overallBar").style.width = rate + "%";

  const atRisk = db.students.filter(
    student => metrics(student).risk !== "Safe"
  );

  $("#dashboardRiskRows").innerHTML = atRisk.length
    ? atRisk.map(student => {
        const m = metrics(student);

        return `
          <tr>
            <td>${escapeHTML(student.name)}</td>
            <td>${escapeHTML(student.rollNo)}</td>
            <td>${m.percentage.toFixed(1)}%</td>
            <td>
              <span class="risk ${m.risk.toLowerCase()}">
                ${m.risk}
              </span>
            </td>
          </tr>
        `;
      }).join("")
    : `<tr><td colspan="4" class="empty">
        No students at risk.
       </td></tr>`;
}

// ADD AND DISPLAY STUDENTS

$("#showStudentForm").addEventListener("click", () => {
  $("#studentFormPanel").hidden = false;
});

$("#cancelStudent").addEventListener("click", () => {
  $("#studentFormPanel").hidden = true;
});

$("#studentForm").addEventListener("submit", event => {
  event.preventDefault();

  const form = new FormData(event.currentTarget);

  const student = {
    id: "s" + Date.now(),
    name: form.get("name").trim(),
    rollNo: form.get("rollNo").trim(),
    className: form.get("className").trim()
  };

  if (db.students.some(s =>
    s.rollNo.toLowerCase() === student.rollNo.toLowerCase()
  )) {
    toast("Roll number already exists.");
    return;
  }

  db.students.push(student);

  saveDB();

  event.currentTarget.reset();
  $("#studentFormPanel").hidden = true;

  render();

  toast("Student added successfully!");
});

function renderStudents() {
  const search = $("#studentSearch").value.toLowerCase();

  const students = db.students.filter(student =>
    (student.name + student.rollNo + student.className)
      .toLowerCase()
      .includes(search)
  );

  $("#studentRows").innerHTML = students.length
    ? students.map(student => {
        const m = metrics(student);

        return `
          <tr>
            <td>${escapeHTML(student.name)}</td>
            <td>${escapeHTML(student.rollNo)}</td>
            <td>${escapeHTML(student.className)}</td>
            <td>${m.total ? m.percentage.toFixed(1) + "%" : "No records"}</td>
            <td>
              <button class="btn delete-student"
                data-id="${escapeHTML(student.id)}">
                Remove
              </button>
            </td>
          </tr>
        `;
      }).join("")
    : `<tr><td colspan="5" class="empty">No students found.</td></tr>`;
}

$("#studentRows").addEventListener("click", event => {
  const button = event.target.closest(".delete-student");

  if (!button) return;

  if (!confirm("Remove this student?")) return;

  const id = button.dataset.id;

  db.students = db.students.filter(s => s.id !== id);

  Object.values(db.attendance).forEach(day => {
    delete day[id];
  });

  saveDB();
  render();

  toast("Student removed.");
});

$("#studentSearch").addEventListener("input", renderStudents);

// ATTENDANCE MANAGEMENT

function renderAttendance() {
  const date = $("#attendanceDate").value || today();
  const search = $("#attendanceSearch").value.toLowerCase();

  const day = db.attendance[date] || {};

  const students = db.students.filter(student =>
    (student.name + student.rollNo)
      .toLowerCase()
      .includes(search)
  );

  $("#attendanceRows").innerHTML = students.length
    ? students.map(student => `
        <tr>
          <td>${escapeHTML(student.name)}</td>
          <td>${escapeHTML(student.rollNo)}</td>
          <td>${escapeHTML(student.className)}</td>
          <td>
            <select class="status-select attendance-status"
              data-id="${escapeHTML(student.id)}">

              <option value="">Not marked</option>

              <option value="Present"
                ${day[student.id] === "Present" ? "selected" : ""}>
                Present
              </option>

              <option value="Absent"
                ${day[student.id] === "Absent" ? "selected" : ""}>
                Absent
              </option>

              <option value="Late"
                ${day[student.id] === "Late" ? "selected" : ""}>
                Late
              </option>

            </select>
          </td>
        </tr>
      `).join("")
    : `<tr><td colspan="4" class="empty">
        No students registered.
       </td></tr>`;

  updateMarked();
}

function updateMarked() {
  const day = db.attendance[$("#attendanceDate").value] || {};

  $("#markedSummary").textContent =
    `${Object.keys(day).length} of ${db.students.length} students marked`;
}

$("#attendanceDate").addEventListener("change", renderAttendance);

$("#attendanceSearch").addEventListener("input", renderAttendance);

$("#markAllPresent").addEventListener("click", () => {
  $$(".attendance-status").forEach(select => {
    select.value = "Present";
  });

  toast("All visible students marked present. Click Save Attendance.");
});

$("#saveAttendance").addEventListener("click", () => {
  const date = $("#attendanceDate").value;

  if (!date) {
    toast("Please select a date.");
    return;
  }

  db.attendance[date] = db.attendance[date] || {};

  $$(".attendance-status").forEach(select => {
    if (select.value) {
      db.attendance[date][select.dataset.id] = select.value;
    } else {
      delete db.attendance[date][select.dataset.id];
    }
  });

  saveDB();
  render();

  toast("Attendance saved successfully!");
});

// MENTOR ALERTS

function renderAlerts() {
  const students = db.students
    .map(student => ({
      student,
      data: metrics(student)
    }))
    .filter(item => item.data.risk !== "Safe");

  const critical = students.filter(
    item => item.data.risk === "Critical"
  ).length;

  const warning = students.filter(
    item => item.data.risk === "Warning"
  ).length;

  const safe = db.students.length - critical - warning;

  $("#alertSummary").innerHTML = `
    <div class="alert-box">
      <strong>${critical}</strong>
      <span>Critical students</span>
    </div>

    <div class="alert-box">
      <strong>${warning}</strong>
      <span>Warning students</span>
    </div>

    <div class="alert-box">
      <strong>${safe}</strong>
      <span>Safe students</span>
    </div>
  `;

  $("#alertRows").innerHTML = students.length
    ? students.map(({ student, data }) => `
        <tr>
          <td>${escapeHTML(student.name)}</td>
          <td>${data.percentage.toFixed(1)}%</td>
          <td>
            <span class="risk ${data.risk.toLowerCase()}">
              ${data.risk}
            </span>
          </td>
          <td>${data.recovery}</td>
          <td>${data.risk === "Critical"
            ? "Contact student"
            : "Monitor progress"}</td>
        </tr>
      `).join("")
    : `<tr><td colspan="5" class="empty">
        No warning students.
       </td></tr>`;
}

// STUDENT SELF-SERVICE PORTAL

$("#portalForm").addEventListener("submit", event => {
  event.preventDefault();

  const roll = $("#portalRoll").value.trim().toLowerCase();

  const student = db.students.find(
    s => s.rollNo.toLowerCase() === roll
  );

  if (!student) {
    $("#portalResult").innerHTML =
      "<p class='empty'>Student not found.</p>";
    return;
  }

  const m = metrics(student);

  $("#portalResult").innerHTML = `
    <div class="result-card">
      <h2>${escapeHTML(student.name)}</h2>

      <p>Roll Number: ${escapeHTML(student.rollNo)}</p>
      <p>Class: ${escapeHTML(student.className)}</p>

      <h2>Attendance: ${m.percentage.toFixed(1)}%</h2>

      <p>Present Classes: ${m.present}</p>
      <p>Total Marked Classes: ${m.total}</p>
      <p>Risk Status: ${m.risk}</p>
      <p>Recovery Classes: ${m.recovery}</p>
    </div>
  `;
});

// START APPLICATION

render();