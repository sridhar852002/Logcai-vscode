import React, { useState } from 'react';
import firebase from '../../auth/firebaseConfig';
import { useUserPlan } from '../../auth/useUserPlan';

const SettingsPanel: React.FC = () => {
  const { user, plan } = useUserPlan();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const strength = getPasswordStrength(password);

  const signIn = async () => {
    setError('');
    try {
      if (!email || !password) {
        setError('Email and password are required.');
        return;
      }
      await firebase.auth().signInWithEmailAndPassword(email, password);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const signUp = async () => {
    setError('');
    try {
      if (!email || !password) {
        setError('Email and password are required.');
        return;
      }

      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }

      const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);

      await firebase.firestore().collection('users').doc(cred.user?.uid).set({
        plan: 'Free',
        email: cred.user?.email,
        role: 'user', 
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      await firebase.auth().currentUser?.reload();
      setEmail('');
      setPassword('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const signOut = async () => {
    await firebase.auth().signOut();
  };

  if (!user) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h2 style={styles.title}>🔐 Sign In to Logcai</h2>
          {error && <p style={styles.error}>{error}</p>}
          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
          />
          <input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
          />
          {password && (
            <div style={{ ...styles.strength, color: strength.color }}>
              Password Strength: {strength.label}
            </div>
          )}
          <button onClick={signIn} style={styles.button}>Sign In</button>
          <button onClick={signUp} style={{ ...styles.button, background: '#444' }}>Sign Up</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.panel}>
      <h2>⚙️ Settings</h2>
      <p><strong>👤 Email:</strong> {user.email}</p>
      <p><strong>💳 Plan:</strong> {plan}</p>
      <button onClick={signOut} style={{ ...styles.button, marginTop: '16px' }}>
        Sign Out
      </button>
    </div>
  );
};

// 🧠 Password strength checker
function getPasswordStrength(pwd: string) {
  let score = 0;
  if (pwd.length >= 6) score += 1;
  if (/[A-Z]/.test(pwd)) score += 1;
  if (/[0-9]/.test(pwd)) score += 1;
  if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

  switch (score) {
    case 0:
    case 1: return { label: 'Weak', color: 'red' };
    case 2: return { label: 'Okay', color: 'orange' };
    case 3: return { label: 'Good', color: '#FFD700' };
    case 4: return { label: 'Strong', color: '#00E676' };
    default: return { label: '', color: '' };
  }
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100%',
    width: '100%',
    backgroundColor: '#121212',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#1E1E1E',
    padding: '32px',
    borderRadius: '12px',
    width: '320px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
    marginBottom: '16px',
    fontSize: '20px',
    color: '#00E5FF',
    textAlign: 'center',
  },
  error: {
    color: 'red',
    marginBottom: '10px',
    textAlign: 'center',
  },
  strength: {
    fontSize: '13px',
    marginBottom: '10px',
    textAlign: 'center',
    transition: 'color 0.3s ease'
  },
  input: {
    marginBottom: '12px',
    padding: '10px 14px',
    borderRadius: '6px',
    border: '1px solid #333',
    backgroundColor: '#121212',
    color: '#fff',
  },
  button: {
    padding: '10px 14px',
    borderRadius: '6px',
    background: '#00E5FF',
    color: '#000',
    fontWeight: 'bold',
    border: 'none',
    marginBottom: '10px',
    cursor: 'pointer',
  },
  panel: {
    padding: '2rem',
    color: '#fff',
    backgroundColor: '#121212',
    height: '100%',
    fontSize: '16px',
  },
};

export default SettingsPanel;
