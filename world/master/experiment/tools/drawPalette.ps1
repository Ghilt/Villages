# Draws palette.png: the swatches with their names, hex codes and meanings, grouped by family.
#
# PowerShell and System.Drawing rather than Node, because this folder has no dependencies and drawing
# readable text needs a real font. Run writePalette.mjs first: this reads the palette.json it leaves.
#
#   powershell -ExecutionPolicy Bypass -File drawPalette.ps1 [-Out <directory>]

param([string]$Out = (Join-Path $PSScriptRoot '..'))

Add-Type -AssemblyName System.Drawing

$palette = Get-Content (Join-Path $Out 'palette.json') -Raw | ConvertFrom-Json

$swatchWidth = 150
$rowHeight = 46
$headerHeight = 42
$margin = 28
$textLeft = $margin + $swatchWidth + 20

$groups = @('water', 'cold', 'forest', 'open', 'farmed', 'wetland', 'dry', 'high')
$rows = $palette.classes.Count
$width = 1360
$height = $margin * 2 + 96 + ($groups.Count * $headerHeight) + ($rows * $rowHeight)

$bitmap = New-Object System.Drawing.Bitmap $width, $height
$g = [System.Drawing.Graphics]::FromImage($bitmap)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
$g.Clear([System.Drawing.Color]::FromArgb(255, 250, 249, 246))

$titleFont = New-Object System.Drawing.Font 'Segoe UI Semibold', 21, ([System.Drawing.FontStyle]::Regular)
$subFont = New-Object System.Drawing.Font 'Segoe UI', 10.5, ([System.Drawing.FontStyle]::Regular)
$groupFont = New-Object System.Drawing.Font 'Segoe UI Semibold', 12, ([System.Drawing.FontStyle]::Regular)
$nameFont = New-Object System.Drawing.Font 'Segoe UI Semibold', 12.5, ([System.Drawing.FontStyle]::Regular)
$hexFont = New-Object System.Drawing.Font 'Consolas', 11, ([System.Drawing.FontStyle]::Regular)
$meaningFont = New-Object System.Drawing.Font 'Segoe UI', 10.5, ([System.Drawing.FontStyle]::Regular)

$ink = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 26, 26, 30))
$faint = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 110, 110, 118))
$rule = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 222, 220, 214)), 1
$edge = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(60, 0, 0, 0)), 1

$g.DrawString('Villages world terrain, experimental 32-class palette', $titleFont, $ink, $margin, $margin)
$g.DrawString(
  "world/master/experiment/terrain.png  -  16384 x 8192, indexed, one flat colour per class  -  no two classes closer than $($palette.minimumClassDistance) apart in RGB",
  $subFont, $faint, ($margin + 2), ($margin + 38))
$g.DrawString(
  'The colours are data, not a look: they exist so classes can be told apart while painting and snapped back on the way in.',
  $subFont, $faint, ($margin + 2), ($margin + 58))

$y = $margin + 100
foreach ($group in $groups) {
  $title = $palette.groupTitles.$group
  $g.DrawString($title.ToUpper(), $groupFont, $faint, $margin, ($y + 12))
  $g.DrawLine($rule, ($margin + 132), ($y + 26), ($width - $margin), ($y + 26))
  $y += $headerHeight

  foreach ($terrain in $palette.classes | Where-Object { $_.group -eq $group }) {
    $r = [Convert]::ToInt32($terrain.colour.Substring(1, 2), 16)
    $gg = [Convert]::ToInt32($terrain.colour.Substring(3, 2), 16)
    $b = [Convert]::ToInt32($terrain.colour.Substring(5, 2), 16)
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, $r, $gg, $b))

    $g.FillRectangle($brush, $margin, ($y + 3), $swatchWidth, ($rowHeight - 10))
    $g.DrawRectangle($edge, $margin, ($y + 3), $swatchWidth, ($rowHeight - 10))
    # The id sits on its swatch, in whichever of black or white the colour can carry.
    $luma = (0.299 * $r + 0.587 * $gg + 0.114 * $b)
    $onSwatch = if ($luma -gt 150) {
      New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(190, 0, 0, 0))
    } else {
      New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(210, 255, 255, 255))
    }
    $g.DrawString([string]$terrain.id, $hexFont, $onSwatch, ($margin + 6), ($y + 8))
    $g.DrawString($terrain.colour, $hexFont, $onSwatch, ($margin + 74), ($y + 8))
    $onSwatch.Dispose()

    $kind = if ($terrain.water) { '  (water)' } else { '' }
    $g.DrawString(($terrain.name + $kind), $nameFont, $ink, $textLeft, ($y + 1))
    $g.DrawString($terrain.meaning, $meaningFont, $faint, $textLeft, ($y + 21))
    $brush.Dispose()
    $y += $rowHeight
  }
}

$target = Join-Path $Out 'palette.png'
$bitmap.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bitmap.Dispose()
Write-Output "palette.png written to $target ($width x $height)"
