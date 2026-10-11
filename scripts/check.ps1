<#
    Every check in the repository, one part after another: the backend's, the frontend's and this folder's own.
    check.ts does the work and says what it does with --help; this only runs it, from wherever it is called.
#>
& node (Join-Path $PSScriptRoot 'check.ts') @args
exit $LASTEXITCODE
