# REFLASHAPP iOS — Single Source 1.4.0

This wrapper loads the same hosted Desktop 1.4.0 web code as the browser and macOS wrapper.

The configured URL is:
`https://broodwich666.github.io/real-estate-study-app/`

If your repository URL differs, edit `ZadsREFLASHAPP/AppConfig.swift` before running.

Code/interface updates made to the hosted `web` folder propagate to the web app, iOS wrapper, and macOS wrapper after refresh/relaunch.

Personal app data does not automatically sync yet because Safari, iOS WKWebView, and macOS WKWebView each have separate local storage. A shared cloud backend is required for notes, progress, Work records, and Vault metadata to sync between devices.
