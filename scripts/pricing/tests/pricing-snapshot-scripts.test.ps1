[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$scriptDirectory = Split-Path -Parent $PSScriptRoot
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
Import-Module (Join-Path $scriptDirectory 'PricingSnapshot.Common.psm1') -Force

$script:Passed = 0
$script:Failed = 0

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) {
        throw $Message
    }
}

function Assert-ThrowsLike {
    param([scriptblock]$Action, [string]$Pattern)
    try {
        & $Action
    }
    catch {
        if ($_.Exception.Message -notlike $Pattern) {
            throw "Expected error like '$Pattern', received '$($_.Exception.Message)'."
        }
        return
    }
    throw "Expected an error like '$Pattern', but no error was raised."
}

function Invoke-Test {
    param([string]$Name, [scriptblock]$Action)
    try {
        & $Action
        $script:Passed += 1
        Write-Output "PASS $Name"
    }
    catch {
        $script:Failed += 1
        Write-Output "FAIL $Name - $($_.Exception.Message)"
    }
}

function New-ValidSqlSnapshotText {
    $blocks = foreach ($table in (Get-PricingSnapshotAllowedTables)) {
        "COPY public.$table (id) FROM stdin;`n\.`n"
    }
    return "-- PostgreSQL data-only snapshot`nSET client_encoding = 'UTF8';`n$($blocks -join '')"
}

$temporaryDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("compra-car-pricing-snapshot-tests-" + [guid]::NewGuid().ToString('N'))
[void](New-Item -ItemType Directory -Path $temporaryDirectory)
try {
    $validSnapshotPath = Join-Path $temporaryDirectory 'authorized.sql'
    [System.IO.File]::WriteAllText($validSnapshotPath, (New-ValidSqlSnapshotText), [System.Text.UTF8Encoding]::new($false))
    $validSha = (Get-FileHash -LiteralPath $validSnapshotPath -Algorithm SHA256).Hash
    $fakeDockerPath = Join-Path $temporaryDirectory 'docker-mock.cmd'
    [System.IO.File]::WriteAllText($fakeDockerPath, @'
@echo off
if "%MOCK_DOCKER_STATE%"=="missing" (
  echo Error: No such container 1>&2
  exit /b 1
)
if "%MOCK_DOCKER_STATE%"=="stopped" (
  echo exited^|healthy^|{}
  exit /b 0
)
if "%MOCK_DOCKER_STATE%"=="unhealthy" (
  echo running^|unhealthy^|{}
  exit /b 0
)
echo running^|healthy^|{"5432/tcp":[{"HostPort":"54322"}]}
'@)
    $fakePsqlPath = Join-Path $temporaryDirectory 'psql-mock.cmd'
    [System.IO.File]::WriteAllText($fakePsqlPath, @'
@echo off
if defined MOCK_PSQL_LOG echo %* > "%MOCK_PSQL_LOG%"
echo pricing_snapshot_reader^|postgres^|on
exit /b 0
'@)
    $fakePgDumpPath = Join-Path $temporaryDirectory 'pg-dump-mock.cmd'
    [System.IO.File]::WriteAllText($fakePgDumpPath, @'
@echo off
setlocal EnableDelayedExpansion
set "outfile="
set "allargs="
set "expectfile="
:loop
if "%~1"=="" goto done
set "arg=%~1"
set "allargs=!allargs! [!arg!]"
if defined expectfile (
  set "outfile=!arg!"
  set "expectfile="
) else if /i "!arg!"=="--file" (
  set "expectfile=1"
) else if /i "!arg:~0,7!"=="--file=" (
  set "outfile=!arg:~7!"
)
shift
goto loop
:done
if defined MOCK_PGDUMP_LOG echo !allargs! > "%MOCK_PGDUMP_LOG%"
if "%MOCK_PGDUMP_FAIL%"=="1" (
  echo simulated pg_dump failure 1>&2
  exit /b 9
)
if not defined outfile (
  echo missing output argument: !allargs! 1>&2
  exit /b 8
)
<nul set /p "=PGDMP" > "!outfile!"
exit /b 0
'@)
    $fakePgRestorePath = Join-Path $temporaryDirectory 'pg-restore-mock.cmd'
    [System.IO.File]::WriteAllText($fakePgRestorePath, @'
@echo off
if "%MOCK_TOC_SEQUENCE%"=="1" echo 99; 0 0 SEQUENCE SET public products_id_seq postgres
echo 1; 0 0 TABLE DATA public products postgres
echo 2; 0 0 TABLE DATA public product_price_offers postgres
echo 3; 0 0 TABLE DATA public price_offer_imports postgres
echo 4; 0 0 TABLE DATA public price_offer_import_rows postgres
echo 5; 0 0 TABLE DATA public price_offers_staging postgres
echo 6; 0 0 TABLE DATA public product_specs postgres
echo 7; 0 0 TABLE DATA public specs postgres
exit /b 0
'@)
    $exportScript = Join-Path $scriptDirectory 'export-pricing-legacy-snapshot.ps1'
    $remoteUrl = 'postgresql://pricing_snapshot_reader:TOP_SECRET_123@allowed.example.com:5432/postgres'

    Invoke-Test 'local psql is found' {
        $executor = Resolve-PsqlExecutor -PsqlPath 'powershell' -DockerPath (Join-Path $temporaryDirectory 'missing-docker.exe')
        Assert-True -Condition ($executor.Mode -eq 'Local' -and $executor.Client -eq 'psql') -Message 'Local psql executor was not selected.'
    }

    Invoke-Test 'local pg_restore is found' {
        $executor = Resolve-PgRestoreExecutor -PgRestorePath 'powershell' -DockerPath (Join-Path $temporaryDirectory 'missing-docker.exe')
        Assert-True -Condition ($executor.Mode -eq 'Local' -and $executor.Client -eq 'pg_restore') -Message 'Local pg_restore executor was not selected.'
    }

    Invoke-Test 'local client has priority over Docker' {
        $env:MOCK_DOCKER_STATE = 'missing'
        $executor = Resolve-PsqlExecutor -PsqlPath 'powershell' -DockerPath $fakeDockerPath
        Assert-True -Condition ($executor.Mode -eq 'Local') -Message 'Docker was selected even though the local client exists.'
    }

    Invoke-Test 'psql falls back to healthy Docker container' {
        $env:MOCK_DOCKER_STATE = 'healthy'
        $executor = Resolve-PsqlExecutor -PsqlPath (Join-Path $temporaryDirectory 'missing-psql.exe') -PostgresContainer 'custom-postgres' -DockerPath $fakeDockerPath
        Assert-True -Condition ($executor.Mode -eq 'Docker' -and $executor.Container -eq 'custom-postgres') -Message 'Docker fallback did not preserve the configured container.'
        Assert-True -Condition ($executor.PortMappings[0].HostPort -eq 54322 -and $executor.PortMappings[0].ContainerPort -eq 5432) -Message 'Docker fallback did not resolve the published PostgreSQL port.'
    }

    Invoke-Test 'pg_restore falls back to healthy Docker container' {
        $env:MOCK_DOCKER_STATE = 'healthy'
        $executor = Resolve-PgRestoreExecutor -PgRestorePath (Join-Path $temporaryDirectory 'missing-pg-restore.exe') -PostgresContainer 'custom-postgres' -DockerPath $fakeDockerPath
        Assert-True -Condition ($executor.Mode -eq 'Docker' -and $executor.Client -eq 'pg_restore') -Message 'pg_restore did not select Docker fallback.'
    }

    Invoke-Test 'missing Docker is reported after local client lookup fails' {
        Assert-ThrowsLike -Pattern '*Docker is not available*' -Action {
            Resolve-PsqlExecutor -PsqlPath (Join-Path $temporaryDirectory 'missing-psql.exe') -DockerPath (Join-Path $temporaryDirectory 'missing-docker.exe')
        }
    }

    Invoke-Test 'missing PostgreSQL container is rejected' {
        $env:MOCK_DOCKER_STATE = 'missing'
        Assert-ThrowsLike -Pattern '*container does not exist*' -Action {
            Resolve-PsqlExecutor -PsqlPath (Join-Path $temporaryDirectory 'missing-psql.exe') -DockerPath $fakeDockerPath
        }
    }

    Invoke-Test 'unhealthy PostgreSQL container is rejected' {
        $env:MOCK_DOCKER_STATE = 'unhealthy'
        Assert-ThrowsLike -Pattern '*container is not healthy*' -Action {
            Resolve-PgRestoreExecutor -PgRestorePath (Join-Path $temporaryDirectory 'missing-pg-restore.exe') -DockerPath $fakeDockerPath
        }
    }

    Invoke-Test 'stopped PostgreSQL container is rejected' {
        $env:MOCK_DOCKER_STATE = 'stopped'
        Assert-ThrowsLike -Pattern '*container is not running*' -Action {
            Resolve-PsqlExecutor -PsqlPath (Join-Path $temporaryDirectory 'missing-psql.exe') -DockerPath $fakeDockerPath
        }
    }

    Invoke-Test 'export requires DatabaseUrl' {
        Assert-ThrowsLike -Pattern '*DatabaseUrl*' -Action {
            & $exportScript
        }
    }

    Invoke-Test 'remote export rejects localhost' {
        Assert-ThrowsLike -Pattern '*localhost is not allowed*' -Action {
            Get-RemotePricingSnapshotSource -DatabaseUrl 'postgresql://reader:secret@localhost:5432/postgres'
        }
    }

    Invoke-Test 'remote export rejects host outside allowlist' {
        Assert-ThrowsLike -Pattern '*not in AllowRemoteHost*' -Action {
            Get-RemotePricingSnapshotSource -DatabaseUrl $remoteUrl -AllowRemoteHost @('different.example.com')
        }
    }

    Invoke-Test 'remote export accepts authorized host without retaining URL' {
        $source = Get-RemotePricingSnapshotSource -DatabaseUrl $remoteUrl -AllowRemoteHost @('allowed.example.com')
        Assert-True -Condition ($source.Host -eq 'allowed.example.com' -and $source.UserName -eq 'pricing_snapshot_reader') -Message 'Authorized remote source was not parsed.'
        Assert-True -Condition ($source.PSObject.Properties.Name -notcontains 'ConnectionString') -Message 'Remote source retained the connection string.'
    }

    Invoke-Test 'remote export requires explicit confirmation and creates output directory' {
        $outputDirectory = Join-Path $temporaryDirectory 'confirmation-required'
        Assert-ThrowsLike -Pattern '*ConfirmRemoteExport*' -Action {
            & $exportScript -DatabaseUrl $remoteUrl -OutputDirectory $outputDirectory -AllowRemoteHost @('allowed.example.com')
        }
        Assert-True -Condition (Test-Path -LiteralPath $outputDirectory -PathType Container) -Message 'Validated output directory was not created.'
    }

    Invoke-Test 'pg_dump plan contains only allowlisted tables and excludes sequences' {
        $source = Get-RemotePricingSnapshotSource -DatabaseUrl $remoteUrl
        $plan = New-PricingSnapshotExportPlan -Source $source -OutputPath (Join-Path $temporaryDirectory 'plan.dump')
        $arguments = $plan.Arguments -join ' '
        Assert-True -Condition (($plan.Tables.Count -eq 7) -and (($plan.Arguments | Where-Object { $_ -like '--table=*' }).Count -eq 7)) -Message 'Export plan does not contain exactly seven allowlisted tables.'
        Assert-True -Condition ($arguments -match '--format=custom' -and $arguments -match '--data-only' -and $arguments -match '--exclude-table-data=public\.\*_seq') -Message 'Export plan lacks custom/data-only/sequence exclusion flags.'
        Assert-True -Condition ($arguments -notmatch 'profiles|auth\.|storage\.|--schema-only|--create|--clean') -Message 'Export plan contains an unauthorized object or option.'
    }

    Invoke-Test 'SEQUENCE SET is rejected explicitly' {
        Assert-ThrowsLike -Pattern '*contains SEQUENCE SET*' -Action {
            Assert-NoPricingSnapshotSequenceSet -TocText '99; 0 0 SEQUENCE SET public products_id_seq postgres'
        }
    }

    Invoke-Test 'pg_dump uses local client before Docker' {
        $executor = Resolve-PgDumpExecutor -PgDumpPath $fakePgDumpPath -DockerPath (Join-Path $temporaryDirectory 'missing-docker.exe')
        Assert-True -Condition ($executor.Mode -eq 'Local' -and $executor.Client -eq 'pg_dump') -Message 'Local pg_dump executor was not selected.'
    }

    Invoke-Test 'pg_dump falls back to configured Docker image' {
        $executor = Resolve-PgDumpExecutor -PgDumpPath (Join-Path $temporaryDirectory 'missing-pg-dump.exe') -PostgresImage 'postgres:17' -DockerPath $fakeDockerPath
        Assert-True -Condition ($executor.Mode -eq 'DockerRun' -and $executor.Image -eq 'postgres:17') -Message 'pg_dump Docker fallback was not selected.'
    }

    Invoke-Test 'official export publishes validated snapshot and sanitized manifest' {
        $exportDirectory = Join-Path $temporaryDirectory 'official-export'
        $env:MOCK_PGDUMP_LOG = Join-Path $temporaryDirectory 'pg-dump-arguments.log'
        $env:MOCK_PSQL_LOG = Join-Path $temporaryDirectory 'psql-arguments.log'
        $output = & $exportScript `
            -DatabaseUrl $remoteUrl `
            -OutputDirectory $exportDirectory `
            -AllowRemoteHost @('allowed.example.com') `
            -ConfirmRemoteExport `
            -PsqlPath $fakePsqlPath `
            -PgDumpPath $fakePgDumpPath `
            -PgRestorePath $fakePgRestorePath 6>&1 3>&1
        $snapshotPath = Join-Path $exportDirectory 'legacy-pricing.dump'
        $manifestPath = Join-Path $exportDirectory 'legacy-pricing.manifest.json'
        $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
        $actualSha = (Get-FileHash -LiteralPath $snapshotPath -Algorithm SHA256).Hash.ToLowerInvariant()
        $allOutput = $output -join [Environment]::NewLine
        $dumpArguments = Get-Content -LiteralPath $env:MOCK_PGDUMP_LOG -Raw
        $psqlArguments = Get-Content -LiteralPath $env:MOCK_PSQL_LOG -Raw

        Assert-True -Condition (Test-Path -LiteralPath $snapshotPath -PathType Leaf) -Message 'Validated snapshot was not published.'
        Assert-True -Condition ($manifest.sha256 -eq $actualSha -and $manifest.status -eq 'VALIDATED' -and $manifest.format -eq 'postgres-custom') -Message 'Manifest hash or validation contract is incorrect.'
        Assert-True -Condition ($manifest.tables.Count -eq 7 -and $manifest.source.host -eq 'allowed.example.com' -and $manifest.tooling.pgDumpMode -eq 'local') -Message 'Manifest does not contain the expected sanitized export metadata.'
        Assert-True -Condition (($manifest | ConvertTo-Json -Depth 8) -notmatch 'TOP_SECRET_123|postgresql://|PGPASSWORD') -Message 'Manifest leaked a credential or connection string.'
        Assert-True -Condition ($allOutput -notmatch 'TOP_SECRET_123|postgresql://') -Message 'Export output leaked a credential or connection string.'
        Assert-True -Condition ($dumpArguments -match '\.tmp\.dump' -and $dumpArguments -match '--exclude-table-data.*public\.\*_seq') -Message 'Export did not use a temporary dump with sequence exclusion.'
        Assert-True -Condition ($dumpArguments -notmatch 'TOP_SECRET_123|postgresql://' -and $psqlArguments -notmatch 'TOP_SECRET_123|postgresql://') -Message 'A child process received the connection string or password as an argument.'
        Assert-True -Condition ($psqlArguments -match 'BEGIN TRANSACTION READ ONLY' -and $psqlArguments -notmatch '\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE)\b') -Message 'Remote preflight was not strictly read-only.'
        Assert-True -Condition ($dumpArguments -notmatch 'restore|pricing:dry-run') -Message 'Export invoked a restore or pricing dry-run command.'
    }

    Invoke-Test 'existing snapshot aborts without Force' {
        $exportDirectory = Join-Path $temporaryDirectory 'official-export'
        Assert-ThrowsLike -Pattern '*already exists*' -Action {
            & $exportScript -DatabaseUrl $remoteUrl -OutputDirectory $exportDirectory -AllowRemoteHost @('allowed.example.com') -ConfirmRemoteExport -PsqlPath $fakePsqlPath -PgDumpPath $fakePgDumpPath -PgRestorePath $fakePgRestorePath
        }
    }

    Invoke-Test 'Force replaces snapshot only after another successful validation' {
        $exportDirectory = Join-Path $temporaryDirectory 'official-export'
        $output = & $exportScript -DatabaseUrl $remoteUrl -OutputDirectory $exportDirectory -AllowRemoteHost @('allowed.example.com') -ConfirmRemoteExport -Force -PsqlPath $fakePsqlPath -PgDumpPath $fakePgDumpPath -PgRestorePath $fakePgRestorePath 6>&1
        $manifest = Get-Content -LiteralPath (Join-Path $exportDirectory 'legacy-pricing.manifest.json') -Raw | ConvertFrom-Json
        Assert-True -Condition (($output -join [Environment]::NewLine) -match 'Snapshot exportado e validado') -Message 'Forced export did not complete validation and publication.'
        Assert-True -Condition ($manifest.status -eq 'VALIDATED') -Message 'Forced export did not publish a validated manifest.'
    }

    Invoke-Test 'failed forced export preserves previous snapshot and removes temporary file' {
        $exportDirectory = Join-Path $temporaryDirectory 'official-export'
        $snapshotPath = Join-Path $exportDirectory 'legacy-pricing.dump'
        $previousSha = (Get-FileHash -LiteralPath $snapshotPath -Algorithm SHA256).Hash
        $env:MOCK_PGDUMP_FAIL = '1'
        try {
            Assert-ThrowsLike -Pattern '*pg_dump failed*' -Action {
                & $exportScript -DatabaseUrl $remoteUrl -OutputDirectory $exportDirectory -AllowRemoteHost @('allowed.example.com') -ConfirmRemoteExport -Force -PsqlPath $fakePsqlPath -PgDumpPath $fakePgDumpPath -PgRestorePath $fakePgRestorePath
            }
        }
        finally {
            $env:MOCK_PGDUMP_FAIL = $null
        }
        $currentSha = (Get-FileHash -LiteralPath $snapshotPath -Algorithm SHA256).Hash
        $temporaryFiles = @(Get-ChildItem -LiteralPath $exportDirectory -Filter '*.tmp.*' -File -Force)
        Assert-True -Condition ($currentSha -eq $previousSha) -Message 'Failed export replaced the previous validated snapshot.'
        Assert-True -Condition ($temporaryFiles.Count -eq 0) -Message 'Failed export left temporary files behind.'
    }

    Invoke-Test 'missing file is rejected' {
        Assert-ThrowsLike -Pattern '*does not exist*' -Action {
            Get-ValidatedPricingSnapshot -SnapshotPath (Join-Path $temporaryDirectory 'missing.sql') -AllowedSnapshotDirectory $temporaryDirectory -ExpectedSha256 ('0' * 64)
        }
    }

    Invoke-Test 'SHA mismatch is rejected' {
        Assert-ThrowsLike -Pattern '*SHA256 does not match*' -Action {
            Get-ValidatedPricingSnapshot -SnapshotPath $validSnapshotPath -AllowedSnapshotDirectory $temporaryDirectory -ExpectedSha256 ('0' * 64)
        }
    }

    Invoke-Test 'table outside allowlist is rejected' {
        $path = Join-Path $temporaryDirectory 'unexpected-table.sql'
        [System.IO.File]::WriteAllText($path, ((New-ValidSqlSnapshotText) + "COPY public.profiles (id) FROM stdin;`n\.`n"))
        $sha = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
        Assert-ThrowsLike -Pattern '*outside the allowlist*' -Action {
            Get-ValidatedPricingSnapshot -SnapshotPath $path -AllowedSnapshotDirectory $temporaryDirectory -ExpectedSha256 $sha
        }
    }

    Invoke-Test 'DROP is rejected' {
        $path = Join-Path $temporaryDirectory 'drop.sql'
        [System.IO.File]::WriteAllText($path, ("DROP TABLE public.products;`n" + (New-ValidSqlSnapshotText)))
        $sha = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
        Assert-ThrowsLike -Pattern '*prohibited content: DROP*' -Action {
            Get-ValidatedPricingSnapshot -SnapshotPath $path -AllowedSnapshotDirectory $temporaryDirectory -ExpectedSha256 $sha
        }
    }

    Invoke-Test 'remote host is rejected' {
        Assert-ThrowsLike -Pattern '*Remote database hosts are disabled*' -Action {
            Get-LocalDatabaseTarget -DatabaseUrl 'postgresql://postgres:secret@example.supabase.com:54322/postgres'
        }
    }

    Invoke-Test 'wrong local port is rejected' {
        Assert-ThrowsLike -Pattern '*must target the configured local Supabase port 54322*' -Action {
            Get-LocalDatabaseTarget -DatabaseUrl 'postgresql://postgres:secret@127.0.0.1:5432/postgres'
        }
    }

    Invoke-Test 'restore without explicit confirmation is blocked' {
        $restoreScript = Join-Path $scriptDirectory 'restore-pricing-legacy-snapshot-local.ps1'
        Assert-ThrowsLike -Pattern '*ConfirmLocalRestore*' -Action {
            & $restoreScript -SnapshotPath $validSnapshotPath -AllowedSnapshotDirectory $temporaryDirectory -ExpectedSha256 $validSha -DatabaseUrl 'postgresql://postgres:secret@127.0.0.1:54322/postgres'
        }
    }

    Invoke-Test 'confirmed restore produces safe plan under WhatIf' {
        $restoreScript = Join-Path $scriptDirectory 'restore-pricing-legacy-snapshot-local.ps1'
        $output = & $restoreScript -SnapshotPath $validSnapshotPath -AllowedSnapshotDirectory $temporaryDirectory -ExpectedSha256 $validSha -DatabaseUrl 'postgresql://postgres:secret@127.0.0.1:54322/postgres' -ConfirmLocalRestore -WhatIf 3>&1
        Assert-True -Condition (($output -join "`n") -match 'PLANNED_ONLY') -Message 'Restore did not return PLANNED_ONLY under WhatIf.'
        Assert-True -Condition (($output -join "`n") -notmatch 'secret') -Message 'Restore plan leaked the password.'
    }

    Invoke-Test 'restore plan is data-only and has no dangerous options' {
        $snapshot = Get-ValidatedPricingSnapshot -SnapshotPath $validSnapshotPath -AllowedSnapshotDirectory $temporaryDirectory -ExpectedSha256 $validSha
        $target = Get-LocalDatabaseTarget -DatabaseUrl 'postgresql://postgres:secret@localhost:54322/postgres'
        $plan = New-LocalRestorePlan -Snapshot $snapshot -Target $target
        $arguments = $plan.Arguments -join ' '
        Assert-True -Condition ($arguments -match '--single-transaction') -Message 'Single transaction is required.'
        Assert-True -Condition ($arguments -notmatch '--clean|--create|--if-exists|postgresql://') -Message 'Restore plan contains a dangerous option or URL.'
    }

    Invoke-Test 'pricing dry-run executes against a fixture' {
        $fixture = Join-Path $repositoryRoot 'packages\pricing-dry-run\test\fixtures\legacy-snapshot.json'
        $reportRoot = Join-Path $temporaryDirectory 'dry-run-fixture'
        Push-Location $repositoryRoot
        try {
            $output = & pnpm pricing:dry-run -- --fixture $fixture --output-dir $reportRoot --algorithm-version snapshot-test --cutoff-date 2026-07-25 --exclude-executed-at-from-hash --verbose 2>&1
            if ($LASTEXITCODE -ne 0) {
                throw "Fixture dry-run failed: $($output -join ' ')"
            }
        }
        finally {
            Pop-Location
        }
        $summaries = @(Get-ChildItem -LiteralPath $reportRoot -Filter summary.json -File -Recurse)
        Assert-True -Condition ($summaries.Count -eq 1) -Message 'Dry-run did not create exactly one summary.'
    }

    Invoke-Test 'manifest is sanitized and complete' {
        $summaryFile = Get-ChildItem -LiteralPath (Join-Path $temporaryDirectory 'dry-run-fixture') -Filter summary.json -File -Recurse | Select-Object -First 1
        $dryRun = [pscustomobject]@{
            Summary = (Get-Content -LiteralPath $summaryFile.FullName -Raw | ConvertFrom-Json)
            ReportDirectory = $summaryFile.Directory.FullName
        }
        $snapshot = Get-ValidatedPricingSnapshot -SnapshotPath $validSnapshotPath -AllowedSnapshotDirectory $temporaryDirectory -ExpectedSha256 $validSha
        $target = Get-LocalDatabaseTarget -DatabaseUrl 'postgresql://postgres:secret@127.0.0.1:54322/postgres'
        $manifest = New-PricingSnapshotManifest -Snapshot $snapshot -Target $target -DryRun $dryRun -AlgorithmVersion 'snapshot-test' -CutoffDate '2026-07-25' -Timestamp '2026-07-25T23:00:00Z'
        $json = $manifest | ConvertTo-Json -Depth 12
        $expectedManifestKeys = 'timestamp,snapshotSha256,snapshotSizeBytes,snapshotFormat,algorithmVersion,cutoffDate,localDatabase,counts,dryRunResult,comparisonHash,finalStatus'
        Assert-True -Condition (($manifest.Keys -join ',') -eq $expectedManifestKeys) -Message 'Manifest contract changed.'
        Assert-True -Condition ($json -match 'comparisonHash') -Message 'Manifest has no comparison hash.'
        Assert-True -Condition ($json -match '127.0.0.1:54322/postgres') -Message 'Manifest has no sanitized local identity.'
        Assert-True -Condition ($json -notmatch 'secret|postgresql://') -Message 'Manifest leaked credentials or a connection string.'
    }
}
finally {
    $env:MOCK_DOCKER_STATE = $null
    $env:MOCK_PGDUMP_FAIL = $null
    $env:MOCK_PGDUMP_LOG = $null
    $env:MOCK_PSQL_LOG = $null
    $env:MOCK_TOC_SEQUENCE = $null
    if (Test-Path -LiteralPath $temporaryDirectory) {
        [System.GC]::Collect()
        [System.GC]::WaitForPendingFinalizers()
        Remove-Item -LiteralPath $temporaryDirectory -Recurse -Force
    }
}

Write-Output "Pricing snapshot PowerShell tests: $script:Passed passed, $script:Failed failed."
if ($script:Failed -gt 0) {
    exit 1
}
