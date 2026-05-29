import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Analytics from './pages/Analytics.jsx';
import Dashboard from './pages/Dashboard.jsx';
import styles from './App.module.css';

function App() {
  return (
    <BrowserRouter>
      <div className={styles.layout}>
        <header className={styles.header}>
          <span className={styles.logo}>
            <span className={styles.logoAccent}>//</span> linksnip
          </span>
          <nav className={styles.nav}>
            <NavLink to="/" end className={({ isActive }) => isActive ? styles.navLinkActive : styles.navLink}>
              Shorten
            </NavLink>
            <NavLink to="/dashboard" className={({ isActive }) => isActive ? styles.navLinkActive : styles.navLink}>
              Dashboard
            </NavLink>
            <NavLink to="/analytics" className={({ isActive }) => isActive ? styles.navLinkActive : styles.navLink}>
              Analytics
            </NavLink>
          </nav>
        </header>

        <main className={styles.main}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/analytics" element={<Analytics />} />
          </Routes>
        </main>

        <footer className={styles.footer}>
          <span className={styles.footerText}>
            Built with Node.js · Redis · RabbitMQ · MongoDB
          </span>
        </footer>
      </div>
    </BrowserRouter>
  );
}

export default App;
