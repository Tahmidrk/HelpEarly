import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { authAPI, helpersAPI } from '../utils/api';
import LoadingSpinner from '../components/LoadingSpinner';
import AddressMap, { addressPlaceholder } from '../components/AddressMap';
import { useSync } from '../context/SyncContext';

export default function Profile() {
  const { user, activeRole, updateUser } = useAuth();
  const role = user?.role === 'both' ? activeRole : user?.role;
  const revision = useSync('profile', 'helpers');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [helperProfile, setHelperProfile] = useState(null);
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    location: user?.location || '',
  });
  const [helperForm, setHelperForm] = useState({
    bio: '',
    hourly_rate: '',
    experience_years: '',
    is_available: true,
  });
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [message, setMessage] = useState('');
  const [mapCandidate,setMapCandidate]=useState(null),[locating,setLocating]=useState(false);
  const chooseCurrentArea=()=>{
    if(!navigator.geolocation){setMessage('Error: Location unavailable. Keep your address and confirm from Android.');return;}
    setLocating(true);
    navigator.geolocation.getCurrentPosition(position=>{
      setLocating(false);
      if(position.coords.accuracy>5000){setMessage('Error: Location is too uncertain. Retry outside or confirm from Android.');return;}
      setMapCandidate({latitude:position.coords.latitude,longitude:position.coords.longitude});
    },()=>{setLocating(false);setMessage('Error: Location permission denied or unavailable. Address remains unchanged.');},{enableHighAccuracy:true,timeout:15000});
  };

  useEffect(() => {
    let disposed = false;
    if (!editing) setForm({ name: user?.name || '', phone: user?.phone || '', location: user?.location || '' });
    if (role === 'helper') {
      helpersAPI.getMyProfile()
        .then((p) => {
          if (disposed) return;
          setHelperProfile(p);
          if (!editing) setHelperForm({
            bio: p.bio || '',
            hourly_rate: p.hourly_rate || '',
            experience_years: p.experience_years || '',
            is_available: p.is_available,
          });
        })
        .catch(err => { if (!disposed) setMessage('Error: ' + err.message); });
    }
    return () => { disposed = true; };
  }, [user, role, revision, editing]);

  const handleSave = async () => {
    setLoading(true);
    setMessage('');
    try {
      const updatedUser = await authAPI.updateProfile({...form,...(mapCandidate?.location_confirmed?mapCandidate:{})});
      if (role === 'helper') {
        await helpersAPI.update(helperForm);
      }
      updateUser(updatedUser);
      setMessage('Profile updated successfully!');
      setEditing(false);
      setMapCandidate(null);
    } catch (err) {
      setMessage('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    setLoading(true);
    setMessage('');

    if (!passwordForm.current_password || !passwordForm.new_password || !passwordForm.confirm_password) {
      setMessage('Error: Please fill in all password fields.');
      setLoading(false);
      return;
    }

    if (passwordForm.new_password.length < 6) {
      setMessage('Error: New password must be at least 6 characters.');
      setLoading(false);
      return;
    }

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setMessage('Error: New passwords do not match.');
      setLoading(false);
      return;
    }

    try {
      const result = await authAPI.changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      setMessage(result.message);
    } catch (err) {
      setMessage('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return <LoadingSpinner />;

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 700 }}>
        <div className="page-header">
          <h1>My Profile</h1>
          <p>View and manage your account details</p>
        </div>

        <div className="glass-card-static">
          {/* Profile Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <div className="avatar avatar-lg avatar-placeholder">
              {user.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 style={{ fontSize: '1.3rem' }}>{user.name}</h2>
              <span className="badge badge-primary">{user.role}</span>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              style={{ marginLeft: 'auto' }}
              onClick={() => setEditing(!editing)}
            >
              {editing ? 'Cancel' : 'Edit Profile'}
            </button>
          </div>

          {message && (
            <div className={`alert ${message.startsWith('Error') ? 'alert-error' : 'alert-success'}`} style={{ marginBottom: 16 }}>
              {message}
            </div>
          )}

          {editing ? (
            <div>
              <div className="form-group">
                <label>Full Name</label>
                <input type="text" className="form-input" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" className="form-input" value={user.email} disabled
                  style={{ opacity: 0.6 }} />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input type="tel" className="form-input" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Address / Location</label>
                <input type="text" className="form-input" value={form.location} placeholder={addressPlaceholder()}
                  onChange={(e) => {setForm({ ...form, location: e.target.value });setMapCandidate(null);}} />
                <small className="field-help">Add house/flat number, road, block, area, and city.</small>
              </div>
              {role==='helper' && <div className="form-group">
                <button type="button" className="btn btn-secondary" onClick={chooseCurrentArea} disabled={locating || !form.location.trim()}>{locating?'Finding area...':'Select current area for map review'}</button>
                <small className="field-help">Use only while in your intended service area. Public maps show approximate coordinates. Nothing is saved until you confirm and save.</small>
                {mapCandidate && <><AddressMap address={form.location} coordinates={{...mapCandidate,location_confirmed:true}} label="Selected service area — review before confirmation"/><label><input type="checkbox" checked={!!mapCandidate.location_confirmed} onChange={e=>setMapCandidate({...mapCandidate,location_confirmed:e.target.checked})}/> I reviewed the map and confirm this service area.</label></>}
              </div>}
              <AddressMap address={form.location} coordinates={mapCandidate?.location_confirmed?mapCandidate:form.location===user.location?user:null} label="Profile map preview" />

              {role === 'helper' && (
                <>
                  <h3 style={{ margin: '24px 0 16px', fontSize: '1.1rem' }}>Helper Details</h3>
                  <div className="form-group">
                    <label>Bio</label>
                    <textarea className="form-input" value={helperForm.bio}
                      onChange={(e) => setHelperForm({ ...helperForm, bio: e.target.value })} rows={3} />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Hourly Rate (৳)</label>
                      <input type="number" className="form-input" value={helperForm.hourly_rate}
                        onChange={(e) => setHelperForm({ ...helperForm, hourly_rate: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Experience (years)</label>
                      <input type="number" className="form-input" value={helperForm.experience_years}
                        onChange={(e) => setHelperForm({ ...helperForm, experience_years: e.target.value })} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="checkbox" checked={helperForm.is_available}
                        onChange={(e) => setHelperForm({ ...helperForm, is_available: e.target.checked })} />
                      Available for work
                    </label>
                  </div>
                </>
              )}

              <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </button>

              <h3 style={{ margin: '28px 0 16px', fontSize: '1.1rem' }}>Change Password</h3>
              <div className="form-group">
                <label>Current Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={passwordForm.current_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>New Password</label>
                  <input
                    type="password"
                    className="form-input"
                    value={passwordForm.new_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Confirm New Password</label>
                  <input
                    type="password"
                    className="form-input"
                    value={passwordForm.confirm_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                  />
                </div>
              </div>
              <button className="btn btn-secondary" onClick={handlePasswordChange} disabled={loading}>
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          ) : (
            <div>
              <div className="profile-field">
                <span className="profile-label">Email</span>
                <span>{user.email}</span>
              </div>
              <div className="profile-field">
                <span className="profile-label">Phone</span>
                <span>{user.phone || 'Not set'}</span>
              </div>
              <div className="profile-field">
                <span className="profile-label">Address / Location</span>
                <span>{user.location || 'Not set'}</span>
              </div>
              <AddressMap address={user.location} coordinates={user} label="Saved map" />
              <div className="profile-field">
                <span className="profile-label">Member Since</span>
                <span>{new Date(user.created_at).toLocaleDateString()}</span>
              </div>

              {role === 'helper' && helperProfile && (
                <>
                  <h3 style={{ margin: '24px 0 12px', fontSize: '1.1rem' }}>Helper Details</h3>
                  <div className="profile-field">
                    <span className="profile-label">Bio</span>
                    <span>{helperProfile.bio || 'Not set'}</span>
                  </div>
                  <div className="profile-field">
                    <span className="profile-label">Hourly Rate</span>
                    <span>৳{helperProfile.hourly_rate}</span>
                  </div>
                  <div className="profile-field">
                    <span className="profile-label">Experience</span>
                    <span>{helperProfile.experience_years} years</span>
                  </div>
                  <div className="profile-field">
                    <span className="profile-label">Status</span>
                    <span>{helperProfile.is_available ? <><i className="fas fa-circle" style={{ fontSize: '0.5rem', color: 'var(--success)', verticalAlign: 'middle' }}></i> Available</> : <><i className="fas fa-circle" style={{ fontSize: '0.5rem', color: 'var(--danger)', verticalAlign: 'middle' }}></i> Unavailable</>}</span>
                  </div>
                  <div className="profile-field">
                    <span className="profile-label">Rating</span>
                    <span><i className="fas fa-star"></i> {Number(helperProfile.total_reviews) > 0 ? `${Number(helperProfile.avg_rating).toFixed(1)} (${helperProfile.total_reviews} reviews)` : 'Not rated yet'}</span>
                  </div>
                  <div className="profile-field">
                    <span className="profile-label">Verified</span>
                    <span>{helperProfile.is_verified ? '✓ Yes' : 'No'}</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
