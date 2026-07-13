<p align="center">
  <img src="../assets/cover.png" alt="nitpic" width="640" />
</p>

<h3 align="center">Klick auf irgendwas. Sag, was falsch ist. Sieh zu, wie Claude es behebt.</h3>

<p align="center">
  <a href="../LICENSE"><img src="https://img.shields.io/badge/Lizenz-MIT-91C31C?style=flat-square" alt="MIT-Lizenz" /></a>
  <a href="https://chromewebstore.google.com/detail/eamfkghlemjhefpdlmpjkjadacgcanll"><img src="https://img.shields.io/badge/Chrome%20Web%20Store-verf%C3%BCgbar-91C31C?style=flat-square&logo=googlechrome&logoColor=white" alt="Chrome Web Store" /></a>
  <img src="https://img.shields.io/badge/Claude%20Code-Plugin-91C31C?style=flat-square&logo=anthropic&logoColor=white" alt="Claude-Code-Plugin" />
  <a href="https://buymeacoffee.com/jibrilai"><img src="https://img.shields.io/badge/%E2%98%95-Kauf%20mir%20einen%20Kaffee-FFDD00?style=flat-square" alt="Kauf mir einen Kaffee" /></a>
</p>

<p align="center">
  <a href="../README.md">English</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="README.ar.md">العربية</a>
</p>

---

**nitpic** verbindet deinen Browser mit [Claude Code](https://claude.com/claude-code). Aktiviere den Feedback-Modus, klicke auf ein beliebiges Element auf einer beliebigen Seite — `localhost` oder Produktion —, schreib, was sich ändern soll, und sende es ab. Dein Kommentar, ein zugeschnittener Screenshot und das HTML des Elements landen in deiner laufenden Claude-Code-Session, **als hättest du sie dort eingetippt** — und Claude legt los.

Gebaut für Designer, Entwicklerinnen und Vibe-Coder, die ihre App im Browser prüfen, aber im Terminal reparieren.

## ✨ Funktionen

- **🎯 Zeig aufs Problem** — Elemente per Hover markieren oder eine Region aufziehen; nitpic erfasst CSS-Selektor, Screenshot und HTML für dich
- **⚡ Sofortige Zustellung** — Feedback landet innerhalb einer Sekunde im Terminal (tmux und iTerm2 bekommen echte Tastatur-Injektion; überall sonst kommt es zur nächsten Runde von Claude)
- **🎛 Du wählst die Session** — tippe `/nitpic` in der Claude-Code-Session, die zuhören soll; führe es woanders aus, um die Verbindung zu verschieben
- **📚 Sammel-Reviews** — Kommentare über Seiten und Tabs hinweg sammeln und als eine Nachricht senden, nach Seite gruppiert
- **🫧 Schwebendes Panel** — verschiebbar, zur Pille einklappbar, verkleinert nie deinen Viewport und löst keine Responsive-Breakpoints aus
- **🔒 Rein lokal** — keine Konten, keine Server, keine Telemetrie; alles bleibt auf deinem Rechner
- **🪄 Reibungslose Einrichtung** — das Pairing passiert automatisch; du kopierst nie einen Code und fasst keine Konfigurationsdatei an

## 🚀 Schnellstart

**1. Chrome-Erweiterung installieren** — mit einem Klick aus dem [Chrome Web Store](https://chromewebstore.google.com/detail/eamfkghlemjhefpdlmpjkjadacgcanll)

**2. Claude-Code-Plugin installieren** — in eine beliebige Session einfügen:

```
/plugin marketplace add jibril4000/nitpic
/plugin install nitpic@nitpic
```

**3. Verbinden** — in der Session, die das Feedback empfangen soll:

```
/nitpic
```

**4. Meckern** — klicke auf das nitpic-Icon auf der Seite, **Start feedback**, klicke auf irgendwas, kommentiere, **Send**. Das ist der ganze Kreislauf.

## 🧠 So funktioniert's

| Dein Terminal | Zustellung |
| --- | --- |
| tmux | ⚡ sofort — direkt ins richtige Pane injiziert |
| iTerm2 | ⚡ sofort — über die Session-API injiziert |
| alles andere | ⏭ an Rundengrenzen — kommt an, wenn Claude seine aktuelle Antwort beendet, mit Desktop-Benachrichtigung |

Screenshots und HTML-Schnipsel landen in `<projekt>/.feedback/` (automatisch in `.gitignore`). Hört keine Session zu, wird das Feedback auf der Festplatte eingereiht und zugestellt, sobald sich eine verbindet.

## 🔒 Datenschutz & Sicherheit

Alles ist lokal: Die Vermittlungsstelle lauscht nur auf `127.0.0.1`, und ein (automatisch ausgetauschtes) Pairing-Token verhindert, dass beliebige Webseiten mit ihr sprechen. Die Erweiterung sammelt keine Daten.

## 🗺 Roadmap

- [x] Claude Code
- [ ] Cursor
- [ ] Codex
- [ ] Gemini CLI
- [ ] Injektion ins VS-Code-Terminal
- [ ] Geräte-Größen-Vorschau
- [ ] Chrome Web Store + Pairing ohne Token

## ☕ Unterstützen

Wenn nitpic dir zehn Umwege erspart, [kauf mir einen Kaffee](https://buymeacoffee.com/jibrilai). Gemacht von [Jibril](https://linkedin.com/in/jibril-ai).

## 📝 Lizenz

[MIT](../LICENSE)
