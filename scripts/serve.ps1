$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$rootPrefix = $root.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 4173)
$contentTypes = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.mjs'  = 'text/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.wasm' = 'application/wasm'
  '.pdf'  = 'application/pdf'
  '.svg'  = 'image/svg+xml'
  '.png'  = 'image/png'
  '.ico'  = 'image/x-icon'
}

$listener.Start()
try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $stream = $client.GetStream()
      $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
      $requestLine = $reader.ReadLine()
      if ([string]::IsNullOrWhiteSpace($requestLine)) { continue }
      $parts = $requestLine.Split(' ', 3)
      $method = $parts[0]
      $target = if ($parts.Length -gt 1) { $parts[1].Split('?')[0] } else { '/' }
      while ($true) { $header = $reader.ReadLine(); if ([string]::IsNullOrEmpty($header)) { break } }

      $status = '200 OK'
      $body = [byte[]]@()
      $contentLength = 0
      $contentType = 'application/octet-stream'
      if ($method -notin @('GET', 'HEAD')) {
        $status = '405 Method Not Allowed'
      } else {
        $relative = [System.Uri]::UnescapeDataString($target.TrimStart('/')).Replace('/', [System.IO.Path]::DirectorySeparatorChar)
        if ([string]::IsNullOrWhiteSpace($relative)) { $relative = 'index.html' }
        $path = [System.IO.Path]::GetFullPath((Join-Path $root $relative))
        if (-not $path.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase) -or -not [System.IO.File]::Exists($path)) {
          $status = '404 Not Found'
        } else {
          $contentType = $contentTypes[[System.IO.Path]::GetExtension($path).ToLowerInvariant()]
          if (-not $contentType) { $contentType = 'application/octet-stream' }
          $contentLength = (Get-Item -LiteralPath $path).Length
          if ($method -eq 'GET') { $body = [System.IO.File]::ReadAllBytes($path) }
        }
      }

      $responseHeaders = "HTTP/1.1 $status`r`nContent-Type: $contentType`r`nContent-Length: $contentLength`r`nConnection: close`r`nCache-Control: no-store`r`nX-Content-Type-Options: nosniff`r`n`r`n"
      $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($responseHeaders)
      $stream.Write($headerBytes, 0, $headerBytes.Length)
      if ($body.Length) { $stream.Write($body, 0, $body.Length) }
      $stream.Flush()
    } catch {
      # Ignore one malformed or disconnected request and keep the local server alive.
    } finally {
      $client.Close()
    }
  }
} finally {
  $listener.Stop()
}
