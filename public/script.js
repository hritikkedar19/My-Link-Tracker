let chartInstance = null;
let refreshTimer = null;
let currentLinks = [];

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showMessage(text, type = "error") {
  $("message").innerHTML = text ? `<div class="message ${type}">${escapeHtml(text)}</div>` : "";
}

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) throw new Error(data?.error || data || "Request failed");
  return data;
}

function login(event) {
  event.preventDefault();
  if ($("user").value === "admin" && $("pass").value === "1234") {
    sessionStorage.setItem("linkTrackerLoggedIn", "true");
    openDashboard();
  } else {
    alert("Wrong username or password. Use admin / 1234.");
  }
}

function openDashboard() {
  $("loginBox").classList.add("hidden");
  $("dashboard").classList.remove("hidden");
  loadStats();
  clearInterval(refreshTimer);
  refreshTimer = setInterval(loadStats, 10000);
}

function logout() {
  sessionStorage.removeItem("linkTrackerLoggedIn");
  clearInterval(refreshTimer);
  $("dashboard").classList.add("hidden");
  $("loginBox").classList.remove("hidden");
  $("pass").value = "";
}

async function shorten(event) {
  event.preventDefault();
  showMessage("");
  $("generateButton").disabled = true;
  $("generateButton").textContent = "Generating...";

  try {
    const data = await request("/shorten", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: $("url").value,
        title: $("title").value,
        customName: $("custom").value,
        expiry: $("expiry").value
      })
    });

    $("responseBox").innerHTML = `
      <article class="result-card">
        <div>
          <p class="eyebrow">READY</p>
          <h3>${escapeHtml(data.link.title)}</h3>
          <a href="${escapeHtml(data.shortLink)}" target="_blank" rel="noopener">${escapeHtml(data.shortLink)}</a>
          <div class="button-row result-actions">
            <button class="secondary" type="button" data-copy="${escapeHtml(data.shortLink)}">Copy link</button>
            <a class="secondary link-button" href="${escapeHtml(data.qr)}" download="qr-code.png">Save QR</a>
          </div>
        </div>
        <img class="result-qr" src="${escapeHtml(data.qr)}" alt="QR code">
      </article>`;

    $("shortenForm").reset();
    showMessage("Short link created successfully.", "success");
    await loadStats();
  } catch (error) {
    showMessage(error.message);
  } finally {
    $("generateButton").disabled = false;
    $("generateButton").textContent = "Generate Link";
  }
}

async function loadStats() {
  try {
    const data = await request("/stats/all");
    currentLinks = data;
    renderLinks(data);
    renderSummary(data);
    loadChart(data.map((link) => link.title), data.map((link) => link.clicks));
  } catch (error) {
    showMessage(error.message);
  }
}

function renderSummary(data) {
  $("totalLinks").textContent = data.length;
  $("totalClicks").textContent = data.reduce((sum, link) => sum + Number(link.clicks || 0), 0);
  $("activeLinks").textContent = data.filter((link) => !link.expiry || new Date(link.expiry) > new Date()).length;
}

function renderLinks(data) {
  $("emptyState").classList.toggle("hidden", data.length !== 0);
  $("links").innerHTML = data.map((link) => {
    const expired = link.expiry && new Date(link.expiry) <= new Date();
    return `
      <article class="link-card">
        <div class="link-card-top">
          <div><span class="status ${expired ? "expired" : "active"}">${expired ? "Expired" : "Active"}</span><h3>${escapeHtml(link.title)}</h3></div>
          <img src="${escapeHtml(link.qrCode)}" alt="QR code for ${escapeHtml(link.title)}">
        </div>
        <a class="short-url" target="_blank" rel="noopener" href="/${encodeURIComponent(link.shortId)}">${escapeHtml(location.origin)}/${escapeHtml(link.shortId)}</a>
        <p class="destination" title="${escapeHtml(link.url)}">${escapeHtml(link.url)}</p>
        <div class="meta-row"><span><strong>${Number(link.clicks || 0)}</strong> clicks</span><span>${link.expiry ? `Expires ${new Date(link.expiry).toLocaleDateString()}` : "No expiry"}</span></div>
        <div class="button-row">
          <button class="secondary" type="button" data-copy="${escapeHtml(location.origin)}/${escapeHtml(link.shortId)}">Copy</button>
          <button class="secondary" type="button" data-visitors="${escapeHtml(link._id)}">Visitors</button>
          <button class="danger" type="button" data-delete="${escapeHtml(link._id)}">Delete</button>
        </div>
        <div id="vis-${escapeHtml(link._id)}" class="visitors hidden"></div>
      </article>`;
  }).join("");
}

function showVisitors(id) {
  const container = $(`vis-${id}`);
  const link = currentLinks.find((item) => item._id === id);
  if (!container || !link) return;

  if (!container.classList.contains("hidden")) {
    container.classList.add("hidden");
    return;
  }

  container.innerHTML = link.visits.length
    ? link.visits.map((visit) => `
        <div class="visitor">
          <strong>${escapeHtml(visit.city)}, ${escapeHtml(visit.country)}</strong>
          <span>${escapeHtml(visit.device)} · ${escapeHtml(visit.browser || "Unknown browser")}</span>
          <span>${new Date(visit.time).toLocaleString()}</span>
          ${visit.lat || visit.lon ? `<a target="_blank" rel="noopener" href="https://www.google.com/maps?q=${Number(visit.lat)},${Number(visit.lon)}">View map</a>` : ""}
        </div>`).join("")
    : '<p class="muted">No visitors recorded yet.</p>';
  container.classList.remove("hidden");
}

async function deleteLink(id) {
  if (!confirm("Delete this short link permanently?")) return;
  try {
    await request(`/delete/${encodeURIComponent(id)}`, { method: "DELETE" });
    await loadStats();
    showMessage("Link deleted.", "success");
  } catch (error) {
    showMessage(error.message);
  }
}

async function copyLink(link) {
  try {
    await navigator.clipboard.writeText(link);
    showMessage("Link copied to clipboard.", "success");
  } catch {
    prompt("Copy this link:", link);
  }
}

function loadChart(labels, clicks) {
  if (typeof Chart === "undefined") return;
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart($("chart"), {
    type: "bar",
    data: { labels, datasets: [{ label: "Clicks", data: clicks, borderWidth: 1 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}

function downloadCSV() {
  window.location.href = "/export";
}

document.addEventListener("DOMContentLoaded", () => {
  $("loginForm").addEventListener("submit", login);
  $("shortenForm").addEventListener("submit", shorten);
  $("refreshButton").addEventListener("click", loadStats);
  $("exportButton").addEventListener("click", downloadCSV);
  $("logoutButton").addEventListener("click", logout);

  document.addEventListener("click", (event) => {
    const copy = event.target.closest("[data-copy]");
    const visitors = event.target.closest("[data-visitors]");
    const remove = event.target.closest("[data-delete]");
    if (copy) copyLink(copy.dataset.copy);
    if (visitors) showVisitors(visitors.dataset.visitors);
    if (remove) deleteLink(remove.dataset.delete);
  });

  if (sessionStorage.getItem("linkTrackerLoggedIn") === "true") openDashboard();
});
