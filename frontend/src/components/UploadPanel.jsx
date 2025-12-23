import { useState } from 'react';
import { uploadAPI } from '../services/api';
import { useNotification } from '../context/NotificationContext';

/**
 * UploadPanel Component
 * Handles file and folder uploads to MinIO
 */
export function UploadPanel({ bucketName, onUploadComplete }) {
  const [isUploading, setIsUploading] = useState(false);
  const { notify } = useNotification();

  const handleUpload = async (files) => {
    if (!files || files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    setIsUploading(true);
    try {
      const res = await uploadAPI.upload(bucketName, formData);
      notify.success(res.data.message || 'Upload successful');
      if (onUploadComplete) {
        await onUploadComplete();
      }
    } catch (err) {
      notify.error("Upload failed: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
      <h4 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: '600' }}>☁️ Upload to MinIO</h4>

      <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
        {/* Directory Upload */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>
            Upload Folder
          </label>
          <input
            type="file"
            webkitdirectory=""
            directory=""
            multiple
            onChange={(e) => {
              handleUpload(e.target.files);
              e.target.value = null; // Reset input
            }}
            disabled={isUploading}
            style={{ width: '100%' }}
          />
        </div>

        {/* Files Upload */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>
            Upload Files
          </label>
          <input
            type="file"
            multiple
            onChange={(e) => {
              handleUpload(e.target.files);
              e.target.value = null; // Reset input
            }}
            disabled={isUploading}
            style={{ width: '100%' }}
          />
        </div>

        {isUploading && (
          <p style={{ color: 'var(--accent)', fontSize: '0.9rem' }}>
            Uploading... please wait.
          </p>
        )}
      </div>
    </div>
  );
}
