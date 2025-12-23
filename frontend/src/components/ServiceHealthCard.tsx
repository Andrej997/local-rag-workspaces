import { ServiceHealthCardProps, ServiceHealth } from '../types';

/**
 * Reusable Service Health Card Component
 * Displays service health status with visual indicators
 */
export function ServiceHealthCard({ services, overallStatus = 'healthy' }: ServiceHealthCardProps) {
  if (!services || services.length === 0) return null;

  const getStatusColor = (status: ServiceHealth['status']): string => {
    switch (status) {
      case 'healthy': return '#10b981';
      case 'unhealthy': return '#ef4444';
      default: return '#94a3b8';
    }
  };

  const getStatusBackground = (status: ServiceHealth['status']): string => {
    switch (status) {
      case 'healthy': return 'rgba(16, 185, 129, 0.05)';
      case 'unhealthy': return 'rgba(239, 68, 68, 0.05)';
      default: return 'rgba(148, 163, 184, 0.05)';
    }
  };

  return (
    <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
      <h3 style={{
        marginTop: 0,
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        Service Status
        <span style={{
          fontSize: '0.75rem',
          padding: '0.25rem 0.75rem',
          borderRadius: '1rem',
          background: overallStatus === 'healthy' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
          color: overallStatus === 'healthy' ? '#10b981' : '#f59e0b',
          fontWeight: '600'
        }}>
          {overallStatus === 'healthy' ? 'All Systems Operational' : 'Degraded'}
        </span>
      </h3>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '0.75rem'
      }}>
        {services.map((service, index) => (
          <div
            key={service.name || index}
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              background: getStatusBackground(service.status),
              border: `1px solid ${getStatusColor(service.status)}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem'
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.9rem',
              fontWeight: '600'
            }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: getStatusColor(service.status),
                boxShadow: service.status === 'healthy' ? `0 0 6px ${getStatusColor(service.status)}` : 'none'
              }}></span>
              {service.name}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '1rem' }}>
              {service.message || 'No details available'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
