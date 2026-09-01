param(
  [Parameter(Mandatory = $true)]
  [string]$Path,
  [int]$MaxRows = 10000
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding

$excel = $null
$workbook = $null
$worksheet = $null
$usedRange = $null

function Normalize-Header([object]$Value) {
  return ([string]$Value).Trim().ToLowerInvariant().Replace('ё', 'е')
}

try {
  $resolvedPath = (Resolve-Path -LiteralPath $Path).Path
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $workbook = $excel.Workbooks.Open($resolvedPath, 0, $true)
  $worksheet = $workbook.Worksheets.Item(1)
  $usedRange = $worksheet.UsedRange

  $headerRow = 0
  $codeColumn = 0
  $recordColumn = 0
  $entryColumn = 0
  $searchRows = [Math]::Min(10, [int]$usedRange.Rows.Count)
  for ($row = 1; $row -le $searchRows; $row++) {
    for ($column = 1; $column -le $usedRange.Columns.Count; $column++) {
      $header = Normalize-Header $usedRange.Cells.Item($row, $column).Text
      if ($header -eq 'основание для льготы') {
        $headerRow = $row
        $codeColumn = $column
      } elseif ($header -eq 'номер') {
        $recordColumn = $column
      } elseif ($header -eq 'время входа') {
        $entryColumn = $column
      }
    }
    if ($codeColumn -gt 0 -and $entryColumn -gt 0) { break }
  }

  if ($headerRow -eq 0 -or $codeColumn -eq 0 -or $entryColumn -eq 0) {
    throw 'В таблице нет колонок «Основание для льготы» и «Время входа».'
  }

  $dataRows = [Math]::Max(0, [int]$usedRange.Rows.Count - $headerRow)
  if ($dataRows -gt $MaxRows) { throw "В таблице больше $MaxRows строк." }

  $rows = [System.Collections.Generic.List[object]]::new()
  for ($row = $headerRow + 1; $row -le $usedRange.Rows.Count; $row++) {
    $code = ([string]$usedRange.Cells.Item($row, $codeColumn).Text).Trim()
    $entryTime = ([string]$usedRange.Cells.Item($row, $entryColumn).Text).Trim()
    $record = if ($recordColumn -gt 0) { ([string]$usedRange.Cells.Item($row, $recordColumn).Text).Trim() } else { '' }
    if (-not $code -and -not $entryTime -and -not $record) { continue }
    $rows.Add([ordered]@{
      'Номер' = $record
      'Основание для льготы' = $code
      'Время входа' = $entryTime
    })
  }

  [ordered]@{
    ok = $true
    sheet = [string]$worksheet.Name
    rows = $rows
  } | ConvertTo-Json -Depth 4 -Compress
} finally {
  if ($workbook) { $workbook.Close($false) }
  if ($excel) { $excel.Quit() }
  foreach ($object in @($usedRange, $worksheet, $workbook, $excel)) {
    if ($object) { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($object) }
  }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
