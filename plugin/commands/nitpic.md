---
description: Connect this session to the nitpic Chrome extension (browser feedback lands here). Use "/nitpic off" to disconnect.
---

The nitpic activation hook has just run for this command and wrote its result to `~/.nitpic/last-activate.txt`.

## Your task

Use the Read tool to read `~/.nitpic/last-activate.txt`, then relay the result to the user, briefly and warmly. Rules:

- If it says NITPIC ACTIVE: confirm this session now receives browser feedback for the shown project, and say whether delivery is instant or arrives on turn boundaries (one short sentence).
- If "pairing needed" appears: tell the user to click the nitpic toolbar icon in Chrome — the floating panel pairs automatically from the clipboard within a few seconds (no copying or pasting needed). Only mention the token value itself if the report says it is NOT on the clipboard. This happens only once, ever.
- If a "hint:" line appears about the extension not being connected: relay it (click the toolbar icon on the page being reviewed; if the panel says "waiting for /nitpic" it will pair itself in a few seconds).
- If "Queued feedback delivered now" appears: treat everything under it as fresh browser feedback from the user — read any referenced .feedback/ files and address each item after relaying the status.
- If it says disconnected: confirm feedback no longer targets this session.
- If it starts with ERROR: show the error and suggest checking ~/.nitpic/daemon.log.
- If the file does not exist: tell the user the activation hook didn't fire — they should restart Claude Code (the nitpic plugin's hooks load at startup) and run /nitpic again.

Do not run any other commands or start any other work (except addressing delivered feedback, per above).
