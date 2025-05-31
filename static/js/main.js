// Global variables
let currentView = "table";
let filesData = [];
let currentFilter = "all";

// Initialize application
function initApp() {
  loadFiles();
  setupFileInput();
  setupUploadForm();
}

// Document ready
document.addEventListener("DOMContentLoaded", function () {
  initApp();
});

// File loading and display
function loadFiles() {
  showLoading();

  fetch("/api/blobs")
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        filesData = data.blobs;
        renderFiles();
      } else {
        showError("Failed to load files");
      }
    })
    .catch((error) => {
      console.error("Error loading files:", error);
      showError("Error loading files");
    });
}

function renderFiles() {
  const filteredData = filterFilesByType(filesData);

  if (filteredData.length === 0) {
    showEmptyState();
    return;
  }

  if (currentView === "table") {
    renderTableView(filteredData);
  } else {
    renderGridView(filteredData);
  }
}

function renderTableView(data) {
  const fileList = document.getElementById("fileList");

  let html = '<table class="file-table">';
  html +=
    "<thead><tr><th>Preview</th><th>Filename</th><th>Type</th><th>Size</th><th>Dimensions</th><th>Uploaded</th><th>Actions</th></tr></thead>";
  html += "<tbody>";

  data.forEach((blob) => {
    const preview = blob.is_image
      ? `<img src="/thumbnail/${
          blob.id
        }" class="thumbnail" onclick="showImageModal('/view/${
          blob.id
        }', '${escapeHtml(blob.filename)}')" alt="Thumbnail">`
      : `<div class="file-type-icon">${getFileIcon(blob.filename)}</div>`;

    const dimensions =
      blob.width && blob.height ? `${blob.width}×${blob.height}` : "-";
    const uploadDate = new Date(blob.uploaded_at).toLocaleDateString();

    html += `
            <tr>
                <td>${preview}</td>
                <td>${escapeHtml(blob.filename)}</td>
                <td>${escapeHtml(blob.content_type || "Unknown")}</td>
                <td>${formatFileSize(blob.size)}</td>
                <td>${dimensions}</td>
                <td>${uploadDate}</td>
                <td>
                    <a href="/download/${
                      blob.id
                    }" class="btn btn-secondary" download>Download</a>
                    ${
                      blob.is_image
                        ? `<button onclick="showImageModal('/view/${
                            blob.id
                          }', '${escapeHtml(
                            blob.filename
                          )}')" class="btn btn-secondary">View</button>`
                        : ""
                    }
                    <button onclick="deleteFile(${blob.id}, '${escapeHtml(
      blob.filename
    )}')" class="btn btn-danger">Delete</button>
                </td>
            </tr>
        `;
  });

  html += "</tbody></table>";
  fileList.innerHTML = html;
}

function renderGridView(data) {
  const fileList = document.getElementById("fileList");

  let html = '<div class="file-grid">';

  data.forEach((blob) => {
    const preview = blob.is_image
      ? `<img src="/thumbnail/${blob.id}" onclick="showImageModal('/view/${
          blob.id
        }', '${escapeHtml(blob.filename)}')" alt="Preview">`
      : `<div class="file-icon-large">${getFileIcon(blob.filename)}</div>`;

    const dimensions =
      blob.width && blob.height ? `${blob.width}×${blob.height}` : "";
    const uploadDate = new Date(blob.uploaded_at).toLocaleDateString();

    html += `
            <div class="grid-item">
                ${preview}
                <h4>${escapeHtml(blob.filename)}</h4>
                <div class="file-info">
                    <div>${formatFileSize(blob.size)} ${dimensions}</div>
                    <div>${uploadDate}</div>
                </div>
                <div class="file-actions">
                    <a href="/download/${
                      blob.id
                    }" class="btn btn-secondary" download>Download</a>
                    ${
                      blob.is_image
                        ? `<button onclick="showImageModal('/view/${
                            blob.id
                          }', '${escapeHtml(
                            blob.filename
                          )}')" class="btn btn-secondary">View</button>`
                        : ""
                    }
                    <button onclick="deleteFile(${blob.id}, '${escapeHtml(
      blob.filename
    )}')" class="btn btn-danger">Delete</button>
                </div>
            </div>
        `;
  });

  html += "</div>";
  fileList.innerHTML = html;
}

// View toggle functions
function toggleView(view) {
  currentView = view;

  // Update button states
  document
    .getElementById("tableBtn")
    .classList.toggle("active", view === "table");
  document
    .getElementById("gridBtn")
    .classList.toggle("active", view === "grid");

  renderFiles();
}

// Filter functions
function filterFiles() {
  const select = document.getElementById("fileTypeFilter");
  currentFilter = select.value;
  renderFiles();
}

function filterFilesByType(data) {
  switch (currentFilter) {
    case "images":
      return data.filter((blob) => blob.is_image);
    case "documents":
      return data.filter((blob) => !blob.is_image);
    default:
      return data;
  }
}

// File upload functions
function setupFileInput() {
  const fileInput = document.getElementById("fileInput");
  const fileLabel = fileInput.nextElementSibling;
  const fileText = fileLabel.querySelector(".file-text");

  fileInput.addEventListener("change", function () {
    if (this.files.length > 0) {
      fileText.textContent = this.files[0].name;
      fileLabel.classList.add("has-file");
    } else {
      fileText.textContent = "Choose File";
      fileLabel.classList.remove("has-file");
    }
  });
}

function setupUploadForm() {
  const form = document.getElementById("uploadForm");

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    const formData = new FormData(form);
    const file = formData.get("file");

    if (!file || file.size === 0) {
      showUploadResult("Please select a file to upload.", "error");
      return;
    }

    uploadFile(formData);
  });
}

function uploadFile(formData) {
  const progressContainer = document.getElementById("uploadProgress");
  const progressFill = document.getElementById("progressFill");
  const progressText = document.getElementById("progressText");

  // Show progress bar
  progressContainer.style.display = "block";

  // Create XMLHttpRequest for progress tracking
  const xhr = new XMLHttpRequest();

  xhr.upload.addEventListener("progress", function (e) {
    if (e.lengthComputable) {
      const percentComplete = (e.loaded / e.total) * 100;
      progressFill.style.width = percentComplete + "%";
      progressText.textContent = Math.round(percentComplete) + "%";
    }
  });

  xhr.addEventListener("load", function () {
    progressContainer.style.display = "none";

    if (xhr.status === 200) {
      const response = JSON.parse(xhr.responseText);
      if (response.success) {
        showUploadResult(
          `File "${response.filename}" uploaded successfully! (ID: ${response.blob_id})`,
          "success"
        );
        resetUploadForm();
        loadFiles(); // Refresh file list
      } else {
        showUploadResult(response.error || "Upload failed", "error");
      }
    } else {
      showUploadResult("Upload failed. Please try again.", "error");
    }
  });

  xhr.addEventListener("error", function () {
    progressContainer.style.display = "none";
    showUploadResult("Upload failed. Please check your connection.", "error");
  });

  xhr.open("POST", "/upload");
  xhr.send(formData);
}

function showUploadResult(message, type) {
  const resultDiv = document.getElementById("uploadResult");
  resultDiv.textContent = message;
  resultDiv.className = `upload-result ${type}`;
  resultDiv.style.display = "block";

  // Hide after 5 seconds
  setTimeout(() => {
    resultDiv.style.display = "none";
  }, 5000);
}

function resetUploadForm() {
  const form = document.getElementById("uploadForm");
  const fileLabel = form.querySelector(".file-input-label");
  const fileText = fileLabel.querySelector(".file-text");

  form.reset();
  fileText.textContent = "Choose File";
  fileLabel.classList.remove("has-file");
}

// Delete file function
function deleteFile(fileId, filename) {
  if (!confirm(`Are you sure you want to delete "${filename}"?`)) {
    return;
  }

  fetch(`/api/blobs/${fileId}`, {
    method: "DELETE",
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        showUploadResult(`File "${filename}" deleted successfully.`, "success");
        loadFiles(); // Refresh file list
      } else {
        showUploadResult(data.error || "Failed to delete file", "error");
      }
    })
    .catch((error) => {
      console.error("Error deleting file:", error);
      showUploadResult("Error deleting file. Please try again.", "error");
    });
}

// Modal functions
function showImageModal(imageSrc, filename) {
  const modal = document.getElementById("imageModal");
  const modalImage = document.getElementById("modalImage");
  const modalInfo = document.getElementById("modalInfo");

  modalImage.src = imageSrc;
  modalInfo.textContent = filename;
  modal.style.display = "block";

  // Prevent body scroll when modal is open
  document.body.style.overflow = "hidden";
}

function closeModal() {
  const modal = document.getElementById("imageModal");
  modal.style.display = "none";

  // Restore body scroll
  document.body.style.overflow = "auto";
}

// Close modal when clicking outside the image
document.addEventListener("click", function (e) {
  const modal = document.getElementById("imageModal");
  if (e.target === modal) {
    closeModal();
  }
});

// Close modal with Escape key
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    closeModal();
  }
});

// Utility functions
function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function getFileIcon(filename) {
  if (!filename) return "📄";

  const ext = filename.split(".").pop().toLowerCase();

  const iconMap = {
    // Images
    jpg: "🖼️",
    jpeg: "🖼️",
    png: "🖼️",
    gif: "🖼️",
    bmp: "🖼️",
    webp: "🖼️",
    svg: "🖼️",
    tiff: "🖼️",

    // Documents
    pdf: "📄",
    doc: "📝",
    docx: "📝",
    txt: "📝",
    rtf: "📝",
    odt: "📝",

    // Spreadsheets
    xls: "📊",
    xlsx: "📊",
    csv: "📊",
    ods: "📊",

    // Presentations
    ppt: "📽️",
    pptx: "📽️",
    odp: "📽️",

    // Archives
    zip: "🗜️",
    rar: "🗜️",
    "7z": "🗜️",
    tar: "🗜️",
    gz: "🗜️",
    bz2: "🗜️",

    // Audio
    mp3: "🎵",
    wav: "🎵",
    flac: "🎵",
    aac: "🎵",
    ogg: "🎵",
    m4a: "🎵",

    // Video
    mp4: "🎬",
    avi: "🎬",
    mkv: "🎬",
    mov: "🎬",
    wmv: "🎬",
    webm: "🎬",
    flv: "🎬",

    // Code
    js: "💻",
    html: "💻",
    css: "💻",
    py: "💻",
    java: "💻",
    cpp: "💻",
    c: "💻",
    php: "💻",
    rb: "💻",
    go: "💻",
    rs: "💻",
    ts: "💻",

    // Data
    json: "📋",
    xml: "📋",
    yaml: "📋",
    yml: "📋",
    sql: "📋",
    db: "📋",
    sqlite: "📋",
  };

  return iconMap[ext] || "📄";
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function showLoading() {
  const fileList = document.getElementById("fileList");
  fileList.innerHTML = '<div class="loading">Loading files...</div>';
}

function showError(message) {
  const fileList = document.getElementById("fileList");
  fileList.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>${escapeHtml(
    message
  )}</p></div>`;
}

function showEmptyState() {
  const fileList = document.getElementById("fileList");
  const filterText =
    currentFilter === "images"
      ? "images"
      : currentFilter === "documents"
      ? "documents"
      : "files";

  fileList.innerHTML = `
        <div class="empty-state">
            <div class="icon">📂</div>
            <p>No ${filterText} found.</p>
            <p>Upload some files to get started!</p>
        </div>
    `;
}

// Drag and drop functionality
function setupDragAndDrop() {
  const uploadForm = document.getElementById("uploadForm");
  const fileInput = document.getElementById("fileInput");

  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    uploadForm.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  ["dragenter", "dragover"].forEach((eventName) => {
    uploadForm.addEventListener(eventName, highlight, false);
  });

  ["dragleave", "drop"].forEach((eventName) => {
    uploadForm.addEventListener(eventName, unhighlight, false);
  });

  function highlight() {
    uploadForm.classList.add("drag-over");
  }

  function unhighlight() {
    uploadForm.classList.remove("drag-over");
  }

  uploadForm.addEventListener("drop", handleDrop, false);

  function handleDrop(e) {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      fileInput.files = files;
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
}

// Initialize drag and drop when DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  setupDragAndDrop();
});

// Auto-refresh functionality (optional)
let autoRefreshInterval;

function startAutoRefresh(intervalSeconds = 30) {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
  }

  autoRefreshInterval = setInterval(() => {
    loadFiles();
  }, intervalSeconds * 1000);
}

function stopAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
    autoRefreshInterval = null;
  }
}

// Keyboard shortcuts
document.addEventListener("keydown", function (e) {
  // Ctrl/Cmd + U for upload focus
  if ((e.ctrlKey || e.metaKey) && e.key === "u") {
    e.preventDefault();
    document.getElementById("fileInput").focus();
  }

  // Ctrl/Cmd + R for refresh
  if ((e.ctrlKey || e.metaKey) && e.key === "r") {
    e.preventDefault();
    loadFiles();
  }

  // 1 for table view, 2 for grid view
  if (e.key === "1" && !e.ctrlKey && !e.metaKey && !e.altKey) {
    toggleView("table");
  } else if (e.key === "2" && !e.ctrlKey && !e.metaKey && !e.altKey) {
    toggleView("grid");
  }
});
