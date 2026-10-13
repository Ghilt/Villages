<#
    Where the game server keeps its world, which this says and answers with the arguments that tell the server:
    in MongoDB and carried by RabbitMQ when Docker is running and the stack is up, and in memory when it is not,
    said plainly, because a world in memory is gone when the server stops (decision records 0092 and 0094). Run
    by debug-quick-start.ps1, whose words and tools it uses.

    With the stack up it drops the worlds of worktrees that are gone, with scripts/drop-gone-worlds.ts, so the
    stack never fills with worlds nobody reads; Adam leaves sessions as they are, and nothing else would.

    It starts the stack in docker-compose.yml only when the stack is not running, and leaves a running one alone:
    the stack is every tree's at once, and bringing it up on a changed file would make its containers again under
    every session. Stopping it is Adam's alone, so nothing here does. See decision record 0092.
#>

$Docker = Resolve-Tool @('docker.exe', 'docker')
$Compose = Join-Path $Root 'infra\docker-compose.yml'

if ($null -eq $Docker) {
    Warn 'the world in memory: Docker is not installed, so a restart of the game server forgets it'
    return '--villages.store=memory'
}

& $Docker info --format '{{.ServerVersion}}' *> $null
if ($LASTEXITCODE -ne 0) {
    Warn 'the world in memory: Docker is not running, so a restart of the game server forgets it.'
    Warn 'Start Docker Desktop and run this again to keep it in MongoDB.'
    return '--villages.store=memory'
}

$running = @(& $Docker compose -f $Compose ps --status running --services 2>$null)
if ($running -notcontains 'mongodb' -or $running -notcontains 'rabbitmq') {
    Step 'MongoDB and RabbitMQ, starting '
    & $Docker compose -f $Compose up -d --wait *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Host ''
        Warn 'the world in memory: the stack did not come up. docker compose -f infra/docker-compose.yml ps says why.'
        return '--villages.store=memory'
    }
    Write-Host 'up' -ForegroundColor Green
}

# A worktree deleted leaves its world behind, a database and a virtual host; they are dropped here, at every start,
# so nobody has to remember to. Only those whose checkout git no longer has a folder for, and never a live tree's.
$said = (& (Resolve-Tool @('node.exe', 'node')) (Join-Path $Root 'scripts\drop-gone-worlds.ts') --drop 2>$null) -join "`n"
$gone = [regex]::Match($said, 'Dropped (\d+) of \d+ worlds?[^,]*, and deleted (\d+) of \d+ virtual hosts?')
if ($LASTEXITCODE -ne 0) {
    Warn 'the worlds of worktrees that are gone were not all dropped: node scripts/drop-gone-worlds.ts --list says which'
} elseif ($gone.Success) {
    Good "dropped the worlds of worktrees that are gone: $($gone.Groups[1].Value) in MongoDB, $($gone.Groups[2].Value) in RabbitMQ"
}

Good 'the world in MongoDB, in a database of this tree''s own, which outlives a restart of the game server'
Good 'carried by RabbitMQ, in a virtual host of this tree''s own'
return '--villages.store=mongo --villages.broker=rabbit'
