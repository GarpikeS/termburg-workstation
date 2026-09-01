#!/usr/bin/env bash
set -Eeuo pipefail

app_dir=/opt/termliny-feedback
env_file=/etc/termliny-game/feedback.env
nginx_file=/etc/nginx/sites-available/termliny-game.ceosivaev.ru
staging_dir=/tmp/termburg-dolphin-deploy
backup_dir="/opt/termliny-feedback.backup-$(date -u +%Y%m%d-%H%M%S)"
journal=/var/lib/termliny-game/reward-redemptions.jsonl
connectors=/var/lib/termliny-game/dolphin-connectors.json
enrollment_hash_file="$staging_dir/dolphin-enrollment.sha256"

if [[ $(id -u) -ne 0 ]]; then
  echo "Run as root." >&2
  exit 1
fi

for required in feedback-service.mjs feedback-server.mjs termliny-game.nginx.conf; do
  test -f "$staging_dir/$required"
done
test -f "$enrollment_hash_file"
enrollment_hash=$(tr -d '[:space:]' < "$enrollment_hash_file")
[[ "$enrollment_hash" =~ ^[a-f0-9]{64}$ ]]

cp -a "$app_dir" "$backup_dir"
cp -a "$env_file" "$backup_dir/feedback.env.live"
cp -a "$nginx_file" "$backup_dir/termliny-game.nginx.conf.live"

rollback() {
  trap - ERR
  set +e
  echo "Deployment failed; restoring $backup_dir" >&2
  cp -a "$backup_dir/feedback-service.mjs" "$app_dir/feedback-service.mjs"
  cp -a "$backup_dir/feedback-server.mjs" "$app_dir/feedback-server.mjs"
  cp -a "$backup_dir/feedback.env.live" "$env_file"
  cp -a "$backup_dir/termliny-game.nginx.conf.live" "$nginx_file"
  systemctl restart termliny-feedback || true
  nginx -t && systemctl reload nginx || true
}
handle_error() {
  status=$?
  failed_line=$1
  failed_command=$2
  rollback
  echo "Failed at line $failed_line: $failed_command" >&2
  exit "$status"
}
trap 'handle_error "$LINENO" "$BASH_COMMAND"' ERR

install -m 0644 "$staging_dir/feedback-service.mjs" "$app_dir/feedback-service.mjs"
install -m 0644 "$staging_dir/feedback-server.mjs" "$app_dir/feedback-server.mjs"
install -m 0644 "$staging_dir/termliny-game.nginx.conf" "$nginx_file"

if ! grep -q '^DOLPHIN_CONNECTOR_TOKEN=' "$env_file"; then
  umask 077
  connector_token=$(openssl rand -hex 32)
  printf '\nDOLPHIN_CONNECTOR_TOKEN=%s\n' "$connector_token" >> "$env_file"
fi
if grep -q '^DOLPHIN_ENROLLMENT_TOKEN_HASH=' "$env_file"; then
  sed -i "s/^DOLPHIN_ENROLLMENT_TOKEN_HASH=.*/DOLPHIN_ENROLLMENT_TOKEN_HASH=$enrollment_hash/" "$env_file"
else
  printf 'DOLPHIN_ENROLLMENT_TOKEN_HASH=%s\n' "$enrollment_hash" >> "$env_file"
fi
chmod 0600 "$env_file"

nginx -t
systemctl restart termliny-feedback
systemctl reload nginx
systemctl is-active --quiet termliny-feedback

set -a
# shellcheck disable=SC1090
source "$env_file"
set +a

connector_ready=0
for _attempt in {1..10}; do
  health_response=$(curl -ksS --resolve tbgame.ru:443:127.0.0.1 \
    -H "Authorization: Bearer $DOLPHIN_CONNECTOR_TOKEN" \
    https://tbgame.ru/api/integrations/dolphin/health || true)
  if node -e 'const v=JSON.parse(process.argv[1]); if (!v.ok || v.service !== "dolphin-redemption-import") process.exit(1)' "$health_response" 2>/dev/null; then
    connector_ready=1
    break
  fi
  sleep 1
done
test "$connector_ready" = 1

unauthorized_status=$(curl -ksS --resolve tbgame.ru:443:127.0.0.1 -o /dev/null -w '%{http_code}' https://tbgame.ru/api/integrations/dolphin/health)
test "$unauthorized_status" = 401

source_unauthorized_status=$(curl -ksS --resolve tbgame.ru:443:127.0.0.1 -o /dev/null -w '%{http_code}' \
  https://tbgame.ru/api/integrations/dolphin/source-config)
test "$source_unauthorized_status" = 401

source_config_response=$(curl -ksS --resolve tbgame.ru:443:127.0.0.1 \
  -H "Authorization: Bearer $DOLPHIN_CONNECTOR_TOKEN" \
  https://tbgame.ru/api/integrations/dolphin/source-config)
node -e '
  const value = JSON.parse(process.argv[1]);
  if (!value.enabled || !Array.isArray(value.baseUrls) || value.baseUrls.length === 0) process.exit(1);
  if (typeof value.apiKey !== "string" || value.apiKey.length < 16) process.exit(1);
  if (value.applyRedemptions !== false) process.exit(1);
' "$source_config_response"

bad_enrollment_status=$(curl -ksS --resolve tbgame.ru:443:127.0.0.1 -o /dev/null -w '%{http_code}' \
  -H 'Content-Type: application/json' \
  --data '{"enrollmentToken":"wrong","deviceId":"deploy-check-device-0001","deviceToken":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}' \
  https://tbgame.ru/api/integrations/dolphin/enroll)
if [[ "$bad_enrollment_status" != 401 ]]; then
  echo "Unexpected enrollment status through nginx: $bad_enrollment_status (expected 401)" >&2
  direct_enrollment_status=$(curl -sS -o /dev/null -w '%{http_code}' \
    -H 'Host: tbgame.ru' \
    -H 'Content-Type: application/json' \
    --data '{"enrollmentToken":"wrong","deviceId":"deploy-check-device-0001","deviceToken":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}' \
    http://127.0.0.1:4175/api/integrations/dolphin/enroll || true)
  echo "Direct service enrollment status: $direct_enrollment_status" >&2
  exit 1
fi

journal_before=0
if [[ -f "$journal" ]]; then journal_before=$(wc -l < "$journal"); fi
dry_run_response=$(curl -sS \
  --resolve tbgame.ru:443:127.0.0.1 \
  -H "Authorization: Bearer $DOLPHIN_CONNECTOR_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"dryRun":true,"deviceId":"deploy-check","rows":[{"code":"TB-00000000","redeemedAt":"2026-08-25T12:00:00+03:00"}]}' \
  https://tbgame.ru/api/integrations/dolphin/redemptions)
node -e 'const v=JSON.parse(process.argv[1]); if (!v.dryRun || v.summary?.unknown !== 1) process.exit(1)' "$dry_run_response"
journal_after=0
if [[ -f "$journal" ]]; then journal_after=$(wc -l < "$journal"); fi
test "$journal_before" = "$journal_after"

trap - ERR
rm -rf -- "$staging_dir"

mapfile -t backups < <(find /opt -maxdepth 1 -type d -name 'termliny-feedback.backup-*' -printf '%f\n' | sort)
while (( ${#backups[@]} > 2 )); do
  oldest=${backups[0]}
  case "$oldest" in
    termliny-feedback.backup-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9][0-9][0-9])
      rm -rf -- "/opt/$oldest"
      ;;
    *)
      echo "Refusing to delete unexpected backup name: $oldest" >&2
      exit 1
      ;;
  esac
  backups=("${backups[@]:1}")
done

echo "Dolphin connector deployed. Backup: $backup_dir"
echo "Health: authorized OK, unauthenticated 401, dry-run idempotency OK"
echo "Local API config: authorized OK, diagnostic mode confirmed"
echo "Enrollment: wrong token rejected, one-time token left unused"
echo "Redemption journal lines: $journal_after"
printf 'Backups kept: %s\n' "${backups[*]}"
