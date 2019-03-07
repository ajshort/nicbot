import * as express from 'express';

const app = express();
const port = Number(process.env.PORT) || 3000;

app.get('/', (_req, res) => {
  res.send('Hello, world');
});

const listener = app.listen(port, () => {
  console.log(`Listening on port ${port}...`);
});
