import { useState, useEffect } from 'react';
import { adminAPI, complaintsAPI } from '../utils/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ProfileLink from '../components/ProfileLink';

import { useSync } from '../context/SyncContext';

export default function AdminDashboard() {
  const revision = useSync("admin");
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [userFilter, setUserFilter] = useState({ role: '', search: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadOverviewStats = async () => {
      try {
        const [statsData, usersData] = await Promise.all([
          adminAPI.getStats(),
          adminAPI.getUsers({ limit: 1 }),
        ]);

        if (!isMounted) return;
        setStats({
          ...statsData,
          userBreakdown: usersData.userBreakdown || statsData.userBreakdown,
        });
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadOverviewStats();
    const refreshTimer = setInterval(loadOverviewStats, 5000);

    return () => {
      isMounted = false;
      clearInterval(refreshTimer);
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'users') {
      adminAPI.getUsers(userFilter).then(data => setUsers(data.users || [])).catch(console.error);
    }
    if (activeTab === 'complaints') {
      complaintsAPI.getAll().then(setComplaints).catch(console.error);
    }
  }, [activeTab, userFilter, revision]);

  const handleToggleUser = async (id, isActive) => {
    try {
      await adminAPI.updateUser(id, { is_active: !isActive });
      setUsers(users.map(u => u.id === id ? { ...u, is_active: !isActive } : u));
      const [statsData, usersData] = await Promise.all([
        adminAPI.getStats(),
        adminAPI.getUsers({ limit: 1 }),
      ]);
      setStats({ ...statsData, userBreakdown: usersData.userBreakdown || statsData.userBreakdown });
    } catch (err) { alert(err.message); }
  };

  const handleVerifyHelper = async (helperId, isVerified) => {
    try {
      await adminAPI.verifyHelper(helperId, !isVerified);
      setUsers(users.map(u => u.helper_profile_id === helperId ? { ...u, is_verified: !isVerified } : u));
    } catch (err) { alert(err.message); }
  };

  const handleDeleteUser = async (id) => {
    if (!confirm('Are you sure? This will delete all associated data.')) return;
    try {
      await adminAPI.deleteUser(id);
      setUsers(users.filter(u => u.id !== id));
      const [statsData, usersData] = await Promise.all([
        adminAPI.getStats(),
        adminAPI.getUsers({ limit: 1 }),
      ]);
      setStats({ ...statsData, userBreakdown: usersData.userBreakdown || statsData.userBreakdown });
    } catch (err) { alert(err.message); }
  };

  const handleComplaintStatus = async (id, status) => {
    try {
      await complaintsAPI.update(id, { status });
      setComplaints(complaints.map(c => c.id === id ? { ...c, status } : c));
    } catch (err) { alert(err.message); }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page">
      <div className="container">
        <div className="page-header animate-fade-in">
          <h1>Admin Dashboard <i className="fas fa-shield-alt"></i></h1>
          <p>Platform management and monitoring</p>
        </div>

        <div className="tabs">
          <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
          <button className={`tab ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>User Management</button>
          <button className={`tab ${activeTab === 'complaints' ? 'active' : ''}`} onClick={() => setActiveTab('complaints')}>Complaints</button>
          <button className={`tab ${activeTab === 'activity' ? 'active' : ''}`} onClick={() => setActiveTab('activity')}>Recent Activity</button>
        </div>

        {/* Overview */}
        {activeTab === 'overview' && stats && (
          <div className="animate-fade-in">
            <div className="grid grid-4 stagger-children" style={{ marginBottom: 32 }}>
              <div className="stat-card"><div className="stat-icon" style={{ background: 'var(--info-bg)' }}><i className="fas fa-users"></i></div><div className="stat-info"><h3>{stats.userBreakdown?.households || 0}</h3><p>Household Members</p></div></div>
              <div className="stat-card"><div className="stat-icon" style={{ background: 'rgba(139,92,246,0.15)' }}><i className="fas fa-wrench"></i></div><div className="stat-info"><h3>{stats.userBreakdown?.helpers || 0}</h3><p>Helpers</p></div></div>
              <div className="stat-card"><div className="stat-icon" style={{ background: 'var(--success-bg)' }}><i className="fas fa-clipboard-list"></i></div><div className="stat-info"><h3>{stats.bookings.total}</h3><p>Total Bookings</p></div></div>
              <div className="stat-card"><div className="stat-icon" style={{ background: 'var(--warning-bg)' }}><i className="fas fa-money-bill-wave"></i></div><div className="stat-info"><h3>৳{stats.revenue}</h3><p>Total Revenue</p></div></div>
            </div>

            <div className="grid grid-3" style={{ marginBottom: 32 }}>
              <div className="glass-card-static">
                <h3 style={{ marginBottom: 16 }}><i className="fas fa-users"></i> User Breakdown</h3>
                <div className="admin-metric"><span>All Accounts</span><span className="badge badge-info">{stats.userBreakdown?.total || 0}</span></div>
                <div className="admin-metric"><span>Active Users</span><span className="badge badge-success">{stats.userBreakdown?.active || 0}</span></div>
                <div className="admin-metric"><span>Banned Users</span><span className="badge badge-danger">{stats.userBreakdown?.banned || 0}</span></div>
                <div className="admin-metric"><span>Household Members</span><span>{stats.userBreakdown?.households || 0}</span></div>
                <div className="admin-metric"><span>Helpers</span><span>{stats.userBreakdown?.helpers || 0}</span></div>
                <div className="admin-metric"><span>Admins</span><span>{stats.userBreakdown?.admins || 0}</span></div>
              </div>
              <div className="glass-card-static">
                <h3 style={{ marginBottom: 16 }}><i className="fas fa-chart-bar"></i> Bookings Breakdown</h3>
                <div className="admin-metric"><span>Pending</span><span className="badge badge-warning">{stats.bookings.pending}</span></div>
                <div className="admin-metric"><span>Completed</span><span className="badge badge-success">{stats.bookings.completed}</span></div>
                <div className="admin-metric"><span>Total</span><span className="badge badge-info">{stats.bookings.total}</span></div>
              </div>
              <div className="glass-card-static">
                <h3 style={{ marginBottom: 16 }}><i className="fas fa-star"></i> Reviews</h3>
                <div className="admin-metric"><span>Total Reviews</span><span>{stats.reviews.total}</span></div>
                <div className="admin-metric"><span>Average Rating</span><span><i className="fas fa-star" style={{ color: '#f59e0b' }}></i> {stats.reviews.avgRating}</span></div>
              </div>
              <div className="glass-card-static">
                <h3 style={{ marginBottom: 16 }}><i className="fas fa-bullhorn"></i> Jobs</h3>
                <div className="admin-metric"><span>Open Jobs</span><span className="badge badge-success">{stats.jobs.open}</span></div>
                <div className="admin-metric"><span>Total Jobs</span><span className="badge badge-info">{stats.jobs.total}</span></div>
              </div>
            </div>

            <div className="grid grid-3" style={{ marginBottom: 32 }}>
              <div className="glass-card-static">
                <h3 style={{ marginBottom: 16 }}><i className="fas fa-home"></i> Households</h3>
                <div className="admin-metric"><span>Active</span><span className="badge badge-success">{stats.userBreakdown?.active_households || 0}</span></div>
                <div className="admin-metric"><span>Banned</span><span className="badge badge-danger">{stats.userBreakdown?.banned_households || 0}</span></div>
              </div>
              <div className="glass-card-static">
                <h3 style={{ marginBottom: 16 }}><i className="fas fa-wrench"></i> Helpers</h3>
                <div className="admin-metric"><span>Active</span><span className="badge badge-success">{stats.userBreakdown?.active_helpers || 0}</span></div>
                <div className="admin-metric"><span>Banned</span><span className="badge badge-danger">{stats.userBreakdown?.banned_helpers || 0}</span></div>
              </div>
              <div className="glass-card-static">
                <h3 style={{ marginBottom: 16 }}><i className="fas fa-user-shield"></i> Admins</h3>
                <div className="admin-metric"><span>Active</span><span className="badge badge-success">{stats.userBreakdown?.active_admins || 0}</span></div>
                <div className="admin-metric"><span>Banned</span><span className="badge badge-danger">{stats.userBreakdown?.banned_admins || 0}</span></div>
              </div>
            </div>
          </div>
        )}

        {/* Users */}
        {activeTab === 'users' && (
          <div className="animate-fade-in">
            <div className="filters-bar glass-card-static" style={{ marginBottom: 24 }}>
              <div className="filter-row">
                <input type="text" className="form-input" placeholder="Search by name or email..." value={userFilter.search}
                  onChange={(e) => setUserFilter({ ...userFilter, search: e.target.value })} />
                <select className="form-input filter-select" value={userFilter.role} onChange={(e) => setUserFilter({ ...userFilter, role: e.target.value })}>
                  <option value="">All Roles</option>
                  <option value="household">Households</option>
                  <option value="helper">Helpers</option>
                  <option value="admin">Admins</option>
                </select>
              </div>
            </div>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>NID Card #</th>
                    <th>Role</th>
                    <th>Location</th>
                    <th>Status / Verification</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="avatar avatar-placeholder" style={{ width: 32, height: 32, fontSize: '0.75rem' }}>{u.name?.charAt(0)}</div>
                          <ProfileLink
                            userId={u.id}
                            helperId={u.helper_profile_id}
                            role={u.role}
                            name={u.name}
                          />
                        </div>
                      </td>
                      <td>{u.email}</td>
                      <td><code style={{ fontSize: '0.85rem' }}>{u.nid_number || 'Not Provided'}</code></td>
                      <td><span className={`badge ${u.role === 'admin' ? 'badge-danger' : u.role === 'helper' ? 'badge-primary' : 'badge-info'}`}>{u.role}</span></td>
                      <td>{u.location || '-'}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}>
                            {u.is_active ? 'Active' : 'Banned'}
                          </span>
                          {u.role === 'helper' && (
                            u.is_verified ? (
                              <span className="badge badge-info"><i className="fas fa-check-circle" /> Verified Helper</span>
                            ) : (
                              <span className="badge badge-warning"><i className="fas fa-clock" /> Pending Approval</span>
                            )
                          )}
                        </div>
                      </td>
                      <td>{new Date(u.created_at).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {u.role === 'helper' && (
                            <button className={`btn btn-sm ${u.is_verified ? 'btn-secondary' : 'btn-success'}`} onClick={() => handleVerifyHelper(u.helper_profile_id, u.is_verified)}>
                              {u.is_verified ? 'Remove Verification' : 'Approve Helper'}
                            </button>
                          )}
                          <button className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-success'}`}
                            onClick={() => handleToggleUser(u.id, u.is_active)}>
                            {u.is_active ? 'Ban' : 'Unban'}
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteUser(u.id)}><i className="fas fa-trash"></i></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'complaints' && (
          <div className="animate-fade-in">
            {complaints.length === 0 ? (
              <div className="empty-state"><i className="fas fa-flag"></i><h3>No complaints</h3><p>Complaints from households and helpers will appear here.</p></div>
            ) : (
              <div className="stagger-children">
                {complaints.map((complaint) => (
                  <div key={complaint.id} className="booking-item glass-card">
                    <div className="booking-item-header">
                      <div className="booking-item-info">
                        <h3>{complaint.subject}</h3>
                        <p className="text-secondary">
                          <ProfileLink
                            userId={complaint.complainant_id}
                            helperId={complaint.complainant_helper_profile_id}
                            role={complaint.complainant_role}
                            name={complaint.complainant_name}
                          />{' '}
                          ({complaint.complainant_role}) against{' '}
                          <ProfileLink
                            userId={complaint.accused_id}
                            helperId={complaint.accused_helper_profile_id}
                            role={complaint.accused_role}
                            name={complaint.accused_name}
                          />{' '}
                          ({complaint.accused_role})
                        </p>
                      </div>
                      <span className={`badge ${complaint.status === 'resolved' ? 'badge-success' : complaint.status === 'dismissed' ? 'badge-danger' : 'badge-warning'}`}>
                        {complaint.status}
                      </span>
                    </div>
                    <p style={{ marginBottom: 12 }}>{complaint.description}</p>
                    <div className="booking-item-actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => handleComplaintStatus(complaint.id, 'reviewing')}>Reviewing</button>
                      <button className="btn btn-success btn-sm" onClick={() => handleComplaintStatus(complaint.id, 'resolved')}>Resolve</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleComplaintStatus(complaint.id, 'dismissed')}>Dismiss</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Activity */}
        {activeTab === 'activity' && stats && (
          <div className="animate-fade-in">
            <h3 style={{ marginBottom: 16 }}>Recent Bookings</h3>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr><th>Client</th><th>Helper</th><th>Status</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {(stats.recentBookings || []).map((b) => (
                    <tr key={b.id}>
                      <td><ProfileLink userId={b.client_id || b.user_id} role="household" name={b.client_name} /></td>
                      <td><ProfileLink userId={b.helper_user_id} helperId={b.helper_profile_id || b.helper_id} role="helper" name={b.helper_name} /></td>
                      <td><span className={`badge ${b.status === 'completed' ? 'badge-success' : b.status === 'pending' ? 'badge-warning' : 'badge-info'}`}>{b.status}</span></td>
                      <td>{new Date(b.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
