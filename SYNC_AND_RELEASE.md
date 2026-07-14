# Single-source operation

## What is synchronized now
The `web` directory is the application source of truth. Upload it to the configured GitHub Pages repository. The browser, iOS wrapper, and macOS wrapper all load that same URL, so UI and feature changes are published once and appear in all three.

## What is not synchronized without a backend
The current 1.4.0 app stores notes, flashcard progress, clients, properties, tasks, settings, and Vault records in local browser/WebKit storage. Those stores are isolated per browser/app/device.

A cloud data service with authentication must be connected before those records can automatically sync. Suitable options include Supabase or Firebase. Vault file synchronization also requires cloud object storage. Until that is configured, use Settings > Export local data backup and Import data backup to move data safely.

## Release steps
1. Replace files in the GitHub Pages repository with the contents of `web`.
2. Commit changes.
3. Wait for Pages deployment.
4. Refresh/relaunch web, iOS, and macOS wrappers.
