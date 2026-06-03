param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string]$Passcode = ""
)

$ErrorActionPreference = "Stop"

$SaltBase64 = "i8rd/AhrrcPs02K9Pg/6lw=="
$HashBase64 = "G143Wbh/6C3ptjYoJsNwQHAwyAPva+MZ5wWQyiN4sps="
$Iterations = 120000

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

function Normalize-Passcode {
  param(
    [string]$Value
  )

  $clean = ($Value ?? "").Trim()
  if ($clean.Length -ge 2 -and $clean.StartsWith('"') -and $clean.EndsWith('"')) {
    $clean = $clean.Substring(1, $clean.Length - 2)
  }
  if ($clean.Length -ge 2 -and $clean.StartsWith("'") -and $clean.EndsWith("'")) {
    $clean = $clean.Substring(1, $clean.Length - 2)
  }
  return $clean
}

function Test-Passcode {
  param(
    [string]$Candidate
  )

  $salt = [Convert]::FromBase64String($SaltBase64)
  $expected = [Convert]::FromBase64String($HashBase64)

  $derive = [System.Security.Cryptography.Rfc2898DeriveBytes]::new(
    $Candidate,
    $salt,
    $Iterations,
    [System.Security.Cryptography.HashAlgorithmName]::SHA256
  )

  try {
    $actual = $derive.GetBytes($expected.Length)
    return [System.Security.Cryptography.CryptographicOperations]::FixedTimeEquals($actual, $expected)
  }
  finally {
    $derive.Dispose()
  }
}

function Disable-VSCodeReadonlyWarning {
  param(
    [string]$ProjectRoot
  )

  $settingsPath = Join-Path (Join-Path $ProjectRoot ".vscode") "settings.json"
  if (-not (Test-Path $settingsPath)) {
    return
  }

  (Get-Item $settingsPath).IsReadOnly = $false

  try {
    $settings = Get-Content -Path $settingsPath -Raw | ConvertFrom-Json -AsHashtable
  }
  catch {
    return
  }

  if ($settings.ContainsKey("files.readonlyInclude")) {
    $settings.Remove("files.readonlyInclude") | Out-Null
  }
  if ($settings.ContainsKey("files.readonlyExclude")) {
    $settings.Remove("files.readonlyExclude") | Out-Null
  }

  $settings | ConvertTo-Json -Depth 20 | Set-Content -Path $settingsPath -Encoding UTF8
}

if ([string]::IsNullOrWhiteSpace($Passcode)) {
  $Passcode = Read-Host "Enter passcode to unlock project files (visible)"
}

$normalizedPasscode = Normalize-Passcode -Value $Passcode

if (-not (Test-Passcode -Candidate $normalizedPasscode)) {
  throw "Incorrect passcode. Files remain locked."
}

$files = Get-ProtectedFiles -ProjectRoot $Root
$readonlyRemoved = 0

foreach ($file in $files) {
  if ($file.IsReadOnly) {
    $file.IsReadOnly = $false
    $readonlyRemoved++
  }
}

Disable-VSCodeReadonlyWarning -ProjectRoot $Root

Write-Output "Project unlocked."
Write-Output "Protected files processed: $($files.Count)"
Write-Output "Read-only removed from: $readonlyRemoved"
Write-Output "ACL deny is not used in this mode (keeps npm run dev working)."
