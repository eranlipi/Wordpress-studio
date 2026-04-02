import React from 'react';
import type { DeviceType } from './DeviceFrame';
import { publishPage } from '../../api/client';
import { useAppStore } from '../../store/appStore';
import { useState } from 'react';

interface PreviewToolbarProps {
  device: DeviceType;
  onDeviceChange: (d: DeviceType) => void;
  onRefresh: () => void;
  previewUrl: string | null;
}

const DEVICES: { type: DeviceType; icon: React.ReactNode; label: string }[] = [
  {
    type: 'desktop',
    label: 'Desktop',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    ),
  },
  {
    type: 'tablet',
    label: 'Tablet',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <circle cx="12" cy="18" r="1" />
      </svg>
    ),
  },
  {
    type: 'mobile',
    label: 'Mobile',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="5" y="2" width="14" height="20" rx="2" />
        <circle cx="12" cy="18" r="1" />
      </svg>
    ),
  },
];

export function PreviewToolbar({ device, onDeviceChange, onRefresh, previewUrl }: PreviewToolbarProps) {
  const { currentPageId, upsertPage, pages } = useAppStore();
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);

  const currentPage = pages.find((p) => p.post_id === currentPageId);
  const isPublished = currentPage?.status === 'publish' || published;

  const handlePublish = async () => {
    if (!currentPageId || publishing) return;
    setPublishing(true);
    try {
      const result = await publishPage(currentPageId);
      setPublished(true);
      if (currentPage) {
        upsertPage({ ...currentPage, status: 'publish', permalink: result.permalink });
      }
      // Open the published page in a new tab
      window.open(result.permalink, '_blank');
    } catch (err) {
      console.error('Publish failed:', err);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-white gap-2">
      {/* Device switcher */}
      <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
        {DEVICES.map(({ type, icon, label }) => (
          <button
            key={type}
            title={label}
            onClick={() => onDeviceChange(type)}
            className={`p-1.5 rounded-md transition-colors ${
              device === type
                ? 'bg-white text-violet-600 shadow-sm'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {icon}
          </button>
        ))}
      </div>

      {/* URL bar */}
      <div className="flex-1 min-w-0">
        {previewUrl ? (
          <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2 py-1 border border-gray-200">
            <svg className="w-3 h-3 text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
            </svg>
            <span className="text-xs text-gray-500 truncate">{previewUrl.replace(/^https?:\/\//, '')}</span>
          </div>
        ) : (
          <div className="text-xs text-gray-400 text-center">No page yet — start chatting</div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        <button
          title="Refresh preview"
          onClick={onRefresh}
          disabled={!previewUrl}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 009-9 9.75 9.75 0 016.74 2.74L21 8" />
            <path d="M21 3v5h-5M21 12a9 9 0 01-9 9 9.75 9.75 0 01-6.74-2.74L3 16" />
            <path d="M8 16H3v5" />
          </svg>
        </button>

        {previewUrl && (
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in new tab"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        )}

        <button
          onClick={handlePublish}
          disabled={!currentPageId || publishing || isPublished}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
            isPublished
              ? 'bg-green-50 text-green-600 border border-green-200'
              : 'bg-violet-600 hover:bg-violet-700 text-white disabled:bg-gray-200 disabled:text-gray-400'
          }`}
        >
          {publishing ? (
            <>
              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Publishing...
            </>
          ) : isPublished ? (
            <>✅ Published</>
          ) : (
            <>🚀 Publish</>
          )}
        </button>
      </div>
    </div>
  );
}
