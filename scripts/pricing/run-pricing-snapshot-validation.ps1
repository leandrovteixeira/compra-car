[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Low')]
param(
    [Parameter(Mandatory = $true)][string]$SnapshotPath,
    [Parameter(Mandatory = $true)][string]$AllowedSnapshotDirectory,
    [Parameter(Mandatory = $true)][ValidatePattern('^[A-Fa-f0-9]{64}$')][string]$ExpectedSha256,
    [Parameter(Mandatory = $true)][string]$DatabaseUrl,
    [Parameter(Mandatory = $true)][ValidatePattern('^\d{4}-\d{2}-\d{2}$')][string]$CutoffDate,
    [switch]$ConfirmLocalRestore,
    [string]$AlgorithmVersion = '1.0.0',
    [string]$OutputDirectory = '.local-reports/pricing-snapshots',
    [int]$ExpectedLocalPort = 54322,
    [long]$MaximumBytes = 1073741824,
    [string]$PsqlPath = 'psql',
    [string]$PgRestorePath = 'pg_restore',
    [string]$PostgresContainer = 'supabase_db_compra-car',
    [string]$PnpmPath = 'pnpm'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'PricingSnapshot.Common.psm1') -Force

if (-not $ConfirmLocalRestore.IsPresent) {
    throw 'Snapshot workflow is blocked unless -ConfirmLocalRestore is supplied explicitly.'
}

$target = Get-LocalDatabaseTarget -DatabaseUrl $DatabaseUrl -ExpectedLocalPort $ExpectedLocalPort
$snapshot = Get-ValidatedPricingSnapshot `
    -SnapshotPath $SnapshotPath `
    -AllowedSnapshotDirectory $AllowedSnapshotDirectory `
    -ExpectedSha256 $ExpectedSha256 `
    -MaximumBytes $MaximumBytes `
    -PgRestorePath $PgRestorePath `
    -PostgresContainer $PostgresContainer
$plan = New-LocalRestorePlan `
    -Snapshot $snapshot `
    -Target $target `
    -PsqlPath $PsqlPath `
    -PgRestorePath $PgRestorePath

if ([System.IO.Path]::IsPathRooted($OutputDirectory)) {
    $resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
}
else {
    $resolvedOutput = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $OutputDirectory))
}
if (-not $PSCmdlet.ShouldProcess($target.SanitizedIdentity, "Restore authorized snapshot, run pricing dry-run, and write manifest under $resolvedOutput")) {
    [ordered]@{
        snapshotSha256 = $snapshot.Sha256
        localDatabase = $target.SanitizedIdentity
        status = 'PLANNED_ONLY'
    } | ConvertTo-Json
    return
}

Invoke-LocalSnapshotRestore -Plan $plan -Target $target -PsqlPath $PsqlPath -PostgresContainer $PostgresContainer
$dryRun = Invoke-PricingSnapshotDryRun `
    -Target $target `
    -OutputDirectory (Join-Path $resolvedOutput 'dry-run') `
    -AlgorithmVersion $AlgorithmVersion `
    -CutoffDate $CutoffDate `
    -ExpectedLocalPort $ExpectedLocalPort `
    -PnpmPath $PnpmPath
$manifest = New-PricingSnapshotManifest `
    -Snapshot $snapshot `
    -Target $target `
    -DryRun $dryRun `
    -AlgorithmVersion $AlgorithmVersion `
    -CutoffDate $CutoffDate

if (-not (Test-Path -LiteralPath $resolvedOutput)) {
    [void](New-Item -ItemType Directory -Path $resolvedOutput -Force)
}
$manifestPath = Join-Path $resolvedOutput 'snapshot-manifest.json'
$manifest | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $manifestPath -Encoding UTF8

[ordered]@{
    manifestPath = $manifestPath
    reportDirectory = $dryRun.ReportDirectory
    comparisonHash = $manifest.comparisonHash
    status = $manifest.finalStatus
} | ConvertTo-Json -Depth 5
