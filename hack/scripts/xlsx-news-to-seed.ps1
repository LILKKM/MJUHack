<#
  docs/seobuk4_history_pins.xlsx 의 newspaper_article 을 읽어 Flyway SQL(V9)을 만든다.
  현장 확인이 어려운 장소 삭제, 남은 장소의 좌표 보강, 뉴스형 기사 입력을 함께 담는다.
  사용법 (hack 폴더에서):  powershell -ExecutionPolicy Bypass -File scripts/xlsx-news-to-seed.ps1
  적용된 파일은 고치지 않는다. 기사가 바뀌면 -Out 으로 새 버전 파일을 만들고 내용을 조정한다.
#>
param(
    [string]$Xlsx = (Join-Path $PSScriptRoot '..\..\docs\seobuk4_history_pins.xlsx'),
    [string]$Out  = (Join-Path $PSScriptRoot '..\src\main\resources\db\migration\V9__remove_spots_and_seed_news.sql')
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

# 메모가 '현장 확인 필요'이고 관광공사 근거도 없는 곳. 직접 가볼 수 있는 명지대·연세대 캠퍼스 지점은 남긴다.
$removed = 'SDM06','SDM08','MPO01','MPO02','MPO03','MPO06','MPO08','MPO09','EPY01','EPY03','EPY04','EPY05','JNG01','JNG03','JNG05','JNG06'

# OpenStreetMap Nominatim 으로 찾은 근사 좌표 (© OpenStreetMap contributors). 현장 확인 전이라 APPROX 로 둔다.
$coords = @(
    @('MPO05', '37.539931', '126.925648', '밤섬'),
    @('EPY02', '37.655084', '126.949561', '북한산성 탐방지원센터'),
    @('EPY08', '37.638202', '126.946545', '진관사 (비석은 오르는 길에 있어 근처 대표점)'),
    @('JNG02', '37.575303', '126.973247', '적선현대빌딩'),
    @('JNG10', '37.573579', '126.987534', '낙원상가 앞')
)

$zip = [IO.Compression.ZipFile]::OpenRead((Resolve-Path $Xlsx))
function Read-Entry([string]$name) {
    $e = $zip.GetEntry($name); if (-not $e) { return $null }
    $r = New-Object IO.StreamReader($e.Open(), [Text.Encoding]::UTF8)
    try { [xml]$r.ReadToEnd() } finally { $r.Close() }
}
try {
    $shared = @((Read-Entry 'xl/sharedStrings.xml').sst.si | ForEach-Object { $_.InnerText })
    $wb = Read-Entry 'xl/workbook.xml'
    $rels = Read-Entry 'xl/_rels/workbook.xml.rels'
    $sheet = $wb.workbook.sheets.sheet | Where-Object { $_.name -eq '장소' }
    $rid = $sheet.GetAttribute('id', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
    $target = ($rels.Relationships.Relationship | Where-Object { $_.Id -eq $rid }).Target
    $x = Read-Entry ('xl/' + ($target -replace '^/?xl/', ''))
    $rows = @()
    foreach ($row in $x.worksheet.sheetData.row) {
        $cells = @{}
        foreach ($c in $row.c) {
            $col = $c.r -replace '\d', ''
            $cells[$col] = if ($c.t -eq 's') { $shared[[int]$c.v] } elseif ($c.t -eq 'inlineStr') { $c.is.InnerText } else { "$($c.v)" }
        }
        $rows += , $cells
    }
} finally { $zip.Dispose() }

$header = $rows[0]
$idCol = ($header.Keys | Where-Object { $header[$_] -eq 'id' })
$newsCol = ($header.Keys | Where-Object { $header[$_] -eq 'newspaper_article' })
if (-not $newsCol) { throw 'newspaper_article 컬럼이 없습니다.' }

function Q([string]$s) {
    if ([string]::IsNullOrWhiteSpace($s)) { return 'NULL' }
    "'" + ($s -replace '\\', '\\' -replace "'", "''") + "'"
}

$articles = @()
foreach ($r in $rows | Select-Object -Skip 1) {
    $id = $r[$idCol]
    if (-not $id -or $removed -contains $id) { continue }
    $text = ("$($r[$newsCol])" -replace "`r`n", "`n").Trim()
    $m = [regex]::Match($text, '^【([^】]+)】\s*([^\n]+)\n+([\s\S]+)$')
    if (-not $m.Success) { throw "기사 형식이 다릅니다: $id" }
    $articles += "    ($(Q $id), 'ko', $(Q $m.Groups[2].Value.Trim()), $(Q $m.Groups[3].Value.Trim()), $(Q $m.Groups[1].Value.Trim()), 'PUBLISHED')"
}

$idList = ($removed | ForEach-Object { "'$_'" }) -join ', '
$sb = New-Object Text.StringBuilder
[void]$sb.AppendLine('-- 자동 생성 파일: scripts/xlsx-news-to-seed.ps1 (원본 docs/seobuk4_history_pins.xlsx). 직접 수정하지 말 것.')
[void]$sb.AppendLine()
[void]$sb.AppendLine('-- 1. 현장 확인이 어려운 장소 삭제. 출처·접근성·연결은 CASCADE 로 함께 지워진다.')
[void]$sb.AppendLine("UPDATE chat_session SET start_spot_id = NULL WHERE start_spot_id IN ($idList);")
[void]$sb.AppendLine("DELETE FROM course WHERE id IN (SELECT course_id FROM (SELECT DISTINCT course_id FROM course_stop WHERE spot_id IN ($idList)) t);")
[void]$sb.AppendLine("DELETE FROM spot WHERE id IN ($idList);")
[void]$sb.AppendLine('-- 장소가 2곳 미만 남은 연결은 더 이상 연결이 아니다.')
[void]$sb.AppendLine('DELETE FROM cross_link WHERE id NOT IN (SELECT cross_link_id FROM (SELECT cross_link_id FROM cross_link_spot GROUP BY cross_link_id HAVING COUNT(*) >= 2) t);')
[void]$sb.AppendLine()
[void]$sb.AppendLine('-- 2. 좌표 보강 (OpenStreetMap Nominatim, © OpenStreetMap contributors).')
foreach ($c in $coords) {
    [void]$sb.AppendLine("UPDATE spot SET latitude = $($c[1]), longitude = $($c[2]), coord_status = 'APPROX' WHERE id = '$($c[0])' AND latitude IS NULL; -- $($c[3])")
}
[void]$sb.AppendLine()
[void]$sb.AppendLine('-- 밤섬은 엑셀 메모가 "조망만 가능"이다. 좌표가 생겨도 휠체어·유모차 코스에는 넣지 않는다.')
[void]$sb.AppendLine("INSERT IGNORE INTO spot_accessibility (spot_id, feature_code, status, raw_text, provider, checked_at) VALUES ('MPO05', 'ACCESS_ROUTE', 'UNAVAILABLE', '조망만 가능', 'TEAM', '2026-11-06');")
[void]$sb.AppendLine()
[void]$sb.AppendLine('-- 3. 뉴스형 재구성 기사. 실제 보도가 아니므로 화면에 안내를 표시한다.')
[void]$sb.AppendLine('INSERT INTO spot_article (spot_id, language, headline, body, event_date, status) VALUES')
[void]$sb.AppendLine(($articles -join ",`n") + ';')

[IO.File]::WriteAllText([IO.Path]::GetFullPath($Out), ($sb.ToString() -replace "`r`n", "`n"), (New-Object Text.UTF8Encoding($false)))
Write-Host "wrote $Out ($($articles.Count) articles, $($removed.Count) removed spots)"
