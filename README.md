<p align="center">
  <img src="assets/cover.png" alt="nitpic" width="640" />
</p>

<h3 align="center">Click anything. Say what's wrong. Watch Claude fix it.</h3>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-91C31C?style=flat-square" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/Chrome%20Web%20Store-coming%20soon-FF8C00?style=flat-square&logo=googlechrome&logoColor=white" alt="Chrome Web Store" />
  <img src="https://img.shields.io/badge/Claude%20Code-plugin-91C31C?style=flat-square&logo=anthropic&logoColor=white" alt="Claude Code plugin" />
  <img src="https://img.shields.io/badge/tests-23%20passing-91C31C?style=flat-square" alt="Tests" />
  <img src="https://img.shields.io/badge/PRs-welcome-FF8C00?style=flat-square" alt="PRs welcome" />
  <a href="https://buymeacoffee.com/jibrilai"><img src="https://img.shields.io/badge/%E2%98%95-buy%20me%20a%20coffee-FFDD00?style=flat-square" alt="Buy me a coffee" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="docs/README.es.md">Español</a> ·
  <a href="docs/README.fr.md">Français</a> ·
  <a href="docs/README.de.md">Deutsch</a> ·
  <a href="docs/README.ja.md">日本語</a> ·
  <a href="docs/README.zh-CN.md">简体中文</a> ·
  <a href="docs/README.ar.md">العربية</a>
</p>

---

**nitpic** connects your browser to [Claude Code](https://claude.com/claude-code). Turn on feedback mode, click any element on any page — `localhost` or production — type what should change, and hit send. Your comment, a cropped screenshot, and the element's HTML land inside your running Claude Code session **as if you typed them there**, and Claude gets to work.

Built for designers, developers, and vibe coders who review their app in the browser but fix it in the terminal.

<p align="center">
  <img src="assets/mascot.png" alt="the nitpic pigeon" width="140" /><br/>
  <sub><i>the quality inspector</i></sub>
</p>

## ✨ Features

- **🎯 Point at the problem** — hover-highlight any element or drag-select a region; nitpic captures the CSS selector, a screenshot, and the HTML for you
- **⚡ Instant delivery** — feedback lands in your terminal within a second (tmux & iTerm2 get true keystroke injection; everywhere else delivers on Claude's next turn)
- **🎛 You choose the session** — type `/nitpic` in whichever Claude Code session should listen; run it elsewhere to move the connection
- **📚 Batch reviews** — collect comments across pages and tabs, then send them as one message, grouped by page
- **🫧 Floating panel** — draggable, collapsible to a pill, never squeezes your viewport or triggers responsive breakpoints
- **🔒 Local-only** — no accounts, no servers, no telemetry; everything stays on your machine
- **🪄 Zero-friction setup** — pairing happens automatically; you never copy a code or touch a config file

## 🚀 Quick start

**1. Install the Chrome extension** — *(Web Store link coming soon; until then: `chrome://extensions` → Developer mode → Load unpacked → `extension/dist`)*

**2. Install the Claude Code plugin** — paste into any Claude Code session:

```
/plugin marketplace add jibril4000/nitpic
/plugin install nitpic@nitpic
```

**3. Connect** — in the session that should receive feedback:

```
/nitpic
```

**4. Nitpick** — click the nitpic icon on the page you're reviewing, hit **Start feedback**, click anything, type a comment, **Send**. That's the whole loop.

The extension's welcome page walks you through all of this with a live checklist that ticks itself as you go.

## 🧠 How it works

```
┌───────────────┐  WebSocket   ┌──────────────┐   types into   ┌──────────────────────┐
│ Chrome        │ ───────────▶ │ switchboard  │ ─────────────▶ │ your Claude Code     │
│ extension     │  127.0.0.1   │ (auto-starts,│  the terminal  │ session (the one you │
└───────────────┘              │  invisible)  │  or via hooks  │ typed /nitpic in)    │
                               └──────────────┘                └──────────────────────┘
```

| Your terminal | Delivery |
| --- | --- |
| tmux | ⚡ instant — injected into the exact pane |
| iTerm2 | ⚡ instant — injected via the session API |
| anything else | ⏭ on turn boundaries — arrives when Claude finishes its current response, with a desktop notification |

Screenshots and HTML snippets are written to `<project>/.feedback/` (auto-gitignored); the message Claude receives points to them. If no session is listening, feedback queues on disk and delivers when one connects.

## 🔒 Privacy & security

Everything is local: the switchboard binds to `127.0.0.1` only, and a pairing token (exchanged automatically) stops arbitrary web pages from speaking to it. The line injected into your terminal never contains page content — comments live in files Claude reads. The extension collects no data and phones no home.

## 🗺 Roadmap

- [x] Claude Code
- [ ] Cursor
- [ ] Codex
- [ ] Gemini CLI
- [ ] VS Code terminal injection (instant delivery without tmux/iTerm2)
- [ ] Device-size preview (test mobile/tablet layouts on purpose)
- [ ] Chrome Web Store + zero-token pairing

## 🤝 Contributing

```sh
git clone https://github.com/jibril4000/nitpic && cd nitpic
npm install
npm run build     # plugin bundles → plugin/dist, extension → extension/dist
npm test          # vitest: switchboard e2e, queueing, formatting, assets
```

Issues and PRs welcome — especially transports for new terminals and agents.

## ☕ Support

If nitpic saves you a round-trip or ten, [buy me a coffee](https://buymeacoffee.com/jibrilai). Made by [Jibril](https://linkedin.com/in/jibril-ai).

## 📝 License

[MIT](LICENSE)
