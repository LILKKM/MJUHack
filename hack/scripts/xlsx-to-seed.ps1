<#
  docs/seobuk4_history_pins.xlsx 를 읽어 Flyway 시드 SQL(V3__seed_spots.sql)을 만든다.
  사용법 (hack 폴더에서):  powershell -ExecutionPolicy Bypass -File scripts/xlsx-to-seed.ps1
  주의: V3 가 이미 적용된 DB 에는 Flyway 체크섬이 달라지므로, 엑셀이 바뀌면 새 버전(V4__...)으로 출력하거나
        로컬 DB 를 초기화(docker compose down -v)한 뒤 다시 실행한다.
#>
param(
    [string]$Xlsx = (Join-Path $PSScriptRoot '..\..\docs\seobuk4_history_pins.xlsx'),
    [string]$Out  = (Join-Path $PSScriptRoot '..\src\main\resources\db\migration\V3__seed_spots.sql')
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zip = [IO.Compression.ZipFile]::OpenRead((Resolve-Path $Xlsx))
function Read-Entry([string]$name) {
    $e = $zip.GetEntry($name); if (-not $e) { return $null }
    $r = New-Object IO.StreamReader($e.Open(), [Text.Encoding]::UTF8)
    try { [xml]$r.ReadToEnd() } finally { $r.Close() }
}
try {
    $shared = @()
    $ssXml = Read-Entry 'xl/sharedStrings.xml'
    if ($ssXml) { $shared = @($ssXml.sst.si | ForEach-Object { $_.InnerText }) }

    # sheet name -> sheet xml path
    $wb   = Read-Entry 'xl/workbook.xml'
    $rels = Read-Entry 'xl/_rels/workbook.xml.rels'
    $sheetPath = @{}
    foreach ($s in $wb.workbook.sheets.sheet) {
        $rid = $s.GetAttribute('id', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
        $target = ($rels.Relationships.Relationship | Where-Object { $_.Id -eq $rid }).Target
        $sheetPath[$s.name] = 'xl/' + ($target -replace '^/?xl/', '')
    }

    function Read-Sheet([string]$name) {
        $x = Read-Entry $sheetPath[$name]
        $rows = @()
        foreach ($row in $x.worksheet.sheetData.row) {
            $cells = @{}
            foreach ($c in $row.c) {
                $col = $c.r -replace '\d', ''
                $v = if ($c.t -eq 's') { $shared[[int]$c.v] } elseif ($c.t -eq 'inlineStr') { $c.is.InnerText } else { $c.v }
                $cells[$col] = if ($null -eq $v) { '' } else { "$v".Trim() }
            }
            $rows += , $cells
        }
        # first row = header, map column letter -> header name
        $header = $rows[0]
        $result = @()
        foreach ($r in $rows | Select-Object -Skip 1) {
            $o = [ordered]@{}
            foreach ($k in $header.Keys) { $o[$header[$k]] = $r[$k] }
            $result += [pscustomobject]$o
        }
        $result
    }

    $spots = Read-Sheet '장소' | Where-Object { $_.id }
    $links = Read-Sheet '시기를 넘는 연결' | Where-Object { $_.'연결 id' }
} finally { $zip.Dispose() }

function Q([string]$s) {
    if ([string]::IsNullOrWhiteSpace($s)) { return 'NULL' }
    "'" + ($s -replace '\\', '\\' -replace "'", "''") + "'"
}
function N([string]$s) { if ([string]::IsNullOrWhiteSpace($s)) { 'NULL' } else { [decimal]::Parse($s, [Globalization.CultureInfo]::InvariantCulture).ToString([Globalization.CultureInfo]::InvariantCulture) } }

$eraMap   = @{ '조선' = 'JOSEON'; '개화기·일제강점기' = 'OPENING_COLONIAL'; '현대' = 'MODERN' }
$coordMap = @{ 'approx' = 'APPROX'; 'user_xlsx' = 'PROVIDED'; 'user_xlsx_area' = 'AREA'; 'missing' = 'MISSING'; '' = 'MISSING' }
$teamListLabel = '엑셀 제공 목록(사용자)'

$sb = New-Object Text.StringBuilder
[void]$sb.AppendLine('-- 자동 생성 파일: scripts/xlsx-to-seed.ps1 (원본 docs/seobuk4_history_pins.xlsx). 직접 수정하지 말 것.')
[void]$sb.AppendLine("-- 장소 $(@($spots).Count)곳, 연결 $(@($links | Select-Object -ExpandProperty '연결 id' -Unique).Count)개")
[void]$sb.AppendLine()

$spotValues = @(); $sourceValues = @()
foreach ($s in $spots) {
    $era = $eraMap[$s.period]; if (-not $era) { throw "알 수 없는 period '$($s.period)' ($($s.id))" }
    $coord = $coordMap[$s.coord_status]; if (-not $coord) { throw "알 수 없는 coord_status '$($s.coord_status)' ($($s.id))" }
    if (-not $s.lat -or -not $s.lng) { $coord = 'MISSING' }
    $district = $s.id.Substring(0, 3)
    $review = if ($s.source_1 -eq $teamListLabel) { 'NEEDS_SOURCE' } else { 'DRAFT' }
    $spotValues += "    ($(Q $s.id), $(Q $district), $(Q $era), $(Q $s.name), $(Q $s.category), $(Q $s.era), $(Q $s.year), $(Q $s.address), $(N $s.lat), $(N $s.lng), $(Q $coord), $(Q $s.story_short), $(Q $s.hidden_fact), $(Q $s.kto_content_id), $(Q $s.accessibility_note), $(Q $s.verify_note), $(Q $review))"
    $order = 1
    foreach ($src in @($s.source_1, $s.source_2)) {
        if ([string]::IsNullOrWhiteSpace($src)) { continue }
        if ($src -match '^https?://') { $sourceValues += "    ($(Q $s.id), $order, $(Q $src), NULL)" }
        else { $sourceValues += "    ($(Q $s.id), $order, NULL, $(Q $src))" }
        $order++
    }
}
[void]$sb.AppendLine('INSERT INTO spot (id, district_id, era_id, name, category, era_detail, year_label, address, latitude, longitude, coord_status, story_short, hidden_fact, kto_content_id, accessibility_note, verify_note, review_status) VALUES')
[void]$sb.AppendLine(($spotValues -join ",`n") + ';')
[void]$sb.AppendLine()
[void]$sb.AppendLine('INSERT INTO spot_source (spot_id, sort_order, url, label) VALUES')
[void]$sb.AppendLine(($sourceValues -join ",`n") + ';')
[void]$sb.AppendLine()

$linkValues = @(); $linkSpotValues = @()
foreach ($g in $links | Group-Object '연결 id') {
    $first = $g.Group[0]
    $linkValues += "    ($(Q $g.Name), $(Q $first.'연결 고리'), $(Q $first.'시기 흐름'), $(Q $first.'겹치는 사건'))"
    $i = 1
    foreach ($row in $g.Group) { $linkSpotValues += "    ($(Q $g.Name), $(Q $row.'장소 id'), $i)"; $i++ }
}
[void]$sb.AppendLine('INSERT INTO cross_link (id, title, era_flow, story) VALUES')
[void]$sb.AppendLine(($linkValues -join ",`n") + ';')
[void]$sb.AppendLine()
[void]$sb.AppendLine('INSERT INTO cross_link_spot (cross_link_id, spot_id, sort_order) VALUES')
[void]$sb.AppendLine(($linkSpotValues -join ",`n") + ';')

[IO.File]::WriteAllText([IO.Path]::GetFullPath($Out), ($sb.ToString() -replace "`r`n", "`n"), (New-Object Text.UTF8Encoding($false)))
Write-Host "wrote $Out ($(@($spots).Count) spots, $(@($sourceValues).Count) sources, $(@($linkValues).Count) links, $(@($linkSpotValues).Count) link-spots)"
