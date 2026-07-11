const API = "";
let chartInstance = null;
let refreshTimer = null;

const $ = (id) => document.getElementById(id);

function showToast(message, type = "success") {
  const toast = $("toast");
  toast.textContent = message;
  toast.className = `show ${type}`;
  setTimeout(() => (toast.className = ""), 3000);
}

async function request(url, options = {}) {
  const response = await fetch(API + url, options);
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    throw new Error(data.error || data || "Request failed");
  }

  return data;
}

async function login() {
  try {
    await request("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: $("loginUser").value.trim(),
        password: $("loginPass").value
      })
    });

    sessionStorage.setItem("smartLinkLoggedIn", "yes");
    openDashboard();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function openDashboard() {
  $("loginView").classList.add("hidden");
  $("dashboard").classList.remove("hidden");
  loadStats();
  clearInterval(refreshTimer);
  refreshTimer = setInterval(loadStats, 15000);
}

function logout() {
  sessionStorage.removeItem("smartLinkLoggedIn");
  clearInterval(refreshTimer);
  $("dashboard").classList.add("hidden");
  $("loginView").classList.remove("hidden");
}

function scrollToSection(id) {
  $(id).scrollIntoView({ behavior: "smooth" });
}

async function shorten() {
  const button = $("generateButton");
  button.disabled = true;
  button.textContent = "Generating...";

  try {
    const data = await request("/shorten", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: $("url").value,
        title: $("title").value,
        customName: $("custom").value,
        expiry: $("expiry").value,
        password: $("linkPassword").value
      })
    });

    $("responseBox").innerHTML = `
      <div class="result-card">
        <div>
          <p class="eyebrow">LINK CREATED</p>
          <h3>${escapeHtml($("title").value || "Untitled")}</h3>
          <a href="${data.shortLink}" target="_blank" rel="noopener">${data.shortLink}</a>
          <div class="result-actions">
            <button class="secondary" onclick="copyLink('${data.shortLink}')">Copy link</button>
            <a class="button-link" href="${data.qr}" download="qr-code.png">Download QR</a>
          </div>
        </div>
        <img class="qr" src="${data.qr}" alt="QR code">
      </div>
    `;

    ["url", "title", "custom", "expiry", "linkPassword"].forEach((id) => ($(id).value = ""));
    showToast("Short link created");
    loadStats();
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = "Generate short link";
  }
}

async function loadStats() {
  try {
    const data = await request("/stats/all");
    renderMetrics(data);
    renderLinks(data);
    renderChart(data);
  } catch (error) {
    showToast(error.message, "error");
  }
}

function renderMetrics(data) {
  $("totalLinks").textContent = data.length;
  $("totalClicks").textContent = data.reduce((sum, link) => sum + (link.clicks || 0), 0);

  const unique = new Set();
  data.forEach((link) => {
    (link.visits || []).forEach((visit) => unique.add(`${visit.ip}-${visit.device}`));
  });
  $("uniqueVisitors").textContent = unique.size;

  const now = new Date();
  $("activeLinks").textContent = data.filter((link) => !link.expiry || new Date(link.expiry) > now).length;
}

function renderLinks(data) {
  $("emptyState").classList.toggle("hidden", data.length !== 0);

  $("links").innerHTML = data
    .map(
      (link) => `
      <article class="link-card">
        <div class="link-head">
          <div>
            <p class="eyebrow">${link.passwordProtected ? "PASSWORD PROTECTED" : "PUBLIC LINK"}</p>
            <h3>${escapeHtml(link.title || "Untitled")}</h3>
          </div>
          <span class="click-badge">${link.clicks || 0} clicks</span>
        </div>

        <a class="short-url" href="${link.shortLink}" target="_blank" rel="noopener">
          ${escapeHtml(link.shortLink)}
        </a>

        <p class="destination">${escapeHtml(link.url)}</p>

        <div class="link-meta">
          <span>Expires: ${link.expiry ? new Date(link.expiry).toLocaleDateString() : "Never"}</span>
          <span>${(link.visits || []).length} visits stored</span>
        </div>

        <div class="card-actions">
          <button class="secondary" onclick="copyLink('${link.shortLink}')">Copy</button>
          <button class="secondary" onclick="toggleVisitors('${link._id}')">Visitors</button>
          <button class="danger" onclick="deleteLink('${link._id}')">Delete</button>
        </div>

        <div id="vis-${link._id}" class="visitors hidden">
          ${renderVisitors(link.visits || [])}
        </div>
      </article>
    `
    )
    .join("");
}

function renderVisitors(visits) {
  if (!visits.length) return '<p class="muted">No visitor data yet.</p>';

  return visits
    .slice()
    .reverse()
    .slice(0, 20)
    .map(
      (visit) => `
        <div class="visitor">
          <strong>${escapeHtml(visit.city || "Unknown")}, ${escapeHtml(visit.country || "Unknown")}</strong>
          <span>${escapeHtml(visit.device || "Desktop")} · ${escapeHtml(visit.browser || "Unknown")} · ${escapeHtml(visit.os || "Unknown")}</span>
          <span>${visit.time ? new Date(visit.time).toLocaleString() : ""}</span>
          ${
            visit.lat || visit.lon
              ? `<a target="_blank" rel="noopener" href="https://www.google.com/maps?q=${visit.lat},${visit.lon}">Open map</a>`
              : ""
          }
        </div>
      `
    )
    .join("");
}

function toggleVisitors(id) {
  $(`vis-${id}`).classList.toggle("hidden");
}

async function deleteLink(id) {
  if (!confirm("Delete this tracked link permanently?")) return;

  try {
    await request(`/delete/${id}`, { method: "DELETE" });
    showToast("Link deleted");
    loadStats();
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function copyLink(link) {
  try {
    await navigator.clipboard.writeText(link);
    showToast("Link copied");
  } catch {
    prompt("Copy this link:", link);
  }
}

function downloadCSV() {
  window.location.href = "/export/csv";
}

function renderChart(data) {
  const labels = data.slice(0, 12).map((link) => link.title || link.shortId);
  const clicks = data.slice(0, 12).map((link) => link.clicks || 0);

  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart($("chart"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Clicks",
          data: clicks,
          borderWidth: 0,
          borderRadius: 8,
          backgroundColor: "#6d5dfc"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } },
        x: { grid: { display: false } }
      }
    }
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

if (sessionStorage.getItem("smartLinkLoggedIn") === "yes") {
  openDashboard();
}
