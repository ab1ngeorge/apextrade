param(
    [string]$Bin = 'C:\Program Files\PostgreSQL\18\bin',
    [ValidateSet('start', 'stop', 'status')][string]$Action = 'start'
)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$runtimeRoot = Join-Path $projectRoot '.runtime'
$dataRoot = Join-Path $runtimeRoot 'pgdata'
$pgCtl = Join-Path $Bin 'pg_ctl.exe'
if (!(Test-Path -LiteralPath $pgCtl)) { throw "PostgreSQL binaries not found at $Bin" }
if ($Action -eq 'status') { & $pgCtl -D $dataRoot status; exit $LASTEXITCODE }
if ($Action -eq 'stop') { & $pgCtl -D $dataRoot -m fast -w stop; exit $LASTEXITCODE }
New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
$envFile = Join-Path $projectRoot '.env'
$passwordFile = Join-Path $runtimeRoot 'pg-password'
if (!(Test-Path -LiteralPath (Join-Path $dataRoot 'PG_VERSION'))) {
    if (Test-Path -LiteralPath $dataRoot) { throw 'Partial cluster exists. Inspect it manually; this script never deletes database files.' }
    if (Test-Path -LiteralPath $envFile) { throw 'Existing .env preserved. Configure the isolated local database manually, or use an existing database.' }
    $bytes = New-Object byte[] 32
    $random = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $random.GetBytes($bytes) } finally { $random.Dispose() }
    $password = [Convert]::ToBase64String($bytes).Replace('+','x').Replace('/','y').TrimEnd('=')
    [IO.File]::WriteAllText($passwordFile, $password)
    & (Join-Path $Bin 'initdb.exe') -D $dataRoot --username=apex --auth-host=scram-sha-256 --auth-local=scram-sha-256 --encoding=UTF8 --locale=C --pwfile=$passwordFile
    if ($LASTEXITCODE -ne 0) { throw 'initdb failed; existing files were preserved for diagnosis.' }
    $config = Get-Content -LiteralPath (Join-Path $projectRoot '.env.example') -Raw
    $config = $config.Replace('apex_local_only@localhost:5432', ($password + '@127.0.0.1:55432'))
    [IO.File]::WriteAllText($envFile, $config)
}
& $pgCtl -D $dataRoot status | Out-Null
if ($LASTEXITCODE -ne 0) {
    & $pgCtl -D $dataRoot -l (Join-Path $runtimeRoot 'postgres.log') -o '-h 127.0.0.1 -p 55432' -w start
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL failed to start. Inspect .runtime/postgres.log.' }
}
$oldPassword = $env:PGPASSWORD
try {
    $env:PGPASSWORD = [IO.File]::ReadAllText($passwordFile)
    foreach ($database in @('apextrade', 'apextrade_test')) {
        $found = & (Join-Path $Bin 'psql.exe') -h 127.0.0.1 -p 55432 -U apex -d postgres -w -tAc "SELECT 1 FROM pg_database WHERE datname='$database'"
        if ($LASTEXITCODE -ne 0) { throw 'Could not authenticate to the isolated PostgreSQL cluster.' }
        if ($found -ne '1') {
            & (Join-Path $Bin 'createdb.exe') -h 127.0.0.1 -p 55432 -U apex -w $database
            if ($LASTEXITCODE -ne 0) { throw "Could not create $database" }
        }
    }
} finally { $env:PGPASSWORD = $oldPassword }
Write-Output 'Isolated PostgreSQL ready at 127.0.0.1:55432. Credentials stored only in ignored local files.'
