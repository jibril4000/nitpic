/** Options page: pairing token + connection settings. */

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function bg(msg: object): Promise<any> {
  try {
    return await chrome.runtime.sendMessage(msg);
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

function setStatus(text: string, ok: boolean): void {
  const el = $("status");
  el.textContent = text;
  el.className = ok ? "ok" : "bad";
}

async function loadSettings(): Promise<void> {
  const { settings } = await chrome.storage.local.get("settings");
  const s = { port: 8790, token: "", screenshotDefault: true, ...(settings ?? {}) };
  ($("port") as HTMLInputElement).value = String(s.port);
  ($("token") as HTMLInputElement).value = s.token;
  ($("screenshotDefault") as HTMLInputElement).checked = s.screenshotDefault;
}

$("save").addEventListener("click", async () => {
  const settings = {
    port: parseInt(($("port") as HTMLInputElement).value, 10) || 8790,
    token: ($("token") as HTMLInputElement).value.trim(),
    screenshotDefault: ($("screenshotDefault") as HTMLInputElement).checked,
  };
  await chrome.storage.local.set({ settings });
  const res = await bg({ cmd: "get-status" });
  if (res?.connected) {
    setStatus("Saved — connected ✓ You're all set: comments now reach your /nitpic session.", true);
  } else {
    setStatus(`Saved, but not connected: ${res?.error ?? "daemon unreachable"}`, false);
  }
});

void loadSettings();
