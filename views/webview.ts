// src/views/webview.ts

export function getWebviewContent(nonce: string, scriptUri: string): string {
  return /* html */ `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta
        http-equiv="Content-Security-Policy"
        content="
          default-src 'none';
          script-src 'nonce-${nonce}';
          style-src 'unsafe-inline';
          connect-src *;
          frame-src *;
          child-src *;
          img-src https: data:;
        "
      />
      <title>Logcai Webview</title>
    </head>
    <body>
      <div id="root"></div>
      <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>
  `;
}
