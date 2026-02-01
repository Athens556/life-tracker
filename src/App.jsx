import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { auth } from './lib/firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import Habits from './components/Habits';
import VibeLogger from './components/VibeLogger';

function Dashboard({ user }) {
  return (
    <>
      <VibeLogger user={user} />
      <Habits user={user} />
    </>
  );
}

function Header({ user }) {
  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  return (
    <header>
      <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/" style={{ textDecoration: 'none', fontSize: '1.5rem', fontWeight: 'bold', color: 'white' }}>
          Vibe<span style={{ color: 'var(--color-primary)' }}>Tracker</span>
        </Link>
        <nav style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {user ? (
            <>
              <Link to="/habits" className="btn" style={{ background: 'transparent', color: 'white' }}>Habits</Link>
              <button onClick={() => signOut(auth)} className="btn" style={{ background: 'rgba(255,255,255,0.1)' }}>
                Sign Out
              </button>
            </>
          ) : (
            <button onClick={handleLogin} className="btn btn-primary">
              Sign In with Google
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}

function Home() {
  return (
    <div className="container animate-fade-in" style={{ paddingTop: '4rem', textAlign: 'center' }}>
      <h1>Track Your Life.<br />Elevate Your Vibe.</h1>
      <p style={{ fontSize: '1.25rem', color: 'var(--color-text-dim)', maxWidth: '600px', margin: '0 auto 2rem' }}>
        A premium habit and mood tracker designed to help you stay minimal, focused, and mindful.
      </p>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <button className="btn btn-primary">Get Started</button>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;

  return (
    <Router>
      <Header user={user} />
      <Routes>
        <Route path="/" element={user ? <Dashboard user={user} /> : <Home />} />
        <Route path="/habits" element={user ? <Dashboard user={user} /> : <Home />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </Router>
  );
}

export default App;
