$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$exe = (Resolve-Path -LiteralPath (Join-Path $repoRoot 'release\schedule-desktop\Termburg-Schedule-1.0.19-portable.exe')).Path
$productName = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('0KLQtdGA0LzQsdGD0YDQsyDQoNCw0YHQv9C40YHQsNC90LjQtQ=='))
$appDataCandidates = @(
  (Join-Path $env:APPDATA $productName),
  (Join-Path $env:APPDATA 'termliny-game-root')
)
$preexisting = @($appDataCandidates | Where-Object { Test-Path -LiteralPath $_ })

if ($preexisting.Count -gt 0) {
  throw "QA stopped: user-data path already exists: $($preexisting -join ', ')"
}
if (Get-NetTCPConnection -LocalPort 4174 -State Listen -ErrorAction SilentlyContinue) {
  throw 'QA stopped: port 4174 is already in use.'
}

function Get-ProcessTreeIds([int]$RootId) {
  $all = @(Get-CimInstance Win32_Process)
  $ids = [System.Collections.Generic.List[int]]::new()
  $ids.Add($RootId)
  $changed = $true
  while ($changed) {
    $changed = $false
    foreach ($item in $all) {
      if ($ids.Contains([int]$item.ParentProcessId) -and -not $ids.Contains([int]$item.ProcessId)) {
        $ids.Add([int]$item.ProcessId)
        $changed = $true
      }
    }
  }
  return @($ids)
}

function Start-ScheduleExe {
  $process = Start-Process -FilePath $exe -WorkingDirectory (Split-Path $exe) -WindowStyle Hidden -PassThru
  $deadline = (Get-Date).AddSeconds(75)
  do {
    Start-Sleep -Milliseconds 500
    try {
      $health = Invoke-RestMethod -Uri 'http://127.0.0.1:4174/api/health' -TimeoutSec 2
      if ($health.ok) { return $process }
    } catch {
      # The portable launcher needs a few seconds to unpack on first launch.
    }
    if ($process.HasExited) {
      throw "Portable EXE exited before health check. Exit code: $($process.ExitCode)"
    }
  } while ((Get-Date) -lt $deadline)
  throw 'Portable EXE did not become healthy within 75 seconds.'
}

function Stop-ScheduleExe($RootProcess) {
  $ids = @(Get-ProcessTreeIds -RootId $RootProcess.Id)
  foreach ($processId in $ids) {
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if ($process -and $process.MainWindowHandle -ne 0) {
      [void]$process.CloseMainWindow()
    }
  }

  $deadline = (Get-Date).AddSeconds(15)
  do {
    Start-Sleep -Milliseconds 250
    $remaining = @($ids | Where-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue })
  } while ($remaining.Count -gt 0 -and (Get-Date) -lt $deadline)

  foreach ($processId in $remaining) {
    Stop-Process -Id $processId -ErrorAction SilentlyContinue
  }

  $portDeadline = (Get-Date).AddSeconds(10)
  do {
    Start-Sleep -Milliseconds 250
    $portOpen = Get-NetTCPConnection -LocalPort 4174 -State Listen -ErrorAction SilentlyContinue
  } while ($portOpen -and (Get-Date) -lt $portDeadline)
}

$first = $null
$second = $null
try {
  $first = Start-ScheduleExe
  $info = Invoke-RestMethod -Uri 'http://127.0.0.1:4174/api/info' -TimeoutSec 5
  $schedule = Invoke-RestMethod -Uri 'http://127.0.0.1:4174/api/schedule' -TimeoutSec 5
  $adminHeaders = @(& curl.exe --silent --show-error --dump-header - --output NUL --max-time 5 'http://127.0.0.1:4174/schedule/admin')
  $originalRevision = [int]$schedule.revision
  $schedule.revision = $originalRevision + 1
  $schedule.updatedAt = (Get-Date).ToUniversalTime().ToString('o')
  $saved = Invoke-RestMethod -Uri 'http://127.0.0.1:4174/api/schedule' -Method Put -ContentType 'application/json; charset=utf-8' -Body ($schedule | ConvertTo-Json -Depth 100) -TimeoutSec 10
  $firstTree = @(Get-ProcessTreeIds -RootId $first.Id)

  Stop-ScheduleExe $first
  if (Get-NetTCPConnection -LocalPort 4174 -State Listen -ErrorAction SilentlyContinue) {
    throw 'Port 4174 remained open after closing the first run.'
  }

  $second = Start-ScheduleExe
  $readBack = Invoke-RestMethod -Uri 'http://127.0.0.1:4174/api/schedule' -TimeoutSec 5
  $secondTree = @(Get-ProcessTreeIds -RootId $second.Id)
  $dataPath = @($appDataCandidates | Where-Object { Test-Path -LiteralPath (Join-Path $_ 'schedule.json') }) | Select-Object -First 1
  $logTail = if ($dataPath) {
    Get-Content -LiteralPath (Join-Path $dataPath 'schedule.log') -Encoding UTF8 -Tail 8
  } else {
    @()
  }

  [pscustomobject]@{
    PortableExe = $exe
    FirstProcessTree = $firstTree -join ','
    SecondProcessTree = $secondTree -join ','
    Health = $true
    AdminStatus = if ($adminHeaders -match '^HTTP/\S+ 200') { 200 } else { 0 }
    CspPresent = [bool]($adminHeaders -match "(?i)^Content-Security-Policy:.*default-src 'self'")
    WriteMode = $info.writeMode
    LanAddressCount = @($info.baseUrls).Count
    SavedRevision = [int]$saved.revision
    PersistedRevision = [int]$readBack.revision
    PersistenceVerified = ([int]$readBack.revision -eq ($originalRevision + 1))
    DataPath = $dataPath
    LogHasStartup = [bool]($logTail -match 'Desktop started')
  }
} finally {
  if ($second -and -not $second.HasExited) {
    Stop-ScheduleExe $second
  } elseif ($first -and -not $first.HasExited) {
    Stop-ScheduleExe $first
  }
  Start-Sleep -Milliseconds 500
  [pscustomobject]@{
    Port4174Closed = -not [bool](Get-NetTCPConnection -LocalPort 4174 -State Listen -ErrorAction SilentlyContinue)
    CreatedUserData = @($appDataCandidates | Where-Object { Test-Path -LiteralPath $_ }) -join ', '
  }
}
