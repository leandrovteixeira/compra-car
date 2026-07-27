[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

try {
    Import-Module (Join-Path $PSScriptRoot 'Environment.Common.psm1') -Force
    $root = Get-CompraCarRepositoryRoot
    $source = Join-Path $root 'apps/web/env/staging.env'
    $destination = Join-Path $root 'apps/web/.env.local'
    $variables = Read-DotEnvFile -Path $source
    Assert-RequiredEnvironmentVariables -Variables $variables
    [void](Assert-EnvironmentTarget -EnvironmentName staging -Variables $variables)
    Set-ActiveEnvironmentFile -SourcePath $source -DestinationPath $destination
    Show-EnvironmentSummary -EnvironmentName staging -Variables $variables -ActiveFile $destination
    exit 0
} catch {
    Write-Error "Failed to activate Staging: $($_.Exception.Message)"
    exit 1
}
