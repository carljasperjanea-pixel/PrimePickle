import express from 'express';
import cookieParser from 'cookie-parser';
import apiRoutes from '../src/server/routes.js';

const app = express();

app.use(express.json());
app.use(cookieParser());

// Mount the routes at /api
app.get('/api', (req, res) => {
  res.json({ status: 'API is running' });
});

app.use('/api', apiRoutes);

export default app;
