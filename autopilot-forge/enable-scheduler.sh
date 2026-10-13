#!/usr/bin/env bash
set -Eeuo pipefail
cd "${OWNZ_PROJECT:-$HOME/ownz-forge}"
command -v crond >/dev/null || { echo 'Install cronie in Termux first: pkg install cronie';exit 1; }
mkdir -p "$HOME/.termux" "$HOME/.ownz-autopilot"
CRON="$(command -v crontab)"
EXISTING="$($CRON -l 2>/dev/null || true)"
LINE="17 */6 * * * cd $PWD && $(command -v node) autopilot-forge/autopilot-run.cjs >> $HOME/.ownz-autopilot/scheduler.log 2>&1"
if ! printf '%s\n' "$EXISTING" | grep -Fq 'autopilot-forge/autopilot-run.cjs';then printf '%s\n%s\n' "$EXISTING" "$LINE" | "$CRON" -;fi
crond 2>/dev/null || true
printf '[OWNZ] Scheduler configured for every 6 hours while Termux cron is running. Android may suspend Termux.\n'
