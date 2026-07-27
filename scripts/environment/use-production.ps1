[CmdletBinding()]
param([switch]$ConfirmProduction)

$ErrorActionPreference = 'Stop'

try {
    Import-Module (Join-Path $PSScriptRoot 'Environment.Common.psm1') -Force
    $root = Get-CompraCarRepositoryRoot
    $source = Join-Path $root 'apps/web/env/production.env'
    $destination = Join-Path $root 'apps/web/.env.local'
    $variables = Read-DotEnvFile -Path $source
    Assert-RequiredEnvironmentVariables -Variables $variables
    [void](Assert-EnvironmentTarget -EnvironmentName production -Variables $variables)

    if (-not $ConfirmProduction) {
        Write-Warning 'PRODUCAO permite operacoes sobre dados operacionais. Nenhum arquivo foi alterado.'
        Write-Host 'Para confirmar, execute: .\scripts\environment\use-production.ps1 -ConfirmProduction'
        exit 2
    }

    Write-Host 'ATIVANDO PRODUCAO' -ForegroundColor Red
    Set-ActiveEnvironmentFile -SourcePath $source -DestinationPath $destination
    Show-EnvironmentSummary -EnvironmentName production -Variables $variables -ActiveFile $destination
    exit 0
} catch {
    Write-Error "Failed to activate Production: $($_.Exception.Message)"
    exit 1
}
