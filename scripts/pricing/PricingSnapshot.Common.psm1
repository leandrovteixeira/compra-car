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
            CommandSource = $localCommand.Source
            Container = $null
        }
    }

    $dockerCommand = Get-Command $DockerPath -ErrorAction SilentlyContinue
    if ($null -eq $dockerCommand) {
        throw "PostgreSQL client '$Client' was not found locally and Docker is not available."
    }
    if ([string]::IsNullOrWhiteSpace($PostgresContainer)) {
        throw 'PostgresContainer must identify a PostgreSQL container.'
    }

    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $inspection = & $dockerCommand.Source 'inspect' '--format' '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}|{{json .NetworkSettings.Ports}}' $PostgresContainer 2>&1
        $inspectionExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    if ($inspectionExitCode -ne 0) {
        throw "PostgreSQL container does not exist or cannot be inspected: $PostgresContainer"
    }
    $containerState = ([string]($inspection | Select-Object -Last 1)).Trim()
    $stateParts = $containerState.Split('|', 3)
    if ($stateParts.Count -ne 3 -or $stateParts[0] -ne 'running') {
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
        if ($portProperty.Name -notmatch '^(\d+)/tcp$') {
            continue
        }
        $containerPort = [int]$Matches[1]
        foreach ($binding in @($portProperty.Value)) {
            if ($null -ne $binding -and -not [string]::IsNullOrWhiteSpace([string]$binding.HostPort)) {
                $portMappings += [pscustomobject]@{
                    HostPort = [int]$binding.HostPort
                    ContainerPort = $containerPort
                }
            }
        }
    }

    Write-Information 'Usando PostgreSQL Client via Docker.' -InformationAction Continue
    return [pscustomobject]@{
        Mode = 'Docker'
        Client = $Client
        CommandSource = $dockerCommand.Source
        Container = $PostgresContainer
        PortMappings = @($portMappings)
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
        [string]$DockerPath = 'docker'
    )

    return Resolve-PostgreSqlClientExecutor -Client 'pg_restore' -ClientPath $PgRestorePath -PostgresContainer $PostgresContainer -DockerPath $DockerPath
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
            $previousErrorActionPreference = $ErrorActionPreference
            try {
                $ErrorActionPreference = 'Continue'
                $output = & $Executor.CommandSource @Arguments 2>&1
                $clientExitCode = $LASTEXITCODE
            }
            finally {
                $ErrorActionPreference = $previousErrorActionPreference
            }
            if ($clientExitCode -ne 0) {
                throw "PostgreSQL client command failed: $($output -join ' ')"
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
                $portMapping = @($Executor.PortMappings | Where-Object { [int]$_.HostPort -eq $hostPort })
                if ($portMapping.Count -ne 1) {
                    throw "PostgreSQL container must publish local port $hostPort exactly once: $($Executor.Container)"
                }
                $clientArguments[$argumentIndex + 1] = [string]$portMapping[0].ContainerPort
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

    if ($null -eq $Executor) {
        $Executor = Resolve-PgRestoreExecutor -PgRestorePath $PgRestorePath -PostgresContainer $PostgresContainer
    }
    return Invoke-PostgreSqlClient -Executor $Executor -Arguments $Arguments -Password $Password -InputFilePath $InputFilePath
}

function Invoke-PgRestoreList {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [string]$PgRestorePath = 'pg_restore',
        [string]$PostgresContainer = 'supabase_db_compra-car'
    )

    try {
        $output = Invoke-PgRestore -Arguments @('--list', $Path) -InputFilePath $Path -PgRestorePath $PgRestorePath -PostgresContainer $PostgresContainer
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

    $tableArguments = @($script:AllowedPricingTables | ForEach-Object { "--table=public.$_" })
    return [pscustomobject]@{
        Executable = $PgRestorePath
        Arguments = @('--data-only', '--exit-on-error', '--single-transaction', '--no-owner', '--no-privileges') + $connectionArguments + $tableArguments + @($Snapshot.Path)
        Password = $Target.Password
        SanitizedTarget = $Target.SanitizedIdentity
        Format = $Snapshot.Format
        InputFilePath = $Snapshot.Path
        Client = 'pg_restore'
    }
}

function Test-LocalRestoreDestination {
    param(
        [Parameter(Mandatory = $true)]$Target,
        [string]$PsqlPath = 'psql',
        [string]$PostgresContainer = 'supabase_db_compra-car',
        $PsqlExecutor
    )

    $countExpressions = @($script:AllowedPricingTables | ForEach-Object { "'$_', (SELECT count(*) FROM public.$_)" })
    $query = "SELECT json_build_object('database', current_database(), 'address', inet_server_addr()::text, 'port', inet_server_port(), 'counts', json_build_object($($countExpressions -join ', ')))::text;"
    $arguments = @(
        '--no-psqlrc', '--tuples-only', '--no-align', '--set=ON_ERROR_STOP=1',
        '--host', $Target.Host, '--port', [string]$Target.Port,
        '--username', $Target.UserName, '--dbname', $Target.Database,
        '--command', $query
    )
    $output = Invoke-Psql -Arguments $arguments -Password $Target.Password -PsqlPath $PsqlPath -PostgresContainer $PostgresContainer -Executor $PsqlExecutor
    $jsonLine = @($output | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) })[-1]
    $result = $jsonLine | ConvertFrom-Json
    $expectedServerPort = [int]$Target.Port
    if ($null -ne $PsqlExecutor -and $PsqlExecutor.Mode -eq 'Docker') {
        $portMapping = @($PsqlExecutor.PortMappings | Where-Object { [int]$_.HostPort -eq [int]$Target.Port })
        if ($portMapping.Count -ne 1) {
            throw "PostgreSQL container must publish local port $($Target.Port) exactly once: $($PsqlExecutor.Container)"
        }
        $expectedServerPort = [int]$portMapping[0].ContainerPort
    }
    if ([int]$result.port -ne $expectedServerPort -or [string]$result.database -ne [string]$Target.Database) {
        throw 'Connected database identity does not match the validated local target.'
    }
    try {
        $serverAddress = [System.Net.IPAddress]::Parse([string]$result.address)
    }
    catch {
        throw 'Connected database did not report a valid server IP address.'
    }
    if (-not [System.Net.IPAddress]::IsLoopback($serverAddress)) {
        throw 'Connected database server address is not loopback; restore is blocked.'
    }
    foreach ($property in $result.counts.PSObject.Properties) {
        if ([long]$property.Value -ne 0) {
            throw "Local restore destination is not empty: public.$($property.Name) has $($property.Value) rows."
        }
    }
    return $result
}

function Invoke-LocalSnapshotRestore {
    param(
        [Parameter(Mandatory = $true)]$Plan,
        [Parameter(Mandatory = $true)]$Target,
        [string]$PsqlPath = 'psql',
        [string]$PostgresContainer = 'supabase_db_compra-car'
    )

    $psqlExecutor = Resolve-PsqlExecutor -PsqlPath $PsqlPath -PostgresContainer $PostgresContainer
    [void](Test-LocalRestoreDestination -Target $Target -PsqlPath $PsqlPath -PostgresContainer $PostgresContainer -PsqlExecutor $psqlExecutor)
    if ($Plan.Client -eq 'psql') {
        [void](Invoke-Psql -Arguments $Plan.Arguments -Password $Plan.Password -InputFilePath $Plan.InputFilePath -Executor $psqlExecutor)
    }
    else {
        [void](Invoke-PgRestore -Arguments $Plan.Arguments -Password $Plan.Password -InputFilePath $Plan.InputFilePath -PgRestorePath $Plan.Executable -PostgresContainer $PostgresContainer)
    }
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
    'Get-ValidatedPricingSnapshot',
    'Test-PlainSqlSnapshot',
    'Test-CustomSnapshotToc',
    'Resolve-PsqlExecutor',
    'Resolve-PgRestoreExecutor',
    'Invoke-Psql',
    'Invoke-PgRestore',
    'New-LocalRestorePlan',
    'Invoke-LocalSnapshotRestore',
    'Invoke-PricingSnapshotDryRun',
    'New-PricingSnapshotManifest'
)
