# December Agent Architecture & Roadmap

## TODO

### Cloud Browser Implementation (Playwright + VNC)

Currently, the `BrowserTool` relies on a lightweight HTTP `fetch` scraper injected via `local-operations.ts` to prevent forcing massive dependencies (like Playwright and Xvfb) onto CLI users' local machines.

We need to implement the "heavyweight" cloud version of the browser operation for `apps/server` (or the Docker Sandbox environment):

- [ ] Install `playwright`, `xvfb`, `x11vnc`, and `websockify` into the cloud Docker image.
- [ ] Create `cloud-operations.ts` in `apps/server`.
- [ ] Implement `context.operations.browser.navigate(url)` in the cloud adapter. It should:
    1. Boot up a headless Chromium instance bound to the `Xvfb` virtual display.
    2. Start `x11vnc` to capture the display.
    3. Start `websockify` to bridge the VNC stream to a websocket port (e.g., `ws://localhost:6080`).
    4. Return the websocket URL to the agent frontend alongside the parsed text.
- [ ] **Interactive Actions Upgrade**: Refactor `BrowserTool` schema in `@december/tools` to support actions beyond just `navigate` (e.g., `click(elementId)`, `type(elementId, text)`) utilizing Playwright's Accessibility Tree to allow the agent to fully interact with complex web apps.
