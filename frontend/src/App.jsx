import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { IndexingProvider } from './context/IndexingContext';
import { NotificationProvider } from './context/NotificationContext';
import ErrorBoundary from './components/ErrorBoundary';
import { NotificationContainer } from './components/NotificationContainer';
import { IndexingDashboard } from './components/IndexingDashboard';
import { SpacePage } from './components/SpacePage';
import { ProjectChat } from './components/ProjectChat';
import { BucketManager } from './components/BucketManager';
import { SettingsPage } from './components/SettingsPage';
import { IndexVisualization } from './components/IndexVisualization';
import { MetadataPage } from './components/MetadataPage';
import { WebScrapingPage } from './components/WebScrapingPage';
import logo from './assets/favico.svg';
import './App.css';

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => setSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setSidebarOpen(false);

  const handleNavClick = (path) => {
    navigate(path);
    closeSidebar();
  };

  // Listen for navigation events
  useEffect(() => {
    const handleNavigateToSpace = () => {
      navigate('/space');
    };

    const handleNavigateToScraping = () => {
      navigate('/scraping');
    };

    window.addEventListener('navigate-to-space', handleNavigateToSpace);
    window.addEventListener('navigate-to-scraping', handleNavigateToScraping);

    return () => {
      window.removeEventListener('navigate-to-space', handleNavigateToSpace);
      window.removeEventListener('navigate-to-scraping', handleNavigateToScraping);
    };
  }, [navigate]);

  return (
    <ErrorBoundary>
      <NotificationProvider>
        <IndexingProvider>
          <NotificationContainer />
          <div className="app-layout">
        {/* Mobile Header for Navigation */}
        <header className="mobile-header">
          <div className="logo-area">
            <img src={logo} alt="Logo" className="logo-icon" /> Local RAG
          </div>
          <button className="menu-toggle" onClick={toggleSidebar} aria-label="Toggle menu">
            {isSidebarOpen ? '✕' : '☰'}
          </button>
        </header>

        {/* Backdrop for mobile sidebar */}
        {isSidebarOpen && <div className="sidebar-overlay" onClick={closeSidebar}></div>}

        {/* Sidebar Navigation */}
        <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-header">
            <h2><img src={logo} alt="Logo" className="logo-icon" /> Local RAG</h2>
          </div>
          
          <div className="sidebar-content">
            <BucketManager />

            <nav className="sidebar-nav">
              <button
                className={`nav-item ${location.pathname === '/' || location.pathname === '/dashboard' ? 'active' : ''}`}
                onClick={() => handleNavClick('/dashboard')}
              >
                <span>📊</span> Dashboard
              </button>
              <button
                className={`nav-item ${location.pathname === '/space' ? 'active' : ''}`}
                onClick={() => handleNavClick('/space')}
              >
                <span>🚀</span> Space
              </button>
              <button
                className={`nav-item ${location.pathname === '/scraping' ? 'active' : ''}`}
                onClick={() => handleNavClick('/scraping')}
              >
                <span>🌐</span> Web Scraper
              </button>
              <button
                className={`nav-item ${location.pathname === '/visualization' ? 'active' : ''}`}
                onClick={() => handleNavClick('/visualization')}
              >
                <span>🔭</span> Visualize
              </button>
              <button
                className={`nav-item ${location.pathname === '/chat' ? 'active' : ''}`}
                onClick={() => handleNavClick('/chat')}
              >
                <span>💬</span> Chat
              </button>
              <button
                className={`nav-item ${location.pathname === '/metadata' ? 'active' : ''}`}
                onClick={() => handleNavClick('/metadata')}
              >
                <span>🗂️</span> Metadata
              </button>
              <button
                className={`nav-item ${location.pathname === '/settings' ? 'active' : ''}`}
                onClick={() => handleNavClick('/settings')}
              >
                <span>⚙️</span> Settings
              </button>
            </nav>
          </div>

          <div className="sidebar-footer">
            <span>Developed by Andrej Kalocanj Mohaci</span>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="main-content">
          <div className="content-wrapper">
            <Routes>
              <Route path="/" element={<IndexingDashboard />} />
              <Route path="/dashboard" element={<IndexingDashboard />} />
              <Route path="/space" element={<SpacePage />} />
              <Route path="/scraping" element={<WebScrapingPage />} />
              <Route path="/visualization" element={<IndexVisualization />} />
              <Route path="/chat" element={<ProjectChat />} />
              <Route path="/metadata" element={<MetadataPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </div>
        </main>
          </div>
        </IndexingProvider>
      </NotificationProvider>
    </ErrorBoundary>
  );
}

export default App;