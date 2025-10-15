const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Initialize SQLite database
const db = new sqlite3.Database('./shop_dashboard.db', (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

// Create tables if they don't exist
function initializeDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      quotedHours REAL NOT NULL,
      timeSpent REAL DEFAULT 0,
      diagnostic_time REAL DEFAULT 0,
      diagnostic_isRunning INTEGER DEFAULT 0,
      job_order INTEGER NOT NULL
    )
  `, (err) => {
    if (err) console.error('Error creating jobs table:', err);
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS techs (
      id TEXT PRIMARY KEY,
      jobId TEXT NOT NULL,
      name TEXT NOT NULL,
      isWorking INTEGER DEFAULT 0,
      startTime INTEGER,
      FOREIGN KEY (jobId) REFERENCES jobs(id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) console.error('Error creating techs table:', err);
  });
}

// Helper function to get all jobs with their techs
function getAllJobs(callback) {
  db.all('SELECT * FROM jobs ORDER BY job_order', [], (err, jobs) => {
    if (err) {
      callback(err, null);
      return;
    }

    if (jobs.length === 0) {
      callback(null, []);
      return;
    }

    // Get techs for each job
    const jobsWithTechs = [];
    let processed = 0;

    jobs.forEach(job => {
      db.all('SELECT * FROM techs WHERE jobId = ?', [job.id], (err, techs) => {
        if (err) {
          console.error('Error fetching techs:', err);
          techs = [];
        }

        jobsWithTechs.push({
          id: job.id,
          title: job.title,
          quotedHours: job.quotedHours,
          timeSpent: job.timeSpent,
          diagnostic: {
            time: job.diagnostic_time,
            isRunning: Boolean(job.diagnostic_isRunning)
          },
          techs: techs.map(t => ({
            id: t.id,
            name: t.name,
            isWorking: Boolean(t.isWorking),
            startTime: t.startTime
          })),
          order: job.job_order
        });

        processed++;
        if (processed === jobs.length) {
          jobsWithTechs.sort((a, b) => a.order - b.order);
          callback(null, jobsWithTechs);
        }
      });
    });
  });
}

// Update job times every second
setInterval(() => {
  getAllJobs((err, jobs) => {
    if (err) {
      console.error('Error in interval:', err);
      return;
    }

    jobs.forEach(job => {
      const activeTechs = job.techs.filter(tech => tech.isWorking);
      let needsUpdate = false;
      let newTimeSpent = job.timeSpent;
      let newDiagnosticTime = job.diagnostic.time;

      // Update tech time
      if (activeTechs.length > 0) {
        const increment = (activeTechs.length / 3600);
        newTimeSpent = Math.min(job.timeSpent + increment, job.quotedHours);
        needsUpdate = true;
      }

      // Update diagnostic time
      if (job.diagnostic && job.diagnostic.isRunning) {
        newDiagnosticTime = job.diagnostic.time + (1 / 3600);
        needsUpdate = true;
      }

      if (needsUpdate) {
        db.run(
          'UPDATE jobs SET timeSpent = ?, diagnostic_time = ? WHERE id = ?',
          [newTimeSpent, newDiagnosticTime, job.id]
        );
      }
    });
  });
}, 1000);

// API Routes
app.get('/api/jobs', (req, res) => {
  getAllJobs((err, jobs) => {
    if (err) {
      res.status(500).json({ error: 'Database error' });
    } else {
      res.json(jobs);
    }
  });
});

app.post('/api/jobs', (req, res) => {
  const id = Date.now().toString();
  
  // Get current max order
  db.get('SELECT MAX(job_order) as maxOrder FROM jobs', [], (err, row) => {
    const order = (row && row.maxOrder !== null) ? row.maxOrder + 1 : 0;
    
    db.run(
      'INSERT INTO jobs (id, title, quotedHours, timeSpent, diagnostic_time, diagnostic_isRunning, job_order) VALUES (?, ?, ?, 0, 0, 0, ?)',
      [id, req.body.title, req.body.quotedHours, order],
      function(err) {
        if (err) {
          res.status(500).json({ error: 'Database error' });
        } else {
          res.json({
            id,
            title: req.body.title,
            quotedHours: req.body.quotedHours,
            timeSpent: 0,
            diagnostic: { time: 0, isRunning: false },
            techs: [],
            order
          });
        }
      }
    );
  });
});

app.put('/api/jobs/:id', (req, res) => {
  const updates = [];
  const values = [];

  if (req.body.quotedHours !== undefined) {
    updates.push('quotedHours = ?');
    values.push(req.body.quotedHours);
  }

  if (updates.length === 0) {
    res.status(400).json({ error: 'No valid fields to update' });
    return;
  }

  values.push(req.params.id);

  db.run(
    `UPDATE jobs SET ${updates.join(', ')} WHERE id = ?`,
    values,
    function(err) {
      if (err) {
        res.status(500).json({ error: 'Database error' });
      } else if (this.changes === 0) {
        res.status(404).json({ error: 'Job not found' });
      } else {
        getAllJobs((err, jobs) => {
          const job = jobs.find(j => j.id === req.params.id);
          res.json(job || {});
        });
      }
    }
  );
});

app.delete('/api/jobs/:id', (req, res) => {
  db.run('DELETE FROM techs WHERE jobId = ?', [req.params.id], (err) => {
    if (err) {
      res.status(500).json({ error: 'Database error' });
      return;
    }

    db.run('DELETE FROM jobs WHERE id = ?', [req.params.id], function(err) {
      if (err) {
        res.status(500).json({ error: 'Database error' });
      } else {
        res.json({ success: true });
      }
    });
  });
});

app.post('/api/jobs/:id/techs', (req, res) => {
  const techId = Date.now().toString();
  
  db.run(
    'INSERT INTO techs (id, jobId, name, isWorking, startTime) VALUES (?, ?, ?, 0, NULL)',
    [techId, req.params.id, req.body.name],
    function(err) {
      if (err) {
        res.status(500).json({ error: 'Database error' });
      } else {
        getAllJobs((err, jobs) => {
          const job = jobs.find(j => j.id === req.params.id);
          res.json(job || {});
        });
      }
    }
  );
});

app.put('/api/jobs/:jobId/techs/:techId/toggle', (req, res) => {
  db.get('SELECT isWorking FROM techs WHERE id = ?', [req.params.techId], (err, tech) => {
    if (err || !tech) {
      res.status(404).json({ error: 'Tech not found' });
      return;
    }

    const newIsWorking = tech.isWorking ? 0 : 1;
    const newStartTime = newIsWorking ? Date.now() : null;

    db.run(
      'UPDATE techs SET isWorking = ?, startTime = ? WHERE id = ?',
      [newIsWorking, newStartTime, req.params.techId],
      function(err) {
        if (err) {
          res.status(500).json({ error: 'Database error' });
        } else {
          getAllJobs((err, jobs) => {
            const job = jobs.find(j => j.id === req.params.jobId);
            res.json(job || {});
          });
        }
      }
    );
  });
});

app.put('/api/jobs/:jobId/diagnostic/toggle', (req, res) => {
  db.get('SELECT diagnostic_isRunning FROM jobs WHERE id = ?', [req.params.jobId], (err, job) => {
    if (err || !job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const newIsRunning = job.diagnostic_isRunning ? 0 : 1;

    db.run(
      'UPDATE jobs SET diagnostic_isRunning = ? WHERE id = ?',
      [newIsRunning, req.params.jobId],
      function(err) {
        if (err) {
          res.status(500).json({ error: 'Database error' });
        } else {
          getAllJobs((err, jobs) => {
            const job = jobs.find(j => j.id === req.params.jobId);
            res.json(job || {});
          });
        }
      }
    );
  });
});

app.post('/api/jobs/reorder', (req, res) => {
  const jobs = req.body.jobs;
  
  // Update order for each job
  const stmt = db.prepare('UPDATE jobs SET job_order = ? WHERE id = ?');
  
  jobs.forEach((job, index) => {
    stmt.run([index, job.id]);
  });
  
  stmt.finalize((err) => {
    if (err) {
      res.status(500).json({ error: 'Database error' });
    } else {
      res.json({ success: true });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
});