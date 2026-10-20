# Supabase & Deno Auto-Update Script
# Updates Deno dependencies, syncs secrets, and deploys Edge Functions
# Usage: .\scripts\supabase-auto-update.ps1 [-CheckOnly] [-Force] [-SyncSecrets]

param(
    [switch]$CheckOnly,      # Only check for updates, don't apply
    [switch]$Force,          # Force redeploy all functions
    [switch]$SyncSecrets,    # Sync secrets from .env to Supabase
    [switch]$Watch           # Watch for changes and auto-deploy
)

$ErrorActionPreference = "Stop"
$DenoJsonPath = "supabase/functions/deno.json"
$EnvFile = ".env"
$VersionCachePath = ".supabase-versions.json"

# Color output helper
function Write-Color($Color, $Message) {
    Write-Host $Message -ForegroundColor $Color
}

# Check if Supabase CLI exists
function Test-SupabaseCLI {
    try {
        $null = supabase --version 2>$null
        return $true
    } catch {
        return $false
    }
}

# Get latest Deno std version
function Get-LatestDenoStdVersion {
    try {
        $response = Invoke-RestMethod -Uri "https://api.github.com/repos/denoland/deno_std/releases/latest" -Headers @{ "User-Agent" = "PowerShell" }
        return $response.tag_name -replace "^v?", ""
    } catch {
        Write-Color Yellow "Could not fetch latest Deno std version: $_"
        return $null
    }
}

# Get latest package version from esm.sh
function Get-LatestEsmVersion {
    param([string]$Package)
    try {
        # Check npm registry for latest version
        $response = Invoke-RestMethod -Uri "https://registry.npmjs.org/$Package/latest" -Headers @{ "User-Agent" = "PowerShell" }
        return $response.version
    } catch {
        return $null
    }
}

# Parse current deno.json imports
function Get-CurrentVersions {
    if (-not (Test-Path $DenoJsonPath)) {
        Write-Color Red "deno.json not found at $DenoJsonPath"
        return $null
    }
    
    $config = Get-Content $DenoJsonPath -Raw | ConvertFrom-Json
    $versions = @{}
    
    foreach ($import in $config.imports.PSObject.Properties) {
        $name = $import.Name
        $url = $import.Value
        
        # Extract version from URL patterns
        if ($url -match '@(\d+\.\d+\.\d+)') {
            $versions[$name] = $matches[1]
        } elseif ($url -match 'v(\d+\.\d+\.\d+)') {
            $versions[$name] = $matches[1]
        }
    }
    
    return $versions
}

# Update deno.json with new versions
function Update-DenoJson {
    param([hashtable]$Updates)
    
    if ($Updates.Count -eq 0) {
        Write-Color Green "All dependencies are up to date!"
        return $false
    }
    
    $content = Get-Content $DenoJsonPath -Raw
    
    foreach ($pkg in $Updates.Keys) {
        $newVersion = $Updates[$pkg].new
        $oldVersion = $Updates[$pkg].old
        
        Write-Color Cyan "  Updating $pkg : $oldVersion -> $newVersion"
        
        # Replace version in URL patterns
        $content = $content -replace "@$oldVersion", "@$newVersion"
        $content = $content -replace "v$oldVersion", "v$newVersion"
    }
    
    Set-Content -Path $DenoJsonPath -Value $content -NoNewline
    return $true
}

# Sync secrets from .env to Supabase
function Sync-SecretsToSupabase {
    Write-Color Cyan "`n========================================="
    Write-Color Cyan "  Syncing Secrets to Supabase"
    Write-Color Cyan "=========================================`n"
    
    if (-not (Test-Path $EnvFile)) {
        Write-Color Yellow "No .env file found. Creating template..."
        
        @"
# Supabase Edge Function Secrets
# These will be synced to Supabase

# OpenAI
OPENAI_API_KEY=

# Gemini AI
GEMINI_API_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Resend Email
RESEND_API_KEY=

# GoHighLevel CRM
GOHIGHLEVEL_API_KEY=
# Optional shared secret for inbound GoHighLevel webhook signature verification
GHL_WEBHOOK_SECRET=
GHL_LOCATION_ID=

# Other APIs
ANTHROPIC_API_KEY=
"@ | Set-Content $EnvFile
        
        Write-Color Yellow "Created .env template. Please fill in your secrets and run again."
        return
    }
    
    # Parse .env file
    $secrets = @{}
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match '^([A-Z_]+)=(.+)$') {
            $key = $matches[1]
            $value = $matches[2].Trim()
            if ($value -and $value -ne "") {
                $secrets[$key] = $value
            }
        }
    }

    if ($secrets.ContainsKey("GHL_API_KEY")) {
        if ($secrets.ContainsKey("GOHIGHLEVEL_API_KEY") -and $secrets["GOHIGHLEVEL_API_KEY"] -ne $secrets["GHL_API_KEY"]) {
            Write-Color Red "Both GHL_API_KEY and GOHIGHLEVEL_API_KEY are set with different values. Keep only GOHIGHLEVEL_API_KEY."
            return
        }
        $secrets["GOHIGHLEVEL_API_KEY"] = $secrets["GHL_API_KEY"]
        $secrets.Remove("GHL_API_KEY")
    }
    
    if ($secrets.Count -eq 0) {
        Write-Color Yellow "No secrets found in .env file"
        return
    }
    
    Write-Color Yellow "Found $($secrets.Count) secrets to sync:"
    
    foreach ($key in $secrets.Keys) {
        Write-Color Gray "  - $key"
    }
    
    # Set secrets in Supabase
    Write-Color Yellow "`nPushing secrets to Supabase..."
    
    $secretArgs = @()
    foreach ($key in $secrets.Keys) {
        $secretArgs += "$key=$($secrets[$key])"
    }
    
    try {
        & supabase secrets set @secretArgs
        
        if ($LASTEXITCODE -eq 0) {
            Write-Color Green "✓ Secrets synced successfully!"
        } else {
            Write-Color Red "✗ Failed to sync secrets"
        }
    } catch {
        Write-Color Red "Error syncing secrets: $_"
    }
}

# Deploy all Edge Functions
function Publish-EdgeFunctions {
    param([switch]$ForceAll)
    
    Write-Color Cyan "`n========================================="
    Write-Color Cyan "  Deploying Edge Functions"
    Write-Color Cyan "=========================================`n"
    
    $functionsDir = "supabase/functions"
    $functions = Get-ChildItem -Path $functionsDir -Directory | Where-Object { $_.Name -ne "node_modules" }
    
    $deployed = 0
    $failed = 0
    
    foreach ($func in $functions) {
        $funcName = $func.Name
        Write-Color Yellow "  Deploying: $funcName..."
        
        try {
            supabase functions deploy $funcName --no-verify-jwt 2>$null
            
            if ($LASTEXITCODE -eq 0) {
                Write-Color Green "    ✓ $funcName deployed"
                $deployed++
            } else {
                Write-Color Red "    ✗ $funcName failed"
                $failed++
            }
        } catch {
            Write-Color Red "    ✗ $funcName error: $_"
            $failed++
        }
    }
    
    Write-Color Cyan "`nDeployment Summary:"
    Write-Color Green "  Deployed: $deployed"
    if ($failed -gt 0) {
        Write-Color Red "  Failed: $failed"
    }
}

# Check for Deno/dependency updates
function Test-Updates {
    Write-Color Cyan "`n========================================="
    Write-Color Cyan "  Checking for Updates"
    Write-Color Cyan "=========================================`n"
    
    $currentVersions = Get-CurrentVersions
    if (-not $currentVersions) { return @{} }
    
    $updates = @{}
    
    # Check Deno std
    if ($currentVersions["serve"]) {
        $latestStd = Get-LatestDenoStdVersion
        if ($latestStd -and $latestStd -ne $currentVersions["serve"]) {
            $updates["serve"] = @{ old = $currentVersions["serve"]; new = $latestStd }
            Write-Color Yellow "  serve (deno std): $($currentVersions["serve"]) -> $latestStd"
        } else {
            Write-Color Green "  serve (deno std): $($currentVersions["serve"]) (up to date)"
        }
    }
    
    # Check npm packages via esm.sh
    $npmPackages = @{
        "@supabase/supabase-js" = "@supabase/supabase-js"
        "stripe" = "stripe"
        "resend" = "resend"
    }
    
    foreach ($pkg in $npmPackages.Keys) {
        $npmName = $npmPackages[$pkg]
        if ($currentVersions[$pkg]) {
            $latest = Get-LatestEsmVersion -Package $npmName
            if ($latest -and $latest -ne $currentVersions[$pkg]) {
                $updates[$pkg] = @{ old = $currentVersions[$pkg]; new = $latest }
                Write-Color Yellow "  ${pkg}: $($currentVersions[$pkg]) -> $latest"
            } else {
                Write-Color Green "  ${pkg}: $($currentVersions[$pkg]) (up to date)"
            }
        }
    }
    
    return $updates
}

# Save version cache
function Save-VersionCache {
    param([hashtable]$Versions)
    $Versions | ConvertTo-Json | Set-Content $VersionCachePath
}

# Watch mode - monitor for changes
function Start-WatchMode {
    Write-Color Cyan "`n========================================="
    Write-Color Cyan "  Watch Mode - Monitoring for Changes"
    Write-Color Cyan "  Press Ctrl+C to stop"
    Write-Color Cyan "=========================================`n"
    
    $lastCheck = Get-Date
    $checkIntervalHours = 6  # Check for updates every 6 hours
    
    # Initial deploy
    Publish-EdgeFunctions
    
    while ($true) {
        Start-Sleep -Seconds 60
        
        $now = Get-Date
        $elapsed = ($now - $lastCheck).TotalHours
        
        if ($elapsed -ge $checkIntervalHours) {
            Write-Color Yellow "`n[$(Get-Date -Format 'HH:mm')] Checking for dependency updates..."
            $updates = Test-Updates
            
            if ($updates.Count -gt 0) {
                Write-Color Yellow "Updates available! Applying..."
                Update-DenoJson -Updates $updates
                Publish-EdgeFunctions
            }
            
            $lastCheck = Get-Date
        }
        
        # Check for local file changes
        $changedFuncs = git diff --name-only 2>$null | Where-Object { $_ -match "^supabase/functions/" }
        if ($changedFuncs) {
            Write-Color Yellow "`nLocal changes detected in Edge Functions..."
            
            # Extract function names
            $funcNames = $changedFuncs | ForEach-Object {
                if ($_ -match "^supabase/functions/([^/]+)/") {
                    $matches[1]
                }
            } | Sort-Object -Unique
            
            foreach ($fn in $funcNames) {
                Write-Color Yellow "  Deploying changed function: $fn"
                supabase functions deploy $fn --no-verify-jwt 2>$null
            }
        }
    }
}

# Main execution
Write-Color Cyan @"
╔═══════════════════════════════════════╗
║  Supabase & Deno Auto-Update Tool    ║
╚═══════════════════════════════════════╝
"@

# Check CLI
if (-not (Test-SupabaseCLI)) {
    Write-Color Yellow "Supabase CLI not found. Installing..."
    npm install -g supabase
}

# Check if linked to project
if (-not (Test-Path ".supabase")) {
    Write-Color Yellow "Project not linked to Supabase. Running link..."
    supabase link
}

# Run requested operations
if ($Watch) {
    Start-WatchMode
} else {
    # Check for updates
    $updates = Test-Updates
    
    if (-not $CheckOnly) {
        # Apply updates if any
        if ($updates.Count -gt 0) {
            Write-Color Yellow "`nApplying updates..."
            $updated = Update-DenoJson -Updates $updates
            
            if ($updated) {
                Write-Color Green "✓ deno.json updated"
            }
        }
        
        # Sync secrets if requested
        if ($SyncSecrets) {
            Sync-SecretsToSupabase
        }
        
        # Deploy functions
        if ($Force -or $updates.Count -gt 0) {
            Publish-EdgeFunctions -ForceAll:$Force
        }
    } else {
        if ($updates.Count -eq 0) {
            Write-Color Green "`n✓ All dependencies are up to date!"
        } else {
            Write-Color Yellow "`nRun without -CheckOnly to apply updates"
        }
    }
}

Write-Color Cyan "`nDone!"
