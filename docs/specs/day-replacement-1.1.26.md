# Замена дня — Workstation 1.1.26

Based on the published desktop 1.1.25 release, not the cloud checkout.

## Employee flow

Расписание → Замена дня → дата → изменить нужные мероприятия →
Сохранить и показать всем. Для официального сайта: Отправить на сайт.
Each change is a dated exception linked to its weekly original. Other events,
dates, locations and weekly templates remain unchanged. Reset requires confirmation.
Additional date events, closures and unpublished drafts are not deleted by reset.
The test account remains isolated. Existing logins and publication settings are retained.

## Compatibility

- Existing Особые даты forms retain the original link. Legacy clients that drop
  a link receive HTTP 409; invalid replacements receive 400 without saving.
- Zelenogorsk's upgraded website accepts linked replacements; Moscow's website
  still exports the ordinary week. This limitation is stated in the editor.
- No default schedule, authentication, Dolphin, updater, TV layout or branding changes.
- Public update includes no enrollment token or generated account/site credentials.
- Release assets: Termburg-Workstation-Update-1.1.26.exe and its SHA256 file.

## Release gates

Run full workstation tests, TypeScript/Vite build, package credential audit and
packaged EXE smoke test (version + byte-preservation of schedule/accounts/site settings).
Verify the new tab and save/reopen/reset cycle against an isolated local server.
After GitHub publication, check discovery and checksum download using the actual updater.
