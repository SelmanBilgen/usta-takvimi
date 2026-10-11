const port = Number.parseInt(process.env.PORT || '3000', 10);
const hostname = process.env.HOST || '0.0.0.0';
const dev = process.env.NODE_ENV === 'development';

async function startServer() {
  const [{ createServer }, { default: next }] = await Promise.all([
    import('node:http'),
    import('next')
  ]);
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();

  await app.prepare();

  const server = createServer((req, res) => {
    void handle(req, res).catch((error) => {
      console.error('Error occurred handling', req.url, error);
      if (res.headersSent) {
        res.destroy(error);
        return;
      }
      res.statusCode = 500;
      res.end('Internal Server Error');
    });
  });

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start Next.js server', error);
  process.exitCode = 1;
});
