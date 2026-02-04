// Hono web server
import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { cors } from 'hono/cors';
import api from './routes';

const app = new Hono();

// Enable CORS
app.use('/*', cors());

// API routes
app.route('/api', api);

// Serve static files
app.use('/*', serveStatic({ root: './src/web/static' }));

export default app;

export function startServer(port = 3000) {
	console.log(`🔍 Git Leaks Scanner Dashboard`);
	console.log(`📡 Server running at http://localhost:${port}`);

	return Bun.serve({
		port,
		fetch: app.fetch,
	});
}
