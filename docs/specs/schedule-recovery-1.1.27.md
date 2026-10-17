# Workstation1.1.27: restore October17/18 and reject stale publications

The previous desktop release preserved a local schedule that did not contain the
cloud holiday replacements. Publishing that snapshot replaced the website array.

## Recovery

On first startup of an activated Zelenogorsk installation, save a byte-exact backup
and load the current public website schedule if it contains the 20 approved holiday
records. Preserve Moscow, monthly posters, private drafts, credentials and Dolphin.
If offline, merge only missing approved replacements into matching recurring slots.
A completion marker prevents resurrecting events that an employee later resets.
The public update contains only the approved public holiday records, no credentials.

## Publication concurrency

WordPress exposes GET /wp-json/termburg/v1/schedule/state (protocol1, opaque revision,
events). Every import requires If-Match with the exact loaded revision. Missing
preconditions return428; stale snapshots return409; no data is changed. A MySQL
named lock serializes separate PHP workers with a5-second bound. Existing API
readers and Moscow's website contract remain unchanged.

The desktop retains lastRemoteRevision in private site-sync settings, sends it on
publication and updates it only after success. It may initialize a missing baseline
only when its content agrees with the website. Otherwise the employee uses
«Загрузить с сайта»; this backs up the local data, imports the selected complex and
records the corresponding revision. Never fetch a new revision solely to authorize
an old full-array publication.

Local editor saves include baseRevision and are serialized; concurrent stale saves
return409. Rejected HTTP writes are not treated as successful local saves.

## Required checks

- Actual missing/stale WordPress writes return428/409 without changing the payload.
- Recovery is idempotent; another complex/private drafts and settings remain.
- Load→edit→publish succeeds; another editor's newer publication blocks the old one.
- Two concurrent local saves from one revision: one succeeds, one conflicts.
- Full workstation suite, package credential audit and packaged EXE smoke pass.
- Old updater discovers1.1.27 and verifies the downloaded SHA256.

Deployment of the WordPress guard precedes enabling the desktop update. Legacy
programs keep viewing/editing locally but must update before website publication.
