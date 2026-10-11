import React, { useEffect, useState } from 'react';

export default function Dashboard({ user, token, onLogout }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch tickets using token authorization
    fetch('http://localhost:5000/api/tickets', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => {
        if (res.status === 401 || res.status === 403) {
          // Token expired or invalid -> log out user
          onLogout();
          throw new Error('Session expired. Please log in again.');
        }
        return res.json();
      })
      .then(data => {
        setTickets(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [token, onLogout]);

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>
        <h2>D4D Ticket Dashboard</h2>
        <div>
          <span style={{ marginRight: '15px' }}>Welcome, <b>{user.name}</b> ({user.role})</span>
          <button onClick={onLogout} style={{ padding: '6px 12px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Logout
          </button>
        </div>
      </header>

      <section style={{ marginTop: '20px' }}>
        <h3>Support Tickets</h3>
        {loading ? (
          <p>Loading tickets...</p>
        ) : tickets.length === 0 ? (
          <p>No tickets found.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {tickets.map(ticket => (
              <li key={ticket.id} style={{ border: '1px solid #ddd', padding: '15px', marginBottom: '10px', borderRadius: '6px' }}>
                <h4>{ticket.title}</h4>
                <p>{ticket.description}</p>
                <small>Status: <b>{ticket.status}</b> | Priority: <b>{ticket.priority}</b> | Category: {ticket.category_name || 'General'}</small>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}