const { app, BrowserWindow, session } = require('electron');


app.on('ready', () => {
  const proxyConfig = {
    proxyRules: '$PROXY_URL',
  };

  session.defaultSession.setProxy(proxyConfig, () => {
  });
});

require('./main/main-entrypoint.js')