[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$scriptDirectory = Split-Path -Parent $PSScriptRoot
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
Import-Module (Join-Path $scriptDirectory 'PricingSnapshot.Common.psm1') -Force

$script:Passed = 0
$script:Failed = 0

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) {
        throw $Message
    }
}

function Assert-ThrowsLike {
    param([scriptblock]$Action, [string]$Pattern)
    try {
        & $Action
    }
    catch {
        if ($_.Exception.Message -notlike $Pattern) {
            throw "Expected error like '$Pattern', received '$($_.Exception.Message)'."
        }
        return
    }
    throw "Expected an error like '$Pattern', but no error was raised."
}

function Invoke-Test {
    param([string]$Name, [scriptblock]$Action)
    try {
        & $Action
        $script:Passed += 1
        Write-Output "PASS $Name"
    }
    catch {
        $script:Failed += 1
        Write-Output "FAIL $Name - $($_.Exception.Message)"
    }
}

function New-ValidSqlSnapshotText {
    $blocks = foreach ($table in (Get-PricingSnapshotAllowedTables)) {
        "COPY public.$table (id) FROM stdin;`n\.`n"
    }
    return "-- PostgreSQL data-only snapshot`nSET client_encoding = 'UTF8';`n$($blocks -join '')"
}

$temporaryDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("compra-car-pricing-snapshot-tests-" + [guid]::NewGuid().ToString('N'))
[void](New-Item -ItemType Directory -Path $temporaryDirectory)
try {
    $validSnapshotPath = Join-Path $temporaryDirectory 'authorized.sql'
    [System.IO.File]::WriteAllText($validSnapshotPath, (New-ValidSqlSnapshotText), [System.Text.UTF8Encoding]::new($false))
    $validSha = (Get-FileHash -LiteralPath $validSnapshotPath -Algorithm SHA256).Hash

    Invoke-Test 'missing file is rejected' {
        Assert-ThrowsLike -Pattern '*does not exist*' -Action {
            Get-ValidatedPricingSnapshot -SnapshotPath (Join-Path $temporaryDirectory 'missing.sql') -AllowedSnapshotDirectory $temporaryDirectory -ExpectedSha256 ('0' * 64)
        }
    }

    Invoke-Test 'SHA mismatch is rejected' {
        Assert-ThrowsLike -Pattern '*SHA256 does not match*' -Action {
            Get-ValidatedPricingSnapshot -SnapshotPath $validSnapshotPath -AllowedSnapshotDirectory $temporaryDirectory -ExpectedSha256 ('0' * 64)
        }
    }

    Invoke-Test 'table outside allowlist is rejected' {
        $path = Join-Path $temporaryDirectory 'unexpected-table.sql'
        [System.IO.File]::WriteAllText($path, ((New-ValidSqlSnapshotText) + "COPY public.profiles (id) FROM stdin;`n\.`n"))
        $sha = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
        Assert-ThrowsLike -Pattern '*outside the allowlist*' -Action {
            Get-ValidatedPricingSnapshot -SnapshotPath $path -AllowedSnapshotDirectory $temporaryDirectory -ExpectedSha256 $sha
        }
    }

    Invoke-Test 'DROP is rejected' {
        $path = Join-Path $temporaryDirectory 'drop.sql'
        [System.IO.File]::WriteAllText($path, ("DROP TABLE public.products;`n" + (New-ValidSqlSnapshotText)))
        $sha = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
        Assert-ThrowsLike -Pattern '*prohibited content: DROP*' -Action {
            Get-ValidatedPricingSnapshot -SnapshotPath $path -AllowedSnapshotDirectory $temporaryDirectory -ExpectedSha256 $sha
        }
    }

    Invoke-Test 'remote host is rejected' {
        Assert-ThrowsLike -Pattern '*Remote database hosts are disabled*' -Action {
            Get-LocalDatabaseTarget -DatabaseUrl 'postgresql://postgres:secret@example.supabase.com:54322/postgres'
        }
    }

    Invoke-Test 'wrong local port is rejected' {
        Assert-ThrowsLike -Pattern '*must target the configured local Supabase port 54322*' -Action {
            Get-LocalDatabaseTarget -DatabaseUrl 'postgresql://postgres:secret@127.0.0.1:5432/postgres'
        }
    }

    Invoke-Test 'restore without explicit confirmation is blocked' {
        $restoreScript = Join-Path $scriptDirectory 'restore-pricing-legacy-snapshot-local.ps1'
        Assert-ThrowsLike -Pattern '*ConfirmLocalRestore*' -Action {
            & $restoreScript -SnapshotPath $validSnapshotPath -AllowedSnapshotDirectory $temporaryDirectory -ExpectedSha256 $validSha -DatabaseUrl 'postgresql://postgres:secret@127.0.0.1:54322/postgres'
        }
    }

    Invoke-Test 'confirmed restore produces safe plan under WhatIf' {
        $restoreScript = Join-Path $scriptDirectory 'restore-pricing-legacy-snapshot-local.ps1'
        $output = & $restoreScript -SnapshotPath $validSnapshotPath -AllowedSnapshotDirectory $temporaryDirectory -ExpectedSha256 $validSha -DatabaseUrl 'postgresql://postgres:secret@127.0.0.1:54322/postgres' -ConfirmLocalRestore -WhatIf 3>&1
        Assert-True -Condition (($output -join "`n") -match 'PLANNED_ONLY') -Message 'Restore did not return PLANNED_ONLY under WhatIf.'
        Assert-True -Condition (($output -join "`n") -notmatch 'secret') -Message 'Restore plan leaked the password.'
    }

    Invoke-Test 'restore plan is data-only and has no dangerous options' {
        $snapshot = Get-ValidatedPricingSnapshot -SnapshotPath $validSnapshotPath -AllowedSnapshotDirectory $temporaryDirectory -ExpectedSha256 $validSha
        $target = Get-LocalDatabaseTarget -DatabaseUrl 'postgresql://postgres:secret@localhost:54322/postgres'
        $plan = New-LocalRestorePlan -Snapshot $snapshot -Target $target
        $arguments = $plan.Arguments -join ' '
        Assert-True -Condition ($arguments -match '--single-transaction') -Message 'Single transaction is required.'
        Assert-True -Condition ($arguments -notmatch '--clean|--create|--if-exists|postgresql://') -Message 'Restore plan contains a dangerous option or URL.'
    }

    Invoke-Test 'pricing dry-run executes against a fixture' {
        $fixture = Join-Path $repositoryRoot 'packages\pricing-dry-run\test\fixtures\legacy-snapshot.json'
        $reportRoot = Join-Path $temporaryDirectory 'dry-run-fixture'
        Push-Location $repositoryRoot
        try {
            $output = & pnpm pricing:dry-run -- --fixture $fixture --output-dir $reportRoot --algorithm-version snapshot-test --cutoff-date 2026-07-25 --exclude-executed-at-from-hash --verbose 2>&1
            if ($LASTEXITCODE -ne 0) {
                throw "Fixture dry-run failed: $($output -join ' ')"
            }
        }
        finally {
            Pop-Location
        }
        $summaries = @(Get-ChildItem -LiteralPath $reportRoot -Filter summary.json -File -Recurse)
        Assert-True -Condition ($summaries.Count -eq 1) -Message 'Dry-run did not create exactly one summary.'
    }

    Invoke-Test 'manifest is sanitized and complete' {
        $summaryFile = Get-ChildItem -LiteralPath (Join-Path $temporaryDirectory 'dry-run-fixture') -Filter summary.json -File -Recurse | Select-Object -First 1
        $dryRun = [pscustomobject]@{
            Summary = (Get-Content -LiteralPath $summaryFile.FullName -Raw | ConvertFrom-Json)
            ReportDirectory = $summaryFile.Directory.FullName
        }
        $snapshot = Get-ValidatedPricingSnapshot -SnapshotPath $validSnapshotPath -AllowedSnapshotDirectory $temporaryDirectory -ExpectedSha256 $validSha
        $target = Get-LocalDatabaseTarget -DatabaseUrl 'postgresql://postgres:secret@127.0.0.1:54322/postgres'
        $manifest = New-PricingSnapshotManifest -Snapshot $snapshot -Target $target -DryRun $dryRun -AlgorithmVersion 'snapshot-test' -CutoffDate '2026-07-25' -Timestamp '2026-07-25T23:00:00Z'
        $json = $manifest | ConvertTo-Json -Depth 12
        Assert-True -Condition ($json -match 'comparisonHash') -Message 'Manifest has no comparison hash.'
        Assert-True -Condition ($json -match '127.0.0.1:54322/postgres') -Message 'Manifest has no sanitized local identity.'
        Assert-True -Condition ($json -notmatch 'secret|postgresql://') -Message 'Manifest leaked credentials or a connection string.'
    }
}
finally {
    if (Test-Path -LiteralPath $temporaryDirectory) {
        Remove-Item -LiteralPath $temporaryDirectory -Recurse -Force
    }
}

Write-Output "Pricing snapshot PowerShell tests: $script:Passed passed, $script:Failed failed."
if ($script:Failed -gt 0) {
    exit 1
}
