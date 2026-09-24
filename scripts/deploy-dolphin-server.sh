#!/usr/bin/env bash
set -Eeuo pipefail

release_root=/opt/termburg-guest
current_link="$release_root/current"
releases_dir="$release_root/releases"
release_stamp=$(date -u +%Y%m%dT%H%M%SZ)
env_file=/etc/termliny-game/feedback.env
team_env_file=/etc/termburg-identity/team.env
nginx_file=/etc/nginx/sites-available/termliny-game.ceosivaev.ru
staging_dir=/tmp/termburg-dolphin-deploy
journal=/var/lib/termliny-game/reward-redemptions.jsonl
business_store=/var/lib/termliny-game/dolphin-business-summaries.json
connectors_store=/var/lib/termliny-game/dolphin-connectors.json
enrollment_hash_file="$staging_dir/dolphin-enrollment.sha256"

if [[ $(id -u) -ne 0 ]]; then
  echo "Run as root." >&2
  exit 1
fi

exec 9>/run/lock/termburg-dolphin-business-deploy.lock
if ! flock -n 9; then
  echo "Another Dolphin deployment is already running." >&2
  exit 1
fi

for required in feedback-service.mjs feedback-server.mjs termliny-game.nginx.conf; do
  test -f "$staging_dir/$required"
done
test -f "$enrollment_hash_file"
enrollment_hash=$(tr -d '[:space:]' < "$enrollment_hash_file")
[[ "$enrollment_hash" =~ ^[a-f0-9]{64}$ ]]

test -L "$current_link"
resolved_releases_dir=$(realpath -e -- "$releases_dir")
old_release=$(realpath -e -- "$current_link")
case "$old_release" in
  "$resolved_releases_dir"/*) ;;
  *)
    echo "Refusing to deploy: current does not point inside $resolved_releases_dir" >&2
    exit 1
    ;;
esac
test -d "$old_release"
test -f "$old_release/server/feedback-service.mjs"
test -f "$old_release/server/feedback-server.mjs"
feedback_unit_definition=$(systemctl cat termliny-feedback)
[[ "$feedback_unit_definition" == *"$current_link"* ]]

new_release="$resolved_releases_dir/dolphin-business-$release_stamp"
backup_root="$release_root/deploy-backups"
backup_dir="$backup_root/dolphin-business-$release_stamp"
current_swap="$release_root/.current-dolphin-business-$release_stamp.$$"
rollback_swap="$release_root/.current-dolphin-business-rollback-$release_stamp.$$"
test ! -e "$new_release" && test ! -L "$new_release"
test ! -e "$backup_dir" && test ! -L "$backup_dir"
test ! -e "$current_swap" && test ! -L "$current_swap"
test ! -e "$rollback_swap" && test ! -L "$rollback_swap"

install -d -m 0700 "$backup_dir"
cp -a "$env_file" "$backup_dir/feedback.env.live"
cp -a "$nginx_file" "$backup_dir/termliny-game.nginx.conf.live"
team_env_was_present=0
if [[ -f "$team_env_file" ]]; then
  team_env_was_present=1
  cp -a "$team_env_file" "$backup_dir/team.env.live"
fi
team_service_was_active=0
if systemctl is-active --quiet termburg-team 2>/dev/null; then
  team_service_was_active=1
fi
current_switched=0
connectors_store_was_present=0
connectors_backup_ready=0
connectors_live_replaced=0
connectors_swap=''

switch_current_release() {
  local target=$1
  local swap=$2
  local target_resolved
  if [[ ! -d "$target" || -e "$swap" || -L "$swap" ]]; then
    return 1
  fi
  target_resolved=$(realpath -e -- "$target") || return 1
  case "$target_resolved" in
    "$resolved_releases_dir"/*) ;;
    *) return 1 ;;
  esac
  case "$swap" in
    "$release_root"/.current-dolphin-business-*) ;;
    *) return 1 ;;
  esac
  ln -s -- "$target_resolved" "$swap" || return 1
  if ! mv -Tf -- "$swap" "$current_link"; then
    rm -f -- "$swap"
    return 1
  fi
  test "$(realpath -e -- "$current_link")" = "$target_resolved"
}

atomic_install_connectors() {
  local source_file=$1
  local connectors_dir=/var/lib/termliny-game
  local owner_mode
  [[ "$connectors_store" = "$connectors_dir/dolphin-connectors.json" ]] || return 1
  [[ ! -L "$connectors_store" ]] || return 1
  [[ -f "$source_file" ]] || return 1
  connectors_swap=$(mktemp "$connectors_dir/.dolphin-connectors.deploy.XXXXXX") || return 1
  install -o www-data -g www-data -m 0640 -- "$source_file" "$connectors_swap" || return 1
  mv -Tf -- "$connectors_swap" "$connectors_store" || return 1
  connectors_live_replaced=1
  connectors_swap=''
  owner_mode=$(stat -c '%U:%G %a' -- "$connectors_store") || return 1
  [[ "$owner_mode" = 'www-data:www-data 640' ]]
}

rollback() {
  trap - ERR
  set +e
  echo "Deployment failed; restoring $backup_dir" >&2
  link_restored=1
  connectors_restored=1
  if [[ -L "$current_swap" ]]; then
    rm -f -- "$current_swap"
  fi
  if [[ -n "$connectors_swap" && "$connectors_swap" = /var/lib/termliny-game/.dolphin-connectors.deploy.* ]]; then
    rm -f -- "$connectors_swap"
    connectors_swap=''
  fi
  if [[ "$current_switched" = 1 ]]; then
    if ! switch_current_release "$old_release" "$rollback_swap"; then
      link_restored=0
      echo "CRITICAL: failed to restore current symlink to $old_release" >&2
    fi
  fi
  cp -a "$backup_dir/feedback.env.live" "$env_file"
  cp -a "$backup_dir/termliny-game.nginx.conf.live" "$nginx_file"
  if [[ "$team_env_was_present" = 1 ]]; then
    cp -a "$backup_dir/team.env.live" "$team_env_file"
  fi
  if [[ "$connectors_store_was_present" = 1 && "$connectors_backup_ready" = 1 && "$connectors_live_replaced" = 1 ]]; then
    if ! atomic_install_connectors "$backup_dir/dolphin-connectors.json.live"; then
      connectors_restored=0
      echo "CRITICAL: failed to restore the Dolphin connector store" >&2
    fi
  fi
  if [[ "$link_restored" = 1 && "$connectors_restored" = 1 ]]; then
    systemctl restart termliny-feedback || true
  else
    systemctl stop termliny-feedback || true
  fi
  if [[ "$team_env_was_present" = 1 && "$team_service_was_active" = 1 ]]; then
    systemctl restart termburg-team || true
  fi
  nginx -t && systemctl reload nginx || true
}
handle_error() {
  status=$?
  failed_line=$1
  rollback
  # Do not print the failed command: it may contain a freshly generated credential.
  echo "Failed at line $failed_line." >&2
  exit "$status"
}
trap 'handle_error "$LINENO"' ERR

cp -a -- "$old_release" "$new_release"
install -m 0644 "$staging_dir/feedback-service.mjs" "$new_release/server/feedback-service.mjs"
install -m 0644 "$staging_dir/feedback-server.mjs" "$new_release/server/feedback-server.mjs"
cmp -s "$staging_dir/feedback-service.mjs" "$new_release/server/feedback-service.mjs"
cmp -s "$staging_dir/feedback-server.mjs" "$new_release/server/feedback-server.mjs"
install -m 0644 "$staging_dir/termliny-game.nginx.conf" "$nginx_file"

upsert_env_value() {
  local key=$1
  local value=$2
  local target_file=${3:-$env_file}
  if grep -q "^${key}=" "$target_file"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$target_file"
  else
    printf '\n%s=%s\n' "$key" "$value" >> "$target_file"
  fi
}

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
if grep -Eq '^DOLPHIN_BUSINESS_INTERNAL_TOKEN=[a-f0-9]{64}$' "$env_file"; then
  business_internal_token=$(sed -n 's/^DOLPHIN_BUSINESS_INTERNAL_TOKEN=//p' "$env_file" | tail -n 1)
else
  umask 077
  business_internal_token=$(openssl rand -hex 32)
  upsert_env_value DOLPHIN_BUSINESS_INTERNAL_TOKEN "$business_internal_token"
fi
[[ "$business_internal_token" =~ ^[a-f0-9]{64}$ ]]
upsert_env_value DOLPHIN_ENROLLMENT_LOCATION_CODE moscow
upsert_env_value DOLPHIN_BUSINESS_SUMMARIES_DATA_FILE "$business_store"
if [[ "$team_env_was_present" = 1 ]]; then
  upsert_env_value DOLPHIN_BUSINESS_INTERNAL_TOKEN "$business_internal_token" "$team_env_file"
  # The consumer stays gated until the vendor endpoints and seven-day overlap are verified.
  upsert_env_value TEAM_DOLPHIN_LIVE_ENABLED 0 "$team_env_file"
  upsert_env_value TEAM_DOLPHIN_LIVE_SUMMARY_URL \
    http://127.0.0.1:4175/api/internal/dolphin/business-summaries "$team_env_file"
  upsert_env_value TEAM_DOLPHIN_LIVE_SUMMARY_TIMEOUT_MS 2000 "$team_env_file"
  chmod 0600 "$team_env_file"
fi
upsert_env_value DOLPHIN_CAMP_SOURCE_ENABLED 1
upsert_env_value DOLPHIN_CAMP_INITIAL_DATE 2023-09-01
upsert_env_value DOLPHIN_CAMP_GUESTTYPES_PATH /api/v1/camp/guesttypes
upsert_env_value DOLPHIN_CAMP_SERVICES_PATH /api/v1/camp/services
upsert_env_value DOLPHIN_CAMP_ACCOUNTS_PATH /api/v1/camp/accounts
upsert_env_value DOLPHIN_CAMP_ACCOUNTSALES_PATH /api/v1/camp/accountsales
upsert_env_value DOLPHIN_CAMP_BUSINESS_ENABLED 0
upsert_env_value DOLPHIN_CAMP_BUSINESS_LOOKBACK_DAYS 7
upsert_env_value DOLPHIN_CAMP_ACCOUNTPAYMENTS_PATH /api/v1/camp/accountpayments
upsert_env_value DOLPHIN_CAMP_SKUDVERIFYLOGS_PATH /api/v1/camp/skudverifylogs
upsert_env_value DOLPHIN_CAMP_CARDS_PATH /api/v1/camp/cards
upsert_env_value DOLPHIN_CAMP_SKUDAREAS_PATH /api/v1/camp/skudareas
upsert_env_value DOLPHIN_CAMP_SKUDCONTROLLERS_PATH /api/v1/camp/skudcontrollers
upsert_env_value DOLPHIN_CAMP_KKMCHEQUES_PATH /api/v1/camp/kkmcheques
chmod 0600 "$env_file"

nginx -t
systemctl stop termliny-feedback
if [[ -e "$connectors_store" || -L "$connectors_store" ]]; then
  [[ -f "$connectors_store" && ! -L "$connectors_store" ]]
  connectors_store_was_present=1
  cp -a -- "$connectors_store" "$backup_dir/dolphin-connectors.json.live"
  connectors_backup_ready=1
  migrated_connectors="$backup_dir/dolphin-connectors.json.migrated"
  CONNECTORS_SOURCE="$connectors_store" CONNECTORS_TARGET="$migrated_connectors" node <<'NODE'
const fs = require('node:fs');

const source = process.env.CONNECTORS_SOURCE;
const target = process.env.CONNECTORS_TARGET;
let state;
try {
  state = JSON.parse(fs.readFileSync(source, 'utf8'));
} catch {
  throw new Error('Dolphin connector store is not valid JSON; migration aborted.');
}
if (!state || typeof state !== 'object' || Array.isArray(state)) {
  throw new Error('Dolphin connector store root is invalid; migration aborted.');
}
for (const collectionName of ['connectors', 'enrollments']) {
  const rows = state[collectionName];
  if (!Array.isArray(rows)) {
    throw new Error(`Dolphin connector store ${collectionName} collection is invalid; migration aborted.`);
  }
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error(`Dolphin connector store ${collectionName} row is invalid; migration aborted.`);
    }
    if (!/^dolphin-moscow-/.test(typeof row.deviceId === 'string' ? row.deviceId : '')) continue;
    const assignments = { locationCode: 'moscow', scopeId: 'pechatniki' };
    for (const [key, expected] of Object.entries(assignments)) {
      const existing = row[key];
      if (existing !== undefined && existing !== null && existing !== '' && existing !== expected) {
        throw new Error('Conflicting Dolphin connector scope metadata; migration aborted.');
      }
      row[key] = expected;
    }
  }
}
fs.writeFileSync(target, `${JSON.stringify(state, null, 2)}\n`, {
  encoding: 'utf8',
  flag: 'wx',
  mode: 0o600,
});
NODE
  atomic_install_connectors "$migrated_connectors"
fi
test "$(realpath -e -- "$current_link")" = "$old_release"
current_switched=1
switch_current_release "$new_release" "$current_swap"
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
printf '%s' "$source_config_response" | \
  EXPECTED_APPLY="${DOLPHIN_SOURCE_APPLY:-0}" \
  EXPECTED_CAMP_ENABLED="${DOLPHIN_CAMP_SOURCE_ENABLED:-0}" \
  node -e '
  let body = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", chunk => { body += chunk; });
  process.stdin.on("end", () => {
  const value = JSON.parse(body);
  const expectedApply = process.env.EXPECTED_APPLY === "1";
  const expectedCampEnabled = process.env.EXPECTED_CAMP_ENABLED === "1";
  if (!value.enabled || !Array.isArray(value.baseUrls) || value.baseUrls.length === 0) process.exit(1);
  if (typeof value.apiKey !== "string" || value.apiKey.length < 16) process.exit(1);
  if (value.applyRedemptions !== expectedApply) process.exit(1);
  if (!value.camp || value.camp.enabled !== expectedCampEnabled) process.exit(1);
  if (value.camp.initialDate !== "2023-09-01") process.exit(1);
  const endpoints = value.camp.endpoints || {};
  if (endpoints.guestTypes !== "/api/v1/camp/guesttypes") process.exit(1);
  if (endpoints.services !== "/api/v1/camp/services") process.exit(1);
  if (endpoints.accounts !== "/api/v1/camp/accounts") process.exit(1);
  if (endpoints.accountSales !== "/api/v1/camp/accountsales") process.exit(1);
  const business = value.camp.business || {};
  if (business.enabled !== false || business.lookbackDays !== 7) process.exit(1);
  const businessEndpoints = business.endpoints || {};
  if (businessEndpoints.accountPayments !== "/api/v1/camp/accountpayments") process.exit(1);
  if (businessEndpoints.skudVerifyLogs !== "/api/v1/camp/skudverifylogs") process.exit(1);
  if (businessEndpoints.cards !== "/api/v1/camp/cards") process.exit(1);
  if (businessEndpoints.skudAreas !== "/api/v1/camp/skudareas") process.exit(1);
  if (businessEndpoints.skudControllers !== "/api/v1/camp/skudcontrollers") process.exit(1);
  if (businessEndpoints.kkmCheques !== "/api/v1/camp/kkmcheques") process.exit(1);
  });
'

business_store_fingerprint() {
  if [[ -f "$business_store" ]]; then
    sha256sum "$business_store" | cut -d ' ' -f 1
  else
    printf 'absent'
  fi
}

business_store_before=$(business_store_fingerprint)
business_unauthorized_status=000
for _attempt in {1..10}; do
  business_unauthorized_status=$(curl -ksS --resolve tbgame.ru:443:127.0.0.1 -o /dev/null -w '%{http_code}' \
    -X POST \
    -H 'Content-Type: application/json' \
    --data '{}' \
    https://tbgame.ru/api/integrations/dolphin/business-summary || true)
  [[ "$business_unauthorized_status" = 401 ]] && break
  sleep 1
done
if [[ "$business_unauthorized_status" != 401 ]]; then
  echo "Unexpected unauthenticated business-summary status: $business_unauthorized_status (expected 401)" >&2
  false
fi

# The deployment credential is intentionally not device-scoped. A 403 proves authentication succeeded
# while also proving that this smoke test cannot write a complex aggregate.
business_legacy_status=000
for _attempt in {1..10}; do
  business_legacy_status=$(curl -ksS --resolve tbgame.ru:443:127.0.0.1 -o /dev/null -w '%{http_code}' \
    -X POST \
    -H "Authorization: Bearer $DOLPHIN_CONNECTOR_TOKEN" \
    -H 'Content-Type: application/json' \
    --data '{}' \
    https://tbgame.ru/api/integrations/dolphin/business-summary || true)
  [[ "$business_legacy_status" = 403 ]] && break
  sleep 1
done
if [[ "$business_legacy_status" != 403 ]]; then
  echo "Unexpected legacy-token business-summary status: $business_legacy_status (expected 403)" >&2
  false
fi
test "$(business_store_fingerprint)" = "$business_store_before"

public_internal_status=$(curl -ksS --resolve tbgame.ru:443:127.0.0.1 -o /dev/null -w '%{http_code}' \
  https://tbgame.ru/api/internal/dolphin/business-summaries)
test "$public_internal_status" = 404

internal_unauthorized_status=$(curl -sS -o /dev/null -w '%{http_code}' \
  http://127.0.0.1:4175/api/internal/dolphin/business-summaries)
test "$internal_unauthorized_status" = 401

internal_business_response=$(curl -sS \
  -H "Authorization: Bearer $DOLPHIN_BUSINESS_INTERNAL_TOKEN" \
  http://127.0.0.1:4175/api/internal/dolphin/business-summaries)
node -e '
  const value = JSON.parse(process.argv[1]);
  if (value.schemaVersion !== 1 || typeof value.scopes !== "object" || Array.isArray(value.scopes)) process.exit(1);
' "$internal_business_response"
test "$(business_store_fingerprint)" = "$business_store_before"

large_heartbeat_response=$(node -e 'process.stdout.write(JSON.stringify({ appVersion: "deploy-size-check", padding: "x".repeat(64 * 1024) }))' | \
  curl -ksS --resolve tbgame.ru:443:127.0.0.1 \
    -H "Authorization: Bearer $DOLPHIN_CONNECTOR_TOKEN" \
    -H 'Content-Type: application/json' \
    --data-binary @- \
    https://tbgame.ru/api/integrations/dolphin/health)
node -e 'const v=JSON.parse(process.argv[1]); if (!v.ok || v.service !== "dolphin-redemption-import") process.exit(1)' \
  "$large_heartbeat_response"

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

if [[ "$team_env_was_present" = 1 && "$team_service_was_active" = 1 ]]; then
  systemctl restart termburg-team
  systemctl is-active --quiet termburg-team
fi

trap - ERR
rm -rf -- "$staging_dir"

echo "Dolphin connector deployed as immutable release: $new_release"
echo "Previous release preserved: $old_release"
echo "Configuration backup preserved: $backup_dir"
echo "Health: authorized OK, unauthenticated 401, dry-run idempotency OK"
echo "Local API config: authorized OK, configured redemption mode preserved"
echo "CAMP diagnostic: enabled, start date and four endpoint paths verified"
echo "CAMP business metrics: endpoint contract verified, collection remains disabled"
echo "Business summaries: public upload auth verified without writes; internal read is loopback-only"
echo "Enrollment: wrong token rejected, one-time token left unused"
echo "Redemption journal lines: $journal_after"
