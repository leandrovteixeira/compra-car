[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$SnapshotPath,
    [Parameter(Mandatory = $true)][string]$AllowedSnapshotDirectory,
    [Parameter(Mandatory = $true)][ValidatePattern('^[A-Fa-f0-9]{64}$')][string]$ExpectedSha256,
    [long]$MaximumBytes = 1073741824,
    [string]$PgRestorePath = 'pg_restore',
    [string]$PostgresContainer = 'supabase_db_compra-car'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'PricingSnapshot.Common.psm1') -Force

$result = Get-ValidatedPricingSnapshot `
    -SnapshotPath $SnapshotPath `
    -AllowedSnapshotDirectory $AllowedSnapshotDirectory `
    -ExpectedSha256 $ExpectedSha256 `
    -MaximumBytes $MaximumBytes `
    -PgRestorePath $PgRestorePath `
    -PostgresContainer $PostgresContainer

[ordered]@{
    fileName = $result.FileName
    sizeBytes = $result.SizeBytes
    sha256 = $result.Sha256
    format = $result.Format
    tables = $result.Tables
    status = $result.ValidationStatus
} | ConvertTo-Json -Depth 5
