const http = require('http');
module.exports = function configureBackendProxy(app) {
  app.use('/api', (request, response) => {
    const upstream = http.request({ hostname: '127.0.0.1', port: 8080, path: request.originalUrl, method: request.method, headers: { ...request.headers, host: '127.0.0.1:8080' } }, result => {
      response.writeHead(result.statusCode, result.headers); result.pipe(response);
    });
    upstream.setTimeout(90000, () => upstream.destroy());
    upstream.on('error', () => {
      if (!response.headersSent) response.status(503).json({ error: 'BACKEND_UNAVAILABLE' });
      else response.destroy();
    });
    request.on('aborted', () => upstream.destroy());
    request.pipe(upstream);
  });
};
