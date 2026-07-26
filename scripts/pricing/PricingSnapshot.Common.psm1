Set-StrictMode -Version Latest

$script:AllowedPricingTables = @(
    'products',
    'product_price_offers',
    'price_offer_imports',
    'price_offer_import_rows',
    'price_offers_staging',
    'product_specs',
    'specs'
)

function Get-PricingSnapshotAllowedTables {
    return @($script:AllowedPricingTables)
}

function Test-PathInsideDirectory {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$AllowedDirectory
    )

    $resolvedPath = [System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path)
    $resolvedDirectory = [System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $AllowedDirectory -ErrorAction Stop).Path)
    $directoryPrefix = $resolvedDirectory.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar

    return $resolvedPath.StartsWith($directoryPrefix, [System.StringComparison]::OrdinalIgnoreCase)
}

function Get-LocalDatabaseTarget {
    param(
        [Parameter(Mandatory = $true)][string]$DatabaseUrl,
        [int]$ExpectedLocalPort = 54322
    )

    if ($ExpectedLocalPort -lt 1 -or $ExpectedLocalPort -gt 65535) {
        throw 'ExpectedLocalPort must be between 1 and 65535.'
    }

    try {
        $uri = [System.Uri]$DatabaseUrl
    }
    catch {
        throw 'DATABASE_URL is not a valid PostgreSQL URL.'
    }

    if ($uri.Scheme -notin @('postgres', 'postgresql')) {
        throw 'DATABASE_URL must use postgres:// or postgresql://.'
    }
    if ([string]::IsNullOrWhiteSpace($uri.Host) -or $uri.Host.ToLowerInvariant() -notin @('localhost', '127.0.0.1', '::1')) {
        throw 'Remote database hosts are disabled for pricing snapshot restore.'
    }
    if ($uri.Port -ne $ExpectedLocalPort) {
        throw "DATABASE_URL must target the configured local Supabase port $ExpectedLocalPort."
    }
    if (-not [string]::IsNullOrEmpty($uri.Query) -or -not [string]::IsNullOrEmpty($uri.Fragment)) {
        throw 'DATABASE_URL query parameters and fragments are disabled; SSL options are not accepted.'
    }

    $database = [System.Uri]::UnescapeDataString($uri.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrWhiteSpace($database) -or $database.Contains('/')) {
        throw 'DATABASE_URL must identify exactly one local database.'
    }

    $userName = ''
    $password = ''
    if (-not [string]::IsNullOrWhiteSpace($uri.UserInfo)) {
        $userParts = $uri.UserInfo.Split(':', 2)
        $userName = [System.Uri]::UnescapeDataString($userParts[0])
        if ($userParts.Count -eq 2) {
            $password = [System.Uri]::UnescapeDataString($userParts[1])
        }
    }
    if ([string]::IsNullOrWhiteSpace($userName)) {
        throw 'DATABASE_URL must include an explicit local database user.'
    }

    return [pscustomobject]@{
        Host = $uri.Host.ToLowerInvariant()
        Port = $uri.Port
        Database = $database
        UserName = $userName
        Password = $password
        ConnectionString = $DatabaseUrl
        SanitizedIdentity = ('{0}:{1}/{2}' -f $uri.Host.ToLowerInvariant(), $uri.Port, $database)
    }
}

function Get-RemotePricingSnapshotSource {
    param(
        [Parameter(Mandatory = $true)][string]$DatabaseUrl,
        [string[]]$AllowRemoteHost = @()
    )

    try {
        $uri = [System.Uri]$DatabaseUrl
    }
    catch {
        throw 'DatabaseUrl is not a valid PostgreSQL URL.'
    }
    if ($uri.Scheme -notin @('postgres', 'postgresql')) {
        throw 'DatabaseUrl must use postgres:// or postgresql://.'
    }
    if ([string]::IsNullOrWhiteSpace($uri.Host)) {
        throw 'DatabaseUrl must include a remote host.'
    }
    $hostName = $uri.Host.ToLowerInvariant()
    if ($hostName -in @('localhost', '127.0.0.1', '::1')) {
        throw 'Pricing snapshot export requires a remote database host; localhost is not allowed.'
    }
    if (-not [string]::IsNullOrEmpty($uri.Query) -or -not [string]::IsNullOrEmpty($uri.Fragment)) {
        throw 'DatabaseUrl query parameters and fragments are not accepted.'
    }

    $database = [System.Uri]::UnescapeDataString($uri.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrWhiteSpace($database) -or $database.Contains('/')) {
        throw 'DatabaseUrl must identify exactly one remote database.'
    }
    $userName = ''
    $password = ''
    if (-not [string]::IsNullOrWhiteSpace($uri.UserInfo)) {
        $userParts = $uri.UserInfo.Split(':', 2)
        $userName = [System.Uri]::UnescapeDataString($userParts[0])
        if ($userParts.Count -eq 2) {
            $password = [System.Uri]::UnescapeDataString($userParts[1])
        }
    }
    if ([string]::IsNullOrWhiteSpace($userName)) {
        throw 'DatabaseUrl must include an explicit remote database user.'
    }

    $normalizedAllowlist = @($AllowRemoteHost | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | ForEach-Object { $_.Trim().ToLowerInvariant() })
    if ($normalizedAllowlist.Count -gt 0 -and $hostName -notin $normalizedAllowlist) {
        throw "Remote database host is not in AllowRemoteHost: $hostName"
    }

    $remotePort = if ($uri.Port -eq -1) { 5432 } else { $uri.Port }
    if ($remotePort -lt 1 -or $remotePort -gt 65535) {
        throw 'DatabaseUrl must include a valid PostgreSQL port.'
    }
    return [pscustomobject]@{
        Host = $hostName
        Port = $remotePort
        Database = $database
        UserName = $userName
        Password = $password
        SanitizedIdentity = ('{0}:{1}/{2}' -f $hostName, $remotePort, $database)
    }
}

function Resolve-PricingSnapshotOutputDirectory {
    param([Parameter(Mandatory = $true)][string]$OutputDirectory)

    if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
        throw 'OutputDirectory must not be empty.'
    }
    $pathSegments = $OutputDirectory -split '[\\/]'
    if ($pathSegments -contains '..') {
        throw 'OutputDirectory must not contain path traversal segments.'
    }
    $fullPath = [System.IO.Path]::GetFullPath($OutputDirectory)
    $existingAncestor = $fullPath
    while (-not (Test-Path -LiteralPath $existingAncestor)) {
        $parent = Split-Path -Parent $existingAncestor
        if ([string]::IsNullOrWhiteSpace($parent) -or $parent -eq $existingAncestor) {
            throw 'OutputDirectory has no accessible parent directory.'
        }
        $existingAncestor = $parent
    }
    if ((Get-Item -LiteralPath $existingAncestor -Force).Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
        throw 'OutputDirectory must not be inside a symbolic link or reparse point.'
    }
    if (-not (Test-Path -LiteralPath $fullPath)) {
        [void](New-Item -ItemType Directory -Path $fullPath -Force)
    }
    $directory = Get-Item -LiteralPath $fullPath -Force
    if (-not $directory.PSIsContainer) {
        throw 'OutputDirectory must identify a directory.'
    }
    if ($directory.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
        throw 'OutputDirectory must not be a symbolic link or reparse point.'
    }
    return $directory.FullName
}

function Assert-NoForbiddenSnapshotText {
    param([Parameter(Mandatory = $true)][string]$Text)

    $forbiddenPatterns = [ordered]@{
        'DROP' = '(?im)^\s*DROP\b'
        'ALTER ROLE' = '(?im)^\s*ALTER\s+ROLE\b'
        'CREATE ROLE' = '(?im)^\s*CREATE\s+ROLE\b'
        'GRANT' = '(?im)^\s*GRANT\b'
        'REVOKE' = '(?im)^\s*REVOKE\b'
        'CREATE EXTENSION' = '(?im)^\s*CREATE\s+EXTENSION\b'
        'ALTER SYSTEM' = '(?im)^\s*ALTER\s+SYSTEM\b'
        'COPY PROGRAM' = '(?im)\bCOPY\b[^;\r\n]*\bPROGRAM\b'
        'CREATE DATABASE' = '(?im)^\s*CREATE\s+DATABASE\b'
        'ALTER DATABASE' = '(?im)^\s*ALTER\s+DATABASE\b'
        'owner change' = '(?im)\bOWNER\s+TO\b'
        'dangerous pg_restore option' = '(?im)(?:^|\s)--(?:clean|create|if-exists|use-list|section|disable-triggers)\b'
    }

    foreach ($entry in $forbiddenPatterns.GetEnumerator()) {
        if ($Text -match $entry.Value) {
            throw "Snapshot contains prohibited content: $($entry.Key)."
        }
    }
}

function Test-PlainSqlSnapshot {
    param([Parameter(Mandatory = $true)][string]$Path)

    $text = [System.IO.File]::ReadAllText($Path, [System.Text.UTF8Encoding]::new($false, $true))
    Assert-NoForbiddenSnapshotText -Text $text

    $foundTables = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::Ordinal)
    $insideCopy = $false
    $lineNumber = 0
    foreach ($line in [System.IO.File]::ReadLines($Path)) {
        $lineNumber += 1
        if ($insideCopy) {
            if ($line -eq '\.') {
                $insideCopy = $false
            }
            continue
        }

        if ([string]::IsNullOrWhiteSpace($line) -or $line -match '^\s*--') {
            continue
        }
        if ($line -match '^\s*\\(?:restrict|unrestrict)\s+[A-Za-z0-9_]+\s*$') {
            continue
        }
        if ($line -match '^\s*SET\s+([A-Za-z_][A-Za-z0-9_.]*)\s*=\s*[^;\r\n]+;\s*$') {
            $setting = $Matches[1].ToLowerInvariant()
            $allowedSettings = @(
                'statement_timeout',
                'lock_timeout',
                'idle_in_transaction_session_timeout',
                'transaction_timeout',
                'client_encoding',
                'standard_conforming_strings',
                'check_function_bodies',
                'xmloption',
                'client_min_messages',
                'row_security'
            )
            if ($setting -notin $allowedSettings) {
                throw "Snapshot contains an unsupported SET command at line ${lineNumber}: $setting."
            }
            continue
        }
        if ($line -match "^\s*SELECT\s+pg_catalog\.set_config\('search_path',\s*'',\s*false\);\s*$") {
            continue
        }
        if ($line -match '^\s*COPY\s+public\.([a-z_][a-z0-9_]*)\s*\([a-z0-9_,\s"]+\)\s+FROM\s+stdin;\s*$') {
            $table = $Matches[1]
            if ($table -notin $script:AllowedPricingTables) {
                throw "Snapshot references a table outside the allowlist at line ${lineNumber}: public.$table."
            }
            [void]$foundTables.Add($table)
            $insideCopy = $true
            continue
        }

        throw "Snapshot contains an unsupported SQL statement at line $lineNumber. Only pg_dump data-only COPY format is accepted."
    }

    if ($insideCopy) {
        throw 'Snapshot contains an unterminated COPY block.'
    }

    $missing = @($script:AllowedPricingTables | Where-Object { -not $foundTables.Contains($_) })
    if ($missing.Count -gt 0) {
        throw "Snapshot is incomplete; required table data entries are missing: $($missing -join ', ')."
    }

    return @($foundTables | Sort-Object | ForEach-Object { "public.$_" })
}

function Get-PostgreSqlContainerRuntimeMetadata {
    param(
        [string]$PostgresContainer = 'supabase_db_compra-car',
        [string]$DockerPath = 'docker'
    )

    $dockerCommandSource = Resolve-DockerCommand -DockerPath $DockerPath
    if ([string]::IsNullOrWhiteSpace($PostgresContainer)) {
        throw 'PostgresContainer must identify a PostgreSQL container.'
    }

    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $inspection = & $dockerCommandSource 'inspect' '--format' '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}|{{json .NetworkSettings.Ports}}|{{json .NetworkSettings.Networks}}' $PostgresContainer 2>&1
        $inspectionExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    if ($inspectionExitCode -ne 0) {
        throw "PostgreSQL container does not exist or cannot be inspected: $PostgresContainer"
    }
    $containerState = ([string]($inspection | Select-Object -Last 1)).Trim()
    $stateParts = $containerState.Split('|', 4)
    if ($stateParts.Count -ne 4 -or $stateParts[0] -ne 'running') {
        throw "PostgreSQL container is not running: $PostgresContainer"
    }
    if ($stateParts[1] -ne 'healthy') {
        throw "PostgreSQL container is not healthy: $PostgresContainer (health: $($stateParts[1]))"
    }

    try {
        $publishedPorts = $stateParts[2] | ConvertFrom-Json
    }
    catch {
        throw "PostgreSQL container port mappings could not be inspected: $PostgresContainer"
    }
    $portMappings = @()
    foreach ($portProperty in $publishedPorts.PSObject.Properties) {
        if ($portProperty.Name -notmatch '^(\d+)/([^/]+)$') {
            continue
        }
        $containerPort = [int]$Matches[1]
        $protocol = $Matches[2].ToLowerInvariant()
        foreach ($binding in @($portProperty.Value)) {
            if ($null -ne $binding -and -not [string]::IsNullOrWhiteSpace([string]$binding.HostPort)) {
                $portMappings += [pscustomobject]@{
                    HostIp = [string]$binding.HostIp
                    HostPort = [int]$binding.HostPort
                    ContainerPort = $containerPort
                    Protocol = $protocol
                }
            }
        }
    }
    $containerIpAddresses = Get-PostgreSqlContainerIpAddresses -NetworkSettingsJson $stateParts[3] -PostgresContainer $PostgresContainer

    return [pscustomobject]@{
        CommandSource = $dockerCommandSource
        Container = $PostgresContainer
        PortMappings = @($portMappings)
        ContainerIpAddresses = @($containerIpAddresses)
    }
}

function Resolve-PostgreSqlClientExecutor {
    param(
        [Parameter(Mandatory = $true)][ValidateSet('psql', 'pg_restore')][string]$Client,
        [Parameter(Mandatory = $true)][string]$ClientPath,
        [string]$PostgresContainer = 'supabase_db_compra-car',
        [string]$DockerPath = 'docker'
    )

    $localCommand = Get-Command $ClientPath -ErrorAction SilentlyContinue
    if ($null -ne $localCommand) {
        Write-Information 'Usando PostgreSQL Client local.' -InformationAction Continue
        return [pscustomobject]@{
            Mode = 'Local'
            Client = $Client
            CommandSource = Get-PostgreSqlCommandSource -Command $localCommand
            Container = $PostgresContainer
        }
    }

    $containerMetadata = Get-PostgreSqlContainerRuntimeMetadata -PostgresContainer $PostgresContainer -DockerPath $DockerPath
    Write-Information 'Usando PostgreSQL Client via Docker.' -InformationAction Continue
    return [pscustomobject]@{
        Mode = 'Docker'
        Client = $Client
        CommandSource = $containerMetadata.CommandSource
        Container = $containerMetadata.Container
        PortMappings = @($containerMetadata.PortMappings)
        ContainerIpAddresses = @($containerMetadata.ContainerIpAddresses)
    }
}

function Resolve-PsqlExecutor {
    param(
        [string]$PsqlPath = 'psql',
        [string]$PostgresContainer = 'supabase_db_compra-car',
        [string]$DockerPath = 'docker'
    )

    return Resolve-PostgreSqlClientExecutor -Client 'psql' -ClientPath $PsqlPath -PostgresContainer $PostgresContainer -DockerPath $DockerPath
}

function Resolve-PgRestoreExecutor {
    param(
        [string]$PgRestorePath = 'pg_restore',
        [string]$PostgresContainer = 'supabase_db_compra-car',
        [string]$PostgresImage = 'postgres:17',
        [string]$DockerPath = 'docker'
    )

    return Resolve-PostgreSqlExportExecutor -Client 'pg_restore' -ClientPath $PgRestorePath -PostgresImage $PostgresImage -DockerPath $DockerPath
}

function Resolve-PostgreSqlContainerPortMapping {
    param(
        [Parameter(Mandatory = $true)]$Executor,
        [Parameter(Mandatory = $true)][ValidateRange(1, 65535)][int]$ExpectedHostPort
    )

    $mappings = @($Executor.PortMappings)
    if ($mappings.Count -eq 0) {
        throw "PostgreSQL container does not publish local port $ExpectedHostPort`: $($Executor.Container)"
    }

    $allowedHostAddresses = @('0.0.0.0', '127.0.0.1', '::')
    foreach ($mapping in $mappings) {
        $hostAddress = ([string]$mapping.HostIp).Trim()
        if ($hostAddress.StartsWith('[') -and $hostAddress.EndsWith(']')) {
            $hostAddress = $hostAddress.Substring(1, $hostAddress.Length - 2)
        }
        if ([int]$mapping.ContainerPort -ne 5432 -or [string]$mapping.Protocol -ne 'tcp') {
            throw "PostgreSQL container must publish only container port 5432/tcp: $($Executor.Container)"
        }
        if ($hostAddress -notin $allowedHostAddresses) {
            throw "PostgreSQL container has an invalid non-local published address '$($mapping.HostIp)': $($Executor.Container)"
        }
        if ([int]$mapping.HostPort -ne $ExpectedHostPort) {
            throw "PostgreSQL container has conflicting host port mappings; expected $ExpectedHostPort`: $($Executor.Container)"
        }
    }

    return 5432
}

function ConvertTo-NormalizedIpAddress {
    param(
        [Parameter(Mandatory = $true)][string]$Address,
        [string]$Description = 'IP address'
    )

    $addressText = $Address.Trim()
    if ([string]::IsNullOrWhiteSpace($addressText)) {
        throw "$Description is empty."
    }
    $addressParts = $addressText.Split('/', 2)
    $ipText = $addressParts[0].Trim()
    if ($ipText.StartsWith('[') -and $ipText.EndsWith(']')) {
        $ipText = $ipText.Substring(1, $ipText.Length - 2)
    }
    try {
        $ipAddress = [System.Net.IPAddress]::Parse($ipText)
    }
    catch {
        throw "$Description is not a valid IP address."
    }
    if ($addressParts.Count -eq 2) {
        $prefixLength = 0
        if (-not [int]::TryParse($addressParts[1].Trim(), [ref]$prefixLength)) {
            throw "$Description has an invalid network prefix."
        }
        $maximumPrefix = if ($ipAddress.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork) { 32 } else { 128 }
        if ($prefixLength -lt 0 -or $prefixLength -gt $maximumPrefix) {
            throw "$Description has an invalid network prefix."
        }
    }
    return $ipAddress
}

function Test-IsPrivateContainerIpAddress {
    param([Parameter(Mandatory = $true)][System.Net.IPAddress]$Address)

    if ([System.Net.IPAddress]::IsLoopback($Address)) {
        return $true
    }
    $bytes = $Address.GetAddressBytes()
    if ($Address.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork) {
        return ($bytes[0] -eq 10 -or
            ($bytes[0] -eq 172 -and $bytes[1] -ge 16 -and $bytes[1] -le 31) -or
            ($bytes[0] -eq 192 -and $bytes[1] -eq 168) -or
            ($bytes[0] -eq 169 -and $bytes[1] -eq 254))
    }
    return (($bytes[0] -band 0xfe) -eq 0xfc -or ($bytes[0] -eq 0xfe -and ($bytes[1] -band 0xc0) -eq 0x80))
}

function Get-PostgreSqlContainerIpAddresses {
    param(
        [Parameter(Mandatory = $true)][string]$NetworkSettingsJson,
        [string]$PostgresContainer = 'supabase_db_compra-car'
    )

    try {
        $networks = $NetworkSettingsJson.Trim() | ConvertFrom-Json
    }
    catch {
        throw "PostgreSQL container network addresses could not be inspected: $PostgresContainer"
    }
    $addresses = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)
    foreach ($network in $networks.PSObject.Properties) {
        foreach ($propertyName in @('IPAddress', 'GlobalIPv6Address')) {
            $rawAddress = [string]$network.Value.$propertyName
            if ([string]::IsNullOrWhiteSpace($rawAddress)) {
                continue
            }
            $ipAddress = ConvertTo-NormalizedIpAddress -Address $rawAddress -Description 'PostgreSQL container IP address'
            if (-not (Test-IsPrivateContainerIpAddress -Address $ipAddress)) {
                throw "PostgreSQL container reported a non-local IP address: $PostgresContainer"
            }
            [void]$addresses.Add($ipAddress.ToString())
        }
    }
    if ($addresses.Count -eq 0) {
        throw "PostgreSQL container did not report a valid IP address: $PostgresContainer"
    }
    return @($addresses | Sort-Object)
}

function Test-PostgreSqlServerAddress {
    param(
        [Parameter(Mandatory = $true)][string]$Address,
        [string[]]$ContainerIpAddresses = @()
    )

    $serverAddress = ConvertTo-NormalizedIpAddress -Address $Address -Description 'Connected database server address'
    if ([System.Net.IPAddress]::IsLoopback($serverAddress)) {
        return $true
    }
    if (-not (Test-IsPrivateContainerIpAddress -Address $serverAddress)) {
        throw 'Connected database server address is public or remote; restore is blocked.'
    }
    foreach ($containerAddressText in @($ContainerIpAddresses)) {
        $containerAddress = ConvertTo-NormalizedIpAddress -Address $containerAddressText -Description 'PostgreSQL container IP address'
        if ($serverAddress.Equals($containerAddress)) {
            return $true
        }
    }
    throw 'Connected database server address does not exactly match the expected PostgreSQL container; restore is blocked.'
}

function Get-PostgreSqlCommandSource {
    param([Parameter(Mandatory = $true)]$Command)

    if (-not [string]::IsNullOrWhiteSpace([string]$Command.Path)) {
        return [string]$Command.Path
    }
    return [string]$Command.Source
}

function Resolve-DockerCommand {
    param([string]$DockerPath = 'docker')

    $dockerCommand = Get-Command $DockerPath -ErrorAction SilentlyContinue
    if ($null -eq $dockerCommand) {
        throw 'Docker is not available.'
    }
    return Get-PostgreSqlCommandSource -Command $dockerCommand
}

function Resolve-PostgreSqlExportExecutor {
    param(
        [Parameter(Mandatory = $true)][ValidateSet('psql', 'pg_dump', 'pg_restore')][string]$Client,
        [Parameter(Mandatory = $true)][string]$ClientPath,
        [string]$PostgresImage = 'postgres:17',
        [string]$DockerPath = 'docker'
    )

    $operation = if ($Client -eq 'pg_restore') { 'restauração/inspeção' } else { 'exportação' }
    $localCommand = Get-Command $ClientPath -ErrorAction SilentlyContinue
    if ($null -ne $localCommand) {
        Write-Information "Usando PostgreSQL Client local para $operation." -InformationAction Continue
        return [pscustomobject]@{
            Mode = 'Local'
            Client = $Client
            CommandSource = Get-PostgreSqlCommandSource -Command $localCommand
            Image = $null
        }
    }
    $dockerCommandSource = Resolve-DockerCommand -DockerPath $DockerPath
    if ([string]::IsNullOrWhiteSpace($PostgresImage)) {
        throw 'PostgresImage must identify a PostgreSQL image.'
    }

    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $dockerOutput = & $dockerCommandSource 'version' '--format' '{{.Client.Version}}' 2>&1
        $dockerExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    if ($dockerExitCode -ne 0) {
        throw 'Docker is installed but its engine is not available for the pricing snapshot operation.'
    }

    Write-Information "Usando PostgreSQL Client via Docker para $operation." -InformationAction Continue
    return [pscustomobject]@{
        Mode = 'DockerRun'
        Client = $Client
        CommandSource = $dockerCommandSource
        Image = $PostgresImage
    }
}

function Resolve-RemotePsqlExecutor {
    param(
        [string]$PsqlPath = 'psql',
        [string]$PostgresImage = 'postgres:17',
        [string]$DockerPath = 'docker'
    )

    return Resolve-PostgreSqlExportExecutor -Client 'psql' -ClientPath $PsqlPath -PostgresImage $PostgresImage -DockerPath $DockerPath
}

function Resolve-PgDumpExecutor {
    param(
        [string]$PgDumpPath = 'pg_dump',
        [string]$PostgresImage = 'postgres:17',
        [string]$DockerPath = 'docker'
    )

    return Resolve-PostgreSqlExportExecutor -Client 'pg_dump' -ClientPath $PgDumpPath -PostgresImage $PostgresImage -DockerPath $DockerPath
}

function ConvertTo-WindowsProcessArgument {
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Value)

    if ($Value -notmatch '[\s"]') {
        return $Value
    }
    $escaped = [regex]::Replace($Value, '(\\*)"', '$1$1\"')
    $escaped = [regex]::Replace($escaped, '(\\+)$', '$1$1')
    return '"' + $escaped + '"'
}

function Assert-PgRestoreDatabaseArguments {
    param(
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $true)][string]$ArchivePath
    )

    $databaseArguments = @($Arguments | Where-Object { $_ -eq '--dbname' -or $_ -like '--dbname=*' })
    if ($databaseArguments.Count -ne 1) {
        throw 'pg_restore database mode requires exactly one --dbname argument.'
    }
    $databaseIndex = [Array]::IndexOf($Arguments, '--dbname')
    if ($databaseIndex -ge 0 -and ($databaseIndex + 1 -ge $Arguments.Count -or [string]::IsNullOrWhiteSpace([string]$Arguments[$databaseIndex + 1]))) {
        throw 'pg_restore --dbname must identify the validated local database.'
    }
    if (@($Arguments | Where-Object { $_ -eq '--file' -or $_ -like '--file=*' }).Count -gt 0) {
        throw 'pg_restore database mode must not use --file.'
    }
    if (@($Arguments | Where-Object { [string]$_ -eq $ArchivePath }).Count -ne 1) {
        throw 'pg_restore must receive the validated snapshot archive path exactly once.'
    }
}

function Invoke-PostgreSqlClient {
    param(
        [Parameter(Mandatory = $true)]$Executor,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [AllowEmptyString()][string]$Password = '',
        [string]$InputFilePath
    )

    $previousPassword = $env:PGPASSWORD
    try {
        $env:PGPASSWORD = $Password
        if ($Executor.Mode -eq 'Local') {
            Write-Verbose "PostgreSQL executable: $($Executor.CommandSource)"
            Write-Verbose "PostgreSQL arguments: $(($Arguments | ForEach-Object { ConvertTo-WindowsProcessArgument -Value ([string]$_) }) -join ' ')"
            $previousErrorActionPreference = $ErrorActionPreference
            try {
                $ErrorActionPreference = 'Continue'
                $output = & $Executor.CommandSource @Arguments 2>&1
                $clientExitCode = $LASTEXITCODE
            }
            finally {
                $ErrorActionPreference = $previousErrorActionPreference
            }
            Write-Verbose "PostgreSQL client exit code: $clientExitCode"
            if ($clientExitCode -ne 0) {
                $safeOutput = $output -join ' '
                if (-not [string]::IsNullOrEmpty($Password)) {
                    $safeOutput = $safeOutput.Replace($Password, '[REDACTED]')
                }
                throw "PostgreSQL client command failed: $safeOutput"
            }
            return @($output)
        }

        if ($Executor.Mode -eq 'DockerRun') {
            $effectiveArguments = @($Arguments)
            $dockerRunArguments = @('run', '--rm', '--env', 'PGPASSWORD')
            if (-not [string]::IsNullOrWhiteSpace($InputFilePath)) {
                $snapshotDirectory = [System.IO.Path]::GetDirectoryName([System.IO.Path]::GetFullPath($InputFilePath))
                $containerInputPath = "/snapshots/$([System.IO.Path]::GetFileName($InputFilePath))"
                $dockerRunArguments += @('--volume', "${snapshotDirectory}:/snapshots:ro")
                for ($argumentIndex = 0; $argumentIndex -lt $effectiveArguments.Count; $argumentIndex += 1) {
                    if ([string]$effectiveArguments[$argumentIndex] -eq $InputFilePath) {
                        $effectiveArguments[$argumentIndex] = $containerInputPath
                    }
                    if ($Executor.Client -eq 'pg_restore' -and [string]$effectiveArguments[$argumentIndex] -eq '--host' -and $argumentIndex + 1 -lt $effectiveArguments.Count) {
                        $effectiveArguments[$argumentIndex + 1] = 'host.docker.internal'
                        $argumentIndex += 1
                    }
                }
            }
            $dockerRunArguments += @($Executor.Image, $Executor.Client) + $effectiveArguments
            Write-Verbose "PostgreSQL Docker image: $($Executor.Image)"
            Write-Verbose "PostgreSQL executable: $($Executor.CommandSource)"
            Write-Verbose "PostgreSQL arguments: $(($dockerRunArguments | ForEach-Object { ConvertTo-WindowsProcessArgument -Value ([string]$_) }) -join ' ')"
            $previousErrorActionPreference = $ErrorActionPreference
            try {
                $ErrorActionPreference = 'Continue'
                $output = & $Executor.CommandSource @dockerRunArguments 2>&1
                $clientExitCode = $LASTEXITCODE
            }
            finally {
                $ErrorActionPreference = $previousErrorActionPreference
            }
            Write-Verbose "PostgreSQL client exit code: $clientExitCode"
            if ($clientExitCode -ne 0) {
                $safeOutput = $output -join ' '
                if (-not [string]::IsNullOrEmpty($Password)) {
                    $safeOutput = $safeOutput.Replace($Password, '[REDACTED]')
                }
                throw "PostgreSQL client command failed: $safeOutput"
            }
            return @($output)
        }

        $dockerArguments = @('exec')
        if (-not [string]::IsNullOrWhiteSpace($InputFilePath)) {
            $dockerArguments += '--interactive'
        }
        $clientArguments = @($Arguments)
        for ($argumentIndex = 0; $argumentIndex -lt $clientArguments.Count; $argumentIndex += 1) {
            if ([string]$clientArguments[$argumentIndex] -eq '--host' -and $argumentIndex + 1 -lt $clientArguments.Count) {
                $clientArguments[$argumentIndex + 1] = '127.0.0.1'
                $argumentIndex += 1
                continue
            }
            if ([string]$clientArguments[$argumentIndex] -eq '--port' -and $argumentIndex + 1 -lt $clientArguments.Count) {
                $hostPort = [int]$clientArguments[$argumentIndex + 1]
                $containerPort = Resolve-PostgreSqlContainerPortMapping -Executor $Executor -ExpectedHostPort $hostPort
                $clientArguments[$argumentIndex + 1] = [string]$containerPort
                $argumentIndex += 1
            }
        }

        $dockerArguments += @('--env', 'PGPASSWORD', $Executor.Container, $Executor.Client)
        for ($argumentIndex = 0; $argumentIndex -lt $clientArguments.Count; $argumentIndex += 1) {
            if ([string]$clientArguments[$argumentIndex] -eq $InputFilePath) {
                continue
            }
            if ([string]$clientArguments[$argumentIndex] -eq '--file' -and
                $argumentIndex + 1 -lt $clientArguments.Count -and
                [string]$clientArguments[$argumentIndex + 1] -eq $InputFilePath) {
                $argumentIndex += 1
                continue
            }
            $dockerArguments += $clientArguments[$argumentIndex]
        }

        $startInfo = New-Object System.Diagnostics.ProcessStartInfo
        $startInfo.FileName = $Executor.CommandSource
        $startInfo.Arguments = (($dockerArguments | ForEach-Object { ConvertTo-WindowsProcessArgument -Value ([string]$_) }) -join ' ')
        Write-Verbose "PostgreSQL executable: $($startInfo.FileName)"
        Write-Verbose "PostgreSQL arguments: $($startInfo.Arguments)"
        $startInfo.UseShellExecute = $false
        $startInfo.CreateNoWindow = $true
        $startInfo.RedirectStandardOutput = $true
        $startInfo.RedirectStandardError = $true
        $startInfo.RedirectStandardInput = -not [string]::IsNullOrWhiteSpace($InputFilePath)

        $process = New-Object System.Diagnostics.Process
        $process.StartInfo = $startInfo
        if (-not $process.Start()) {
            throw 'Docker could not start the PostgreSQL client command.'
        }
        $standardOutput = $process.StandardOutput.ReadToEndAsync()
        $standardError = $process.StandardError.ReadToEndAsync()
        if ($startInfo.RedirectStandardInput) {
            $inputStream = [System.IO.File]::OpenRead($InputFilePath)
            try {
                $inputStream.CopyTo($process.StandardInput.BaseStream)
            }
            finally {
                $inputStream.Dispose()
                $process.StandardInput.Close()
            }
        }
        $process.WaitForExit()
        $outputText = $standardOutput.Result
        $errorText = $standardError.Result
        Write-Verbose "PostgreSQL client exit code: $($process.ExitCode)"
        if ($process.ExitCode -ne 0) {
            throw "PostgreSQL client command failed: $errorText"
        }
        return @(($outputText -split '\r?\n') | Where-Object { $_ -ne '' })
    }
    finally {
        $env:PGPASSWORD = $previousPassword
    }
}

function Invoke-Psql {
    param(
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [AllowEmptyString()][string]$Password = '',
        [string]$InputFilePath,
        [string]$PsqlPath = 'psql',
        [string]$PostgresContainer = 'supabase_db_compra-car',
        $Executor
    )

    if ($null -eq $Executor) {
        $Executor = Resolve-PsqlExecutor -PsqlPath $PsqlPath -PostgresContainer $PostgresContainer
    }
    return Invoke-PostgreSqlClient -Executor $Executor -Arguments $Arguments -Password $Password -InputFilePath $InputFilePath
}

function Invoke-PgRestore {
    param(
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [AllowEmptyString()][string]$Password = '',
        [string]$InputFilePath,
        [string]$PgRestorePath = 'pg_restore',
        [string]$PostgresContainer = 'supabase_db_compra-car',
        $Executor
    )

    Assert-PgRestoreDatabaseArguments -Arguments $Arguments -ArchivePath $InputFilePath
    Write-Verbose 'pg_restore restore mode: database (--dbname); archive output mode (--file) is disabled.'
    if ($null -eq $Executor) {
        $Executor = Resolve-PgRestoreExecutor -PgRestorePath $PgRestorePath -PostgresContainer $PostgresContainer
    }
    return Invoke-PostgreSqlClient -Executor $Executor -Arguments $Arguments -Password $Password -InputFilePath $InputFilePath
}

function Test-RemotePricingSnapshotConnection {
    param(
        [Parameter(Mandatory = $true)]$Source,
        [Parameter(Mandatory = $true)]$Executor
    )

    $query = "BEGIN TRANSACTION READ ONLY; SELECT current_user || '|' || current_database() || '|' || current_setting('transaction_read_only'); COMMIT;"
    $arguments = @(
        '--no-psqlrc', '--tuples-only', '--no-align', '--set=ON_ERROR_STOP=1',
        '--host', $Source.Host, '--port', [string]$Source.Port,
        '--username', $Source.UserName, '--dbname', $Source.Database,
        '--command', $query
    )
    $output = Invoke-PostgreSqlClient -Executor $Executor -Arguments $arguments -Password $Source.Password
    $identityLine = @($output | ForEach-Object { ([string]$_).Trim() } | Where-Object { $_ -match '^[^|]+\|[^|]+\|(on|true)$' }) | Select-Object -Last 1
    if ($null -eq $identityLine) {
        throw 'Remote read-only preflight did not return the expected sanitized identity.'
    }
    $identity = $identityLine.Split('|', 3)
    if ($identity[1] -ne $Source.Database -or $identity[2] -notin @('on', 'true')) {
        throw 'Remote export session did not confirm the expected database and read-only transaction.'
    }
    return [pscustomobject]@{
        UserName = $identity[0]
        Database = $identity[1]
        TransactionReadOnly = $true
    }
}

function New-PricingSnapshotExportPlan {
    param(
        [Parameter(Mandatory = $true)]$Source,
        [Parameter(Mandatory = $true)][string]$OutputPath
    )

    $tables = @(Get-PricingSnapshotAllowedTables | ForEach-Object { "public.$_" })
    $arguments = @(
        '--format=custom',
        '--data-only',
        '--no-owner',
        '--no-privileges',
        '--no-blobs',
        '--exclude-table-data=public.*_seq',
        '--host', $Source.Host,
        '--port', [string]$Source.Port,
        '--username', $Source.UserName,
        '--dbname', $Source.Database
    )
    $arguments += @($tables | ForEach-Object { "--table=$_" })
    $arguments += "--file=$OutputPath"
    return [pscustomobject]@{
        Arguments = @($arguments)
        OutputPath = $OutputPath
        Tables = @($tables)
    }
}

function Invoke-PgDump {
    param(
        [Parameter(Mandatory = $true)]$Executor,
        [Parameter(Mandatory = $true)]$Plan,
        [AllowEmptyString()][string]$Password = ''
    )

    $previousPassword = $env:PGPASSWORD
    $previousOptions = $env:PGOPTIONS
    try {
        $env:PGPASSWORD = $Password
        $env:PGOPTIONS = '-c default_transaction_read_only=on'
        if ($Executor.Mode -eq 'Local') {
            $dumpArguments = @($Plan.Arguments)
            $previousErrorActionPreference = $ErrorActionPreference
            try {
                $ErrorActionPreference = 'Continue'
                $output = & $Executor.CommandSource @dumpArguments 2>&1
                $dumpExitCode = $LASTEXITCODE
            }
            finally {
                $ErrorActionPreference = $previousErrorActionPreference
            }
            if ($dumpExitCode -ne 0) {
                $safeOutput = $output -join ' '
                if (-not [string]::IsNullOrEmpty($Password)) {
                    $safeOutput = $safeOutput.Replace($Password, '[REDACTED]')
                }
                throw "pg_dump failed with exit code ${dumpExitCode}: $safeOutput"
            }
            return
        }

        $clientArguments = @($Plan.Arguments | Where-Object { [string]$_ -notlike '--file=*' })
        $dockerArguments = @('run', '--rm', '--env', 'PGPASSWORD', '--env', 'PGOPTIONS', $Executor.Image, 'pg_dump') + $clientArguments
        $startInfo = New-Object System.Diagnostics.ProcessStartInfo
        $startInfo.FileName = $Executor.CommandSource
        $startInfo.Arguments = (($dockerArguments | ForEach-Object { ConvertTo-WindowsProcessArgument -Value ([string]$_) }) -join ' ')
        $startInfo.UseShellExecute = $false
        $startInfo.CreateNoWindow = $true
        $startInfo.RedirectStandardOutput = $true
        $startInfo.RedirectStandardError = $true

        $process = New-Object System.Diagnostics.Process
        $process.StartInfo = $startInfo
        if (-not $process.Start()) {
            throw 'Docker could not start pg_dump.'
        }
        $standardError = $process.StandardError.ReadToEndAsync()
        $snapshotStream = [System.IO.File]::Create($Plan.OutputPath)
        try {
            $process.StandardOutput.BaseStream.CopyTo($snapshotStream)
        }
        finally {
            $snapshotStream.Dispose()
        }
        $process.WaitForExit()
        $errorText = $standardError.Result
        if ($process.ExitCode -ne 0) {
            if (-not [string]::IsNullOrEmpty($Password)) {
                $errorText = $errorText.Replace($Password, '[REDACTED]')
            }
            throw "pg_dump failed: $errorText"
        }
    }
    finally {
        $env:PGPASSWORD = $previousPassword
        $env:PGOPTIONS = $previousOptions
    }
}

function Assert-NoPricingSnapshotSequenceSet {
    param([Parameter(Mandatory = $true)][string]$TocText)

    if ($TocText -match '(?im)\bSEQUENCE SET\b') {
        throw 'Exported pricing snapshot contains SEQUENCE SET; regenerate it without sequence data.'
    }
}

function New-PricingSnapshotExportManifest {
    param(
        [Parameter(Mandatory = $true)]$Snapshot,
        [Parameter(Mandatory = $true)]$Source,
        [Parameter(Mandatory = $true)]$PgDumpExecutor,
        [Parameter(Mandatory = $true)][string]$FileName,
        [string]$PostgresImage = 'postgres:17',
        [string]$ExportedAtUtc = ([DateTimeOffset]::UtcNow.ToString('o'))
    )

    return [ordered]@{
        fileName = $FileName
        sizeBytes = [long]$Snapshot.SizeBytes
        sha256 = [string]$Snapshot.Sha256
        format = [string]$Snapshot.Format
        tables = @($Snapshot.Tables)
        status = [string]$Snapshot.ValidationStatus
        exportedAtUtc = $ExportedAtUtc
        source = [ordered]@{
            host = [string]$Source.Host
            port = [int]$Source.Port
            database = [string]$Source.Database
            user = [string]$Source.UserName
        }
        tooling = [ordered]@{
            pgDumpMode = if ($PgDumpExecutor.Mode -eq 'Local') { 'local' } else { 'docker' }
            postgresImage = if ($PgDumpExecutor.Mode -eq 'Local') { $null } else { $PostgresImage }
        }
    }
}

function Invoke-PgRestoreList {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [string]$PgRestorePath = 'pg_restore',
        [string]$PostgresContainer = 'supabase_db_compra-car'
    )

    try {
        $executor = Resolve-PgRestoreExecutor -PgRestorePath $PgRestorePath -PostgresContainer $PostgresContainer
        $output = Invoke-PostgreSqlClient -Executor $executor -Arguments @('--list', $Path) -InputFilePath $Path
    }
    catch {
        throw "pg_restore could not inspect the custom-format snapshot: $($_.Exception.Message)"
    }
    return ($output -join [Environment]::NewLine)
}

function Test-CustomSnapshotToc {
    param([Parameter(Mandatory = $true)][string]$TocText)

    Assert-NoForbiddenSnapshotText -Text $TocText
    $foundTables = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::Ordinal)
    $allowedSequences = @($script:AllowedPricingTables | ForEach-Object { "${_}_id_seq" })

    foreach ($line in ($TocText -split '\r?\n')) {
        if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith(';')) {
            continue
        }
        if ($line -match '^\d+;\s+\d+\s+\d+\s+TABLE DATA\s+(\S+)\s+(\S+)\s+(\S+)\s*$') {
            $schema = $Matches[1]
            $table = $Matches[2]
            $owner = $Matches[3]
            if ($schema -ne 'public' -or $table -notin $script:AllowedPricingTables) {
                throw "Custom snapshot contains unexpected table data: $schema.$table."
            }
            if ($owner -ne 'postgres') {
                throw "Custom snapshot contains unexpected owner '$owner' for public.$table."
            }
            [void]$foundTables.Add($table)
            continue
        }
        if ($line -match '^\d+;\s+\d+\s+\d+\s+SEQUENCE SET\s+(\S+)\s+(\S+)\s+(\S+)\s*$') {
            if ($Matches[1] -ne 'public' -or $Matches[2] -notin $allowedSequences -or $Matches[3] -ne 'postgres') {
                throw "Custom snapshot contains an unexpected sequence entry: $line"
            }
            continue
        }
        throw "Custom snapshot contains an unsupported archive entry: $line"
    }

    $missing = @($script:AllowedPricingTables | Where-Object { -not $foundTables.Contains($_) })
    if ($missing.Count -gt 0) {
        throw "Custom snapshot is incomplete; required table data entries are missing: $($missing -join ', ')."
    }
    return @($foundTables | Sort-Object | ForEach-Object { "public.$_" })
}

function Get-ValidatedPricingSnapshot {
    param(
        [Parameter(Mandatory = $true)][string]$SnapshotPath,
        [Parameter(Mandatory = $true)][string]$AllowedSnapshotDirectory,
        [Parameter(Mandatory = $true)][ValidatePattern('^[A-Fa-f0-9]{64}$')][string]$ExpectedSha256,
        [long]$MaximumBytes = 1073741824,
        [string]$PgRestorePath = 'pg_restore',
        [string]$PostgresContainer = 'supabase_db_compra-car'
    )

    if (-not (Test-Path -LiteralPath $SnapshotPath -PathType Leaf)) {
        throw "Snapshot file does not exist: $SnapshotPath"
    }
    if (-not (Test-Path -LiteralPath $AllowedSnapshotDirectory -PathType Container)) {
        throw "Allowed snapshot directory does not exist: $AllowedSnapshotDirectory"
    }
    if (-not (Test-PathInsideDirectory -Path $SnapshotPath -AllowedDirectory $AllowedSnapshotDirectory)) {
        throw 'Snapshot file is outside the explicitly allowed directory.'
    }

    $file = Get-Item -LiteralPath $SnapshotPath
    if ($file.Length -le 0 -or $file.Length -gt $MaximumBytes) {
        throw "Snapshot size must be between 1 and $MaximumBytes bytes."
    }

    $extension = $file.Extension.ToLowerInvariant()
    if ($extension -notin @('.sql', '.dump', '.backup')) {
        throw 'Snapshot extension must be .sql, .dump, or .backup.'
    }

    $actualSha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualSha256 -ne $ExpectedSha256.ToLowerInvariant()) {
        throw 'Snapshot SHA256 does not match the authorized digest.'
    }

    if ($extension -eq '.sql') {
        $format = 'plain-sql-copy'
        $tables = Test-PlainSqlSnapshot -Path $file.FullName
    }
    else {
        $header = [System.IO.File]::ReadAllBytes($file.FullName)
        if ($header.Length -lt 5 -or [System.Text.Encoding]::ASCII.GetString($header, 0, 5) -ne 'PGDMP') {
            throw 'Binary snapshot is not a PostgreSQL custom-format archive.'
        }
        $format = 'postgres-custom'
        $toc = Invoke-PgRestoreList -Path $file.FullName -PgRestorePath $PgRestorePath -PostgresContainer $PostgresContainer
        $tables = Test-CustomSnapshotToc -TocText $toc
    }

    return [pscustomobject]@{
        Path = $file.FullName
        FileName = $file.Name
        SizeBytes = $file.Length
        Sha256 = $actualSha256
        Format = $format
        Tables = @($tables)
        ValidationStatus = 'VALIDATED'
    }
}

function New-LocalRestorePlan {
    param(
        [Parameter(Mandatory = $true)]$Snapshot,
        [Parameter(Mandatory = $true)]$Target,
        [string]$PsqlPath = 'psql',
        [string]$PgRestorePath = 'pg_restore'
    )

    $connectionArguments = @(
        '--host', $Target.Host,
        '--port', [string]$Target.Port,
        '--username', $Target.UserName,
        '--dbname', $Target.Database
    )
    if ($Snapshot.Format -eq 'plain-sql-copy') {
        return [pscustomobject]@{
            Executable = $PsqlPath
            Arguments = @('--no-psqlrc', '--single-transaction', '--set=ON_ERROR_STOP=1') + $connectionArguments + @('--file', $Snapshot.Path)
            Password = $Target.Password
            SanitizedTarget = $Target.SanitizedIdentity
            Format = $Snapshot.Format
            InputFilePath = $Snapshot.Path
            Client = 'psql'
        }
    }

    return [pscustomobject]@{
        Executable = $PgRestorePath
        Arguments = @('--verbose', '--data-only', '--exit-on-error', '--single-transaction', '--no-owner', '--no-privileges') + $connectionArguments + @($Snapshot.Path)
        Password = $Target.Password
        SanitizedTarget = $Target.SanitizedIdentity
        Format = $Snapshot.Format
        InputFilePath = $Snapshot.Path
        Client = 'pg_restore'
    }
}

function ConvertTo-ValidatedPricingRowCounts {
    param(
        [Parameter(Mandatory = $true)]$Counts,
        [switch]$RequirePositive,
        [string]$Description = 'Pricing row counts'
    )

    $providedCounts = @{}
    if ($Counts -is [System.Collections.IDictionary]) {
        foreach ($key in $Counts.Keys) {
            $providedCounts[[string]$key] = $Counts[$key]
        }
    }
    else {
        foreach ($property in $Counts.PSObject.Properties) {
            $providedCounts[[string]$property.Name] = $property.Value
        }
    }
    $unexpected = @($providedCounts.Keys | Where-Object { $_ -notin $script:AllowedPricingTables })
    $missing = @($script:AllowedPricingTables | Where-Object { -not $providedCounts.ContainsKey($_) })
    if ($unexpected.Count -gt 0 -or $missing.Count -gt 0) {
        throw "$Description must contain exactly the seven allowed pricing tables."
    }

    $validated = [ordered]@{}
    foreach ($table in $script:AllowedPricingTables) {
        try {
            $count = [long]$providedCounts[$table]
        }
        catch {
            throw "$Description contains an invalid count for public.$table."
        }
        if ($count -lt 0 -or ($RequirePositive.IsPresent -and $count -eq 0)) {
            throw "$Description contains an invalid or empty count for public.$table."
        }
        $validated[$table] = $count
    }
    return $validated
}

function Assert-PricingRestoreRowCounts {
    param(
        [Parameter(Mandatory = $true)]$ActualCounts,
        [Parameter(Mandatory = $true)]$ExpectedCounts
    )

    $actual = ConvertTo-ValidatedPricingRowCounts -Counts $ActualCounts -RequirePositive -Description 'Post-restore row counts'
    $expected = ConvertTo-ValidatedPricingRowCounts -Counts $ExpectedCounts -RequirePositive -Description 'Expected row counts'
    foreach ($table in $script:AllowedPricingTables) {
        if ([long]$actual[$table] -ne [long]$expected[$table]) {
            throw "Post-restore count mismatch for public.$table`: expected $($expected[$table]), received $($actual[$table])."
        }
    }
    return $actual
}

function Complete-LocalPricingRestore {
    param(
        [Parameter(Mandatory = $true)][bool]$RestoreExecuted,
        [Parameter(Mandatory = $true)][bool]$DatabaseMode,
        [Parameter(Mandatory = $true)]$ActualCounts,
        [Parameter(Mandatory = $true)]$ExpectedCounts
    )

    if (-not $RestoreExecuted) {
        throw 'pg_restore was not executed; local restore cannot be reported as successful.'
    }
    if (-not $DatabaseMode) {
        throw 'pg_restore did not execute in database mode; --dbname is required.'
    }
    $validatedCounts = Assert-PricingRestoreRowCounts -ActualCounts $ActualCounts -ExpectedCounts $ExpectedCounts
    return [pscustomobject]@{
        Counts = $validatedCounts
        RestoreExecuted = $true
        DatabaseMode = $true
        Status = 'RESTORED_LOCALLY'
    }
}

function Get-LocalRestoreDatabaseState {
    param(
        [Parameter(Mandatory = $true)]$Target,
        [string]$PsqlPath = 'psql',
        [string]$PostgresContainer = 'supabase_db_compra-car',
        [string]$DockerPath = 'docker',
        $PsqlExecutor
    )

    $countExpressions = @($script:AllowedPricingTables | ForEach-Object { "'$_', (SELECT count(*) FROM public.$_)" })
    $query = "SELECT json_build_object('user', current_user, 'database', current_database(), 'address', inet_server_addr()::text, 'port', inet_server_port(), 'counts', json_build_object($($countExpressions -join ', ')))::text;"
    $arguments = @(
        '--no-psqlrc', '--tuples-only', '--no-align', '--set=ON_ERROR_STOP=1',
        '--host', $Target.Host, '--port', [string]$Target.Port,
        '--username', $Target.UserName, '--dbname', $Target.Database,
        '--command', $query
    )
    $output = Invoke-Psql -Arguments $arguments -Password $Target.Password -PsqlPath $PsqlPath -PostgresContainer $PostgresContainer -Executor $PsqlExecutor
    $jsonLine = @($output | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) })[-1]
    $result = $jsonLine | ConvertFrom-Json
    if ($null -ne $PsqlExecutor -and $PsqlExecutor.Mode -eq 'Docker') {
        $containerMetadata = $PsqlExecutor
    }
    else {
        $containerMetadata = Get-PostgreSqlContainerRuntimeMetadata -PostgresContainer $PostgresContainer -DockerPath $DockerPath
    }
    $expectedServerPort = Resolve-PostgreSqlContainerPortMapping -Executor $containerMetadata -ExpectedHostPort ([int]$Target.Port)
    if ([int]$result.port -ne $expectedServerPort -or
        [string]$result.database -ne [string]$Target.Database -or
        [string]$result.user -ne [string]$Target.UserName) {
        throw 'Connected database identity does not match the validated local target.'
    }
    [void](Test-PostgreSqlServerAddress -Address ([string]$result.address) -ContainerIpAddresses @($containerMetadata.ContainerIpAddresses))
    $result.counts = ConvertTo-ValidatedPricingRowCounts -Counts $result.counts -Description 'Connected database row counts'
    return $result
}

function Test-LocalRestoreDestination {
    param(
        [Parameter(Mandatory = $true)]$Target,
        [string]$PsqlPath = 'psql',
        [string]$PostgresContainer = 'supabase_db_compra-car',
        [string]$DockerPath = 'docker',
        $PsqlExecutor
    )

    $result = Get-LocalRestoreDatabaseState -Target $Target -PsqlPath $PsqlPath -PostgresContainer $PostgresContainer -DockerPath $DockerPath -PsqlExecutor $PsqlExecutor
    foreach ($table in $script:AllowedPricingTables) {
        if ([long]$result.counts[$table] -ne 0) {
            throw "Local restore destination is not empty: public.$table has $($result.counts[$table]) rows."
        }
    }
    return $result
}

function Invoke-LocalSnapshotRestore {
    param(
        [Parameter(Mandatory = $true)]$Plan,
        [Parameter(Mandatory = $true)]$Target,
        [Parameter(Mandatory = $true)]$ExpectedRowCounts,
        [string]$PsqlPath = 'psql',
        [string]$PostgresContainer = 'supabase_db_compra-car',
        [string]$PostgresImage = 'postgres:17',
        [string]$DockerPath = 'docker',
        $PsqlExecutor,
        $PgRestoreExecutor
    )

    [void](ConvertTo-ValidatedPricingRowCounts -Counts $ExpectedRowCounts -RequirePositive -Description 'Expected row counts')
    if ($Plan.Client -ne 'pg_restore') {
        throw 'Local pricing restore requires pg_restore with a validated custom-format archive.'
    }
    Assert-PgRestoreDatabaseArguments -Arguments $Plan.Arguments -ArchivePath $Plan.InputFilePath
    if ($null -eq $PsqlExecutor) {
        $PsqlExecutor = Resolve-PsqlExecutor -PsqlPath $PsqlPath -PostgresContainer $PostgresContainer -DockerPath $DockerPath
    }
    [void](Test-LocalRestoreDestination -Target $Target -PsqlPath $PsqlPath -PostgresContainer $PostgresContainer -DockerPath $DockerPath -PsqlExecutor $PsqlExecutor)
    if ($null -eq $PgRestoreExecutor) {
        $PgRestoreExecutor = Resolve-PgRestoreExecutor -PgRestorePath $Plan.Executable -PostgresContainer $PostgresContainer -PostgresImage $PostgresImage -DockerPath $DockerPath
    }
    [void](Invoke-PgRestore -Arguments $Plan.Arguments -Password $Plan.Password -InputFilePath $Plan.InputFilePath -PgRestorePath $Plan.Executable -PostgresContainer $PostgresContainer -Executor $PgRestoreExecutor)
    $postRestoreState = Get-LocalRestoreDatabaseState -Target $Target -PsqlPath $PsqlPath -PostgresContainer $PostgresContainer -DockerPath $DockerPath -PsqlExecutor $PsqlExecutor
    $completion = Complete-LocalPricingRestore -RestoreExecuted $true -DatabaseMode $true -ActualCounts $postRestoreState.counts -ExpectedCounts $ExpectedRowCounts
    Write-Verbose "Post-restore counts: $($completion.Counts | ConvertTo-Json -Compress)"
    return $completion
}

function Invoke-PricingSnapshotDryRun {
    param(
        [Parameter(Mandatory = $true)]$Target,
        [Parameter(Mandatory = $true)][string]$OutputDirectory,
        [Parameter(Mandatory = $true)][string]$AlgorithmVersion,
        [Parameter(Mandatory = $true)][ValidatePattern('^\d{4}-\d{2}-\d{2}$')][string]$CutoffDate,
        [int]$ExpectedLocalPort = 54322,
        [string]$PnpmPath = 'pnpm'
    )

    $command = Get-Command $PnpmPath -ErrorAction SilentlyContinue
    if ($null -eq $command) {
        throw "pnpm executable was not found: $PnpmPath"
    }
    if (-not (Test-Path -LiteralPath $OutputDirectory)) {
        [void](New-Item -ItemType Directory -Path $OutputDirectory -Force)
    }
    $existingSummaries = @(Get-ChildItem -LiteralPath $OutputDirectory -Filter summary.json -File -Recurse -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName })
    $arguments = @(
        'pricing:dry-run', '--',
        '--output-dir', $OutputDirectory,
        '--algorithm-version', $AlgorithmVersion,
        '--cutoff-date', $CutoffDate,
        '--expected-local-port', [string]$ExpectedLocalPort,
        '--exclude-executed-at-from-hash',
        '--verbose'
    )

    $previousDatabaseUrl = $env:DATABASE_URL
    try {
        $env:DATABASE_URL = $Target.ConnectionString
        $output = & $command.Source @arguments 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "Pricing dry-run failed: $($output -join ' ')"
        }
    }
    finally {
        $env:DATABASE_URL = $previousDatabaseUrl
    }

    $summaryFiles = @(Get-ChildItem -LiteralPath $OutputDirectory -Filter summary.json -File -Recurse | Where-Object { $_.FullName -notin $existingSummaries } | Sort-Object LastWriteTimeUtc)
    if ($summaryFiles.Count -ne 1) {
        throw "Pricing dry-run must produce exactly one new summary.json; found $($summaryFiles.Count)."
    }
    return [pscustomobject]@{
        SummaryPath = $summaryFiles[0].FullName
        ReportDirectory = $summaryFiles[0].Directory.FullName
        Summary = (Get-Content -LiteralPath $summaryFiles[0].FullName -Raw | ConvertFrom-Json)
    }
}

function New-PricingSnapshotManifest {
    param(
        [Parameter(Mandatory = $true)]$Snapshot,
        [Parameter(Mandatory = $true)]$Target,
        [Parameter(Mandatory = $true)]$DryRun,
        [Parameter(Mandatory = $true)][string]$AlgorithmVersion,
        [Parameter(Mandatory = $true)][string]$CutoffDate,
        [string]$Timestamp = ([DateTimeOffset]::UtcNow.ToString('o'))
    )

    return [ordered]@{
        timestamp = $Timestamp
        snapshotSha256 = $Snapshot.Sha256
        snapshotSizeBytes = $Snapshot.SizeBytes
        snapshotFormat = $Snapshot.Format
        algorithmVersion = $AlgorithmVersion
        cutoffDate = $CutoffDate
        localDatabase = $Target.SanitizedIdentity
        counts = $DryRun.Summary.sourceCounts
        dryRunResult = [ordered]@{
            status = $DryRun.Summary.overallStatus
            candidateCounts = $DryRun.Summary.candidateCounts
            classificationCounts = $DryRun.Summary.classificationCounts
            issueCounts = $DryRun.Summary.issueCounts
            reportDirectory = (Split-Path -Leaf $DryRun.ReportDirectory)
        }
        comparisonHash = $DryRun.Summary.comparisonHash
        finalStatus = 'RESTORED_LOCALLY_AND_DRY_RUN_COMPLETED'
    }
}

Export-ModuleMember -Function @(
    'Get-PricingSnapshotAllowedTables',
    'Get-LocalDatabaseTarget',
    'Get-RemotePricingSnapshotSource',
    'Resolve-PricingSnapshotOutputDirectory',
    'Get-ValidatedPricingSnapshot',
    'Test-PlainSqlSnapshot',
    'Test-CustomSnapshotToc',
    'Resolve-PsqlExecutor',
    'Resolve-PgRestoreExecutor',
    'Resolve-PostgreSqlContainerPortMapping',
    'Get-PostgreSqlContainerIpAddresses',
    'Test-PostgreSqlServerAddress',
    'Assert-PgRestoreDatabaseArguments',
    'ConvertTo-ValidatedPricingRowCounts',
    'Assert-PricingRestoreRowCounts',
    'Complete-LocalPricingRestore',
    'Resolve-RemotePsqlExecutor',
    'Resolve-PgDumpExecutor',
    'Invoke-Psql',
    'Invoke-PgRestore',
    'Invoke-PgRestoreList',
    'Test-RemotePricingSnapshotConnection',
    'New-PricingSnapshotExportPlan',
    'Invoke-PgDump',
    'Assert-NoPricingSnapshotSequenceSet',
    'New-PricingSnapshotExportManifest',
    'New-LocalRestorePlan',
    'Invoke-LocalSnapshotRestore',
    'Invoke-PricingSnapshotDryRun',
    'New-PricingSnapshotManifest'
)
