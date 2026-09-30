require('dotenv').config();
const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.json({ limit: '20kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'controle_financeiro',
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true,
  dateStrings: true
});

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const validDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

app.get('/api/health', asyncRoute(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok', database: 'connected' });
}));

app.get('/api/transactions', asyncRoute(async (req, res) => {
  const { month, type } = req.query;
  const conditions = [];
  const params = [];
  if (month && /^\d{4}-\d{2}$/.test(month)) { conditions.push('DATE_FORMAT(transaction_date, \'%Y-%m\') = ?'); params.push(month); }
  if (type && ['income', 'expense'].includes(type)) { conditions.push('type = ?'); params.push(type); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.execute(`SELECT id, description, amount, type, category, DATE_FORMAT(transaction_date, '%Y-%m-%d') AS transaction_date, notes FROM transactions ${where} ORDER BY transaction_date DESC, id DESC`, params);
  res.json(rows);
}));

app.get('/api/summary', asyncRoute(async (req, res) => {
  const month = req.query.month;
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'Informe o mês no formato AAAA-MM.' });
  const [rows] = await pool.execute(
    `SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0) AS income,
            COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) AS expense,
            COUNT(*) AS count
       FROM transactions WHERE DATE_FORMAT(transaction_date, '%Y-%m') = ?`, [month]);
  const income = Number(rows[0].income);
  const expense = Number(rows[0].expense);
  res.json({ income, expense, balance: income - expense, count: Number(rows[0].count) });
}));

app.post('/api/transactions', asyncRoute(async (req, res) => {
  const { description, amount, type, category, transaction_date, notes = '' } = req.body || {};
  if (typeof description !== 'string' || !description.trim() || description.trim().length > 160) return res.status(400).json({ error: 'Informe uma descrição com até 160 caracteres.' });
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0 || Number(amount) > 9999999999.99) return res.status(400).json({ error: 'O valor deve ser maior que zero.' });
  if (!['income', 'expense'].includes(type)) return res.status(400).json({ error: 'Tipo de lançamento inválido.' });
  if (typeof category !== 'string' || !category.trim() || category.trim().length > 80) return res.status(400).json({ error: 'Informe uma categoria válida.' });
  if (typeof transaction_date !== 'string' || !validDate(transaction_date)) return res.status(400).json({ error: 'Informe uma data válida.' });
  if (typeof notes !== 'string' || notes.length > 500) return res.status(400).json({ error: 'As observações podem ter até 500 caracteres.' });
  const [result] = await pool.execute(
    'INSERT INTO transactions (description, amount, type, category, transaction_date, notes) VALUES (?, ?, ?, ?, ?, ?)',
    [description.trim(), Number(amount).toFixed(2), type, category.trim(), transaction_date, notes.trim() || null]);
  const [rows] = await pool.execute("SELECT id, description, amount, type, category, DATE_FORMAT(transaction_date, '%Y-%m-%d') AS transaction_date, notes FROM transactions WHERE id = ?", [result.insertId]);
  res.status(201).json(rows[0]);
}));

app.delete('/api/transactions/:id', asyncRoute(async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Identificador inválido.' });
  const [result] = await pool.execute('DELETE FROM transactions WHERE id = ?', [req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Lançamento não encontrado.' });
  res.status(204).end();
}));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Não foi possível concluir a solicitação.' });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Controle Financeiro disponível em http://localhost:${port}`));
