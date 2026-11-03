# GDevelop Debloated

This fork prioritizes the core game-authoring workflow over optional assistant features.

## First pass: remove Ask AI

- Hide the title-bar and desktop Help-menu entries for Ask AI.
- Remove the AI prompt from the start page and project-creation flow.
- Hide AI advertisements in the Learn pages and the extension error dialog.
- Remove the AI-specific preferences, while keeping connected-agent integration settings available.
- Stop mounting the AI request provider, which also stops its initial AI-settings fetch and background request handling.
- Replace the AI editor renderer with a no-op compatibility renderer and reject new AI tab openings. This avoids pulling the full Ask AI editor UI into the main editor via that import.

**Not yet removed:** all AI-related service modules, AI asset-generation integrations, server-side services, or every possible transitive reference. No installer size or speed improvement has been measured. This first change focuses on the Ask AI assistant rather than stripping unrelated engine features.

## Developing and verifying

```sh
cd newIDE/app
npm ci
npm start
# In another terminal, use the scripts in package.json for checks.
```

Smoke test the editor: create a blank project, open a scene, edit events and objects, run preview, save a project, and verify no Ask AI actions are visible. Also check the desktop Help menu, Preferences > Integrations, and the Learn page. Tests/builds must be run before releasing binaries.

## Upstream attribution

GDevelop's code is MIT-licensed; preserve upstream copyright/license notices. The GDevelop name and logo are proprietary to Florian Rival according to the upstream LICENSE.md. Rebrand any independently distributed binaries rather than implying they are official GDevelop builds.
