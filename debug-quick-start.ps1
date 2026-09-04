<#
    Villages, from a cold machine to a running world, in one command.

        .\debug-quick-start.ps1

    It checks the tools, generates whatever part of the world is missing, starts the game server and the
    dev server, waits until both of them answer, and prints the address to open. Nothing here is clever:
    every step is a command from CLAUDE.md, run in order, with the answer to "did that work" after it.

    Both servers run hidden, with everything they print going to .logs/ beside this file.

    Switches:
        -WebOnly     just the map. No game server, so no houses and no events.
        -NoBrowser   do not open the browser.
        -Stop        stop both, and whatever they started, and exit.
        -Logs        print the tail of both logs, and exit. This is what to paste into a conversation.
#>
[CmdletBinding()]
param(
    [switch] $WebOnly,
    [switch] $NoBrowser,
    [switch] $Stop,
    [switch] $Logs
)

$ErrorActionPreference = 'Stop'

$Root = $PSScriptRoot
$LogDir = Join-Path $Root '.logs'
$BackendLog = Join-Path $LogDir 'backend.log'
$BackendErrors = Join-Path $LogDir 'backend-errors.log'
$WebLog = Join-Path $LogDir 'web.log'
$WebErrors = Join-Path $LogDir 'web-errors.log'
$StartedFile = Join-Path $LogDir 'started.json'

$WebPort = 5173
$GamePort = 8080
$Address = "http://localhost:$WebPort"

# --- saying things ---------------------------------------------------------------------------------

function Say([string] $Text) { Write-Host $Text }
function Head([string] $Text) { Write-Host ''; Write-Host $Text -ForegroundColor Cyan }
function Step([string] $Text) { Write-Host "  $Text" -ForegroundColor Gray -NoNewline }
function Good([string] $Text) { Write-Host "  $Text" -ForegroundColor Green }
function Warn([string] $Text) { Write-Host "  $Text" -ForegroundColor Yellow }
function Bad([string] $Text) { Write-Host "  $Text" -ForegroundColor Red }

# --- the machinery ---------------------------------------------------------------------------------

<#
    Is anything listening there?

    Asked of the port rather than by connecting to it, because Vite binds to whatever `localhost`
    resolves to, which here is the IPv6 loopback: a connect to 127.0.0.1 fails against a dev server
    that is plainly up and serving. The port table sees every bind address.
#>
function Test-Listening([int] $Port) {
    $listening = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
    return $listening.Count -gt 0
}

<# Wait for a port, counting out loud, and give up rather than hang forever. #>
function Wait-Listening([int] $Port, [int] $Seconds, [string] $What) {
    $started = Get-Date
    while ((Get-Date) -lt $started.AddSeconds($Seconds)) {
        if (Test-Listening $Port) {
            $took = [int] ((Get-Date) - $started).TotalSeconds
            Write-Host " up on $Port after ${took}s" -ForegroundColor Green
            return $true
        }
        Write-Host '.' -NoNewline -ForegroundColor DarkGray
        Start-Sleep -Milliseconds 900
    }
    Write-Host " gave up after ${Seconds}s" -ForegroundColor Red
    Bad "$What never answered on $Port. The last of its log:"
    return $false
}

function Show-Tail([string] $Path, [int] $Lines = 40) {
    if (-not (Test-Path $Path)) { Warn "  (no $Path yet)"; return }
    $tail = Get-Content -Path $Path -Tail $Lines -ErrorAction SilentlyContinue
    if ($null -eq $tail -or $tail.Count -eq 0) { Warn "  ($Path is empty)"; return }
    Write-Host ''
    Write-Host "  --- $Path" -ForegroundColor DarkGray
    $tail | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
}

$script:Stopped = $false

<#
    What this script started, so that -Stop can end the whole tree rather than one leaf of it.

    A server here is three or four processes deep: a hidden cmd.exe around npm around npm again around
    Vite. Killing whatever holds the port leaves the rest orphaned, so the pid of the wrapper is
    written down. Its start time goes with it: after a restart the same number belongs to something
    else entirely, and killing that would be a nasty surprise.
#>
function Remember([string] $Name, $Process) {
    $all = @{}
    if (Test-Path $StartedFile) {
        $saved = Get-Content -Raw -Path $StartedFile | ConvertFrom-Json
        foreach ($property in $saved.PSObject.Properties) { $all[$property.Name] = $property.Value }
    }
    $all[$Name] = @{ pid = $Process.Id; born = $Process.StartTime.ToString('o') }
    $all | ConvertTo-Json | Set-Content -Path $StartedFile -Encoding UTF8
}

function Stop-Remembered([string] $Name, [string] $What) {
    if (-not (Test-Path $StartedFile)) { return }
    $entry = (Get-Content -Raw -Path $StartedFile | ConvertFrom-Json).$Name
    if ($null -eq $entry) { return }
    $process = Get-Process -Id $entry.pid -ErrorAction SilentlyContinue
    if ($null -eq $process) { return }
    if ($process.StartTime.ToString('o') -ne $entry.born) { return }
    & taskkill.exe /T /F /PID $entry.pid 2>&1 | Out-Null
    Good "stopped $What, and the processes it started (pid $($entry.pid))"
    $script:Stopped = $true
}

<# Whatever holds the port, whoever started it: an IDE, the launch config, an older run of this. #>
function Stop-Port([int] $Port, [string] $What) {
    $owners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique)
    foreach ($owner in $owners) {
        $name = (Get-Process -Id $owner -ErrorAction SilentlyContinue).ProcessName
        & taskkill.exe /T /F /PID $owner 2>&1 | Out-Null
        Good "stopped $What on $Port ($name, pid $owner)"
        $script:Stopped = $true
    }
}

<#
    The full path to a real executable, or nothing.

    Two Windows traps in one function. Start-Process cannot launch a PowerShell script, and on this
    machine `Get-Command npm` finds npm.ps1 before npm.cmd, so -CommandType Application is what makes
    the difference between a running dev server and "%1 is not a valid Win32 application". The names
    are tried in order, most explicit first.
#>
function Resolve-Tool([string[]] $Names) {
    foreach ($name in $Names) {
        $found = @(Get-Command $name -CommandType Application -ErrorAction SilentlyContinue)
        if ($found.Count -gt 0) { return $found[0].Source }
    }
    return $null
}

function Start-Server([string] $File, [string[]] $Arguments, [string] $In, [string] $Out, [string] $Err) {
    return Start-Process -FilePath $File -ArgumentList $Arguments -WorkingDirectory $In `
        -RedirectStandardOutput $Out -RedirectStandardError $Err -WindowStyle Hidden -PassThru
}

<# A preparation step: show its output, because these are the slow ones, and stop if it fails. #>
function Run([string] $What, [string] $Tool, [string[]] $Arguments, [string] $In) {
    Warn "$What ..."
    Push-Location $In
    try {
        & $Tool @Arguments
        if ($LASTEXITCODE -ne 0) { throw "$What failed with exit code $LASTEXITCODE" }
    } finally {
        Pop-Location
    }
    Good "$What done"
}

# --- the two short errands -------------------------------------------------------------------------

Head 'Villages'
Say  '  One shared world of noble houses. This starts every part of it that exists.'

if ($Logs) {
    Head 'logs'
    Show-Tail $BackendLog 40
    Show-Tail $BackendErrors 15
    Show-Tail $WebLog 25
    Show-Tail $WebErrors 15
    Write-Host ''
    exit 0
}

if ($Stop) {
    Head 'stopping'
    Stop-Remembered 'web' 'the dev server'
    Stop-Remembered 'game' 'the game server'
    Stop-Port $WebPort 'the dev server'
    Stop-Port $GamePort 'the game server'
    if (-not $script:Stopped) { Good 'nothing was running' }
    Write-Host ''
    exit 0
}

# --- the tools -------------------------------------------------------------------------------------

Head 'tools'

$Npm = Resolve-Tool @('npm.cmd', 'npm')
if ($null -eq $Npm) {
    Bad 'no npm on the path. Install Node 24 from https://nodejs.org and open a new terminal.'
    exit 1
}
$NodeVersion = & (Resolve-Tool @('node.exe', 'node')) --version
Good "node $NodeVersion"

$Gradlew = Join-Path $Root 'backend\gradlew.bat'
$Java = Resolve-Tool @('java.exe', 'java')
if ($WebOnly) {
    Warn 'asked for the map only, so the game server stays down: no houses and no events'
} elseif ($null -eq $Java) {
    Warn 'no java on the path, so the map will start but the game server will not.'
    Warn 'Install Eclipse Temurin 21, then run this again to get houses and events.'
    $WebOnly = $true
} else {
    # --version rather than -version: the old flag writes to stderr, which stops the script dead.
    $JavaVersion = (& $Java --version | Select-Object -First 1)
    Good "java $JavaVersion"
    Say  '        Gradle fetches the JDK 21 it compiles with, so this one only has to run it.'
}

# --- what the browser needs ------------------------------------------------------------------------

Head 'the browser app'

if (-not (Test-Path (Join-Path $Root 'frontend\node_modules'))) {
    Run 'installing dependencies (a minute, once)' $Npm @('install') (Join-Path $Root 'frontend')
} else {
    Good 'dependencies are installed'
}

$WorldDir = Join-Path $Root 'frontend\apps\web\public\world'
$Frontend = Join-Path $Root 'frontend'
$Master = Join-Path $Root 'world\master\terrain.png'

if (-not (Test-Path $Master)) {
    Bad "the hand-painted world is missing: $Master"
    Bad 'without it there is nothing to generate. Restore it from git and run this again.'
    exit 1
}

if (-not (Test-Path (Join-Path $WorldDir 'terrain.geojson'))) {
    Run 'tracing the coast and the lakes' $Npm @('run', 'world:import') $Frontend
} else {
    Good 'the coast and the lakes are traced'
}

$Tiles = Join-Path $WorldDir 'tiles'
if (-not (Test-Path (Join-Path $Tiles '7'))) {
    Run 'cutting the world into tiles (about two minutes, once)' $Npm @('run', 'world:tile') $Frontend
} else {
    $cut = @(Get-ChildItem -Path $Tiles -Recurse -Filter '*.png' -ErrorAction SilentlyContinue).Count
    Good "the world is cut: $cut tiles"
}

if (-not (Test-Path (Join-Path $WorldDir 'paint.json'))) {
    Run 'writing the painting styles' $Npm @('run', 'world:paint', '--', '--config-only') $Frontend
} else {
    Good 'the painting styles are written'
}

# --- starting the servers --------------------------------------------------------------------------

Head 'starting'

if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }

$GameUp = $false
if (-not $WebOnly) {
    if (Test-Listening $GamePort) {
        Good "the game server is already up on $GamePort, leaving it alone"
        $GameUp = $true
    } else {
        Step 'game server  '
        Remember 'game' (Start-Server $Gradlew @('--console=plain', ':app:bootRun') `
            (Join-Path $Root 'backend') $BackendLog $BackendErrors)
        $GameUp = Wait-Listening $GamePort 300 'the game server'
        if (-not $GameUp) {
            Show-Tail $BackendLog
            Show-Tail $BackendErrors 15
            Warn 'the map still works without it. Everything below is still true.'
        }
    }
}

if (Test-Listening $WebPort) {
    Good "the dev server is already up on $WebPort, leaving it alone"
    $WebUp = $true
} else {
    Step 'dev server   '
    Remember 'web' (Start-Server $Npm @('run', 'dev') (Join-Path $Root 'frontend') $WebLog $WebErrors)
    $WebUp = Wait-Listening $WebPort 120 'the dev server'
    if (-not $WebUp) {
        Show-Tail $WebLog
        Show-Tail $WebErrors 15
        Write-Host ''
        Bad 'nothing to open. Fix the above, or paste it into a conversation with Claude.'
        exit 1
    }
}

# --- what to do now -------------------------------------------------------------------------------

Head 'ready'
Write-Host ''
Write-Host "      $Address" -ForegroundColor White -BackgroundColor DarkBlue
Write-Host ''

Say '  The map is served on 5173. The picker at the top right switches renderer; the debug panel'
Say '  under it says what the program thinks is happening, and minimises to a chip.'
if ($GameUp) {
    Say ''
    Say "  The game server is the WebSocket on $GamePort. The debug panel should say `"open`", and its"
    Say '  "found a house here" button sends a real command: an event appears in the panel, one line,'
    Say '  opening to the whole thing. Nothing is stored yet, so a restart of the server forgets them.'
} elseif (-not $WebOnly) {
    Say ''
    Warn 'The game server never came up, so the panel will say "closed" and there are no events.'
}

Head 'if something looks wrong'
Say  "  .\debug-quick-start.ps1 -Logs     the tail of both logs, which is what to paste to Claude"
Say  "  .\debug-quick-start.ps1 -Stop     stop both servers"
Say  "  .\debug-quick-start.ps1           start them again; it skips whatever is already up"
Say  ''
Say  "  logs live in $LogDir"

if (-not $NoBrowser) {
    Write-Host ''
    Good 'opening the browser'
    Start-Process $Address | Out-Null
}

Write-Host ''
