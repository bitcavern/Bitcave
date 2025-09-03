import React, { useState, useEffect } from 'react';

interface Fact {
  id: number;
  content: string;
  category: string;
  confidence: number;
  created_at: string;
  updated_at: string;
  source_conversation_id?: string;
  project_id?: string;
}

interface MemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MemoryModal: React.FC<MemoryModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [facts, setFacts] = useState<Fact[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'facts' | 'stats' | 'settings'>('facts');
  const [editingFact, setEditingFact] = useState<Fact | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [stats, setStats] = useState<{
    totalFacts: number;
    categoryCounts: { [key: string]: number };
    averageConfidence: number;
    recentFacts: number;
  }>({
    totalFacts: 0,
    categoryCounts: {},
    averageConfidence: 0,
    recentFacts: 0
  });

  useEffect(() => {
    if (isOpen) {
      loadFacts();
      loadStats();
    }
  }, [isOpen]);

  const loadFacts = async () => {
    try {
      setLoading(true);
      const result = await (window as any).electronAPI.invoke('memory:get-facts');
      if (result.success) {
        setFacts(result.data || []);
      }
    } catch (error) {
      console.error('Failed to load facts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const result = await (window as any).electronAPI.invoke('memory:get-stats');
      if (result.success) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Failed to load memory stats:', error);
    }
  };

  const handleDeleteFact = async (factId: number) => {
    try {
      const result = await (window as any).electronAPI.invoke('memory:delete-fact', { factId });
      if (result.success) {
        setFacts(prev => prev.filter(f => f.id !== factId));
        loadStats(); // Refresh stats
      }
    } catch (error) {
      console.error('Failed to delete fact:', error);
    }
  };

  const handleEditFact = async (fact: Fact, newContent: string) => {
    try {
      const result = await (window as any).electronAPI.invoke('memory:update-fact', {
        factId: fact.id,
        content: newContent,
        updated_at: new Date().toISOString()
      });
      if (result.success) {
        setFacts(prev => prev.map(f => f.id === fact.id ? { ...f, content: newContent, updated_at: new Date().toISOString() } : f));
        setEditingFact(null);
      }
    } catch (error) {
      console.error('Failed to update fact:', error);
    }
  };

  const filteredFacts = facts.filter(fact => {
    const matchesSearch = fact.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || fact.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['all', ...Array.from(new Set(facts.map(f => f.category)))];

  if (!isOpen) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        animation: 'modalFadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: '16px',
          width: '800px',
          maxHeight: '80vh',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          animation: 'modalSlideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          color: '#f1f5f9',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '24px', borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>Memory Management</h2>
          <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: '14px' }}>View and manage AI memory about you.</p>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>
          {[
            { id: 'facts', label: 'Facts', icon: '📝' },
            { id: 'stats', label: 'Statistics', icon: '📊' },
            { id: 'settings', label: 'Settings', icon: '⚙️' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: '12px 20px',
                border: 'none',
                backgroundColor: activeTab === tab.id ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                color: activeTab === tab.id ? '#60a5fa' : '#94a3b8',
                borderBottom: activeTab === tab.id ? '2px solid #60a5fa' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'all 0.2s ease'
              }}
            >
              <span style={{ marginRight: '8px' }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ padding: '24px', flex: 1, overflow: 'auto' }}>
          {activeTab === 'facts' && (
            <div>
              {/* Search and Filter */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                <input
                  type="text"
                  placeholder="Search facts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    ...inputStyle,
                    flex: 1
                  }}
                />
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  style={{
                    ...inputStyle,
                    minWidth: '150px'
                  }}
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>
                      {cat === 'all' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  Loading facts...
                </div>
              ) : filteredFacts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  {facts.length === 0 ? 'No facts stored yet. Start chatting with the AI to build memory.' : 'No facts match your search.'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {filteredFacts.map((fact) => (
                    <div
                      key={fact.id}
                      style={{
                        padding: '16px',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(15, 23, 42, 0.5)'
                      }}
                    >
                      {editingFact?.id === fact.id ? (
                        <div>
                          <textarea
                            value={editingFact.content}
                            onChange={(e) => setEditingFact({ ...editingFact, content: e.target.value })}
                            style={{
                              ...inputStyle,
                              width: '100%',
                              height: '80px',
                              resize: 'vertical',
                              marginBottom: '12px'
                            }}
                          />
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => handleEditFact(fact, editingFact.content)}
                              style={buttonStyle.primary}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingFact(null)}
                              style={buttonStyle.secondary}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ marginBottom: '8px' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: '500',
                                backgroundColor: getCategoryColor(fact.category),
                                color: '#1f2937',
                                marginRight: '8px'
                              }}
                            >
                              {fact.category}
                            </span>
                            <span
                              style={{
                                fontSize: '12px',
                                color: '#94a3b8',
                                marginRight: '8px'
                              }}
                            >
                              Confidence: {fact.confidence.toFixed(1)}
                            </span>
                            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                              {new Date(fact.updated_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p style={{ margin: '0 0 12px 0', lineHeight: '1.5' }}>
                            {fact.content}
                          </p>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => setEditingFact(fact)}
                              style={{
                                ...buttonStyle.secondary,
                                fontSize: '12px',
                                padding: '6px 12px'
                              }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteFact(fact.id)}
                              style={{
                                ...buttonStyle.secondary,
                                fontSize: '12px',
                                padding: '6px 12px',
                                borderColor: 'rgba(239, 68, 68, 0.5)',
                                color: '#f87171'
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'stats' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div style={statCardStyle}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#94a3b8' }}>Total Facts</h3>
                  <p style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>{stats.totalFacts}</p>
                </div>
                <div style={statCardStyle}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#94a3b8' }}>Average Confidence</h3>
                  <p style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>{stats.averageConfidence.toFixed(1)}</p>
                </div>
                <div style={statCardStyle}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#94a3b8' }}>Recent Facts</h3>
                  <p style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>{stats.recentFacts}</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>Last 7 days</p>
                </div>
              </div>

              <div>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>Facts by Category</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {Object.entries(stats.categoryCounts).map(([category, count]) => (
                    <div key={category} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ 
                        minWidth: '100px', 
                        fontSize: '14px',
                        color: '#e2e8f0',
                        textTransform: 'capitalize'
                      }}>
                        {category}
                      </span>
                      <div style={{
                        flex: 1,
                        height: '8px',
                        backgroundColor: 'rgba(148, 163, 184, 0.2)',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        <div
                          style={{
                            height: '100%',
                            backgroundColor: getCategoryColor(category),
                            width: `${(count / stats.totalFacts) * 100}%`,
                            transition: 'width 0.3s ease'
                          }}
                        />
                      </div>
                      <span style={{ fontSize: '14px', color: '#94a3b8', minWidth: '30px' }}>
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div>
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600' }}>Memory Settings</h3>
                <p style={{ margin: '0 0 16px 0', color: '#94a3b8', fontSize: '14px' }}>
                  Configure how the AI memory system works.
                </p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#e2e8f0', marginBottom: '8px' }}>
                      Fact Extraction Frequency
                    </label>
                    <select style={inputStyle} defaultValue="3">
                      <option value="2">Every 2 messages</option>
                      <option value="3">Every 3 messages (default)</option>
                      <option value="5">Every 5 messages</option>
                      <option value="disabled">Disabled</option>
                    </select>
                    <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
                      How often the AI extracts facts from conversations.
                    </p>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#e2e8f0', marginBottom: '8px' }}>
                      Context Relevance Threshold
                    </label>
                    <select style={inputStyle} defaultValue="0.7">
                      <option value="0.5">Low (0.5) - More facts included</option>
                      <option value="0.7">Medium (0.7) - Default</option>
                      <option value="0.8">High (0.8) - Only highly relevant facts</option>
                    </select>
                    <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
                      How similar a fact must be to be included in context.
                    </p>
                  </div>

                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input type="checkbox" defaultChecked style={{ transform: 'scale(1.2)' }} />
                      <span style={{ fontSize: '14px', color: '#e2e8f0' }}>Enable memory context in conversations</span>
                    </label>
                    <p style={{ margin: '6px 0 0 24px', fontSize: '12px', color: '#94a3b8' }}>
                      Include relevant facts in AI conversations for personalized responses.
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid rgba(148, 163, 184, 0.2)', paddingTop: '20px' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600' }}>Data Management</h3>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button 
                    style={{
                      ...buttonStyle.secondary,
                      borderColor: 'rgba(239, 68, 68, 0.5)',
                      color: '#f87171'
                    }}
                    onClick={() => {
                      if (confirm('Are you sure you want to clear all memory? This cannot be undone.')) {
                        // TODO: Implement clear all memory
                      }
                    }}
                  >
                    Clear All Memory
                  </button>
                  <button style={buttonStyle.secondary}>
                    Export Memory Data
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(148, 163, 184, 0.2)', background: 'rgba(30, 41, 59, 0.5)', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
          <button onClick={onClose} style={buttonStyle.primary}>Close</button>
        </div>
      </div>
      <style>{`
        @keyframes modalFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalSlideIn { from { opacity: 0; transform: scale(0.95) translateY(-10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
    </div>
  );
};

const getCategoryColor = (category: string): string => {
  const colors: { [key: string]: string } = {
    personal: '#fbbf24',
    preferences: '#8b5cf6',
    professional: '#10b981',
    interests: '#f472b6',
  };
  return colors[category] || '#64748b';
};

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  border: '1px solid rgba(148, 163, 184, 0.3)',
  borderRadius: '8px',
  fontSize: '14px',
  boxSizing: 'border-box',
  backgroundColor: 'rgba(15, 23, 42, 0.5)',
  color: '#f1f5f9',
  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
};

const buttonStyle: { [key: string]: React.CSSProperties } = {
  primary: {
    padding: '10px 20px',
    border: 'none',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
    color: 'white',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'opacity 0.2s ease',
  },
  secondary: {
    padding: '10px 20px',
    border: '1px solid rgba(148, 163, 184, 0.3)',
    borderRadius: '8px',
    backgroundColor: 'transparent',
    color: '#e2e8f0',
    fontSize: '14px',
    cursor: 'pointer',
    fontWeight: '500',
    transition: 'background-color 0.2s ease',
  }
};

const statCardStyle: React.CSSProperties = {
  padding: '16px',
  border: '1px solid rgba(148, 163, 184, 0.2)',
  borderRadius: '8px',
  backgroundColor: 'rgba(15, 23, 42, 0.5)',
};