#!/bin/sh
# nitpic hook runner. Claude Code runs hooks in a non-interactive, non-login
# shell, so a Node installed by a version manager (mise, nvm, volta, asdf, fnm)
# is usually NOT on PATH — those tools only put node on PATH after a shell
# activation hook runs, which never happens here. Calling bare `node` then
# silently fails and nitpic never starts. This script finds a real node binary
# itself and execs ctl.js with it, so the plugin works regardless of how the
# user installs Node. It must stay silent and never break the session: if no
# node can be found, we exit 0 and nitpic simply stays dormant.

# Prefer the newest match from a whitespace-separated glob, if any is runnable.
newest() {
  best=""
  for c in $1; do
    [ -x "$c" ] || continue
    if [ -z "$best" ]; then best="$c"; else
      # Compare parent-dir version strings; keep the higher one.
      hi=$(printf '%s\n%s\n' "$best" "$c" | sort -V | tail -1)
      best="$hi"
    fi
  done
  [ -n "$best" ] && { printf '%s\n' "$best"; return 0; }
  return 1
}

find_node() {
  # 1) Already on PATH (covers Homebrew/system/globally-activated managers).
  if command -v node >/dev/null 2>&1; then command -v node; return 0; fi

  # 2) Version-manager shims/binaries that work standalone (no PATH activation).
  for n in \
    "${MISE_DATA_DIR:-$HOME/.local/share/mise}/shims/node" \
    "$HOME/.local/share/mise/shims/node" \
    "${VOLTA_HOME:-$HOME/.volta}/bin/node" \
    "${ASDF_DATA_DIR:-$HOME/.asdf}/shims/node"
  do
    [ -x "$n" ] && { printf '%s\n' "$n"; return 0; }
  done

  # 3) Version managers without shims: glob installs, pick the newest.
  newest "$HOME/.nvm/versions/node/*/bin/node" && return 0
  newest "${FNM_DIR:-$HOME/.local/share/fnm}/node-versions/*/installation/bin/node" && return 0
  newest "$HOME/.fnm/node-versions/*/installation/bin/node" && return 0
  newest "${ASDF_DATA_DIR:-$HOME/.asdf}/installs/nodejs/*/bin/node" && return 0
  newest "${MISE_DATA_DIR:-$HOME/.local/share/mise}/installs/node/*/bin/node" && return 0

  # 4) Common absolute install locations.
  for n in /opt/homebrew/bin/node /usr/local/bin/node /usr/bin/node; do
    [ -x "$n" ] && { printf '%s\n' "$n"; return 0; }
  done

  # 5) Last resort: ask the user's login+interactive shell, which activates
  #    whatever manager they configured. Guarded against hanging/noise.
  if [ -n "$SHELL" ] && [ -x "$SHELL" ]; then
    n=$("$SHELL" -lic 'command -v node' </dev/null 2>/dev/null | tail -1)
    [ -n "$n" ] && [ -x "$n" ] && { printf '%s\n' "$n"; return 0; }
  fi

  return 1
}

NODE=$(find_node) || exit 0
# Put the resolved node first on PATH so any child that calls bare `node` finds it.
PATH="$(dirname "$NODE"):$PATH"
export PATH
exec "$NODE" "${CLAUDE_PLUGIN_ROOT}/dist/ctl.js" "$@"
