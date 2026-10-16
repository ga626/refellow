$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$runtimeFile = Join-Path $projectRoot 'local/runtime/server.json'
if (-not (Test-Path -LiteralPath $runtimeFile)) { throw 'No runtime receipt; refusing to stop an unknown process.' }
$receipt = Get-Content -LiteralPath $runtimeFile -Raw -Encoding UTF8 | ConvertFrom-Json
$listeners = @(Get-NetTCPConnection -LocalPort 5192 -State Listen -ErrorAction SilentlyContinue)
if (-not $listeners.Count) { Write-Output 'Server is already stopped.'; exit 0 }
$health = Invoke-RestMethod -Uri 'http://127.0.0.1:5192/health' -TimeoutSec 3
$processInfo = Get-CimInstance Win32_Process -Filter ('ProcessId = ' + $receipt.pid)
$serverPath = Join-Path $projectRoot 'server.mjs'
if ($receipt.projectRoot -ne $projectRoot -or $health.projectRoot -ne $projectRoot -or $health.service -ne 'refellow' -or $health.pid -ne $receipt.pid -or $receipt.pid -notin $listeners.OwningProcess -or -not $processInfo.CommandLine.Contains($serverPath)) { throw 'Process identity mismatch; no process was stopped.' }
Stop-Process -Id $receipt.pid -ErrorAction Stop
$receipt.status = 'stopped'
$receipt.observedAt = [DateTime]::UtcNow.ToString('o')
[IO.File]::WriteAllText($runtimeFile, ($receipt | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
Write-Output 'Stopped the verified Refellow local server.'
