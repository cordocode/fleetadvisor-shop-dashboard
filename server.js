const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

let jobs = [];

// Update job times every second
setInterval(() => {
  jobs = jobs.map(job => {
    const activeTechs = job.techs.filter(tech => tech.isWorking);
    if (activeTechs.length > 0) {
      // Each active tech adds 1 second worth of work
      // Convert seconds to hours: 1 second = 1/3600 hours
      const increment = (activeTechs.length / 3600);
      return {
        ...job,
        timeSpent: Math.min(job.timeSpent + increment, job.quotedHours)
      };
    }
    return job;
  });
}, 1000);

app.get('/api/jobs', (req, res) => {
  res.json(jobs);
});

app.post('/api/jobs', (req, res) => {
  const newJob = {
    id: Date.now().toString(),
    title: req.body.title,
    quotedHours: req.body.quotedHours,
    techs: [],
    timeSpent: 0,
    order: jobs.length
  };
  jobs.push(newJob);
  res.json(newJob);
});

app.put('/api/jobs/:id', (req, res) => {
  const jobIndex = jobs.findIndex(j => j.id === req.params.id);
  if (jobIndex !== -1) {
    jobs[jobIndex] = { ...jobs[jobIndex], ...req.body };
    res.json(jobs[jobIndex]);
  } else {
    res.status(404).json({ error: 'Job not found' });
  }
});

app.delete('/api/jobs/:id', (req, res) => {
  jobs = jobs.filter(j => j.id !== req.params.id);
  res.json({ success: true });
});

app.post('/api/jobs/:id/techs', (req, res) => {
  const job = jobs.find(j => j.id === req.params.id);
  if (job) {
    const newTech = {
      id: Date.now().toString(),
      name: req.body.name,
      isWorking: false,
      startTime: null
    };
    job.techs.push(newTech);
    res.json(job);
  } else {
    res.status(404).json({ error: 'Job not found' });
  }
});

app.put('/api/jobs/:jobId/techs/:techId/toggle', (req, res) => {
  const job = jobs.find(j => j.id === req.params.jobId);
  if (job) {
    const tech = job.techs.find(t => t.id === req.params.techId);
    if (tech) {
      tech.isWorking = !tech.isWorking;
      tech.startTime = tech.isWorking ? Date.now() : null;
      res.json(job);
    } else {
      res.status(404).json({ error: 'Tech not found' });
    }
  } else {
    res.status(404).json({ error: 'Job not found' });
  }
});

app.post('/api/jobs/reorder', (req, res) => {
  jobs = req.body.jobs;
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});