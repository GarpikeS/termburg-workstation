# Серверное погашение бесплатных часов

Погашения хранятся отдельно от выданных кодов в append-only журнале. Повторный импорт одного кода безопасен: сервер вернёт `already_redeemed` и не создаст второе погашение.

## Защита

В `/etc/termliny-game/feedback.env` задаётся отдельный секрет:

```env
REWARD_ADMIN_TOKEN=replace-with-a-long-random-secret
```

Секрет используется только серверной автоматизацией и не попадает во фронтенд.

## Проверка без изменений

```http
POST /api/admin/rewards/free-hour/redemptions/import
Authorization: Bearer <REWARD_ADMIN_TOKEN>
Content-Type: application/json
```

```json
{
  "dryRun": true,
  "source": "dolphin-xls",
  "rows": [
    {
      "code": "TB-1234ABCD",
      "redeemedAt": "2026-08-18T14:10:00+03:00",
      "sourceRecordId": "0000160961"
    }
  ]
}
```

Сервер принимает только точные коды `TB-` и восемь шестнадцатеричных символов. Результаты: `would_redeem`, `redeemed`, `already_redeemed`, `unknown`, `invalid`.

## Применение

После проверки отправляется тот же запрос с `"dryRun": false`. За один импорт принимается не более 2000 строк. Неизвестные и некорректные коды не погашаются и остаются в отчёте для ручной проверки.
