[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Low')]
param(
    [Parameter(Mandatory = $true)][string]$SnapshotPath,
    [Parameter(Mandatory = $true)][string]$AllowedSnapshotDirectory,
    [Parameter(Mandatory = $true)][ValidatePattern('^[A-Fa-f0-9]{64}$')][string]$ExpectedSha256,
    [Parameter(Mandatory = $true)][string]$DatabaseUrl,
    [switch]$ConfirmLocalRestore,
    [int]$ExpectedLocalPort = 54322,
    [long]$MaximumBytes = 1073741824,
    [string]$PsqlPath = 'psql',
    [string]$PgRestorePath = 'pg_restore',
    [string]$PostgresContainer = 'supabase_db_compra-car'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'PricingSnapshot.Common.psm1') -Force

if (-not $ConfirmLocalRestore.IsPresent) {
    throw 'Restore is blocked unless -ConfirmLocalRestore is supplied explicitly.'
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

$status = 'PLANNED_ONLY'
if ($PSCmdlet.ShouldProcess($target.SanitizedIdentity, "Restore data-only snapshot $($snapshot.FileName)")) {
    Invoke-LocalSnapshotRestore -Plan $plan -Target $target -PsqlPath $PsqlPath -PostgresContainer $PostgresContainer
    $status = 'RESTORED_LOCALLY'
}

[ordered]@{
    snapshotSha256 = $snapshot.Sha256
    snapshotFormat = $snapshot.Format
    localDatabase = $target.SanitizedIdentity
    tables = $snapshot.Tables
    status = $status
} | ConvertTo-Json -Depth 5
