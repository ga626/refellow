param([switch]$Background)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$serverPath = Join-Path $projectRoot 'server.mjs'
$localPort = 5192
$healthUrl = 'http://127.0.0.1:5192/health'
$nodeExecutable = (Get-Command node -ErrorAction Stop).Source
$runtimeDirectory = Join-Path $projectRoot 'local/runtime'
New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
function Read-ProjectHealth {
  try { return Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2 } catch { return $null }
}
function Write-RunningReceipt($health) {
  $receipt = [PSCustomObject]@{schema='refellow-local-runtime/v1';status='running';projectRoot=$projectRoot;pid=$health.pid;port=$localPort;url='http://127.0.0.1:5192/#collector';observedAt=[DateTime]::UtcNow.ToString('o')}
  [IO.File]::WriteAllText((Join-Path $runtimeDirectory 'server.json'), ($receipt | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
  $receipt | ConvertTo-Json -Compress
}
$existingListener = @(Get-NetTCPConnection -LocalPort $localPort -State Listen -ErrorAction SilentlyContinue)
if ($existingListener.Count) {
  $health = Read-ProjectHealth
  if (-not $health -or $health.service -ne 'refellow' -or $health.projectRoot -ne $projectRoot -or $health.pid -notin $existingListener.OwningProcess) { throw 'Port 5192 belongs to a different or unverified process; no process was stopped.' }
  Write-RunningReceipt $health
  exit 0
}
$previousPort = $env:PORT
$env:PORT = [string]$localPort
try {
  if (-not $Background) {
    & $nodeExecutable $serverPath
    $nodeExit = $LASTEXITCODE
    exit $nodeExit
  }
  $serverProcess = Start-Process -FilePath $nodeExecutable -ArgumentList ('"' + $serverPath + '"') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeDirectory 'server.stdout.log') -RedirectStandardError (Join-Path $runtimeDirectory 'server.stderr.log') -PassThru
} finally { $env:PORT = $previousPort }
$verified = $false
for ($attempt=0; $attempt -lt 30; $attempt++) {
  if ($serverProcess.HasExited) { throw 'Server exited early; inspect local/runtime/server.stderr.log.' }
  $health = Read-ProjectHealth
  if ($health -and $health.service -eq 'refellow' -and $health.projectRoot -eq $projectRoot -and $health.pid -eq $serverProcess.Id) { $verified = $true; break }
  Start-Sleep -Milliseconds 100
}
if (-not $verified) {
  if (-not $serverProcess.HasExited) { Stop-Process -Id $serverProcess.Id }
  throw 'Newly started server did not pass identity verification.'
}
Write-RunningReceipt $health
