import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [jobs, setJobs] = useState([]);
  const [showAddJob, setShowAddJob] = useState(false);
  const [newJobTitle, setNewJobTitle] = useState('');
  const [newJobHours, setNewJobHours] = useState('');
  const [draggedJob, setDraggedJob] = useState(null);
  const [addingTechToJob, setAddingTechToJob] = useState(null);
  const [newTechName, setNewTechName] = useState('');
  const [completingJob, setCompletingJob] = useState(null);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchJobs = async () => {
    const response = await fetch('/api/jobs');
    const data = await response.json();
    setJobs(data.sort((a, b) => a.order - b.order));
  };

  const handleAddJob = async (e) => {
    e.preventDefault();
    await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newJobTitle,
        quotedHours: parseFloat(newJobHours),
      })
    });
    setNewJobTitle('');
    setNewJobHours('');
    setShowAddJob(false);
    fetchJobs();
  };

  const handleDeleteJob = async (jobId) => {
    await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' });
    fetchJobs();
  };

  const handleCompleteJob = async (jobId) => {
    setCompletingJob(jobId);
    setTimeout(async () => {
      await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' });
      setCompletingJob(null);
      fetchJobs();
    }, 1000);
  };

  const handleAddTechSubmit = async (e, jobId) => {
    e.preventDefault();
    if (newTechName.trim()) {
      await fetch(`/api/jobs/${jobId}/techs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTechName.trim() })
      });
      setNewTechName('');
      setAddingTechToJob(null);
      fetchJobs();
    }
  };

  const handleToggleTech = async (jobId, techId) => {
    await fetch(`/api/jobs/${jobId}/techs/${techId}/toggle`, {
      method: 'PUT'
    });
    fetchJobs();
  };

  const handleDragStart = (e, job) => {
    setDraggedJob(job);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, targetJob) => {
    e.preventDefault();
    if (!draggedJob || draggedJob.id === targetJob.id) return;

    const newJobs = [...jobs];
    const draggedIndex = newJobs.findIndex(j => j.id === draggedJob.id);
    const targetIndex = newJobs.findIndex(j => j.id === targetJob.id);

    newJobs.splice(draggedIndex, 1);
    newJobs.splice(targetIndex, 0, draggedJob);

    const reorderedJobs = newJobs.map((job, index) => ({
      ...job,
      order: index
    }));

    setJobs(reorderedJobs);
    setDraggedJob(null);

    await fetch('/api/jobs/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobs: reorderedJobs })
    });
  };

  const getProgressPercentage = (job) => {
    return Math.min((job.timeSpent / job.quotedHours) * 100, 100);
  };

  const getTimeRemaining = (job) => {
    const remaining = job.quotedHours - job.timeSpent;
    if (remaining < 0) {
      return `+${Math.abs(remaining).toFixed(2)}h OVERTIME`;
    }
    return `${remaining.toFixed(2)}h`;
  };

  const isOvertime = (job) => {
    return job.timeSpent > job.quotedHours;
  };

  const getProgressColor = (job) => {
    if (isOvertime(job)) return '#F44336';
    const percentage = getProgressPercentage(job);
    if (percentage < 50) return '#4CAF50';
    if (percentage < 80) return '#FFC107';
    return '#FF9800';
  };

  return (
    <div className="App">
      <div className="header">
        <h1>Shop Dashboard</h1>
        <button className="add-job-btn" onClick={() => setShowAddJob(true)}>
          +
        </button>
      </div>
      
      <div className="dashboard-grid">
        {jobs.map(job => (
          <div
            key={job.id}
            className={`job-tile ${completingJob === job.id ? 'completing' : ''} ${isOvertime(job) ? 'overtime' : ''}`}
            draggable
            onDragStart={(e) => handleDragStart(e, job)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, job)}
          >
            <div className="job-header">
              <h3>{job.title}</h3>
              <button className="delete-btn" onClick={() => handleDeleteJob(job.id)}>
                ×
              </button>
            </div>
            
            <div className="job-stats">
              <div className="stat">
                <span className="label">Quoted:</span>
                <span className="value">{job.quotedHours}h</span>
              </div>
              <div className="stat">
                <span className="label">Spent:</span>
                <span className="value">{job.timeSpent.toFixed(2)}h</span>
              </div>
              <div className="stat">
                <span className="label">Remaining:</span>
                <span className={`value ${isOvertime(job) ? 'overtime-text' : ''}`}>
                  {getTimeRemaining(job)}
                </span>
              </div>
            </div>

            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${getProgressPercentage(job)}%`,
                  backgroundColor: getProgressColor(job)
                }}
              />
            </div>

            <div className="techs-section">
              <div className="techs-list">
                {job.techs.map(tech => (
                  <div key={tech.id} className="tech-row">
                    <span className="tech-name">{tech.name}</span>
                    <button
                      className={`tech-toggle ${tech.isWorking ? 'working' : ''}`}
                      onClick={() => handleToggleTech(job.id, tech.id)}
                    >
                      {tech.isWorking ? 'STOP' : 'START'}
                    </button>
                  </div>
                ))}
              </div>
              
              {addingTechToJob === job.id ? (
                <form onSubmit={(e) => handleAddTechSubmit(e, job.id)} className="add-tech-form">
                  <input
                    type="text"
                    value={newTechName}
                    onChange={(e) => setNewTechName(e.target.value)}
                    placeholder="Tech name..."
                    autoFocus
                    className="tech-input"
                  />
                  <div className="tech-form-buttons">
                    <button type="submit" className="tech-submit-btn">✓</button>
                    <button 
                      type="button" 
                      onClick={() => {
                        setAddingTechToJob(null);
                        setNewTechName('');
                      }}
                      className="tech-cancel-btn"
                    >
                      ×
                    </button>
                  </div>
                </form>
              ) : (
                <button 
                  className="add-tech-btn" 
                  onClick={() => setAddingTechToJob(job.id)}
                >
                  + Add Tech
                </button>
              )}
            </div>

            <button className="complete-btn" onClick={() => handleCompleteJob(job.id)}>
              ✓ Complete Job
            </button>
          </div>
        ))}
      </div>

      {showAddJob && (
        <div className="modal-overlay" onClick={() => setShowAddJob(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add New Job</h2>
            <form onSubmit={handleAddJob}>
              <div className="form-group">
                <label>Job Title:</label>
                <input
                  type="text"
                  value={newJobTitle}
                  onChange={(e) => setNewJobTitle(e.target.value)}
                  placeholder="e.g., CO2 Transmission Replacement"
                  required
                />
              </div>
              <div className="form-group">
                <label>Quoted Hours:</label>
                <input
                  type="number"
                  step="0.5"
                  value={newJobHours}
                  onChange={(e) => setNewJobHours(e.target.value)}
                  placeholder="e.g., 20"
                  required
                />
              </div>
              <div className="modal-buttons">
                <button type="button" onClick={() => setShowAddJob(false)} className="cancel-btn">
                  Cancel
                </button>
                <button type="submit" className="submit-btn">
                  Add Job
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;