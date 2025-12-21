/**
 * Directory selection component.
 */
import { useState } from 'react';
import { useConfig } from '../hooks/useConfig';

export function DirectorySelector() {
  const { directory, loading, saveConfig } = useConfig();
  const [localPath, setLocalPath] = useState('');
  const [saveMessage, setSaveMessage] = useState(null);

  const handleSave = async () => {
    const pathToSave = localPath || directory;

    if (!pathToSave || !pathToSave.trim()) {
      setSaveMessage({ type: 'error', text: 'Please enter a directory path' });
      return;
    }

    const result = await saveConfig(pathToSave);

    if (result.success) {
      setSaveMessage({ type: 'success', text: 'Directory saved successfully!' });
      setLocalPath('');

      // Clear success message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000);
    } else {
      setSaveMessage({ type: 'error', text: result.error });
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    }
  };

  return (
    <div className="directory-selector">
      <h2>Project Directory</h2>

      <div className="input-group">
        <input
          type="text"
          value={localPath !== '' ? localPath : directory}
          onChange={(e) => setLocalPath(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Enter project directory path"
          disabled={loading}
          className="directory-input"
        />

        <button
          onClick={handleSave}
          disabled={loading}
          className="btn btn-primary"
        >
          {loading ? 'Saving...' : 'Save Directory'}
        </button>
      </div>

      {saveMessage && (
        <div className={`message ${saveMessage.type}`}>
          {saveMessage.text}
        </div>
      )}

      {directory && !saveMessage && (
        <div className="current-directory">
          <small>Current: {directory}</small>
        </div>
      )}
    </div>
  );
}
