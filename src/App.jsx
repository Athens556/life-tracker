import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { auth, usingEmulators } from './lib/firebase';
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut } from 'firebase/auth';
import Habits from './components/Habits';
import VibeLogger from './components/VibeLogger';
import Analysis from './components/Analysis';
import Timeline from './components/Timeline';
import Resistance from './components/Resistance';
import NegativeHabits from './components/NegativeHabits';
import HabitsProvider from './components/HabitsProvider';
import System from './components/System';
import { ensureDefaultHabits } from './lib/defaultHabits';

function Dashboard({ user }) {
  return (
    <>
      <VibeLogger user={user} />
      <NegativeHabits user={user} />
      <Habits user={user} />
    </>
  );
}

function Header({ user }) {
  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      if (usingEmulators) {
        await signInWithRedirect(auth, provider);
      } else {
        await signInWithPopup(auth, provider);
      }
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
              <Link to="/analysis" className="btn" style={{ background: 'transparent', color: 'white' }}>Analysis</Link>
              <Link to="/timeline" className="btn" style={{ background: 'transparent', color: 'white' }}>Timeline</Link>
              <Link to="/resistance" className="btn" style={{ background: 'transparent', color: 'white' }}>Resistance</Link>
              <Link to="/system" className="btn" style={{ background: 'transparent', color: 'white' }}>System</Link>
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
    if (usingEmulators) getRedirectResult(auth).catch(error => console.error("Login failed:", error));
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
      if (user) ensureDefaultHabits(user.uid).catch(console.error);
    });
    return unsubscribe;
  }, []);

  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;

  return (
    <Router>
      <HabitsProvider user={user}>
      <Header user={user} />
      <Routes>
        <Route path="/" element={user ? <Dashboard user={user} /> : <Home />} />
        <Route path="/habits" element={user ? <Dashboard user={user} /> : <Home />} />
        <Route path="/analysis" element={user ? <Analysis user={user} /> : <Home />} />
        <Route path="/timeline" element={user ? <Timeline user={user} /> : <Home />} />
        <Route path="/resistance" element={user ? <Resistance user={user} /> : <Home />} />
        <Route path="/system" element={user ? <System user={user} /> : <Home />} />
        <Route path="*" element={<Home />} />
      </Routes>
      </HabitsProvider>
    </Router>
  );
}

export default App;
