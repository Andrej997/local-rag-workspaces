import { useState } from 'react';
import { useIndexing } from '../context/IndexingContext';
import { scrapingAPI } from '../services/api';

export function WebScrapingPage() {
  const { state } = useIndexing();
  const { currentBucket } = state;

  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [pageUrl, setPageUrl] = useState(null);
  const [error, setError] = useState(null);
  const [iframeError, setIframeError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  if (!currentBucket) {
    return (
      <div className="card" style={{ padding: '2rem' }}>
        No space selected. Please create or select a space to save scraped content.
      </div>
    );
  }

  const validateUrl = (urlString) => {
    if (!urlString.trim()) {
      return 'URL cannot be empty';
    }
    if (!urlString.match(/^https?:\/\//i)) {
      return 'URL must start with http:// or https://';
    }
    return null;
  };

  const handleLoadPage = () => {
    const validationError = validateUrl(url);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIframeError(null);
    setPageUrl(url);
    setSuccessMessage(null);

    // Set a timeout to check if iframe loaded successfully
    setTimeout(() => {
      if (!iframeError) {
        setIframeError(
          'If the page is not visible above, it may block iframe embedding. You can still scrape it to PDF!'
        );
      }
    }, 3000);
  };

  const handleScrapeToPdf = async () => {
    const validationError = validateUrl(url);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await scrapingAPI.scrape(url, currentBucket.name);

      setSuccessMessage(response.data.message);

      // Redirect to space page after 3 seconds
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('navigate-to-space'));
      }, 3000);
    } catch (err) {
      console.error('Scraping error:', err);
      const errorMsg = err.response?.data?.detail || err.message || 'Failed to start scraping';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleScrapeAnother = () => {
    setUrl('');
    setPageUrl(null);
    setError(null);
    setIframeError(null);
    setSuccessMessage(null);
  };

  return (
    <div className="space-page" style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header Section */}
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          Web Page Scraper
        </h1>
        <div style={{ color: '#94a3b8' }}>
          Capture web pages as PDFs for indexing in <strong>{currentBucket.name}</strong>
        </div>
      </div>

      {/* URL Input Section */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '1rem' }}>
          Enter Website URL
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleLoadPage()}
            placeholder="https://example.com"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '1rem'
            }}
          />

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              onClick={handleLoadPage}
              disabled={loading || !url.trim()}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: 'var(--accent)',
                color: 'white',
                cursor: loading || !url.trim() ? 'not-allowed' : 'pointer',
                fontWeight: '500',
                opacity: loading || !url.trim() ? 0.5 : 1
              }}
            >
              Load Page
            </button>

            <button
              onClick={handleScrapeToPdf}
              disabled={loading || !url.trim()}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--accent)',
                background: 'transparent',
                color: 'var(--accent)',
                cursor: loading || !url.trim() ? 'not-allowed' : 'pointer',
                fontWeight: '500',
                opacity: loading || !url.trim() ? 0.5 : 1
              }}
            >
              {loading ? 'Starting...' : 'Scrape to PDF'}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            marginTop: '1rem',
            padding: '1rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid var(--danger)',
            borderRadius: '0.5rem',
            color: 'var(--danger)'
          }}>
            {error}
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div style={{
            marginTop: '1rem',
            padding: '1rem',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid #10b981',
            borderRadius: '0.5rem',
            color: '#10b981'
          }}>
            <div style={{ marginBottom: '0.5rem', fontWeight: '600' }}>
              Scraping started successfully!
            </div>
            <div style={{ fontSize: '0.9rem' }}>
              {successMessage}
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', fontStyle: 'italic' }}>
              Redirecting to Space page...
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {loading && (
          <div style={{
            marginTop: '1rem',
            padding: '1rem',
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid var(--accent)',
            borderRadius: '0.5rem',
            color: 'var(--accent)',
            textAlign: 'center'
          }}>
            Starting background scraping...
          </div>
        )}
      </div>

      {/* Page Preview Section */}
      {pageUrl && !successMessage && (
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '1rem' }}>
            Page Preview
          </h2>

          {iframeError && (
            <div style={{
              marginBottom: '1rem',
              padding: '1rem',
              background: 'rgba(251, 191, 36, 0.1)',
              border: '1px solid #fbbf24',
              borderRadius: '0.5rem',
              color: '#fbbf24'
            }}>
              {iframeError}
            </div>
          )}

          <iframe
            src={pageUrl}
            title="Page Preview"
            onLoad={(e) => {
              // Check if iframe loaded successfully
              try {
                const iframe = e.target;
                const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

                // If we can't access the document, it's likely blocked
                if (!iframeDoc || iframeDoc.location.href === 'about:blank') {
                  setIframeError(
                    'Cannot preview this page (blocked by site policy). You can still scrape it to PDF.'
                  );
                } else {
                  // Successfully loaded - clear any timeout error
                  setIframeError(null);
                }
              } catch (err) {
                // Cross-origin error - page loaded but we can't access it
                setIframeError(
                  'Cannot preview this page (blocked by site policy). You can still scrape it to PDF.'
                );
              }
            }}
            onError={() => {
              setIframeError(
                'Cannot load this page. The website may be unreachable or blocks iframe embedding. You can still try to scrape it to PDF.'
              );
            }}
            style={{
              width: '100%',
              height: '600px',
              border: '1px solid var(--border)',
              borderRadius: '0.5rem',
              background: 'white'
            }}
          />
        </div>
      )}
    </div>
  );
}
