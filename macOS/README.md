# REFLASHAPP macOS — Single Source 1.4.0

Create a new macOS App project in Xcode named `ZadsREFLASHAPPMac`, then replace the generated Swift files with the three files in `ZadsREFLASHAPPMac/ZadsREFLASHAPPMac/`.

The wrapper loads the same hosted URL as web and iOS. Therefore interface and feature releases are made once in the hosted `web` folder.

The existing compiled Desktop 1.4.0 remains usable, but it contains bundled files and cannot automatically receive hosted code changes. This wrapper is the version that provides one-source code updates.
