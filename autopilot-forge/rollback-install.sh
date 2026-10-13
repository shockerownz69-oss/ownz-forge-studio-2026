#!/usr/bin/env bash
set -Eeuo pipefail
PROJECT="${OWNZ_PROJECT:-$HOME/ownz-forge}"
BACK="${1:?Provide exact installer backup folder}"
[[ "$BACK" == "$PROJECT"/.ownz-recovery/installer/autopilot-v1-* && -f "$BACK/server.js" && -f "$BACK/index.html" ]] || { echo 'Invalid recovery folder';exit 1; }
cd "$PROJECT"; cp "$BACK/server.js" server.js;cp "$BACK/index.html" editor/index.html
if [[ -f "$BACK/previous-api.cjs" ]];then cp "$BACK/previous-api.cjs" autopilot-forge/autopilot-api.cjs;else rm -f autopilot-forge/autopilot-api.cjs;fi
if [[ -f "$BACK/previous-run.cjs" ]];then cp "$BACK/previous-run.cjs" autopilot-forge/autopilot-run.cjs;else rm -f autopilot-forge/autopilot-run.cjs;fi
for f in autopilot-ui.js autopilot-ui.css;do if [[ -f "$BACK/previous-$f" ]];then cp "$BACK/previous-$f" "editor/public/$f";else rm -f "editor/public/$f";fi;done
echo '[OWNZ] Restored previous files; restart backend.'
