import { useEffect, useState } from 'react';
import { statsAPI } from '../services/api';
import { useIndexing } from '../context/IndexingContext';
import { ServiceHealthCard } from './ServiceHealthCard';
import { GuideModal } from './GuideModal';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

export function IndexingDashboard() {
  const { state } = useIndexing();
  const { currentBucket } = state;

  const [systemStats, setSystemStats] = useState(null);
  const [spaceStats, setSpaceStats] = useState(null);
  const [serviceHealth, setServiceHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [currentBucket?.name]);

  const loadStats = async () => {
    setLoading(true);
    try {
      // Always load system stats
      const sysRes = await statsAPI.getStats();
      setSystemStats(sysRes.data);

      // Load service health
      try {
        const healthRes = await statsAPI.getServiceHealth();
        setServiceHealth(healthRes.data);
      } catch (err) {
        console.error("Failed to load service health", err);
        setServiceHealth(null);
      }

      // Load space stats if a space is selected
      if (currentBucket) {
        try {
          const spaceRes = await statsAPI.getSpaceStats(currentBucket.name);
          setSpaceStats(spaceRes.data);
        } catch (err) {
          console.error("Failed to load space stats", err);
          setSpaceStats(null);
        }
      } else {
        setSpaceStats(null);
      }
    } catch (err) {
      console.error("Failed to load stats", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !systemStats) {
    return <div style={{ padding: '2rem' }}>Loading Dashboard...</div>;
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#FF6B9D'];

  const spaceGuideContent = {
    title: "Dashboard Guide",
    sections: [
      {
        icon: "📊",
        title: "Key Performance Indicators",
        color: "#3b82f6",
        description: "Monitor your space's core metrics at a glance:",
        items: [
          { label: "Files Uploaded", text: "Total number of files stored in this space" },
          { label: "Files Indexed", text: "Number of files processed and ready for search" },
          { label: "Chat Sessions", text: "Total conversation threads in this space" },
          { label: "Total Messages", text: "Cumulative messages across all chat sessions" }
        ]
      },
      {
        icon: "🏥",
        title: "Service Health",
        color: "#10b981",
        description: "Real-time status of backend services (Milvus, MinIO, Ollama). Green indicates healthy, red indicates issues requiring attention."
      },
      {
        icon: "📈",
        title: "Charts & Analytics",
        color: "#f59e0b",
        description: "Visual insights into your space:",
        items: [
          { label: "File Types Distribution", text: "Pie chart showing breakdown of document types (.pdf, .txt, .md, etc.)" },
          { label: "Activity Summary", text: "Overview of upload progress, indexing completion, and chat engagement" }
        ]
      },
      {
        icon: "💡",
        title: "Quick Tips",
        color: "#8b5cf6",
        items: [
          { label: "Status Updates", text: "Dashboard refreshes when switching spaces" },
          { label: "Indexing Required", text: "Upload files first, then run indexing to enable search" },
          { label: "System View", text: "Deselect space to view system-wide metrics" }
        ]
      }
    ]
  };

  const systemGuideContent = {
    title: "System Dashboard Guide",
    sections: [
      {
        icon: "🌐",
        title: "System Overview",
        color: "#3b82f6",
        description: "High-level view of all spaces in your RAG system:",
        items: [
          { label: "Total Spaces", text: "Number of isolated document workspaces" },
          { label: "Files Indexed", text: "Aggregate count of searchable documents" },
          { label: "Tracked Directories", text: "Total directories being monitored for changes" }
        ]
      },
      {
        icon: "📊",
        title: "Charts",
        color: "#10b981",
        description: "Visual distribution of resources across spaces:",
        items: [
          { label: "Files per Space", text: "Bar chart comparing indexed file counts" },
          { label: "Directory Distribution", text: "Pie chart showing directory allocation" }
        ]
      },
      {
        icon: "🎯",
        title: "How to Use",
        color: "#f59e0b",
        steps: [
          { label: "Select Space", text: "Choose a space from sidebar to view detailed metrics" },
          { label: "Monitor Health", text: "Check service status for operational issues" },
          { label: "Compare Spaces", text: "Use charts to identify imbalanced spaces" }
        ]
      }
    ]
  };

  // Show space-specific dashboard if space is selected
  if (spaceStats) {
    return (
      <div style={{ padding: '1.5rem', height: '100%', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
          <h1 style={{ fontSize: '1.8rem', margin: 0 }}>
            Dashboard
          </h1>
          <GuideModal title={spaceGuideContent.title} sections={spaceGuideContent.sections} />
        </div>
        <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
          Space-specific metrics and analytics
        </p>

        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.2rem', fontWeight: 'bold', color: '#2563eb' }}>{spaceStats.total_files}</div>
            <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>Files Uploaded</div>
          </div>
          <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.2rem', fontWeight: 'bold', color: '#10b981' }}>{spaceStats.indexed_files}</div>
            <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>Files Indexed</div>
          </div>
          <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.2rem', fontWeight: 'bold', color: '#f59e0b' }}>{spaceStats.total_sessions}</div>
            <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>Chat Sessions</div>
          </div>
          <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.2rem', fontWeight: 'bold', color: '#8b5cf6' }}>{spaceStats.total_messages}</div>
            <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>Total Messages</div>
          </div>
        </div>

        {/* Status Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div className="card" style={{ padding: '1rem' }}>
            <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '0.5rem' }}>Indexing Status</div>
            <div style={{ fontSize: '1.2rem', fontWeight: '600', color: spaceStats.indexing_status === 'Indexed' ? '#10b981' : '#6b7280' }}>
              {spaceStats.indexing_status}
            </div>
            {spaceStats.last_indexed && (
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                Last: {new Date(spaceStats.last_indexed).toLocaleString()} UTC
              </div>
            )}
          </div>
          <div className="card" style={{ padding: '1rem' }}>
            <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '0.5rem' }}>Last Chat Activity</div>
            <div style={{ fontSize: '1.2rem', fontWeight: '600' }}>
              {spaceStats.last_chat_activity ? new Date(spaceStats.last_chat_activity).toLocaleDateString() : 'No activity'}
            </div>
            {spaceStats.last_chat_activity && (
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                {new Date(spaceStats.last_chat_activity).toLocaleTimeString()} UTC
              </div>
            )}
          </div>
        </div>

        {/* Service Health Section */}
        {serviceHealth && (
          <ServiceHealthCard
            services={serviceHealth.services}
            overallStatus={serviceHealth.status}
          />
        )}

        {/* Charts */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>

          {/* File Types Distribution */}
          {spaceStats.file_type_distribution && spaceStats.file_type_distribution.length > 0 && (
            <div className="card" style={{ padding: '1.5rem', minHeight: '400px' }}>
              <h3 style={{ marginTop: 0 }}>File Types Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={spaceStats.file_type_distribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ type, percent }) => `${type} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="count"
                    nameKey="type"
                  >
                    {spaceStats.file_type_distribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Activity Summary */}
          <div className="card" style={{ padding: '1.5rem', minHeight: '400px' }}>
            <h3 style={{ marginTop: 0 }}>Activity Summary</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: '#f8fafc', borderRadius: '8px' }}>
                <span style={{ fontWeight: '500' }}>Upload Progress</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2563eb' }}>
                  {spaceStats.total_files} files
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: '#f8fafc', borderRadius: '8px' }}>
                <span style={{ fontWeight: '500' }}>Indexing Progress</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>
                  {spaceStats.indexed_files}/{spaceStats.total_files}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: '#f8fafc', borderRadius: '8px' }}>
                <span style={{ fontWeight: '500' }}>Chat Engagement</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#8b5cf6' }}>
                  {spaceStats.total_messages} msgs
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // System-wide dashboard (no space selected)
  return (
    <div style={{ padding: '1.5rem', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
        <h1 style={{ fontSize: '1.8rem', margin: 0 }}>System Dashboard</h1>
        <GuideModal title={systemGuideContent.title} sections={systemGuideContent.sections} />
      </div>
      <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
        Overview of all spaces • Select a space to view detailed metrics
      </p>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#2563eb' }}>{systemStats.total_spaces}</div>
          <div style={{ color: '#6b7280' }}>Total Spaces</div>
        </div>
        <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#10b981' }}>{systemStats.total_files_indexed}</div>
          <div style={{ color: '#6b7280' }}>Files Indexed</div>
        </div>
        <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#f59e0b' }}>{systemStats.total_directories}</div>
          <div style={{ color: '#6b7280' }}>Tracked Directories</div>
        </div>
      </div>

      {/* Service Health Section */}
      {serviceHealth && (
        <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Service Status
            <span style={{
              fontSize: '0.75rem',
              padding: '0.25rem 0.75rem',
              borderRadius: '1rem',
              background: serviceHealth.status === 'healthy' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
              color: serviceHealth.status === 'healthy' ? '#10b981' : '#f59e0b',
              fontWeight: '600'
            }}>
              {serviceHealth.status === 'healthy' ? 'All Systems Operational' : 'Degraded'}
            </span>
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            {serviceHealth.services.map((service, index) => (
              <div
                key={index}
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  background: service.status === 'healthy' ? 'rgba(16, 185, 129, 0.05)' : service.status === 'unhealthy' ? 'rgba(239, 68, 68, 0.05)' : 'rgba(148, 163, 184, 0.05)',
                  border: `1px solid ${service.status === 'healthy' ? '#10b981' : service.status === 'unhealthy' ? '#ef4444' : '#94a3b8'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: '600' }}>
                  <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: service.status === 'healthy' ? '#10b981' : service.status === 'unhealthy' ? '#ef4444' : '#94a3b8',
                    boxShadow: service.status === 'healthy' ? '0 0 6px #10b981' : 'none'
                  }}></span>
                  {service.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '1rem' }}>
                  {service.message}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>

        {/* Files per Space Chart */}
        <div className="card" style={{ padding: '1.5rem', minHeight: '400px' }}>
          <h3 style={{ marginTop: 0 }}>Files per Space</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={systemStats.space_stats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="files" fill="#8884d8" name="Indexed Files" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Directory Distribution Chart */}
        <div className="card" style={{ padding: '1.5rem', minHeight: '400px' }}>
          <h3 style={{ marginTop: 0 }}>Directory Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={systemStats.space_stats}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="directories"
                nameKey="name"
              >
                {systemStats.space_stats.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  );
}