(() => {
  'use strict';

  const CONFIG_KEY = 'zads_reflash_google_sync_config_v1';
  const MAX_FILE_BYTES = 25 * 1024 * 1024;
  let cloudFiles = [];
  let activeObjectURL = null;

  function config() {
    try { return JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}'); }
    catch { return {}; }
  }

  function connected() {
    const cfg = config();
    return Boolean(cfg.url && cfg.key);
  }

  function jsonp(url) {
    return new Promise((resolve, reject) => {
      const callback = '__reflashVault' + Date.now() + Math.random().toString(16).slice(2);
      const script = document.createElement('script');
      const timer = setTimeout(() => cleanup(new Error('Google Drive Vault request timed out.')), 30000);
      function cleanup(error, value) {
        clearTimeout(timer);
        delete window[callback];
        script.remove();
        error ? reject(error) : resolve(value);
      }
      window[callback] = data => cleanup(null, data);
      script.onerror = () => cleanup(new Error('Could not reach Google Apps Script.'));
      script.src = `${url}${url.includes('?') ? '&' : '?'}callback=${encodeURIComponent(callback)}&_=${Date.now()}`;
      document.head.appendChild(script);
    });
  }

  async function post(payload) {
    const cfg = config();
    const response = await fetch(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...payload, key: cfg.key }),
      redirect: 'follow'
    });
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || 'Google Drive Vault request failed.');
    return result;
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = () => reject(reader.error || new Error('Could not read file.'));
      reader.readAsDataURL(file);
    });
  }

  function setUploadMessage(text, error = false) {
    let node = document.getElementById('vaultCloudStatus');
    if (!node) {
      node = document.createElement('div');
      node.id = 'vaultCloudStatus';
      node.className = 'vault-cloud-status';
      document.getElementById('dropZone')?.appendChild(node);
    }
    node.textContent = text;
    node.classList.toggle('error', error);
  }

  async function uploadFiles(files) {
    if (!connected()) {
      setUploadMessage('Connect Google Sheets Sync in Settings before uploading cloud Vault files.', true);
      alert('Open Settings and connect Google sync first. Vault files use the same Apps Script URL and private key.');
      return;
    }
    for (const file of [...files]) {
      if (file.size > MAX_FILE_BYTES) {
        alert(`${file.name} is larger than 25 MB. Compress it or upload a smaller copy.`);
        continue;
      }
      try {
        setUploadMessage(`Uploading ${file.name}…`);
        const dataBase64 = await fileToBase64(file);
        await post({
          action: 'vaultUpload',
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          dataBase64
        });
        setUploadMessage(`${file.name} saved to Google Drive.`);
      } catch (error) {
        console.error(error);
        setUploadMessage(`Upload failed: ${error.message}`, true);
        alert(error.message || String(error));
      }
    }
    await renderCloudVault();
  }

  async function listCloudFiles() {
    const cfg = config();
    return jsonp(`${cfg.url}?action=vaultList&key=${encodeURIComponent(cfg.key)}`);
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }

  function formatBytes(n) {
    n = Number(n || 0);
    return n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;
  }

  async function renderCloudVault() {
    if (!connected()) {
      setUploadMessage('Vault cloud sync is not connected. Open Settings to connect Google sync.');
      if (typeof window.renderVault === 'function' && window.renderVault !== renderCloudVault) {
        // Preserve the original local Vault until cloud sync is configured.
      }
      return;
    }
    const grid = document.getElementById('vaultGrid');
    if (!grid) return;
    grid.innerHTML = '<div class="empty">Loading Google Drive Vault…</div>';
    try {
      const result = await listCloudFiles();
      if (!result.ok) throw new Error(result.error || 'Could not list Vault files.');
      cloudFiles = result.files || [];
      const filter = (document.getElementById('vaultSearch')?.value || '').toLowerCase();
      const shown = cloudFiles.filter(file => file.name.toLowerCase().includes(filter));
      grid.innerHTML = shown.length ? shown.map(file => `
        <div class="file-card cloud-file-card">
          <strong>${esc(file.name)}</strong>
          <small>${formatBytes(file.size)} • ${new Date(file.createdAt).toLocaleDateString()}</small>
          <span class="cloud-file-type">${esc(file.mimeType || 'File')}</span>
          <div class="actions">
            <button data-cloud-open="${esc(file.id)}">Preview</button>
            <button data-cloud-download="${esc(file.id)}">Download</button>
            <button data-cloud-delete="${esc(file.id)}">Delete</button>
          </div>
        </div>`).join('') : '<div class="empty">No cloud Vault files yet.</div>';
      const count = document.getElementById('vaultCount');
      if (count) count.textContent = cloudFiles.length;
      document.querySelectorAll('[data-cloud-open]').forEach(button => button.onclick = () => openCloudFile(button.dataset.cloudOpen, true));
      document.querySelectorAll('[data-cloud-download]').forEach(button => button.onclick = () => openCloudFile(button.dataset.cloudDownload, false));
      document.querySelectorAll('[data-cloud-delete]').forEach(button => button.onclick = () => deleteCloudFile(button.dataset.cloudDelete));
      setUploadMessage('Google Drive Vault connected. Uploads are available on Mac, iPhone, and web.');
    } catch (error) {
      grid.innerHTML = `<div class="empty">Could not load Google Drive Vault: ${esc(error.message)}</div>`;
      setUploadMessage('Google Drive Vault unavailable.', true);
    }
  }

  async function getCloudBlob(id) {
    const result = await post({ action: 'vaultDownload', fileId: id });
    const bytes = Uint8Array.from(atob(result.dataBase64), c => c.charCodeAt(0));
    return new Blob([bytes], { type: result.mimeType || 'application/octet-stream' });
  }

  async function openCloudFile(id, preview) {
    const file = cloudFiles.find(item => item.id === id);
    if (!file) return;
    try {
      setUploadMessage(`Loading ${file.name}…`);
      const blob = await getCloudBlob(id);
      if (activeObjectURL) URL.revokeObjectURL(activeObjectURL);
      activeObjectURL = URL.createObjectURL(blob);
      if (!preview) {
        const link = document.createElement('a');
        link.href = activeObjectURL;
        link.download = file.name;
        link.click();
        return;
      }
      const title = document.getElementById('vaultPreviewTitle');
      const body = document.getElementById('vaultPreviewBody');
      const dialog = document.getElementById('vaultPreview');
      title.textContent = file.name;
      const type = file.mimeType || '';
      if (type.startsWith('image/')) body.innerHTML = `<img class="vault-media" src="${activeObjectURL}" alt="${esc(file.name)}">`;
      else if (type === 'application/pdf') body.innerHTML = `<iframe class="vault-frame" src="${activeObjectURL}"></iframe>`;
      else if (type.startsWith('audio/')) body.innerHTML = `<audio class="vault-av" controls src="${activeObjectURL}"></audio>`;
      else if (type.startsWith('video/')) body.innerHTML = `<video class="vault-media" controls src="${activeObjectURL}"></video>`;
      else if (type.startsWith('text/') || /\.(txt|md|csv|json)$/i.test(file.name)) body.innerHTML = `<pre class="vault-text">${esc(await blob.text())}</pre>`;
      else body.innerHTML = `<div class="empty"><h3>Preview unavailable</h3><p>Use Download to open ${esc(file.name)}.</p></div>`;
      dialog.showModal();
      setUploadMessage('Google Drive Vault connected.');
    } catch (error) {
      alert(error.message || String(error));
    }
  }

  async function deleteCloudFile(id) {
    const file = cloudFiles.find(item => item.id === id);
    if (!confirm(`Delete ${file?.name || 'this file'} from the shared Google Drive Vault?`)) return;
    try {
      await post({ action: 'vaultDelete', fileId: id });
      await renderCloudVault();
    } catch (error) {
      alert(error.message || String(error));
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('fileInput');
    const drop = document.getElementById('dropZone');
    const search = document.getElementById('vaultSearch');
    if (input) input.onchange = event => uploadFiles(event.target.files);
    if (drop) {
      drop.ondrop = event => {
        event.preventDefault();
        drop.style.borderColor = '';
        uploadFiles(event.dataTransfer.files);
      };
    }
    if (search) search.oninput = () => connected() ? renderCloudVault() : window.renderVault?.();

    const originalRenderVault = window.renderVault;
    window.renderVault = function () {
      if (connected()) return renderCloudVault();
      return originalRenderVault?.();
    };
    setTimeout(() => window.renderVault(), 600);
  });
})();
