const USERS = {
    admin: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a918",
    user: "04f8996da763b7a969b1028ee3007569eaf3a635486ddab211d512c85b9df8fb",
  };

const GOOGLE_CONFIG = {
    client_id: "30896238069-4qccgpqt8iu5935v1fa7qbag7ve36m3m.apps.googleusercontent.com",
    api_key: "AIzaSyBBWWwug-UcevBmNa7sgypGFZjLfpZusEo",
    scopes: "https://www.googleapis.com/auth/drive.readonly",
};

let google_initialized = false;
let current_user = null;
let accessToken = null;

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
        loadGoogleServices();
      }, 1000);
    } else {
      showError("Invalid username or password");
    }
  });

function loadGoogleServices() {
  // Load Google Identity Services
  if (typeof google === "undefined" || !google.accounts) {
    const gisScript = document.createElement("script");
    gisScript.src = "https://accounts.google.com/gsi/client";
    gisScript.onload = initializeGoogleServices;
    gisScript.onerror = () => {
      showError("Failed to load Google Identity Services.");
    };
    document.head.appendChild(gisScript);
  } else {
    initializeGoogleServices();
  }
}

function initializeGoogleServices() {
  try {
    google_initialized = true;
    console.log("Google Identity Services loaded successfully");
  } catch (error) {
    console.error("Error initializing Google Services:", error);
    showError("Failed to initialize Google services.");
  }
}

// Connect to Google Drive using direct API calls
document
  .getElementById("connectDriveBtn")
  .addEventListener("click", async function () {
    if (!google_initialized) {
      showError("Google services not initialized. Please wait and try again.");
      return;
    }

    try {
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CONFIG.client_id,
        scope: GOOGLE_CONFIG.scopes,
        callback: handleAuthCallback,
      });

      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (error) {
      console.error("Error requesting access token:", error);
      showError("Failed to authenticate with Google. Please try again.");
    }
  });

function handleAuthCallback(tokenResponse) {
  if (tokenResponse && tokenResponse.access_token) {
    accessToken = tokenResponse.access_token;
    updateDriveStatus(true);
    showElement("driveContent");
    showElement("refreshFilesBtn");
    hideElement("connectDriveBtn");
    loadDriveFiles();
    showSuccess("Successfully connected to Google Drive!");
  } else {
    console.error("No access token received:", tokenResponse);
    showError("Authentication failed. Please try again.");
  }
}

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

  if (!accessToken) {
    fileListElement.innerHTML = '<div class="loading" style="color: #dc3545;">Not authenticated. Please connect to Google Drive first.</div>';
    return;
  }

  try {
    // Direct API call to Google Drive without GAPI client
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?pageSize=20&fields=nextPageToken,files(id,name,mimeType,modifiedTime,size,webViewLink)&orderBy=modifiedTime desc&key=${GOOGLE_CONFIG.api_key}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Authentication expired");
      }
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    const files = data.files;

    if (!files || files.length === 0) {
      fileListElement.innerHTML = '<div class="loading">No files found in your Google Drive</div>';
      return;
    }

    let fileListHTML = "";
    files.forEach((file) => {
      const icon = getFileIcon(file.mimeType);
      const size = file.size ? formatFileSize(parseInt(file.size)) : "Unknown size";
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
    
    if (error.message === "Authentication expired") {
      showError("Authentication expired. Please reconnect to Google Drive.");
      updateDriveStatus(false);
      hideElement("driveContent");
      hideElement("refreshFilesBtn");
      accessToken = null;
    } else {
      fileListElement.innerHTML = '<div class="loading" style="color: #dc3545;">Error loading files. Please try refreshing.</div>';
      showError("Failed to load files. Please try again.");
    }
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
  // Revoke the access token
  if (accessToken && google && google.accounts && google.accounts.oauth2) {
    google.accounts.oauth2.revoke(accessToken, () => {
      console.log('Access token revoked.');
    });
  }

  current_user = null;
  accessToken = null;
  
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
console.log("📋 This app uses:");
console.log("✅ Google Identity Services (GIS) for authentication");
console.log("✅ Direct Google Drive API calls (no deprecated GAPI client)");
console.log("✅ Modern web standards");
