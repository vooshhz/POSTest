// Simple Express server for serving the web app locally
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// API proxy (forward to backend server if needed)
app.use('/api', (req, res) => {
  res.status(503).json({ 
    error: 'API server not configured. Please run the backend server separately.' 
  });
});

// Serve index.html for all other routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Web app running at http://localhost:${PORT}`);
  console.log(`Note: API server must be running separately on port 8080`);
});