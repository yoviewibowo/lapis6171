param(
  [Parameter(Mandatory=$true)]
  [string]$GitHubUsername,

  [Parameter(Mandatory=$true)]
  [string]$Repository,

  [Parameter(Mandatory=$true)]
  [string]$ApiUrl,

  [string]$AnalyticsId = ""
)

$ErrorActionPreference = "Stop"

if ($ApiUrl -notmatch '^https://script\.google\.com/macros/s/.+/exec') {
  throw "ApiUrl harus berupa URL deployment Apps Script yang berakhiran /exec."
}

$SiteUrl = "https://$GitHubUsername.github.io/$Repository/"

$files = @(
  "index.html",
  "404.html",
  "robots.txt",
  "sitemap.xml",
  "js/config.js"
)

foreach ($file in $files) {
  if (-not (Test-Path $file)) {
    throw "File tidak ditemukan: $file. Jalankan script ini dari root folder PINTAS_GITHUB."
  }

  $content = Get-Content $file -Raw -Encoding UTF8
  $content = $content.Replace("https://YOUR_USERNAME.github.io/YOUR_REPO/", $SiteUrl)
  $content = $content.Replace("PASTE_YOUR_APPS_SCRIPT_EXEC_URL_HERE", $ApiUrl)

  if ($AnalyticsId) {
    $content = $content -replace "ANALYTICS_MEASUREMENT_ID:\s*''", "ANALYTICS_MEASUREMENT_ID: '$AnalyticsId'"
  }

  Set-Content $file $content -Encoding UTF8
}

Write-Host ""
Write-Host "PINTAS berhasil dikonfigurasi." -ForegroundColor Green
Write-Host "SITE_URL : $SiteUrl"
Write-Host "API_URL  : $ApiUrl"
if ($AnalyticsId) {
  Write-Host "Analytics: $AnalyticsId"
} else {
  Write-Host "Analytics: tidak diaktifkan"
}
Write-Host ""
Write-Host "Selanjutnya upload ISI folder PINTAS_GITHUB ke root repository GitHub."
