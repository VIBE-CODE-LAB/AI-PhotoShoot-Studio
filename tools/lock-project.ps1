param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$ErrorActionPreference = "Stop"

$ProtectedExtensions = @(
  ".ts", ".tsx", ".js", ".jsx", ".json",
  ".md", ".txt", ".html", ".css", ".scss",
  ".mjs", ".cjs", ".yml", ".yaml"
)

$ExcludedTopDirs = @(
  "node_modules",
  "dist",
  ".git",
  ".vite"
)

function Get-ProtectedFiles {
  param(
    [string]$ProjectRoot
  )

  return Get-ChildItem -Path $ProjectRoot -File -Recurse -Force | Where-Object {
    $relative = [System.IO.Path]::GetRelativePath($ProjectRoot, $_.FullName)
    $topDir = ($relative -split "[\\/]", 2)[0]
    if ($ExcludedTopDirs -contains $topDir) {
      return $false
    }

    $ext = $_.Extension.ToLowerInvariant()
    if (-not ($ProtectedExtensions -contains $ext)) {
      return $false
    }

    return $true
  }
}

function Ensure-VSCodeReadonlyWarning {
  param(
    [string]$ProjectRoot
  )

  $vscodeDir = Join-Path $ProjectRoot ".vscode"
  $settingsPath = Join-Path $vscodeDir "settings.json"
  New-Item -ItemType Directory -Path $vscodeDir -Force | Out-Null

  if (Test-Path $settingsPath) {
    (Get-Item $settingsPath).IsReadOnly = $false
  }

  $settings = @{}
  if (Test-Path $settingsPath) {
    try {
      $settings = Get-Content -Path $settingsPath -Raw | ConvertFrom-Json -AsHashtable
    }
    catch {
      $settings = @{}
    }
  }

  $settings["files.readonlyInclude"] = @{
    "**/*.ts" = $true
    "**/*.tsx" = $true
    "**/*.js" = $true
    "**/*.jsx" = $true
    "**/*.json" = $true
    "**/*.md" = $true
    "**/*.txt" = $true
    "**/*.html" = $true
    "**/*.css" = $true
    "**/*.scss" = $true
    "**/*.mjs" = $true
    "**/*.cjs" = $true
    "**/*.yml" = $true
    "**/*.yaml" = $true
  }

  $settings["files.readonlyExclude"] = @{
    ".git/**" = $true
    ".vscode/**" = $true
    "tools/unlock-project.ps1" = $true
    "node_modules/**" = $true
    "dist/**" = $true
  }

  $settings | ConvertTo-Json -Depth 20 | Set-Content -Path $settingsPath -Encoding UTF8
}

Ensure-VSCodeReadonlyWarning -ProjectRoot $Root

$files = Get-ProtectedFiles -ProjectRoot $Root
$readonlyCount = 0

foreach ($file in $files) {
  if (-not $file.IsReadOnly) {
    $file.IsReadOnly = $true
    $readonlyCount++
  }
}

Write-Output "Project lock complete."
Write-Output "Protected files matched: $($files.Count)"
Write-Output "Read-only enabled on: $readonlyCount"
Write-Output "ACL deny is intentionally NOT used (to keep npm run dev working)."
Write-Output "Dev server should run; protected files stay read-only + editor warns on edit."
