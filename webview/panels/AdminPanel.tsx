// src/webview/panels/AdminPanel.tsx
import React, { useEffect, useState } from 'react';
import firebase from '../../auth/firebaseConfig';

interface UserData {
  uid: string;
  email: string;
  plan: 'Free' | 'LocalPro' | 'CloudPro';
  role: 'user' | 'admin';
}

const AdminPanel: React.FC = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      const snapshot = await firebase.firestore().collection('users').get();
      const fetched = snapshot.docs.map(doc => ({
        uid: doc.id,
        email: doc.data().email || '',
        plan: doc.data().plan || 'Free',
        role: doc.data().role || 'user',
      }));
      setUsers(fetched);
      setLoading(false);
    };

    fetchUsers();
  }, []);

  const updatePlan = async (uid: string, newPlan: UserData['plan']) => {
    try {
      await firebase.firestore().collection('users').doc(uid).update({ plan: newPlan });
      setUsers(prev =>
        prev.map(u => (u.uid === uid ? { ...u, plan: newPlan } : u))
      );
    } catch (err) {
      alert('❌ Failed to update plan: ' + (err as any).message);
    }
  };

  const updateRole = async (uid: string, newRole: UserData['role']) => {
    try {
      await firebase.firestore().collection('users').doc(uid).update({ role: newRole });
      setUsers(prev =>
        prev.map(u => (u.uid === uid ? { ...u, role: newRole } : u))
      );
    } catch (err) {
      alert('❌ Failed to update role: ' + (err as any).message);
    }
  };

  const deleteUser = async (uid: string, email: string) => {
    const confirmed = confirm(`Are you sure you want to delete user ${email}?`);
    if (!confirmed) return;

    try {
      await firebase.firestore().collection('users').doc(uid).delete();
      setUsers(prev => prev.filter(u => u.uid !== uid));
    } catch (err) {
      alert('❌ Failed to delete user: ' + (err as any).message);
    }
  };

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: '2rem', color: '#fff' }}>
      <h2>🛠 Admin Panel</h2>
      <input
        placeholder="Search by email..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          marginBottom: '1rem',
          padding: '10px',
          width: '100%',
          borderRadius: '8px',
          backgroundColor: '#1e1e1e',
          border: '1px solid #444',
          color: '#fff',
        }}
      />
      {loading ? <p>Loading users...</p> : null}
      {filteredUsers.map(user => (
        <div
          key={user.uid}
          style={{
            border: '1px solid #444',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem',
            background: '#1E1E1E',
          }}
        >
          <p><strong>Email:</strong> {user.email}</p>
          <p><strong>Plan:</strong> {user.plan}</p>
          <p><strong>Role:</strong> {user.role}</p>

          <div style={{ marginBottom: '0.5rem' }}>
            <label>Change Plan:</label>
            <select
              value={user.plan}
              onChange={(e) => updatePlan(user.uid, e.target.value as UserData['plan'])}
              style={{ marginLeft: '0.5rem' }}
            >
              <option value="Free">Free</option>
              <option value="LocalPro">LocalPro</option>
              <option value="CloudPro">CloudPro</option>
            </select>
          </div>

          <div style={{ marginBottom: '0.5rem' }}>
            <label>Change Role:</label>
            <select
              value={user.role}
              onChange={(e) => updateRole(user.uid, e.target.value as UserData['role'])}
              style={{ marginLeft: '0.5rem' }}
            >
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </div>

          <button
            onClick={() => deleteUser(user.uid, user.email)}
            style={{
              padding: '8px 12px',
              background: '#ff4d4d',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              cursor: 'pointer',
              marginTop: '8px',
            }}
          >
            🗑️ Delete User
          </button>
        </div>
      ))}
    </div>
  );
};

export default AdminPanel;
