const USERS = {
    admin: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a918",
    user: "04f8996da763b7a969b1028ee3007569eaf3a635486ddab211d512c85b9df8fb",
  },
  GOOGLE_CONFIG = {
    client_id: "30896238069-4qccgpqt8iu5935v1fa7qbag7ve36m3m.apps.googleusercontent.com",
    api_key: "AIzaSyBBWWwug-UcevBmNa7sgypGFZjLfpZusEo",
    discovery_doc: "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
    scopes: "https://www.googleapis.com/auth/drive.readonly",
  };

let gapi_loaded = false,
  google_initialized = false,
  current_user = null;

function hashPassword(password) {
  return CryptoJS.SHA256(password).toString();
}

function showElement(id) {
  document.getElementById(id).style.display = "block";
}

function hideElement(id) {
  document.getElementById(id).style.display = "none";
}

function showError(message) {
  const errorElement = document.getElementById("errorMessage");
  errorElement.textContent = message;
  errorElement.style.display = "block";
  setTimeout(() => errorElement.style.display = "none", 5000);
}

function showSuccess(message) {
  const successElement = document.getElementById("successMessage");
  successElement.textContent = message;
  successElement.style.display = "block";
  setTimeout(() => successElement.style.display = "none", 3000);
}

// Login form handler
document
  .getElementById("loginFormElement")
  .addEventListener("submit", function (event) {
    event.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const hashedPassword = hashPassword(password);
    
    if (USERS[username] && USERS[username] === hashedPassword) {
      current_user = username;
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

function loadGoogleAPI() {
  if (typeof gapi === "undefined") {
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.onload = initializeGAPI;
    script.onerror = () => {
      showError("Failed to load Google API. Please check your internet connection.");
    };
    document.head.appendChild(script);
  } else {
    initializeGAPI();
  }
}

async function initializeGAPI() {
  try {
    // Load the API
    await new Promise((resolve, reject) => {
      gapi.load("client:auth2", {
        callback: resolve,
        onerror: reject
      });
    });
    
    gapi_loaded = true;

    // Initialize the client
    await gapi.client.init({
      apiKey: GOOGLE_CONFIG.api_key,
      clientId: GOOGLE_CONFIG.client_id,
      discoveryDocs: [GOOGLE_CONFIG.discovery_doc],
      scope: GOOGLE_CONFIG.scopes,
    });

    google_initialized = true;
    
    // Check if already signed in
    const authInstance = gapi.auth2.getAuthInstance();
    if (authInstance.isSignedIn.get()) {
      updateDriveStatus(true);
      showElement("driveContent");
      showElement("refreshFilesBtn");
      loadDriveFiles();
    }
    
  } catch (error) {
    console.error("Error initializing Google API:", error);
    showError("Failed to initialize Google Drive connection. Please try refreshing the page.");
  }
}

// Connect to Google Drive
document
  .getElementById("connectDriveBtn")
  .addEventListener("click", async function () {
    if (!google_initialized) {
      showError("Google API not initialized. Please wait and try again.");
      return;
    }

    try {
      const authInstance = gapi.auth2.getAuthInstance();
      const user = await authInstance.signIn();
      
      if (user.isSignedIn()) {
        updateDriveStatus(true);
        showElement("driveContent");
        showElement("refreshFilesBtn");
        hideElement("connectDriveBtn");
        loadDriveFiles();
        showSuccess("Successfully connected to Google Drive!");
      }
    } catch (error) {
      console.error("Error connecting to Google Drive:", error);
      if (error.error === 'popup_blocked_by_browser') {
        showError("Popup blocked! Please allow popups for this site and try again.");
      } else {
        showError("Failed to connect to Google Drive. Please try again.");
      }
    }
  });

function updateDriveStatus(connected) {
  const statusElement = document.getElementById("driveStatus");
  const connectBtn = document.getElementById("connectDriveBtn");
  
  if (connected) {
    statusElement.textContent = "📂 Google Drive: Connected";
    statusElement.className = "status-indicator status-connected";
    connectBtn.style.display = "none";
  } else {
    statusElement.textContent = "📂 Google Drive: Not Connected";
    statusElement.className = "status-indicator status-disconnected";
    connectBtn.style.display = "inline-block";
  }
}

async function loadDriveFiles() {
  const fileListElement = document.getElementById("fileList");
  fileListElement.innerHTML = '<div class="loading"><div class="spinner"></div>Loading files...</div>';

  try {
    const response = await gapi.client.drive.files.list({
      pageSize: 20,
      fields: "nextPageToken, files(id, name, mimeType, modifiedTime, size, webViewLink)",
      orderBy: "modifiedTime desc",
    });

    const files = response.result.files;

    if (!files || files.length === 0) {
      fileListElement.innerHTML = '<div class="loading">No files found in your Google Drive</div>';
      return;
    }

    let fileListHTML = "";
    files.forEach((file) => {
      const icon = getFileIcon(file.mimeType);
      const size = file.size ? formatFileSize(file.size) : "Unknown size";
      const modifiedDate = new Date(file.modifiedTime).toLocaleDateString();
      
      fileListHTML += `
        <div class="file-item">
          <span class="file-icon">${icon}</span>
          <div style="flex-grow: 1;">
            <div style="font-weight: 500;">${file.name}</div>
            <div style="font-size: 0.8rem; color: #666;">${size} • Modified ${modifiedDate}</div>
          </div>
          <button onclick="openFile('${file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`}')" 
                  style="background: #4285f4; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; font-size: 0.8rem;">
            Open
          </button>
        </div>
      `;
    });

    fileListElement.innerHTML = fileListHTML;
  } catch (error) {
    console.error("Error loading files:", error);
    fileListElement.innerHTML = '<div class="loading" style="color: #dc3545;">Error loading files. Please try refreshing.</div>';
  }
}

function getFileIcon(mimeType) {
  if (mimeType.includes("folder")) return "📁";
  if (mimeType.includes("document")) return "📄";
  if (mimeType.includes("spreadsheet")) return "📊";
  if (mimeType.includes("presentation")) return "📽️";
  if (mimeType.includes("image")) return "🖼️";
  if (mimeType.includes("video")) return "🎥";
  if (mimeType.includes("audio")) return "🎵";
  if (mimeType.includes("pdf")) return "📕";
  return "📄";
}

function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

function openFile(url) {
  window.open(url, "_blank");
}

// Refresh files
document
  .getElementById("refreshFilesBtn")
  .addEventListener("click", loadDriveFiles);

// Logout
document.getElementById("logoutBtn").addEventListener("click", function () {
  if (google_initialized && gapi.auth2) {
    const authInstance = gapi.auth2.getAuthInstance();
    if (authInstance.isSignedIn.get()) {
      authInstance.signOut();
    }
  }

  current_user = null;
  document.getElementById("username").value = "";
  document.getElementById("password").value = "";
  updateDriveStatus(false);
  hideElement("driveContent");
  hideElement("refreshFilesBtn");
  hideElement("portalContent");
  showElement("loginForm");
  showSuccess("Logged out successfully");
});

// Console instructions
console.log("🔐 Demo Credentials:");
console.log("Username: admin, Password: admin123");
console.log("Username: user, Password: user123");
console.log("");
console.log("📋 Setup Instructions for GitHub Pages:");
console.log("1. Go to Google Cloud Console (https://console.cloud.google.com)");
console.log("2. Create a new project or select existing one");
console.log("3. Enable Google Drive API");
console.log("4. Go to Credentials and create OAuth 2.0 Client ID");
console.log("5. Add your GitHub Pages URL to authorized origins");
console.log("6. Update the credentials in the code if needed");
