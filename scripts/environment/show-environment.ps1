[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

try {
    Import-Module (Join-Path $PSScriptRoot 'Environment.Common.psm1') -Force
    $root = Get-CompraCarRepositoryRoot
    $activeFile = Join-Path $root 'apps/web/.env.local'
    if (-not (Test-Path -LiteralPath $activeFile -PathType Leaf)) {
        Write-Warning 'No local environment is active because apps/web/.env.local does not exist.'
        exit 2
    }

    $variables = Read-DotEnvFile -Path $activeFile
    Assert-RequiredEnvironmentVariables -Variables $variables
    $publicRef = Get-SupabaseProjectRef -Url ([string]$variables['NEXT_PUBLIC_SUPABASE_URL'])
    $serverRef = Get-SupabaseProjectRef -Url ([string]$variables['SUPABASE_URL'])
    if ($publicRef -ne $serverRef) {
        throw 'Public and server Supabase URLs target different projects.'
    }

    $environmentName = switch ($publicRef) {
        'shfsjyjxmgwnlexmdkcs' { 'STAGING' }
        'ltbeykzccckdwpzyeywu' { 'PRODUCTION' }
        default { 'UNKNOWN' }
    }
    if ($environmentName -eq 'UNKNOWN') {
        Write-Warning 'The active environment targets an unknown Supabase project. No files were changed.'
    }
    Show-EnvironmentSummary -EnvironmentName $environmentName -Variables $variables -ActiveFile $activeFile
    exit 0
} catch {
    Write-Error "Failed to inspect the active environment: $($_.Exception.Message)"
    exit 1
}
