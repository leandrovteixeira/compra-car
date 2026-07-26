[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$DatabaseUrl,
    [string]$OutputDirectory = '.local-snapshots/pricing',
    [string]$SnapshotFileName = 'legacy-pricing.dump',
    [string]$PostgresImage = 'postgres:17',
    [string]$PostgresContainer = 'supabase_db_compra-car',
    [long]$MaximumBytes = 1073741824,
    [string[]]$AllowRemoteHost = @(),
    [switch]$ConfirmRemoteExport,
    [switch]$Force,
    [string]$PsqlPath = 'psql',
    [string]$PgDumpPath = 'pg_dump',
    [string]$PgRestorePath = 'pg_restore',
    [string]$DockerPath = 'docker',
    [string]$ValidatorPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$modulePath = Join-Path $PSScriptRoot 'PricingSnapshot.Common.psm1'
Import-Module $modulePath -Force

if ($MaximumBytes -le 0) {
    throw 'MaximumBytes must be greater than zero.'
}
if ([string]::IsNullOrWhiteSpace($SnapshotFileName) -or
    [System.IO.Path]::IsPathRooted($SnapshotFileName) -or
    [System.IO.Path]::GetFileName($SnapshotFileName) -ne $SnapshotFileName -or
    [System.IO.Path]::GetExtension($SnapshotFileName).ToLowerInvariant() -notin @('.dump', '.backup')) {
    throw 'SnapshotFileName must be a leaf file name ending in .dump or .backup.'
}
if ([string]::IsNullOrWhiteSpace($ValidatorPath)) {
    $ValidatorPath = Join-Path $PSScriptRoot 'validate-pricing-legacy-snapshot.ps1'
}
if (-not (Test-Path -LiteralPath $ValidatorPath -PathType Leaf)) {
    throw 'The existing pricing snapshot validator could not be found.'
}

$source = $null
$temporarySnapshotPath = $null
$temporaryManifestPath = $null
$backupSnapshotPath = $null
$backupManifestPath = $null
try {
    $source = Get-RemotePricingSnapshotSource -DatabaseUrl $DatabaseUrl -AllowRemoteHost $AllowRemoteHost
    $resolvedOutputDirectory = Resolve-PricingSnapshotOutputDirectory -OutputDirectory $OutputDirectory
    $snapshotPath = Join-Path $resolvedOutputDirectory $SnapshotFileName
    $manifestFileName = [System.IO.Path]::GetFileNameWithoutExtension($SnapshotFileName) + '.manifest.json'
    $manifestPath = Join-Path $resolvedOutputDirectory $manifestFileName

    if (-not $Force.IsPresent -and ((Test-Path -LiteralPath $snapshotPath) -or (Test-Path -LiteralPath $manifestPath))) {
        throw 'Snapshot or manifest already exists. Supply -Force to replace it after successful validation.'
    }

    $tables = @(Get-PricingSnapshotAllowedTables | ForEach-Object { "public.$_" })
    Write-Output 'Exportação remota de snapshot de pricing:'
    Write-Output "Host: $($source.Host)"
    Write-Output "Porta: $($source.Port)"
    Write-Output "Database: $($source.Database)"
    Write-Output "User: $($source.UserName)"
    Write-Output "Diretório: $resolvedOutputDirectory"
    Write-Output "Arquivo: $snapshotPath"
    Write-Output "Tabelas: $($tables -join ', ')"

    if (-not $ConfirmRemoteExport.IsPresent) {
        throw 'Remote export is blocked unless -ConfirmRemoteExport is supplied explicitly.'
    }

    $psqlExecutor = Resolve-RemotePsqlExecutor -PsqlPath $PsqlPath -PostgresImage $PostgresImage -DockerPath $DockerPath
    $pgDumpExecutor = Resolve-PgDumpExecutor -PgDumpPath $PgDumpPath -PostgresImage $PostgresImage -DockerPath $DockerPath
    [void](Test-RemotePricingSnapshotConnection -Source $source -Executor $psqlExecutor)

    $temporaryId = [guid]::NewGuid().ToString('N')
    $temporarySnapshotPath = Join-Path $resolvedOutputDirectory ('.{0}.{1}.tmp.dump' -f [System.IO.Path]::GetFileNameWithoutExtension($SnapshotFileName), $temporaryId)
    $temporaryManifestPath = Join-Path $resolvedOutputDirectory ('.{0}.{1}.tmp.manifest.json' -f [System.IO.Path]::GetFileNameWithoutExtension($SnapshotFileName), $temporaryId)
    $exportPlan = New-PricingSnapshotExportPlan -Source $source -OutputPath $temporarySnapshotPath
    Invoke-PgDump -Executor $pgDumpExecutor -Plan $exportPlan -Password $source.Password

    $toc = Invoke-PgRestoreList -Path $temporarySnapshotPath -PgRestorePath $PgRestorePath -PostgresContainer $PostgresContainer
    Assert-NoPricingSnapshotSequenceSet -TocText $toc
    $sha256 = (Get-FileHash -LiteralPath $temporarySnapshotPath -Algorithm SHA256).Hash.ToLowerInvariant()

    $validationJson = & $ValidatorPath `
        -SnapshotPath $temporarySnapshotPath `
        -AllowedSnapshotDirectory $resolvedOutputDirectory `
        -ExpectedSha256 $sha256 `
        -MaximumBytes $MaximumBytes `
        -PgRestorePath $PgRestorePath `
        -PostgresContainer $PostgresContainer
    $validation = ($validationJson -join [Environment]::NewLine) | ConvertFrom-Json
    if ($validation.status -ne 'VALIDATED' -or $validation.format -ne 'postgres-custom') {
        throw 'The existing validator did not approve the exported PostgreSQL custom snapshot.'
    }
    $validatedSnapshot = [pscustomobject]@{
        SizeBytes = [long]$validation.sizeBytes
        Sha256 = [string]$validation.sha256
        Format = [string]$validation.format
        Tables = @($validation.tables)
        ValidationStatus = [string]$validation.status
    }
    $manifest = New-PricingSnapshotExportManifest `
        -Snapshot $validatedSnapshot `
        -Source $source `
        -PgDumpExecutor $pgDumpExecutor `
        -FileName $SnapshotFileName `
        -PostgresImage $PostgresImage
    [System.IO.File]::WriteAllText(
        $temporaryManifestPath,
        (($manifest | ConvertTo-Json -Depth 8) + [Environment]::NewLine),
        [System.Text.UTF8Encoding]::new($false)
    )

    $snapshotExisted = Test-Path -LiteralPath $snapshotPath
    $manifestExisted = Test-Path -LiteralPath $manifestPath
    $snapshotPublished = $false
    $manifestPublished = $false
    $backupSnapshotPath = Join-Path $resolvedOutputDirectory ('.{0}.{1}.previous.dump' -f [System.IO.Path]::GetFileNameWithoutExtension($SnapshotFileName), $temporaryId)
    $backupManifestPath = Join-Path $resolvedOutputDirectory ('.{0}.{1}.previous.manifest.json' -f [System.IO.Path]::GetFileNameWithoutExtension($SnapshotFileName), $temporaryId)
    try {
        if ($snapshotExisted) {
            Copy-Item -LiteralPath $snapshotPath -Destination $backupSnapshotPath
            Move-Item -LiteralPath $temporarySnapshotPath -Destination $snapshotPath -Force
        }
        else {
            Move-Item -LiteralPath $temporarySnapshotPath -Destination $snapshotPath
        }
        $temporarySnapshotPath = $null
        $snapshotPublished = $true

        if ($manifestExisted) {
            Copy-Item -LiteralPath $manifestPath -Destination $backupManifestPath
            Move-Item -LiteralPath $temporaryManifestPath -Destination $manifestPath -Force
        }
        else {
            Move-Item -LiteralPath $temporaryManifestPath -Destination $manifestPath
        }
        $temporaryManifestPath = $null
        $manifestPublished = $true
    }
    catch {
        if ($manifestPublished) {
            Remove-Item -LiteralPath $manifestPath -Force
        }
        if ($manifestExisted -and (Test-Path -LiteralPath $backupManifestPath)) {
            Move-Item -LiteralPath $backupManifestPath -Destination $manifestPath -Force
        }
        if ($snapshotPublished) {
            Remove-Item -LiteralPath $snapshotPath -Force
        }
        if ($snapshotExisted -and (Test-Path -LiteralPath $backupSnapshotPath)) {
            Move-Item -LiteralPath $backupSnapshotPath -Destination $snapshotPath -Force
        }
        throw
    }
    if (Test-Path -LiteralPath $backupSnapshotPath) {
        Remove-Item -LiteralPath $backupSnapshotPath -Force
    }
    if (Test-Path -LiteralPath $backupManifestPath) {
        Remove-Item -LiteralPath $backupManifestPath -Force
    }

    Write-Output 'Snapshot exportado e validado.'
    Write-Output "Arquivo: $snapshotPath"
    Write-Output "Manifesto: $manifestPath"
    Write-Output "SHA-256: $sha256"
    Write-Output "Tabelas: $($validation.tables.Count)"
    Write-Output 'Status: VALIDATED'
}
finally {
    if ($null -ne $temporarySnapshotPath -and (Test-Path -LiteralPath $temporarySnapshotPath)) {
        Remove-Item -LiteralPath $temporarySnapshotPath -Force
    }
    if ($null -ne $temporaryManifestPath -and (Test-Path -LiteralPath $temporaryManifestPath)) {
        Remove-Item -LiteralPath $temporaryManifestPath -Force
    }
    if ($null -ne $backupSnapshotPath -and (Test-Path -LiteralPath $backupSnapshotPath)) {
        Remove-Item -LiteralPath $backupSnapshotPath -Force
    }
    if ($null -ne $backupManifestPath -and (Test-Path -LiteralPath $backupManifestPath)) {
        Remove-Item -LiteralPath $backupManifestPath -Force
    }
    if ($null -ne $source) {
        $source.Password = $null
    }
    $DatabaseUrl = $null
}
