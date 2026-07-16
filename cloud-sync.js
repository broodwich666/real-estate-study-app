(() => {
  'use strict';

  const CONFIG_KEY = 'zads_reflash_google_sync_config_v1';
  const META_KEY = 'zads_reflash_google_sync_meta_v1';
  const APP_STATE_KEY = 'zads_reflash_desktop_v1';
  let pushTimer = null;
  let syncing = false;

  const getConfig = () => {
    try { return JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}'); }
    catch { return {}; }
  };
  const setConfig = value => localStorage.setItem(CONFIG_KEY, JSON.stringify(value));
  const getMeta = () => {
    try { return JSON.parse(localStorage.getItem(META_KEY) || '{}'); }
    catch { return {}; }
  };
  const setMeta = value => localStorage.setItem(META_KEY, JSON.stringify(value));

  const deviceName = () => {
    const ua = navigator.userAgent || '';
    if (/iPhone/i.test(ua)) return 'iPhone';
    if (/iPad/i.test(ua)) return 'iPad';
    if (/Macintosh/i.test(ua)) return 'Mac';
    return 'Web browser';
  };

  function setStatus(text, mode = '') {
    const top = document.getElementById('saveState');
    const badge = document.querySelector('.local-badge');
    const detail = document.getElementById('cloudSyncStatus');
    if (top) top.textContent = text;
    if (detail) detail.textContent = text;
    if (badge) {
      badge.textContent = mode === 'ok' ? '● Google sync connected' : mode === 'busy' ? '● Syncing with Google…' : '● Local storage + optional Google sync';
      badge.style.color = mode === 'ok' ? '#46b36d' : '';
    }
  }

  function jsonp(url) {
    return new Promise((resolve, reject) => {
      const callback = '__reflashSync' + Date.now() + Math.random().toString(16).slice(2);
      const script = document.createElement('script');
      const timer = setTimeout(() => cleanup(new Error('Google sync request timed out.')), 15000);
      function cleanup(error, value) {
        clearTimeout(timer);
        delete window[callback];
        script.remove();
        error ? reject(error) : resolve(value);
      }
      window[callback] = data => cleanup(null, data);
      script.onerror = () => cleanup(new Error('Could not reach the Google Apps Script URL.'));
      script.src = `${url}${url.includes('?') ? '&' : '?'}callback=${encodeURIComponent(callback)}&_=${Date.now()}`;
      document.head.appendChild(script);
    });
  }

  async function loadCloud() {
    const cfg = getConfig();
    if (!cfg.url || !cfg.key) throw new Error('Enter the Apps Script URL and sync key first.');
    return jsonp(`${cfg.url}?action=load&key=${encodeURIComponent(cfg.key)}`);
  }

  async function pushCloud({ silent = false } = {}) {
    const cfg = getConfig();
    if (!cfg.url || !cfg.key || syncing) return;
    syncing = true;
    if (!silent) setStatus('Syncing with Google…', 'busy');
    const updatedAt = new Date().toISOString();
    const payload = {
      action: 'save',
      key: cfg.key,
      updatedAt,
      device: deviceName(),
      state: window.state || JSON.parse(localStorage.getItem(APP_STATE_KEY) || '{}')
    };
    try {
      const response = await fetch(cfg.url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow'
      });
      let result = { ok: response.ok };
      try { result = await response.json(); } catch {}
      if (result.ok === false) throw new Error(result.error || 'Google rejected the save.');
      setMeta({ lastCloudUpdatedAt: updatedAt, lastPushAt: updatedAt, device: deviceName() });
      setStatus('Saved to Google', 'ok');
    } catch (error) {
      setStatus('Saved locally — Google sync failed');
      console.error(error);
      if (!silent) alert(error.message || String(error));
    } finally {
      syncing = false;
    }
  }

  function queuePush() {
    const cfg = getConfig();
    if (!cfg.url || !cfg.key) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => pushCloud({ silent: true }), 1200);
  }

  async function connectAndPull() {
    const url = document.getElementById('cloudScriptUrl').value.trim();
    const key = document.getElementById('cloudSyncKey').value.trim();
    if (!/^https:\/\/script\.google\.com\/macros\/s\//.test(url)) {
      alert('Paste the deployed Google Apps Script Web app URL.');
      return;
    }
    if (!key) { alert('Paste the sync key from Apps Script.'); return; }
    setConfig({ url, key, enabled: true });
    setStatus('Connecting to Google…', 'busy');
    try {
      const cloud = await loadCloud();
      if (!cloud.ok) throw new Error(cloud.error || 'Connection failed.');
      if (cloud.hasState && cloud.state) {
        const useCloud = confirm('Google already has REFLASHAPP data. Replace this device’s local data with the Google copy?\n\nChoose Cancel to keep this device and upload it instead.');
        if (useCloud) {
          localStorage.setItem(APP_STATE_KEY, JSON.stringify(cloud.state));
          setMeta({ lastCloudUpdatedAt: cloud.updatedAt || '', lastPullAt: new Date().toISOString() });
          location.reload();
          return;
        }
      }
      await pushCloud();
      setStatus('Google sync connected', 'ok');
    } catch (error) {
      setStatus('Google sync not connected');
      alert(error.message || String(error));
    }
  }

  async function pullNow() {
    setStatus('Pulling from Google…', 'busy');
    try {
      const cloud = await loadCloud();
      if (!cloud.ok) throw new Error(cloud.error || 'Pull failed.');
      if (!cloud.hasState) { alert('No cloud data exists yet. Use Push this device now.'); return; }
      if (!confirm('Replace this device’s current app data with the Google copy?')) return;
      localStorage.setItem(APP_STATE_KEY, JSON.stringify(cloud.state));
      setMeta({ lastCloudUpdatedAt: cloud.updatedAt || '', lastPullAt: new Date().toISOString() });
      location.reload();
    } catch (error) {
      setStatus('Google pull failed');
      alert(error.message || String(error));
    }
  }

  function disconnect() {
    if (!confirm('Disconnect Google sync on this device? Your Google Sheet data will not be deleted.')) return;
    localStorage.removeItem(CONFIG_KEY);
    localStorage.removeItem(META_KEY);
    location.reload();
  }

  function installUI() {
    const settings = document.querySelector('#settings .settings');
    if (!settings || document.getElementById('cloudSyncPanel')) return;
    const cfg = getConfig();
    const panel = document.createElement('div');
    panel.id = 'cloudSyncPanel';
    panel.className = 'cloud-sync-panel';
    panel.innerHTML = `
      <hr>
      <p class="eyebrow">FREE CROSS-DEVICE SYNC</p>
      <h3>Google Sheets Sync</h3>
      <p class="cloud-help">Syncs notes, progress, edited app data, clients, properties, tasks, transactions, favorites, and settings across Mac, iPhone, and web. Vault photos, PDFs, audio, video, and documents sync through a private Google Drive folder.</p>
      <label><span>Apps Script Web app URL</span><input id="cloudScriptUrl" type="url" placeholder="https://script.google.com/macros/s/.../exec" value="${(cfg.url || '').replace(/"/g, '&quot;')}"></label>
      <label><span>Private sync key</span><input id="cloudSyncKey" type="password" placeholder="Paste the generated sync key" value="${(cfg.key || '').replace(/"/g, '&quot;')}"></label>
      <div class="cloud-actions">
        <button class="primary" id="cloudConnect">Connect / initialize</button>
        <button id="cloudPull">Pull Google copy</button>
        <button id="cloudPush">Push this device now</button>
        <button id="cloudDisconnect">Disconnect</button>
      </div>
      <small id="cloudSyncStatus">${cfg.url && cfg.key ? 'Configured on this device' : 'Not configured'}</small>
    `;
    settings.insertBefore(panel, settings.querySelector('.danger'));
    document.getElementById('cloudConnect').onclick = connectAndPull;
    document.getElementById('cloudPull').onclick = pullNow;
    document.getElementById('cloudPush').onclick = () => pushCloud();
    document.getElementById('cloudDisconnect').onclick = disconnect;
  }

  async function autoPullIfNewer() {
    const cfg = getConfig();
    if (!cfg.url || !cfg.key) return;
    try {
      const cloud = await loadCloud();
      if (!cloud.ok || !cloud.hasState || !cloud.state) return;
      const meta = getMeta();
      if (cloud.updatedAt && cloud.updatedAt !== meta.lastCloudUpdatedAt) {
        localStorage.setItem(APP_STATE_KEY, JSON.stringify(cloud.state));
        setMeta({ ...meta, lastCloudUpdatedAt: cloud.updatedAt, lastPullAt: new Date().toISOString() });
        location.reload();
      } else {
        setStatus('Google sync connected', 'ok');
      }
    } catch (error) {
      console.warn('Automatic Google pull failed:', error);
      setStatus('Saved locally — Google unavailable');
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    installUI();
    const cfg = getConfig();
    if (cfg.url && cfg.key) setStatus('Google sync connected', 'ok');

    if (typeof window.save === 'function') {
      const originalSave = window.save;
      window.save = function (...args) {
        const value = originalSave.apply(this, args);
        queuePush();
        return value;
      };
    }

    setTimeout(autoPullIfNewer, 500);
  });
})();
