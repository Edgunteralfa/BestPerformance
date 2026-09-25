$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $root 'src-edhunter\target\release\BestPerformance.exe'
if (-not (Test-Path $exe)) {
  Write-Error "Release exe not found. Run npm run tauri:build first."
}

$version = (Get-Item $exe).VersionInfo.ProductVersion
if (-not $version) {
  $version = (Get-Item $exe).VersionInfo.FileVersion
}
if ($version -match '^(\d+\.\d+\.\d+)') {
  $version = $Matches[1]
}

$outDir = Join-Path $root 'src-edhunter\target\release\bundle\portable'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$zip = Join-Path $outDir "BestPerformance_${version}_x64-portable.zip"
if (Test-Path $zip) {
  Remove-Item $zip -Force
}

$stage = Join-Path $env:TEMP ("hidescreen-portable-" + [guid]::NewGuid().ToString())
New-Item -ItemType Directory -Force -Path $stage | Out-Null
try {
  Copy-Item $exe (Join-Path $stage 'BestPerformance.exe')
  Copy-Item (Join-Path $PSScriptRoot 'portable-readme.txt') (Join-Path $stage 'readme.txt')
  New-Item -ItemType File -Path (Join-Path $stage 'portable') | Out-Null
  Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip
}
finally {
  Remove-Item $stage -Recurse -Force
}

Write-Output $zip
