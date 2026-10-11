<#
    Where the game server keeps its world, which this says and answers with: 'mongo' when Docker is running, and
    'memory' when it is not, said plainly, because a world in memory is gone when the server stops. Run by
    debug-quick-start.ps1, whose words and tools it uses.

    It starts the stack in docker-compose.yml only when the stack is not running, and leaves a running one alone:
    the stack is every tree's at once, and bringing it up on a changed file would make its containers again under
    every session. Stopping it is Adam's alone, so nothing here does. See decision record 0092.
#>

$Docker = Resolve-Tool @('docker.exe', 'docker')
$Compose = Join-Path $Root 'infra\docker-compose.yml'

if ($null -eq $Docker) {
    Warn 'the world in memory: Docker is not installed, so a restart of the game server forgets it'
    return 'memory'
}

& $Docker info --format '{{.ServerVersion}}' *> $null
if ($LASTEXITCODE -ne 0) {
    Warn 'the world in memory: Docker is not running, so a restart of the game server forgets it.'
    Warn 'Start Docker Desktop and run this again to keep it in MongoDB.'
    return 'memory'
}

$running = @(& $Docker compose -f $Compose ps --status running --services 2>$null)
if ($running -notcontains 'mongodb') {
    Step 'MongoDB and RabbitMQ, starting '
    & $Docker compose -f $Compose up -d --wait *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Host ''
        Warn 'the world in memory: the stack did not come up. docker compose -f infra/docker-compose.yml ps says why.'
        return 'memory'
    }
    Write-Host 'up' -ForegroundColor Green
}

Good 'the world in MongoDB, in a database of this tree''s own, which outlives a restart of the game server'
return 'mongo'
