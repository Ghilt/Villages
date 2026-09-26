<#
    Villages, from a cold machine to a running world, in one command.

        .\debug-quick-start.ps1

    It checks the tools, generates whatever part of the world is missing, starts the game server and the
    dev server, waits until both of them answer, and prints the address to open. Nothing here is clever:
    every step is a command from CLAUDE.md, run in order, with the answer to "did that work" after it.

    Both servers run hidden, with everything they print going to .logs/ beside this file.

    A port already held by another tree, or by a server older than the code it serves, is taken rather
    than adopted: launching this from a checkout means "show me this checkout". See decision record 0037.

    The packages are held to the same rule: when package-lock.json has changed since they were last
    installed - a merge that brought a new one - they are installed again before anything starts.

    Switches:
        -WebOnly     just the map. No game server, so no houses and no events.
        -NoBrowser   do not open the browser.
        -Stop        stop both, and whatever they started, and exit.
        -Logs        print the tail of both logs, and exit. This is what to paste into a conversation.
        -Hold        stay open afterwards, with q to stop both. What the double-click wrapper passes.
#>
[CmdletBinding()]
param(
    [switch] $WebOnly,
    [switch] $NoBrowser,
    [switch] $Stop,
    [switch] $Logs,
    [switch] $Hold
)

$ErrorActionPreference = 'Stop'

$Root = $PSScriptRoot
$LogDir = Join-Path $Root '.logs'
$BackendLog = Join-Path $LogDir 'backend.log'
$BackendErrors = Join-Path $LogDir 'backend-errors.log'
$WebLog = Join-Path $LogDir 'web.log'
$WebErrors = Join-Path $LogDir 'web-errors.log'
$StartedFile = Join-Path $LogDir 'started.json'

<#
    Which ports this tree uses. The main checkout is 5173 and 8080 as it always was; a worktree gets its
    own pair, worked out from its directory name, so several sessions can run at once. Asked of the same
    file Vite asks, because a launcher that guessed a port would send you to somebody else's world - and
    that is not a figure of speech now that a port in the wrong hands gets taken. See 0031 and 0037.
#>
$PortScript = Join-Path $Root 'frontend\apps\web\vite\worktreePort.ts'
$WebPort = 5173
$GamePort = 8080
if (Test-Path $PortScript) {
    $answer = & node $PortScript '--launch' 2>$null
    if ($LASTEXITCODE -eq 0 -and $answer -match '^\d+$') { $WebPort = [int] $answer }
    $answer = & node $PortScript '--game' 2>$null
    if ($LASTEXITCODE -eq 0 -and $answer -match '^\d+$') { $GamePort = [int] $answer }
}
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

<#
    Every checkout of this repository on the machine: this one, and the worktrees beside it.

    Asked of git rather than guessed from the directory layout, and compared with the separator
    normalised and the case folded away, because a process command line spells a path the other way
    round from the way git does. Worked out once, on first use, because git is not on the path until
    the tools step has run.
#>
$Sep = [System.IO.Path]::DirectorySeparatorChar

function Tidy-Path([string] $Path) {
    if ([string]::IsNullOrWhiteSpace($Path)) { return '' }
    return $Path.Replace('/', $Sep).TrimEnd($Sep).ToLowerInvariant()
}

$Here = Tidy-Path $Root
$script:Trees = $null
$script:MainTree = $null

function Get-Trees {
    if ($null -ne $script:Trees) { return $script:Trees }
    $found = @($Here)
    # First match only: this machine has git twice on the path, and a two-element array used as a
    # command name becomes one long nonsense path. Resolve-Tool below learned the same lesson.
    $git = @(Get-Command git -CommandType Application -ErrorAction SilentlyContinue)[0]
    if ($null -ne $git) {
        foreach ($line in @(& $git.Source -C $Root worktree list --porcelain 2>$null)) {
            if ($line -like 'worktree *') {
                $path = Tidy-Path $line.Substring(9)
                # git lists the main checkout first, which is the only way to tell it from the rest.
                if ($null -eq $script:MainTree) { $script:MainTree = $path }
                $found += $path
            }
        }
    }
    $script:Trees = @($found | Where-Object { $_ -ne '' } | Select-Object -Unique)
    return $script:Trees
}

<# What to call a tree in a sentence: the main checkout is not "villages", it is main. #>
function Name-Of([string] $Tree) {
    Get-Trees | Out-Null
    if ($Tree -eq $script:MainTree) { return 'main' }
    return Split-Path $Tree -Leaf
}

<#
    Which checkout a running process belongs to, or nothing when it is none of ours.

    The longest match wins. Every worktree path begins with the main checkout's, so the shorter one
    would otherwise claim all of them and every tree would look like main.
#>
function Get-TreeOf($Process) {
    if ($null -eq $Process) { return $null }
    $said = ''
    try {
        $said = (Get-CimInstance Win32_Process -Filter "ProcessId=$($Process.Id)" `
                -ErrorAction SilentlyContinue).CommandLine
    } catch {
        $said = ''
    }
    if ([string]::IsNullOrWhiteSpace($said)) { return $null }

    $said = $said.Replace('/', $Sep).ToLowerInvariant()
    $best = $null
    foreach ($tree in Get-Trees) {
        if ($said.Contains($tree) -and ($null -eq $best -or $tree.Length -gt $best.Length)) {
            $best = $tree
        }
    }
    return $best
}

<# A killed listener gives its port back in a moment rather than instantly, and strictPort does not forgive. #>
function Wait-Free([int] $Port, [int] $Seconds = 10) {
    $until = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $until) {
        if (-not (Test-Listening $Port)) { return $true }
        Start-Sleep -Milliseconds 200
    }
    return $false
}

<#
    When the dev server's own configuration was last edited.

    Vite serves the app from disk, so a dev server is never stale about the app. Its configuration is
    different: that is read when the process starts, and the plugins it names are the dev-only routes the
    page asks for. A server older than its own config is answering 404 to things the page now expects.
#>
function Get-NewestWebConfigChange {
    $web = Join-Path (Join-Path (Join-Path $Root 'frontend') 'apps') 'web'
    $config = @(Join-Path $web 'vite.config.ts')
    $plugins = @(Get-ChildItem -Path (Join-Path $web 'vite') -File -Filter '*.ts' -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty FullName)
    $newest = @($config + $plugins |
        Where-Object { Test-Path $_ } |
        ForEach-Object { (Get-Item $_).LastWriteTime } |
        Sort-Object -Descending |
        Select-Object -First 1)
    if ($newest.Count -eq 0) { return $null }
    return $newest[0]
}

<#
    Why the installed packages are older than the ones this checkout asks for, or nothing when they are not.

    npm writes node_modules/.package-lock.json as the last thing an install does, after package-lock.json
    itself, so a lock file newer than it has changed since: a merge, a pull or a checkout brought packages
    that were never installed here. Found on 2026-09-26: main's checkout was installed on the 4th, a merge
    on the 26th brought the art cut, and the art cut needs sharp, which main had never installed. This
    script would have stopped at cutting the sprites, under Node's complaint that it cannot find sharp,
    which says what is missing and not what to do about it.

    Asked of the two files' times rather than their contents, which keeps it instant, and wrong only the
    cheap way: a checkout that rewrote the lock without changing it gets an install with nothing to do,
    which takes seconds. Asked of .NET rather than Get-Item, which will not see a hidden file.
#>
function Get-StaleInstallReason {
    $frontend = Join-Path $Root 'frontend'
    $installed = Join-Path $frontend 'node_modules\.package-lock.json'
    if (-not (Test-Path $installed)) { return 'there is no record of what was last installed' }
    $lock = Join-Path $frontend 'package-lock.json'
    if ([System.IO.File]::GetLastWriteTimeUtc($lock) -gt [System.IO.File]::GetLastWriteTimeUtc($installed)) {
        return 'package-lock.json has changed since the packages were installed'
    }
    return $null
}

<#
    Whatever holds this port: is it this checkout's, and is it current? If it is not, it goes.

    This is the rule, and the reason a held port is no longer merely reported: running this from a
    checkout means "show me this checkout". A server from another tree, or one started before the code
    it serves was written, is not that, however well it answers. The tree you launch from owns the ports
    it uses, and anyone else's server was already in the wrong place. See decision record 0037.

    True means keep what is there. False means the port is free and ours to start on.
#>
function Confirm-Port([int] $Port, [string] $What, $StaleAfter) {
    if (-not (Test-Listening $Port)) { return $false }

    $holder = Get-PortHolder $Port
    if ($null -eq $holder) {
        Warn "something holds $Port that this cannot see into, so it is being left alone"
        return $true
    }

    $since = $null
    try { $since = $holder.StartTime } catch { $since = $null }
    $tree = Get-TreeOf $holder

    $wrong = $null
    if ($null -eq $tree) {
        $wrong = "is not one of ours ($($holder.ProcessName), pid $($holder.Id))"
    } elseif ($tree -ne $Here) {
        $wrong = "belongs to $(Name-Of $tree)"
    } elseif ($null -ne $StaleAfter -and $null -ne $since -and $since -lt $StaleAfter) {
        $wrong = "started $(Describe-Since $since), before the code it serves was last changed"
    }

    if ($null -eq $wrong) {
        Good "$What is already up on $Port, this checkout's, started $(Describe-Since $since)"
        return $true
    }

    Warn "$What on $Port $wrong. Taking the port, so that what you see is this checkout."
    Stop-Port $Port $What
    if (-not (Wait-Free $Port)) {
        Bad "$Port is still held. Stop whatever has it by hand and run this again."
        return $true
    }
    return $false
}

<#
    Every Villages server running on this machine, whichever checkout started it.

    There are a dozen trees and they all look alike from a browser. This is the one place that says what
    is up, where it came from, and how long it has been there.
#>
function Get-VillagesServers {
    $rows = @()
    $held = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
        Select-Object -Property LocalPort, OwningProcess -Unique)
    foreach ($one in $held) {
        $process = Get-Process -Id $one.OwningProcess -ErrorAction SilentlyContinue
        if ($null -eq $process) { continue }
        if ($process.ProcessName -notin @('java', 'node')) { continue }
        $tree = Get-TreeOf $process
        if ($null -eq $tree) { continue }
        $since = $null
        try { $since = $process.StartTime } catch { $since = $null }
        $rows += [pscustomobject]@{
            Tree  = Name-Of $tree
            Kind  = if ($process.ProcessName -eq 'java') { 'game' } else { 'web ' }
            Port  = [int] $one.LocalPort
            Since = $since
            Mine  = ($tree -eq $Here)
        }
    }
    return @($rows | Sort-Object Tree, Port)
}

function Stop-Everything {
    Stop-Remembered 'web' 'the dev server'
    Stop-Remembered 'game' 'the game server'
    Stop-Port $WebPort 'the dev server'
    Stop-Port $GamePort 'the game server'
}

<#
    Who holds a port, and since when.

    A port that answers is not the same thing as the right program answering it. What bit: a game server
    six days old, still listening on 8080 long after the session that started it had gone. The page found
    it, the handshake passed because nobody had changed the protocol version, and the first frame that old
    gateway had never heard of came back as Jackson's opinion of an unknown type id - which names
    everything except the fault. So a port that is already held gets looked at rather than trusted.
#>
function Get-PortHolder([int] $Port) {
    $owners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique)
    if ($owners.Count -eq 0) { return $null }
    return Get-Process -Id $owners[0] -ErrorAction SilentlyContinue
}

<#
    When the backend in this tree was last edited.

    Only files under a module's src, because Gradle writes generated Kotlin into build directories every
    time it runs, and a clock that moves whenever you build says nothing about the code.
#>
function Get-NewestBackendChange {
    $roots = @(Get-ChildItem -Path (Join-Path $Root 'backend') -Directory -Recurse -Filter 'src' `
            -ErrorAction SilentlyContinue)
    $newest = $roots |
        ForEach-Object { Get-ChildItem -Path $_.FullName -Recurse -File -Filter '*.kt' -ErrorAction SilentlyContinue } |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if ($null -eq $newest) { return $null }
    return $newest.LastWriteTime
}

<# The start of a process, in the units a person notices: minutes, hours, or the days that mean trouble. #>
function Describe-Since($When) {
    if ($null -eq $When) { return 'at some point' }
    $span = (Get-Date) - $When
    if ($span.TotalMinutes -lt 90) { return "$([int] $span.TotalMinutes) minutes ago" }
    if ($span.TotalHours -lt 36) { return "$([int] $span.TotalHours) hours ago" }
    return "$([int] $span.TotalDays) days ago"
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

<#
    End a process and every process it started, and say whether it is gone.

    Through cmd, which keeps taskkill's complaints to itself. taskkill writes to stderr when part of what
    it was asked to end is already on its way out, and Windows PowerShell turns a line on stderr into an
    error that stops this whole script. That is the normal case, not the odd one: stopping a server's
    wrapper takes the server with it, the port table goes on naming the server until it has finished
    dying, and asking for the port a moment later asks taskkill for a process that is already going. It
    stopped this script dead on 2026-09-26, halfway through stopping a dev server.
#>
function End-Process([int] $Id) {
    & cmd.exe /d /c "taskkill /T /F /PID $Id >nul 2>&1"
    $left = Get-Process -Id $Id -ErrorAction SilentlyContinue
    if ($null -eq $left) { return $true }
    try { return $left.WaitForExit(5000) } catch { return $false }
}

function Stop-Remembered([string] $Name, [string] $What) {
    if (-not (Test-Path $StartedFile)) { return }
    $entry = (Get-Content -Raw -Path $StartedFile | ConvertFrom-Json).$Name
    if ($null -eq $entry) { return }
    $process = Get-Process -Id $entry.pid -ErrorAction SilentlyContinue
    if ($null -eq $process) { return }
    if ($process.StartTime.ToString('o') -ne $entry.born) { return }
    if (End-Process $entry.pid) {
        Good "stopped $What, and the processes it started (pid $($entry.pid))"
        $script:Stopped = $true
    } else {
        Warn "could not stop $What (pid $($entry.pid))"
    }
}

<# Whatever holds the port, whoever started it: an IDE, the launch config, an older run of this. #>
function Stop-Port([int] $Port, [string] $What) {
    $owners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique)
    foreach ($owner in $owners) {
        $process = Get-Process -Id $owner -ErrorAction SilentlyContinue
        # Already gone, and the port table has not caught up with it.
        if ($null -eq $process) { continue }
        # Asked before it is ended, because an ended process has no name to give.
        $name = $process.ProcessName
        if (End-Process $owner) {
            Good "stopped $What on $Port ($name, pid $owner)"
            $script:Stopped = $true
        } else {
            Warn "could not stop $What on $Port ($name, pid $owner)"
        }
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
    Stop-Everything
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

$Frontend = Join-Path $Root 'frontend'
if (-not (Test-Path (Join-Path $Frontend 'node_modules'))) {
    Run 'installing dependencies (a minute, once)' $Npm @('install') $Frontend
} else {
    $stale = Get-StaleInstallReason
    if ($null -eq $stale) {
        Good 'dependencies are installed, and package-lock.json has not changed since'
    } else {
        Warn $stale
        # This checkout's own dev server is running on the packages about to be replaced. Windows will
        # not let npm overwrite a program that is running, and Vite reads its packages once, when it
        # starts, so it goes first and the start below brings it back on the new ones. Another tree's is
        # left to the rule that takes ports back, further down, because its packages are its own.
        $holder = Get-PortHolder $WebPort
        if ($null -ne $holder -and (Get-TreeOf $holder) -eq $Here) {
            Warn 'the dev server is running on them, so it stops first and starts again below'
            Stop-Remembered 'web' 'the dev server'
            Stop-Port $WebPort 'the dev server'
            Wait-Free $WebPort | Out-Null
        }
        try {
            Run 'installing them again (seconds, or a minute if a lot changed)' $Npm @('install') $Frontend
        } catch {
            # Offline, say. What was installed before is still there, and most of the program runs on it.
            Bad "$($_.Exception.Message)."
            Warn 'starting on what was installed before, which may be missing a package the code now uses'
        }
    }
}

$WorldDir = Join-Path $Root 'frontend\apps\web\public\world'
$Master = Join-Path $Root 'world\master\terrain.png'
# One directory per hand-painted master, so the debug map panel can hold more than one world at once.
# This is the one the two world commands write when given no arguments.
$DefaultWorld = Join-Path $WorldDir 'masters\terrain'

if (-not (Test-Path $Master)) {
    Bad "the hand-painted world is missing: $Master"
    Bad 'without it there is nothing to generate. Restore it from git and run this again.'
    exit 1
}

if (-not (Test-Path (Join-Path $DefaultWorld 'terrain.geojson'))) {
    Run 'tracing the coast and the lakes' $Npm @('run', 'world:import') $Frontend
} else {
    Good 'the coast and the lakes are traced'
}

$Tiles = Join-Path $DefaultWorld 'tiles'
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

# What kind of place every part of the world is, and where the scenery clumps. Without it the map draws
# no scenery at all - which is the rule rather than a fault, but it is not what anyone starting from
# nothing is expecting to see. Half a minute, once per master. See decision record 0054.
$SpriteMap = Join-Path $DefaultWorld 'sprites/biome/map.json'
if (-not (Test-Path $SpriteMap)) {
    Run 'working out the biomes and the stands (about half a minute, once)' $Npm @('run', 'world:sprites') $Frontend
} else {
    $map = Get-Content $SpriteMap -Raw | ConvertFrom-Json
    Good ("the world is furnished: {0:N0} stands in {1:N0} chunks" -f $map.stands, $map.chunks)
}

# What the scenery is drawn as: Adam's pictures in world/sprites, cut into one atlas. The dev server cuts
# it on start when it is missing too, but cutting it here says so where everything else is said, and
# fails before a server is started rather than into its log. About ten seconds in a tree that has cut
# nothing yet, because pictures standing on a plinth are lifted off it. See decision record 0059.
$ArtAtlas = Join-Path $Frontend 'apps/web/public/art/scenery.json'
if (-not (Test-Path $ArtAtlas)) {
    Run 'cutting the sprites into an atlas (about ten seconds)' $Npm @('run', 'world:art') $Frontend
} else {
    $atlas = Get-Content $ArtAtlas -Raw | ConvertFrom-Json
    Good ("the sprites are cut: {0} in an atlas of {1}x{2}" -f @($atlas.frames.PSObject.Properties).Count, $atlas.width, $atlas.height)
}

# --- starting the servers --------------------------------------------------------------------------

Head 'starting'

if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }

$GameUp = $false
if (-not $WebOnly) {
    if (Confirm-Port $GamePort 'the game server' (Get-NewestBackendChange)) {
        $GameUp = $true
    } else {
        Step 'game server  '
        Remember 'game' (Start-Server $Gradlew `
            @('--console=plain', ':app:bootRun', "--args=--server.port=$GamePort") `
            (Join-Path $Root 'backend') $BackendLog $BackendErrors)
        $GameUp = Wait-Listening $GamePort 300 'the game server'
        if (-not $GameUp) {
            Show-Tail $BackendLog
            Show-Tail $BackendErrors 15
            Warn 'the map still works without it. Everything below is still true.'
        }
    }
}

# The app itself is served from disk and is never stale; the configuration is read once, at startup.
if (Confirm-Port $WebPort 'the dev server' (Get-NewestWebConfigChange)) {
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

Say "  The map is served on $WebPort. The picker at the top right switches renderer; the debug panel"
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

Head 'servers'

$servers = Get-VillagesServers
if ($servers.Count -eq 0) {
    Say '  none that this can see, which is odd, since one of them is serving this page'
} else {
    foreach ($row in $servers) {
        $mark = ' '
        if ($row.Mine) { $mark = '*' }
        Say ("  {0} {1,-38} {2}  {3,-5}  started {4}" -f $mark, $row.Tree, $row.Kind, $row.Port,
            (Describe-Since $row.Since))
    }
    Say ''
    Say '  * this checkout. The rest belong to other trees; leave them be unless they hold a port you'
    Say '    need, in which case running this from that tree takes it back.'
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

<#
    Double-clicked, this window is the servers: it stays where you can see it, and q ends them.

    Closing it instead leaves them running, which is what you want when you meant to keep playing and
    were only done with the terminal. Nothing here holds the servers up; they are their own processes
    and this is a keyboard.
#>
if ($Hold) {
    Write-Host ''
    Head 'this window'
    Say  '  q   stop both servers and close this window'
    Say  '  l   the tail of both logs'
    Say  '  closing the window leaves them running'
    Write-Host ''
    while ($true) {
        $key = $null
        try {
            $key = [Console]::ReadKey($true)
        } catch {
            # Nothing to read a key from, so there is nothing to hold on to either.
            break
        }
        if ($key.KeyChar -eq 'q' -or $key.KeyChar -eq 'Q') {
            Write-Host ''
            Head 'stopping'
            Stop-Everything
            if (-not $script:Stopped) { Good 'nothing was running' }
            Write-Host ''
            exit 0
        }
        if ($key.KeyChar -eq 'l' -or $key.KeyChar -eq 'L') {
            Show-Tail $BackendLog 20
            Show-Tail $WebLog 15
            Write-Host ''
        }
    }
}
