document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const fileQueue = document.getElementById('fileQueue');
  const queueList = document.getElementById('queueList');
  const queueCount = document.getElementById('queueCount');
  const btnUpload = document.getElementById('btnUpload');
  const btnClearQueue = document.getElementById('btnClearQueue');
  const progressContainer = document.getElementById('progressContainer');
  const progressBar = document.getElementById('progressBar');
  const progressPercent = document.getElementById('progressPercent');
  const progressStatus = document.getElementById('progressStatus');
  const fileGrid = document.getElementById('fileGrid');
  const emptyState = document.getElementById('emptyState');
  const fileCount = document.getElementById('fileCount');
  const btnRefresh = document.getElementById('btnRefresh');
  const toast = document.getElementById('toast');

  let selectedFiles = [];

  // Drag and drop handlers
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    }, false);
  });

  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = Array.from(dt.files);
    handleFileSelection(files);
  });

  fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    handleFileSelection(files);
  });

  function handleFileSelection(files) {
    if (!files || files.length === 0) return;
    selectedFiles = [...selectedFiles, ...files];
    updateQueueUI();
  }

  function updateQueueUI() {
    if (selectedFiles.length === 0) {
      fileQueue.classList.add('hidden');
      return;
    }

    fileQueue.classList.remove('hidden');
    queueCount.textContent = selectedFiles.length;
    queueList.innerHTML = '';

    selectedFiles.forEach((file, index) => {
      const item = document.createElement('div');
      item.className = 'queue-item';
      item.innerHTML = `
        <span class="queue-item-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
        <span class="queue-item-size">${formatBytes(file.size)}</span>
      `;
      queueList.appendChild(item);
    });
  }

  btnClearQueue.addEventListener('click', () => {
    selectedFiles = [];
    fileInput.value = '';
    updateQueueUI();
  });

  // Upload Logic with Progress
  btnUpload.addEventListener('click', () => {
    if (selectedFiles.length === 0) return;

    const formData = new FormData();
    const isSingle = selectedFiles.length === 1;

    if (isSingle) {
      formData.append('file', selectedFiles[0]);
    } else {
      selectedFiles.forEach(file => formData.append('files', file));
    }

    const endpoint = isSingle ? '/api/upload/single' : '/api/upload/multiple';

    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint, true);

    progressContainer.classList.remove('hidden');
    progressBar.style.width = '0%';
    progressPercent.textContent = '0%';
    progressStatus.textContent = 'Uploading...';

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        progressBar.style.width = `${percent}%`;
        progressPercent.textContent = `${percent}%`;
      }
    };

    xhr.onload = function () {
      progressContainer.classList.add('hidden');
      if (xhr.status === 200 || xhr.status === 201) {
        const response = JSON.parse(xhr.responseText);
        showToast(response.message || 'Upload complete!');
        selectedFiles = [];
        fileInput.value = '';
        updateQueueUI();
        loadFilesList();
      } else {
        let errMessage = 'Upload failed.';
        try {
          const errRes = JSON.parse(xhr.responseText);
          errMessage = errRes.error || errMessage;
        } catch (e) {}
        showToast(errMessage, true);
      }
    };

    xhr.onerror = function () {
      progressContainer.classList.add('hidden');
      showToast('Network error during upload.', true);
    };

    xhr.send(formData);
  });

  // Fetch file list from server
  async function loadFilesList() {
    try {
      const res = await fetch('/api/uploads');
      if (!res.ok) throw new Error('Failed to fetch server files.');
      const data = await res.json();
      renderGallery(data.files || []);
    } catch (err) {
      console.error(err);
    }
  }

  function renderGallery(files) {
    fileCount.textContent = files.length;
    fileGrid.innerHTML = '';

    if (files.length === 0) {
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');

    files.forEach(file => {
      const card = document.createElement('div');
      card.className = 'file-card';

      const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.filename);
      const previewContent = isImage
        ? `<img src="${file.url}" alt="${escapeHtml(file.filename)}" loading="lazy">`
        : `<div class="file-icon-placeholder">${getFileIcon(file.filename)}</div>`;

      card.innerHTML = `
        <div class="file-preview">
          ${previewContent}
        </div>
        <div class="file-details">
          <div class="file-title" title="${escapeHtml(file.filename)}">${escapeHtml(file.filename)}</div>
          <div class="file-meta">${file.sizeFormatted}</div>
          <div class="file-card-actions">
            <button class="btn-card btn-copy" data-url="${file.url}">
              📋 Copy Link
            </button>
            <button class="btn-card btn-delete" data-filename="${file.filename}">
              🗑️ Delete
            </button>
          </div>
        </div>
      `;

      fileGrid.appendChild(card);
    });

    // Event listeners for Copy and Delete inside cards
    document.querySelectorAll('.btn-copy').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const url = e.currentTarget.getAttribute('data-url');
        navigator.clipboard.writeText(url).then(() => {
          showToast('Link copied to clipboard!');
        });
      });
    });

    document.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const filename = e.currentTarget.getAttribute('data-filename');
        if (confirm(`Delete file '${filename}'?`)) {
          await deleteFile(filename);
        }
      });
    });
  }

  async function deleteFile(filename) {
    try {
      const res = await fetch(`/api/upload/${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'File deleted');
        loadFilesList();
      } else {
        showToast(data.error || 'Deletion failed', true);
      }
    } catch (err) {
      showToast('Error deleting file', true);
    }
  }

  btnRefresh.addEventListener('click', loadFilesList);

  // Helper functions
  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    if (['pdf'].includes(ext)) return '📄';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return '📦';
    if (['mp3', 'wav', 'ogg'].includes(ext)) return '🎵';
    if (['mp4', 'mkv', 'avi', 'mov'].includes(ext)) return '🎥';
    if (['js', 'json', 'html', 'css', 'py', 'ts'].includes(ext)) return '💻';
    return '📑';
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, function (m) {
      return ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      })[m];
    });
  }

  function showToast(message, isError = false) {
    toast.textContent = message;
    toast.style.borderColor = isError ? 'var(--danger)' : 'var(--accent-cyan)';
    toast.classList.remove('hidden');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 3500);
  }

  // Initial load
  loadFilesList();
});
