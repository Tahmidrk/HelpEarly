import { useEffect, useState } from 'react';
import { complaintsAPI } from '../utils/api';
import ProfileLink from './ProfileLink';

import { useSync } from '../context/SyncContext';

export default function ComplaintPanel() {
  const revision = useSync('complaints','bookings');
  const [contacts, setContacts] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ accused_id: '', subject: '', description: '' });

  const loadData = async () => {
    const [contactData, complaintData] = await Promise.all([
      complaintsAPI.getContacts().catch(() => []),
      complaintsAPI.getMine().catch(() => []),
    ]);
    setContacts(contactData);
    setComplaints(complaintData);
  };

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, [revision]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');
    try {
      await complaintsAPI.create({
        accused_id: Number(form.accused_id),
        subject: form.subject,
        description: form.description,
      });
      setForm({ accused_id: '', subject: '', description: '' });
      await loadData();
      setMessage('Complaint submitted to admin.');
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="glass-card-static">Loading complaints...</div>;
  }

  return (
    <div className="complaint-grid">
      <form className="glass-card-static" onSubmit={handleSubmit}>
        <h3 style={{ marginBottom: 12 }}>Submit a Complaint</h3>
        {message && (
          <div className={`alert ${message.startsWith('Error') ? 'alert-error' : 'alert-success'}`}>
            {message}
          </div>
        )}
        <div className="form-group">
          <label>Complaint Against</label>
          <select
            className="form-input"
            value={form.accused_id}
            onChange={(e) => setForm({ ...form, accused_id: e.target.value })}
            required
          >
            <option value="">Select a person</option>
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.name} ({contact.role})
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Subject</label>
          <input
            className="form-input"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            placeholder="Short reason for the complaint"
            required
          />
        </div>
        <div className="form-group">
          <label>Details</label>
          <textarea
            className="form-input"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Explain what happened with enough detail for admin to review."
            rows={4}
            required
          />
        </div>
        <button className="btn btn-primary" disabled={submitting || contacts.length === 0}>
          {submitting ? 'Submitting...' : 'Submit Complaint'}
        </button>
        {contacts.length === 0 && (
          <p className="text-secondary" style={{ marginTop: 10 }}>
            You can complain after you have a booking or accepted job with another member.
          </p>
        )}
      </form>

      <div className="glass-card-static">
        <h3 style={{ marginBottom: 12 }}>My Complaints</h3>
        {complaints.length === 0 ? (
          <p className="text-secondary">No complaints submitted yet.</p>
        ) : (
          <div className="stagger-children">
            {complaints.map((complaint) => (
              <div className="complaint-item" key={complaint.id}>
                <div className="booking-item-header">
                  <strong>{complaint.subject}</strong>
                  <span className={`badge ${complaint.status === 'resolved' ? 'badge-success' : 'badge-warning'}`}>
                    {complaint.status}
                  </span>
                </div>
                <p className="text-secondary">
                  Against{' '}
                  <ProfileLink
                    userId={complaint.accused_id}
                    helperId={complaint.accused_helper_profile_id}
                    role={complaint.accused_role}
                    name={complaint.accused_name}
                  />
                </p>
                <p>{complaint.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
