import React, { useState, useEffect } from 'react';
import type { UserSettings } from '@/shared/types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [settings, setSettings] = useState<Partial<UserSettings>>({});
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      const result = await (window as any).electronAPI.invoke('user:get-settings');
      if (result.success) {
        setSettings(result.data);
      }
      
      // Check AI configuration status
      const aiResult = await (window as any).electronAPI.invoke('ai:is-configured');
      if (aiResult.success && aiResult.data) {
        setApiKey('••••••••'); // Show masked key if configured
      } else {
        setApiKey('');
      }
    } catch (error) {
      console.error('Failed to load user settings:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await (window as any).electronAPI.invoke('user:save-settings', settings);
      
      // Save API key if it's not the masked placeholder and not empty
      if (apiKey && apiKey !== '••••••••') {
        const result = await (window as any).electronAPI.invoke('ai:set-api-key', {
          apiKey: apiKey.trim(),
        });
        if (!result.success) {
          console.error('Failed to set API key:', result.error);
        }
      }
      
      onClose();
    } catch (error) {
      console.error('Failed to save user settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: name === 'interests' ? value.split(',').map(s => s.trim()) : value }));
  };

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
          width: '500px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          animation: 'modalSlideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          color: '#f1f5f9'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '24px', borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>User Settings</h2>
          <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: '14px' }}>Manage your global preferences.</p>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#e2e8f0', marginBottom: '8px' }}>Name</label>
            <input
              type="text"
              name="name"
              value={settings.name || ''}
              onChange={handleInputChange}
              placeholder="How should the AI address you?"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#e2e8f0', marginBottom: '8px' }}>Interests</label>
            <textarea
              name="interests"
              value={(settings.interests || []).join(', ')}
              onChange={handleInputChange}
              placeholder="e.g., programming, sci-fi, hiking"
              rows={3}
              style={{...inputStyle, resize: 'vertical', height: 'auto'}}
            />
             <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>Comma-separated list of your interests.</p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#e2e8f0', marginBottom: '8px' }}>AI Personality</label>
            <select name="aiPersonality" value={settings.aiPersonality || 'explanatory'} onChange={handleInputChange} style={inputStyle}>
              <option value="efficient">Efficient</option>
              <option value="explanatory">Explanatory</option>
              <option value="funny">Funny</option>
              <option value="robotic">Robotic</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#e2e8f0', marginBottom: '8px' }}>OpenRouter API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-or-v1-..."
              style={inputStyle}
            />
            <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
              Get your API key from{' '}
              <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>
                openrouter.ai
              </a>
            </p>
          </div>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid rgba(148, 163, 184, 0.2)', background: 'rgba(30, 41, 59, 0.5)', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
          <button onClick={onClose} style={buttonStyle.secondary}>Cancel</button>
          <button onClick={handleSave} disabled={loading} style={buttonStyle.primary}>
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes modalFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalSlideIn { from { opacity: 0; transform: scale(0.95) translateY(-10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  width: '100%',
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
