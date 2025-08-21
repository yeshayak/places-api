param (
    [switch]$DryRun
)

Write-Host "Starting import path fix process..."

$distPath = Resolve-Path (Join-Path $PSScriptRoot "..\dist")
Write-Host "Target directory: $distPath"

$jsFiles = Get-ChildItem -Path $distPath -Recurse -Filter "*.js"
$htmlFiles = Get-ChildItem -Path $distPath -Recurse -Filter "*.html"
Write-Host "Found $($jsFiles.Count) JavaScript files"
Write-Host "Found $($htmlFiles.Count) HTML files"

# Patterns for JS import rewriting
$jsPatterns = @(
    'from "(\.\.?/[^"]+)"',
    "from '(\.\.?/[^']+)'"
)

# Patterns for HTML src/href rewriting
$htmlPatterns = @(
    '<script\s+[^>]*src="(\.\.?/[^"]+?)"',
    '<link\s+[^>]*href="(\.\.?/[^"]+?)"'
)

function Update-ImportPath {
    param (
        [System.IO.FileInfo]$File,
        [string[]]$Patterns,
        [string]$Extension
    )

    Write-Host "→ Processing: $($File.Name)"
    $content = Get-Content -Path $File.FullName -Raw
    $updatedContent = $content

 foreach ($pattern in $Patterns) {
    $regex = [regex]::new($pattern)
    $updatedContent = $regex.Replace($updatedContent, {
        param($match)
        $path = $match.Groups[1].Value

                # If path contains 'src', flatten to ./filename.js
        if ($path -match 'src') {
            $filename = [System.IO.Path]::GetFileNameWithoutExtension($path)
            $newPath = "./$filename.js"
            $fullMatch = $match.Value
            $updated = $fullMatch -replace [regex]::Escape($path), $newPath
            return $updated
        }
        # Otherwise, only append .js if no extension

        if ($path -notmatch "\.($Extension)$") {
            $fullMatch = $match.Value
            $updated = $fullMatch -replace [regex]::Escape($path), "$path.$Extension"
            return $updated
        }
        return $match.Value
    })
}


    # Avoid double extensions
    $updatedContent = $updatedContent -replace "\.$Extension\.$Extension", ".$Extension"

    if ($content -ne $updatedContent) {
        Write-Host "↻ Changes detected in $($File.Name)"

        if ($DryRun) {
            Write-Host "🧪 Dry run: no changes written" -ForegroundColor Cyan
        } else {
            $backup = "$($File.FullName).bak"
            Copy-Item -Path $File.FullName -Destination $backup

            try {
                Set-Content -Path $File.FullName -Value $updatedContent -NoNewline
                Write-Host "✓ Updated $($File.Name)" -ForegroundColor Green
                Remove-Item -Path $backup
            }
            catch {
                Write-Host "✗ Failed to update $($File.Name). Restoring backup..." -ForegroundColor Red
                Copy-Item -Path $backup -Destination $File.FullName -Force
                Remove-Item -Path $backup
                throw $_
            }
        }
    } else {
        Write-Host "- No changes needed in $($File.Name)" -ForegroundColor Yellow
    }
}

# Process JS and HTML files
foreach ($file in $jsFiles) {
    Update-ImportPath -File $file -Patterns $jsPatterns -Extension "js"
}
foreach ($file in $htmlFiles) {
    Update-ImportPath -File $file -Patterns $htmlPatterns -Extension "js"
}

Write-Host "`nImport path fix process completed!" -ForegroundColor Green