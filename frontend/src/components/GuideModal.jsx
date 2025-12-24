import { useState } from 'react';

export function GuideModal({ title, sections }) {
  const [showGuide, setShowGuide] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowGuide(true)}
        style={{
          padding: '0.5rem 1rem',
          background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
          color: 'white',
          border: 'none',
          borderRadius: '0.5rem',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '0.95rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}
      >
        📚 Guide
      </button>

      {showGuide && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem'
          }}
          onClick={() => setShowGuide(false)}
        >
          <div
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '1rem',
              maxWidth: '800px',
              maxHeight: '80vh',
              overflow: 'auto',
              padding: '2rem',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowGuide(false)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: '#334155',
                border: 'none',
                color: '#f8fafc',
                fontSize: '1.5rem',
                cursor: 'pointer',
                borderRadius: '0.5rem',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ×
            </button>

            <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#f8fafc' }}>
              {title}
            </h2>

            <div style={{ color: '#cbd5e1', lineHeight: '1.8' }}>
              {sections.map((section, idx) => (
                <section key={idx} style={{ marginBottom: '2rem' }}>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: 600, color: section.color, marginBottom: '0.75rem' }}>
                    {section.icon} {section.title}
                  </h3>
                  <p style={{ marginBottom: '0.75rem' }}>
                    {section.description}
                  </p>
                  {section.items && (
                    <ul style={{ marginLeft: '1.5rem', marginBottom: '0.75rem' }}>
                      {section.items.map((item, itemIdx) => (
                        <li key={itemIdx} style={{ marginBottom: '0.5rem' }}>
                          <strong>{item.label}:</strong> {item.text}
                        </li>
                      ))}
                    </ul>
                  )}
                  {section.steps && (
                    <ol style={{ marginLeft: '1.5rem' }}>
                      {section.steps.map((step, stepIdx) => (
                        <li key={stepIdx} style={{ marginBottom: '0.5rem' }}>
                          <strong>{step.label}:</strong> {step.text}
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
