const USERS = {
    admin: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918",
    user: "04f8996da763b7a969b1028ee3007569eaf3a635486ddab211d512c85b9df8fb",
  },
  GOOGLE_CONFIG = {
    client_id: "30896238069-4qccgpqt8iu5935v1fa7qbag7ve36m3m.apps.googleusercontent.com",
    api_key: "AIzaSyBBWWwug-UcevBmNa7sgypGFZjLfpZusEo",
    discovery_doc: "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
    scopes: "https://www.googleapis.com/auth/drive",
  };

let gapi_loaded = false,
  google_initialized = false,
  current_user = null,
  tokenClient = null;

function hashPassword(e) {
  return CryptoJS.SHA256(e).toString();
}
function showElement(e) {
  document.getElementById(e).style.display = "block";
}
function hideElement(e) {
  document.getElementById(e).style.display = "none";
}
function showError(e) {
  const t = document.getElementById("errorMessage");
  t.textContent = e;
  t.style.display = "block";
  setTimeout(() => (t.style.display = "none"), 5000);
}
function showSuccess(e) {
  const t = document.getElementById("successMessage");
  t.textContent = e;
  t.style.display = "block";
  setTimeout(() => (t.style.display = "none"), 3000);
}

// Handle login form
document.getElementById("loginFormElement").addEventListener("submit", function (e) {
  e.preventDefault();
  const t = document.getElementById("username").value,
    n = document.getElementById("password").value,
    a = hashPassword(n);
  if (USERS[t] && USERS[t] === a) {
    current_user = t;
    showSuccess("Login successful!");
    setTimeout(() => {
      hideElement("loginForm");
      showElement("portalContent");
      loadGoogleAPI();
    }, 1000);
  } else {
    showError("Invalid username or password");
  }
});

// Load Google API client library
function loadGoogleAPI() {
  if (typeof gapi === "undefined") {
    let e = document.createElement("script");
    e.src = "https://apis.google.com/js/api.js";
    e.onload = initializeGAPI;
    document.head.appendChild(e);
  } else {
    initializeGAPI();
  }
}

// Initialize GAPI + GIS token client
async function initializeGAPI() {
  try {
    console.log("[DEBUG] Loading gapi client...");
    await new Promise((resolve) => gapi.load("client", resolve));
    gapi_loaded = true;

    console.log("[DEBUG] Initializing gapi client with API key...");
    await gapi.client.init({
      apiKey: GOOGLE_CONFIG.api_key,
      discoveryDocs: [GOOGLE_CONFIG.discovery_doc],
    });

    console.log("[DEBUG] Creating GIS token client...");
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CONFIG.client_id,
      scope: GOOGLE_CONFIG.scopes,
      callback: (response) => {
        if (response.error) {
          console.error("Error fetching access token:", response);
          showError("Failed to connect to Google Drive");
          return;
        }
        console.log("[DEBUG] Access token received:", response.access_token);
        gapi.client.setToken({ access_token: response.access_token });
        updateDriveStatus(true);
        showElement("driveContent");
        showElement("refreshFilesBtn");
        loadDriveFiles();
      },
    });

    google_initialized = true;
    console.log("[DEBUG] Google API initialized successfully (GIS mode)");
  } catch (e) {
    console.error("Error initializing Google API:", e);
    showError("Failed to initialize Google Drive connection");
  }
}

// Handle "Connect Google Drive" button
document.getElementById("connectDriveBtn").addEventListener("click", function () {
  if (!google_initialized) {
    showError("Google API not initialized");
    return;
  }
  console.log("[DEBUG] Requesting access token...");
  tokenClient.requestAccessToken();
});

function updateDriveStatus(e) {
  const t = document.getElementById("driveStatus");
  e
    ? ((t.textContent = "📂 Google Drive: Connected"),
      (t.className = "status-indicator status-connected"))
    : ((t.textContent = "📂 Google Drive: Not Connected"),
      (t.className = "status-indicator status-disconnected"));
}

async function loadDriveFiles() {
  const e = document.getElementById("fileList");
  e.innerHTML = '<div class="loading"><div class="spinner"></div>Loading files...</div>';
  try {
    const t = await gapi.client.drive.files.list({
      pageSize: 20,
      fields: "nextPageToken, files(id, name, mimeType, modifiedTime, size)",
      orderBy: "modifiedTime desc",
    });
    const n = t.result.files;
    if (!n || n.length === 0) {
      e.innerHTML = '<div class="loading">No files found</div>';
      return;
    }
    let a = "";
    n.forEach((e) => {
      const t = getFileIcon(e.mimeType),
        n = e.size ? formatFileSize(e.size) : "Unknown",
        o = new Date(e.modifiedTime).toLocaleDateString();
      a += `<div class="file-item"><span class="file-icon">${t}</span><div style="flex-grow: 1;"><div style="font-weight: 500;">${e.name}</div><div style="font-size: 0.8rem; color: #666;">${n} • Modified ${o}</div></div><button onclick="openFile('${e.id}')" style="background: #4285f4; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">Open</button></div>`;
    });
    e.innerHTML = a;
  } catch (t) {
    console.error("Error loading files:", t);
    e.innerHTML = '<div class="loading" style="color: #dc3545;">Error loading files</div>';
  }
}

function getFileIcon(e) {
  return e.includes("folder")
    ? "📁"
    : e.includes("document")
    ? "📄"
    : e.includes("spreadsheet")
    ? "📊"
    : e.includes("presentation")
    ? "📽️"
    : e.includes("image")
    ? "🖼️"
    : e.includes("video")
    ? "🎥"
    : e.includes("audio")
    ? "🎵"
    : e.includes("pdf")
    ? "📕"
    : "📄";
}

function formatFileSize(e) {
  if (e === 0) return "0 Bytes";
  const t = Math.floor(Math.log(e) / Math.log(1024));
  return Math.round((e / Math.pow(1024, t)) * 100) / 100 + " " + ["Bytes", "KB", "MB", "GB"][t];
}

function openFile(e) {
  window.open(`https://drive.google.com/file/d/${e}/view`, "_blank");
}

document.getElementById("refreshFilesBtn").addEventListener("click", loadDriveFiles);
document.getElementById("logoutBtn").addEventListener("click", function () {
  current_user = null;
  updateDriveStatus(false);
  hideElement("driveContent");
  hideElement("refreshFilesBtn");
  hideElement("portalContent");
  showElement("loginForm");
  document.getElementById("username").value = "";
  document.getElementById("password").value = "";
  showSuccess("Logged out successfully");
});
