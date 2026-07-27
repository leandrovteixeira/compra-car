Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:StagingProjectRef = 'shfsjyjxmgwnlexmdkcs'
$script:ProductionProjectRef = 'ltbeykzccckdwpzyeywu'
$script:RequiredVariableNames = @(
    'NEXT_PUBLIC_SUPABASE_URL'
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'
    'SUPABASE_URL'
    'SUPABASE_SERVER_KEY'
)

function Get-CompraCarRepositoryRoot {
    $root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
    if (-not (Test-Path -LiteralPath (Join-Path $root 'package.json') -PathType Leaf) -or
        -not (Test-Path -LiteralPath (Join-Path $root 'apps/web') -PathType Container)) {
        throw "Could not identify the Compra Car repository root from the environment module."
    }
    return $root
}

function Read-DotEnvFile {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Environment file not found: $Path"
    }

    $variables = @{}
    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmedLine = $line.Trim()
        if ([string]::IsNullOrWhiteSpace($trimmedLine) -or $trimmedLine.StartsWith('#')) {
            continue
        }

        $separatorIndex = $line.IndexOf('=')
        if ($separatorIndex -lt 1) {
            throw "Invalid environment variable declaration in $Path."
        }

        $name = $line.Substring(0, $separatorIndex).Trim()
        $value = $line.Substring($separatorIndex + 1).Trim()
        if ([string]::IsNullOrWhiteSpace($name)) {
            throw "Invalid empty environment variable name in $Path."
        }
        if ($value.Length -ge 2 -and
            (($value.StartsWith('"') -and $value.EndsWith('"')) -or
             ($value.StartsWith("'") -and $value.EndsWith("'")))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        $variables[$name] = $value
    }
    return $variables
}

function Assert-RequiredEnvironmentVariables {
    param([Parameter(Mandatory = $true)][hashtable]$Variables)

    $missing = @($script:RequiredVariableNames | Where-Object {
        -not $Variables.ContainsKey($_) -or [string]::IsNullOrWhiteSpace([string]$Variables[$_])
    })
    if ($missing.Count -gt 0) {
        throw "Missing required environment variables: $($missing -join ', ')"
    }
}

function Get-SupabaseProjectRef {
    param([Parameter(Mandatory = $true)][string]$Url)

    $uri = $null
    if (-not [System.Uri]::TryCreate($Url, [System.UriKind]::Absolute, [ref]$uri) -or
        $uri.Scheme -ne 'https' -or
        -not [string]::IsNullOrEmpty($uri.UserInfo) -or
        -not $uri.IsDefaultPort -or
        -not [string]::IsNullOrEmpty($uri.Query) -or
        -not [string]::IsNullOrEmpty($uri.Fragment) -or
        ($uri.AbsolutePath -ne '/' -and $uri.AbsolutePath -ne '')) {
        throw 'Supabase URL must be an absolute HTTPS URL without credentials, custom port, query, fragment, or path.'
    }

    $match = [regex]::Match($uri.DnsSafeHost, '^(?<ref>[a-z0-9]+)\.supabase\.co$', 'IgnoreCase')
    if (-not $match.Success) {
        throw 'Supabase URL hostname must end exactly in .supabase.co and contain one project-ref label.'
    }
    return $match.Groups['ref'].Value.ToLowerInvariant()
}

function Assert-EnvironmentTarget {
    param(
        [Parameter(Mandatory = $true)][ValidateSet('staging', 'production')][string]$EnvironmentName,
        [Parameter(Mandatory = $true)][hashtable]$Variables
    )

    $publicRef = Get-SupabaseProjectRef -Url ([string]$Variables['NEXT_PUBLIC_SUPABASE_URL'])
    $serverRef = Get-SupabaseProjectRef -Url ([string]$Variables['SUPABASE_URL'])
    if ($publicRef -ne $serverRef) {
        throw 'Public and server Supabase URLs target different projects.'
    }

    $expectedRef = if ($EnvironmentName -eq 'staging') { $script:StagingProjectRef } else { $script:ProductionProjectRef }
    if ($publicRef -ne $expectedRef) {
        throw "The $EnvironmentName environment file targets an unexpected Supabase project ref."
    }

    foreach ($keyName in @('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SERVER_KEY')) {
        $keyValue = [string]$Variables[$keyName]
        if ([string]::IsNullOrWhiteSpace($keyValue) -or
            $keyValue.Contains('<') -or
            $keyValue -match 'SUA_|CHANGE_ME|TODO') {
            throw "Environment variable $keyName contains an empty or placeholder value."
        }
    }
    return $publicRef
}

function Set-ActiveEnvironmentFile {
    param(
        [Parameter(Mandatory = $true)][string]$SourcePath,
        [Parameter(Mandatory = $true)][string]$DestinationPath
    )

    $destinationDirectory = Split-Path -Parent $DestinationPath
    if (-not (Test-Path -LiteralPath $destinationDirectory -PathType Container)) {
        [void](New-Item -ItemType Directory -Path $destinationDirectory -Force)
    }
    Copy-Item -LiteralPath $SourcePath -Destination $DestinationPath -Force
    if (-not (Test-Path -LiteralPath $DestinationPath -PathType Leaf)) {
        throw "Failed to activate the environment file at $DestinationPath."
    }
}

function Show-EnvironmentSummary {
    param(
        [Parameter(Mandatory = $true)][string]$EnvironmentName,
        [Parameter(Mandatory = $true)][hashtable]$Variables,
        [Parameter(Mandatory = $true)][string]$ActiveFile
    )

    $projectRef = Get-SupabaseProjectRef -Url ([string]$Variables['NEXT_PUBLIC_SUPABASE_URL'])
    $appName = if ($Variables.ContainsKey('APP_NAME') -and $Variables['APP_NAME']) {
        [string]$Variables['APP_NAME']
    } elseif ($Variables.ContainsKey('NEXT_PUBLIC_APP_NAME') -and $Variables['NEXT_PUBLIC_APP_NAME']) {
        [string]$Variables['NEXT_PUBLIC_APP_NAME']
    } else { $null }

    Write-Host "Environment: $($EnvironmentName.ToUpperInvariant())" -ForegroundColor Cyan
    if ($appName) { Write-Host "Application: $appName" }
    Write-Host "Supabase public URL: $($Variables['NEXT_PUBLIC_SUPABASE_URL'])"
    Write-Host "Project ref: $projectRef"
    Write-Host "Active file: $ActiveFile"
    Write-Host 'Restart the Next.js development server after changing environments.' -ForegroundColor Yellow
}

Export-ModuleMember -Function Get-CompraCarRepositoryRoot, Read-DotEnvFile, Assert-RequiredEnvironmentVariables, Get-SupabaseProjectRef, Assert-EnvironmentTarget, Set-ActiveEnvironmentFile, Show-EnvironmentSummary
