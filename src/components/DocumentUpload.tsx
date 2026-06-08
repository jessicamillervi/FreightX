'use client';

import React, { useState, useRef } from 'react';
import { Upload, File, Image, X, CheckCircle, AlertCircle, Eye, ShieldAlert } from 'lucide-react';
import { uploadToIPFS } from '@/lib/ipfs';
import { useAppContext } from '@/contexts/AppContext';

interface DocumentUploadProps {
  onUploadSuccess: (cid: string, fileName: string, fileType: string) => void;
  allowedTypes?: string[];
  maxSizeMB?: number;
}

export default function DocumentUpload({
  onUploadSuccess,
  allowedTypes = ['application/pdf', 'image/png', 'image/jpeg'],
  maxSizeMB = 10
}: DocumentUploadProps) {
  const { showToast, logTerminal } = useAppContext();
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedCid, setUploadedCid] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const validateFile = (selectedFile: File): boolean => {
    if (!allowedTypes.includes(selectedFile.type)) {
      showToast('Invalid file type. Only PDF and images are allowed.', 'error');
      return false;
    }
    if (selectedFile.size > maxSizeMB * 1024 * 1024) {
      showToast(`File is too large. Max size is ${maxSizeMB}MB.`, 'error');
      return false;
    }
    return true;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selectedFile = e.dataTransfer.files[0];
      if (validateFile(selectedFile)) {
        setFile(selectedFile);
        setupPreview(selectedFile);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (validateFile(selectedFile)) {
        setFile(selectedFile);
        setupPreview(selectedFile);
      }
    }
  };

  const setupPreview = (selectedFile: File) => {
    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(selectedFile);
    } else {
      setPreviewUrl(null); // No image preview for PDFs
    }
  };

  const removeFile = () => {
    setFile(null);
    setPreviewUrl(null);
    setUploadedCid('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    logTerminal(`Uploading document "${file.name}" to IPFS...`);
    
    try {
      const result = await uploadToIPFS(file, file.name);
      if (result.success && result.cid) {
        setUploadedCid(result.cid);
        logTerminal(`[IPFS Upload Success] CID: ${result.cid}`);
        showToast('Document uploaded to IPFS successfully!', 'success');
        onUploadSuccess(result.cid, file.name, file.type);
      } else {
        throw new Error(result.error || 'Failed to pin file');
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logTerminal(`[IPFS Upload Error] ${errMsg}`);
      showToast(`Upload failed: ${errMsg}`, 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {!file ? (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragActive ? 'var(--primary)' : 'var(--border-color)'}`,
            borderRadius: '12px',
            padding: '2rem',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragActive ? 'rgba(84, 110, 238, 0.05)' : 'rgba(0, 0, 0, 0.1)',
            transition: 'all 0.2s ease',
            position: 'relative',
          }}
          className="flex-center"
        >
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            accept={allowedTypes.join(',')}
            style={{ display: 'none' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '50%',
              background: 'rgba(84, 110, 238, 0.1)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: 'var(--primary)'
            }}>
              <Upload size={24} />
            </div>
            <div>
              <span style={{ fontWeight: 600, display: 'block', color: 'var(--text-main)' }}>
                Drag and drop your trade document here
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                or click to browse from files (PDF, PNG, JPG up to {maxSizeMB}MB)
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* FILE PREVIEW & UPLOAD TRIGGER */
        <div className="glass-panel" style={{ padding: '1.25rem', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.05)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', color: 'var(--primary)'
              }}>
                {file.type.startsWith('image/') ? <Image size={20} /> : <File size={20} />}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <span style={{ fontWeight: 600, display: 'block', fontSize: '0.85rem', color: 'var(--text-main)', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file.name}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  {(file.size / (1024 * 1024)).toFixed(2)} MB • {file.type.split('/')[1].toUpperCase()}
                </span>
              </div>
            </div>
            <button
              onClick={removeFile}
              className="flex-center"
              style={{
                background: 'rgba(239, 83, 80, 0.1)', border: 'none',
                width: '28px', height: '28px', borderRadius: '50%',
                color: '#ef5350', cursor: 'pointer', transition: 'all 0.2s'
              }}
              disabled={uploading}
            >
              <X size={14} />
            </button>
          </div>

          {previewUrl && (
            <div style={{
              borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)',
              marginBottom: '1rem', background: '#000', maxHeight: '180px', display: 'flex',
              justifyContent: 'center', alignItems: 'center'
            }}>
              <img src={previewUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '180px', objectFit: 'contain' }} />
            </div>
          )}

          {!previewUrl && file.type === 'application/pdf' && (
            <div style={{
              padding: '1.5rem', background: 'rgba(0,0,0,0.2)', border: '1px dashed var(--border-color)',
              borderRadius: '8px', textAlign: 'center', marginBottom: '1rem', color: 'var(--text-secondary)'
            }}>
              <File size={32} style={{ color: 'var(--primary)', marginBottom: '0.5rem' }} />
              <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>PDF Document Preview Not Supported in Sandbox</div>
              <span style={{ fontSize: '0.65rem' }}>Will be encoded directly to IPFS raw data block</span>
            </div>
          )}

          {uploadedCid ? (
            <div style={{
              display: 'flex', flexDirection: 'column', gap: '0.75rem',
              padding: '0.75rem', background: 'rgba(74, 201, 153, 0.1)',
              border: '1px solid rgba(74, 201, 153, 0.3)', borderRadius: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>
                <CheckCircle size={14} />
                <span>Uploaded & Pinned to IPFS!</span>
              </div>
              <div style={{ fontSize: '0.7rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>IPFS Content Identifier (CID):</span>
                <code style={{ background: 'rgba(0,0,0,0.2)', padding: '0.25rem 0.5rem', borderRadius: '4px', wordBreak: 'break-all', color: 'var(--text-main)' }}>
                  {uploadedCid}
                </code>
              </div>
            </div>
          ) : (
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="btn btn-primary"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              {uploading ? (
                <>Uploading to IPFS...</>
              ) : (
                <>
                  <Upload size={16} /> Pin Trade Document to IPFS
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
