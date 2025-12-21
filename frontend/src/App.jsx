import { useState } from 'react';
import { IndexingProvider } from './context/IndexingContext';
import { IndexingDashboard } from './components/IndexingDashboard';
import { SpacePage } from './components/SpacePage';
import { ProjectChat } from './components/ProjectChat';
import { BucketManager } from './components/BucketManager';
import { SettingsPage } from './components/SettingsPage';
import { IndexVisualization } from './components/IndexVisualization';
import logo from './assets/favico.svg';
import './App.css';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => setSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setSidebarOpen(false);

  const handleNavClick = (page) => {
    setCurrentPage(page);
    closeSidebar();
  };

  return (
    <IndexingProvider>
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
                className={`nav-item ${currentPage === 'dashboard' ? 'active' : ''}`}
                onClick={() => handleNavClick('dashboard')}
              >
                <span>📊</span> Dashboard
              </button>
              <button 
                className={`nav-item ${currentPage === 'space' ? 'active' : ''}`}
                onClick={() => handleNavClick('space')}
              >
                <span>🚀</span> Space
              </button>
              <button 
                className={`nav-item ${currentPage === 'visualization' ? 'active' : ''}`}
                onClick={() => handleNavClick('visualization')}
              >
                <span>🔭</span> Visualize
              </button>
              <button 
                className={`nav-item ${currentPage === 'search' ? 'active' : ''}`}
                onClick={() => handleNavClick('search')}
              >
                <span>💬</span> Chat
              </button>
              <button 
                className={`nav-item ${currentPage === 'settings' ? 'active' : ''}`}
                onClick={() => handleNavClick('settings')}
              >
                <span>⚙️</span> Settings
              </button>
            </nav>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="main-content">
          <div className="content-wrapper">
            {currentPage === 'dashboard' && <IndexingDashboard />}
            {currentPage === 'space' && <SpacePage />}
            {currentPage === 'visualization' && <IndexVisualization />}
            {currentPage === 'search' && <ProjectChat />}
            {currentPage === 'settings' && <SettingsPage />}
          </div>
        </main>
      </div>
    </IndexingProvider>
  );
}

export default App;