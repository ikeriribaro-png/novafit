const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;
const dbFile = process.env.DATABASE_PATH || path.join(__dirname, 'novafit.db');

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ─── DATABASE INITIALIZATION ─────────────────────────────────────────────
const db = new Database(dbFile);

db.exec(`
  CREATE TABLE IF NOT EXISTS workouts (
    id TEXT PRIMARY KEY,
    date TEXT,
    name TEXT,
    data TEXT
  );

  CREATE TABLE IF NOT EXISTS custom_exercises (
    id TEXT PRIMARY KEY,
    name TEXT,
    muscle TEXT,
    equipment TEXT,
    emoji TEXT
  );

  CREATE TABLE IF NOT EXISTS routines (
    id TEXT PRIMARY KEY,
    name TEXT,
    emoji TEXT,
    exercises TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// ─── API ENDPOINTS ────────────────────────────────────────────────────────

// Workouts
app.get('/api/workouts', (req, res) => {
  const rows = db.prepare('SELECT * FROM workouts ORDER BY date DESC').all();
  const workouts = rows.map(r => JSON.parse(r.data));
  res.json(workouts);
});

app.post('/api/workouts', (req, res) => {
  const workout = req.body;
  if (!workout.id) workout.id = Date.now().toString();
  
  const stmt = db.prepare('INSERT OR REPLACE INTO workouts (id, date, name, data) VALUES (?, ?, ?, ?)');
  stmt.run(workout.id, workout.date, workout.name, JSON.stringify(workout));
  res.json({ success: true, workout });
});

app.delete('/api/workouts/:id', (req, res) => {
  db.prepare('DELETE FROM workouts WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Custom Exercises
app.get('/api/custom-exercises', (req, res) => {
  const ex = db.prepare('SELECT * FROM custom_exercises').all();
  res.json(ex);
});

app.post('/api/custom-exercises', (req, res) => {
  const ex = req.body;
  const stmt = db.prepare('INSERT OR REPLACE INTO custom_exercises (id, name, muscle, equipment, emoji) VALUES (?, ?, ?, ?, ?)');
  stmt.run(ex.id, ex.name, ex.muscle, ex.equipment, ex.emoji);
  res.json({ success: true, exercise: ex });
});

// Routines
app.get('/api/routines', (req, res) => {
  const rows = db.prepare('SELECT * FROM routines').all();
  const routines = rows.map(r => ({
    id: r.id,
    name: r.name,
    emoji: r.emoji,
    exercises: JSON.parse(r.exercises)
  }));
  res.json(routines);
});

app.post('/api/routines', (req, res) => {
  const routine = req.body;
  const stmt = db.prepare('INSERT OR REPLACE INTO routines (id, name, emoji, exercises) VALUES (?, ?, ?, ?)');
  stmt.run(routine.id, routine.name, routine.emoji, JSON.stringify(routine.exercises));
  res.json({ success: true, routine });
});

app.delete('/api/routines/:id', (req, res) => {
  db.prepare('DELETE FROM routines WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Settings (key-value)
app.get('/api/settings', (req, res) => {
  const rows = db.prepare('SELECT * FROM settings').all();
  const settings = {};
  rows.forEach(r => {
    try {
      settings[r.key] = JSON.parse(r.value);
    } catch {
      settings[r.key] = r.value;
    }
  });
  res.json(settings);
});

app.post('/api/settings/:key', (req, res) => {
  const { key } = req.params;
  const value = JSON.stringify(req.body);
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  stmt.run(key, value);
  res.json({ success: true });
});

// ─── START SERVER ─────────────────────────────────────────────────────────
app.listen(port, () => {
  console.log(`NovaFit server running on port ${port}`);
});
