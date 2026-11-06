import React, { useEffect, useState, useRef } from 'react';

export default function Dashboard({ user, token, onLogout }) {
  const [tickets, setTickets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Error and Status States
  const [ticketError, setTicketError] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);

  // Ticket Form States (Submitter)
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priority, setPriority] = useState('medium');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Per-Ticket Editing & Deletion States (Technician / Admin)
  const [editingStatus, setEditingStatus] = useState({});
  const [editingPriority, setEditingPriority] = useState({});
  const [updateError, setUpdateError] = useState({});
  const [updateSuccess, setUpdateSuccess] = useState({});
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleteError, setDeleteError] = useState({});
  const [deleteSuccess, setDeleteSuccess] = useState({});

  // useRef guard to prevent duplicate concurrent deletion requests
  const deletingRef = useRef({});

  // Fetch tickets and categories on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setTicketError('');
      setCategoryError('');

      try {
        const ticketRes = await fetch('http://localhost:5000/api/tickets', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (ticketRes.status === 401 || ticketRes.status === 403) {
          onLogout();
          throw new Error('Session expired. Please log in again.');
        }
        if (!ticketRes.ok) {
          throw new Error('Failed to retrieve tickets from server.');
        }
        const ticketData = await ticketRes.json();
        setTickets(Array.isArray(ticketData) ? ticketData : []);

        const initialStatus = {};
        const initialPriority = {};
        if (Array.isArray(ticketData)) {
          ticketData.forEach(t => {
            initialStatus[t.id] = t.status;
            initialPriority[t.id] = t.priority;
          });
        }
        setEditingStatus(initialStatus);
        setEditingPriority(initialPriority);
      } catch (err) {
        if (err.message !== 'Session expired. Please log in again.') {
          setTicketError(err.message || 'Error loading tickets.');
        }
      }

      if (user.role === 'user') {
        try {
          const catRes = await fetch('http://localhost:5000/api/categories', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (catRes.ok) {
            const catData = await catRes.json();
            setCategories(Array.isArray(catData) ? catData : []);
            setCategoriesLoaded(true);
          } else {
            setCategoryError('Failed to load categories.');
          }
        } catch (err) {
          setCategoryError('Error connecting to category service.');
        }
      }

      setLoading(false);
    };

    fetchData();
  }, [token, onLogout, user.role]);

  // Handle Submitter Ticket Creation
  const handleCreateTicket = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!title || !description || !categoryId) {
      setFormError('Please fill in all required fields.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('http://localhost:5000/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          description,
          category_id: parseInt(categoryId),
          priority
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create ticket.');
      }

      setFormSuccess('Ticket submitted successfully!');
      setTitle('');
      setDescription('');
      setCategoryId('');
      setPriority('medium');

      const ticketRes = await fetch('http://localhost:5000/api/tickets', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (ticketRes.ok) {
        const ticketData = await ticketRes.json();
        setTickets(Array.isArray(ticketData) ? ticketData : []);
      }
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Technician / Administrator Ticket Updates
  const handleUpdateTicket = async (ticketId) => {
    setUpdateError(prev => ({ ...prev, [ticketId]: '' }));
    setUpdateSuccess(prev => ({ ...prev, [ticketId]: '' }));

    const newStatus = editingStatus[ticketId];
    const newPriority = editingPriority[ticketId];

    try {
      const res = await fetch(`http://localhost:5000/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus, priority: newPriority })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update ticket.');
      }

      setUpdateSuccess(prev => ({ ...prev, [ticketId]: 'Changes saved successfully!' }));

      const ticketRes = await fetch('http://localhost:5000/api/tickets', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (ticketRes.ok) {
        const ticketData = await ticketRes.json();
        setTickets(Array.isArray(ticketData) ? ticketData : []);
      }
    } catch (err) {
      setUpdateError(prev => ({ ...prev, [ticketId]: err.message }));
    }
  };

  // Handle Administrator Ticket Deletion
  const handleDeleteTicket = async (ticketId) => {
    if (deletingRef.current[ticketId]) return;
    deletingRef.current[ticketId] = true;

    setDeleteError(prev => ({ ...prev, [ticketId]: '' }));
    setDeleteSuccess(prev => ({ ...prev, [ticketId]: '' }));

    try {
      const res = await fetch(`http://localhost:5000/api/tickets/${ticketId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete ticket.');
      }

      setTickets(prev => prev.filter(t => t.id !== ticketId));
      setConfirmDeleteId(null);
    } catch (err) {
      setDeleteError(prev => ({ ...prev, [ticketId]: err.message }));
    } finally {
      deletingRef.current[ticketId] = false;
    }
  };

  // Helper functions for badge styling classes & human-readable formatting
  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'open': return 'd4d-badge d4d-status-open';
      case 'in_progress': return 'd4d-badge d4d-status-in-progress';
      case 'resolved': return 'd4d-badge d4d-status-resolved';
      case 'closed': return 'd4d-badge d4d-status-closed';
      default: return 'd4d-badge d4d-status-unknown';
    }
  };

  const getPriorityBadgeClass = (priority) => {
    switch (priority) {
      case 'low': return 'd4d-badge d4d-priority-low';
      case 'medium': return 'd4d-badge d4d-priority-medium';
      case 'high': return 'd4d-badge d4d-priority-high';
      case 'urgent': return 'd4d-badge d4d-priority-urgent';
      default: return 'd4d-badge d4d-priority-medium';
    }
  };

  const formatStatusLabel = (status) => {
    switch (status) {
      case 'open': return 'Open';
      case 'in_progress': return 'In Progress';
      case 'resolved': return 'Resolved';
      case 'closed': return 'Closed';
      default: return status || 'Unknown';
    }
  };

  const formatPriorityLabel = (priority) => {
    switch (priority) {
      case 'low': return 'Low';
      case 'medium': return 'Medium';
      case 'high': return 'High';
      case 'urgent': return 'Urgent';
      default: return priority ? priority.charAt(0).toUpperCase() + priority.slice(1) : 'Medium';
    }
  };

  return (
    <div className="d4d-container">
      <header className="d4d-header">
        <h2>D4D Ticket Dashboard</h2>
        <div className="d4d-user-info">
          <span>Welcome, <b>{user.name}</b></span>
          <span className="d4d-role-badge">{user.role}</span>
          <button onClick={onLogout} className="d4d-logout-btn">
            Logout
          </button>
        </div>
      </header>

      {/* Submitter Ticket Creation Section */}
      {user.role === 'user' && (
        <section className="d4d-section">
          <h3>Create New Support Ticket</h3>
          {formError && <div className="d4d-alert-error">{formError}</div>}
          {formSuccess && <div className="d4d-alert-success">{formSuccess}</div>}
          <form onSubmit={handleCreateTicket}>
            <div className="d4d-form-group">
              <label htmlFor="ticket-title">Ticket Title</label>
              <input
                type="text"
                id="ticket-title"
                className="d4d-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="Brief summary of the issue"
              />
            </div>
            <div className="d4d-form-group">
              <label htmlFor="ticket-category">Category</label>
              <select
                id="ticket-category"
                className="d4d-select"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
              >
                <option value="">-- Select Category --</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              {categoryError && <div className="d4d-alert-error" style={{ marginTop: '10px', fontSize: '0.85rem' }}>{categoryError}</div>}
            </div>
            <div className="d4d-form-group">
              <label htmlFor="ticket-priority">Priority</label>
              <select
                id="ticket-priority"
                className="d4d-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="d4d-form-group">
              <label htmlFor="ticket-description">Description</label>
              <textarea
                id="ticket-description"
                className="d4d-textarea"
                rows="4"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                placeholder="Detailed description of the problem..."
              />
            </div>
            <button type="submit" disabled={submitting} className="d4d-btn-primary">
              {submitting ? 'Submitting...' : 'Submit Ticket'}
            </button>
          </form>
        </section>
      )}

      {/* Ticket List Section */}
      <section className="d4d-section">
        <h3>Support Tickets</h3>
        {loading ? (
          <div className="d4d-loading-state">
            <div className="d4d-spinner"></div>
            <span>Loading support tickets...</span>
          </div>
        ) : ticketError ? (
          <div className="d4d-alert-error">{ticketError}</div>
        ) : tickets.length === 0 ? (
          <div className="d4d-empty-state">
            <div className="d4d-empty-icon">🎫</div>
            <h4>No tickets found</h4>
            <p>
              {user.role === 'user'
                ? "You don't have any support requests at the moment."
                : "There are currently no support tickets to display."}
            </p>
          </div>
        ) : (
          <div>
            {tickets.map(ticket => (
              <div key={ticket.id} className="d4d-ticket-card">
                <div className="d4d-ticket-header-row">
                  <h4>{ticket.title}</h4>
                </div>
                <p>{ticket.description}</p>
                <div className="d4d-ticket-meta">
                  <span className="d4d-meta-item">
                    Status: <span className={getStatusBadgeClass(ticket.status)}>{formatStatusLabel(ticket.status)}</span>
                  </span>
                  <span>|</span>
                  <span className="d4d-meta-item">
                    Priority: <span className={getPriorityBadgeClass(ticket.priority)}>{formatPriorityLabel(ticket.priority)}</span>
                  </span>
                  <span>|</span>
                  <span className="d4d-meta-item">
                    Category: <b>{ticket.category_name || 'General'}</b>
                  </span>
                </div>

                {/* Technician & Administrator Update Controls */}
                {(user.role === 'technician' || user.role === 'admin') && (
                  <div className="d4d-controls-panel">
                    <p className="d4d-controls-header">
                      {user.role === 'admin' ? 'Administrator Controls' : 'Technician Controls'}
                    </p>
                    {updateError[ticket.id] && <div className="d4d-alert-error">{updateError[ticket.id]}</div>}
                    {updateSuccess[ticket.id] && <div className="d4d-alert-success">{updateSuccess[ticket.id]}</div>}

                    <div className="d4d-controls-grid">
                      <div className="d4d-control-field">
                        <label>Status</label>
                        <select
                          className="d4d-select"
                          value={editingStatus[ticket.id] !== undefined ? editingStatus[ticket.id] : ticket.status}
                          onChange={(e) => setEditingStatus({ ...editingStatus, [ticket.id]: e.target.value })}
                        >
                          <option value="open">open</option>
                          <option value="in_progress">in_progress</option>
                          <option value="resolved">resolved</option>
                          <option value="closed">closed</option>
                        </select>
                      </div>

                      <div className="d4d-control-field">
                        <label>Priority</label>
                        <select
                          className="d4d-select"
                          value={editingPriority[ticket.id] !== undefined ? editingPriority[ticket.id] : ticket.priority}
                          onChange={(e) => setEditingPriority({ ...editingPriority, [ticket.id]: e.target.value })}
                        >
                          <option value="low">low</option>
                          <option value="medium">medium</option>
                          <option value="high">high</option>
                          {((editingPriority[ticket.id] === 'urgent') || (ticket.priority === 'urgent')) && (
                            <option value="urgent">urgent</option>
                          )}
                        </select>
                      </div>

                      <div className="d4d-control-actions">
                        <button
                          onClick={() => handleUpdateTicket(ticket.id)}
                          className="d4d-btn-primary d4d-save-btn"
                        >
                          Save Changes
                        </button>
                      </div>

                      {/* Administrator Delete Controls */}
                      {user.role === 'admin' && (
                        <div className="d4d-admin-delete-wrapper">
                          {confirmDeleteId !== ticket.id ? (
                            <button
                              onClick={() => setConfirmDeleteId(ticket.id)}
                              className="d4d-btn-danger d4d-delete-trigger-btn"
                            >
                              Delete Ticket
                            </button>
                          ) : (
                            <div className="d4d-confirm-box">
                              <p className="d4d-confirm-text">Are you sure you want to delete this ticket?</p>
                              <div className="d4d-confirm-actions">
                                <button
                                  onClick={() => handleDeleteTicket(ticket.id)}
                                  className="d4d-btn-danger d4d-delete-confirm-btn"
                                >
                                  Yes, Delete
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="d4d-btn-secondary"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {deleteError[ticket.id] && <div className="d4d-alert-error d4d-update-error">{deleteError[ticket.id]}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}