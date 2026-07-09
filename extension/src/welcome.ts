/** Welcome page: theme switcher, copy buttons, and a live checklist. */

/* ----- theme: auto (system) → light → dark, persisted ----- */

type ThemePref = "auto" | "light" | "dark";
const THEME_LABELS: Record<ThemePref, string> = { auto: "🌗 Auto", light: "☀️ Light", dark: "🌙 Dark" };
const themeBtn = document.getElementById("themeToggle") as HTMLButtonElement;
const systemDark = window.matchMedia("(prefers-color-scheme: dark)");
let themePref: ThemePref = (localStorage.getItem("nitpicTheme") as ThemePref) || "auto";

function applyTheme(): void {
  const resolved = themePref === "auto" ? (systemDark.matches ? "dark" : "light") : themePref;
  document.documentElement.dataset.theme = resolved;
  themeBtn.textContent = THEME_LABELS[themePref];
}

themeBtn.addEventListener("click", () => {
  themePref = themePref === "auto" ? "light" : themePref === "light" ? "dark" : "auto";
  localStorage.setItem("nitpicTheme", themePref);
  applyTheme();
});
systemDark.addEventListener("change", () => {
  if (themePref === "auto") applyTheme();
});
applyTheme();

/* ----- copy buttons ----- */

for (const btn of document.querySelectorAll<HTMLButtonElement>("[data-copy]")) {
  btn.addEventListener("click", async () => {
    await navigator.clipboard.writeText(btn.dataset.copy!);
    btn.textContent = "Copied ✓";
    setTimeout(() => (btn.textContent = "Copy"), 1600);
  });
}

const ext = document.getElementById("ck-ext")!;
const daemon = document.getElementById("ck-daemon")!;
const session = document.getElementById("ck-session")!;
const alldone = document.getElementById("alldone")!;

ext.classList.add("on"); // you're reading this page, so: yes

async function refresh(): Promise<void> {
  let s: any;
  try {
    s = await chrome.runtime.sendMessage({ cmd: "get-status" });
  } catch {
    return;
  }
  if (!s?.ok) return;
  // If the daemon is up but we're not paired yet, pairing is automatic:
  // /nitpic put the code on the clipboard, and we're an extension page.
  if (!s.connected) await chrome.runtime.sendMessage({ cmd: "auto-pair" }).catch(() => {});
  daemon.classList.toggle("on", Boolean(s.connected));
  session.classList.toggle("on", Boolean(s.session));
  alldone.classList.toggle("show", Boolean(s.connected && s.session));
}

void refresh();
setInterval(refresh, 2000);
