/** Offscreen document: the only place MV3 allows silent clipboard reads. */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.target !== "offscreen" || msg.cmd !== "read-clipboard") return;
  const ta = document.getElementById("t") as HTMLTextAreaElement;
  ta.value = "";
  ta.focus();
  document.execCommand("paste");
  sendResponse({ text: ta.value });
});
