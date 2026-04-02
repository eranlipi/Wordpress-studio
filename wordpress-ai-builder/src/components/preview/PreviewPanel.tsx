import React, { useState } from 'react';
import { DeviceFrame, DeviceType } from './DeviceFrame';
import { PreviewToolbar } from './PreviewToolbar';
import { usePreview } from '../../hooks/usePreview';
import { useAppStore } from '../../store/appStore';

export function PreviewPanel() {
  const [device, setDevice] = useState<DeviceType>('desktop');
  const { previewUrl, iframeRef, refresh } = usePreview();
  const { isStreaming, streamStatus } = useAppStore();

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <PreviewToolbar
        device={device}
        onDeviceChange={setDevice}
        onRefresh={() => refresh()}
        previewUrl={previewUrl}
      />

      <div className="flex-1 relative overflow-hidden">
        {/* Streaming overlay */}
        {isStreaming && (
          <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-sm flex items-center justify-center">
            <div className="text-center">
              <div className="relative w-16 h-16 mx-auto mb-4">
                <div className="absolute inset-0 rounded-full border-4 border-violet-100" />
                <div className="absolute inset-0 rounded-full border-4 border-t-violet-600 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center text-xl">✨</div>
              </div>
              <div className="text-sm font-medium text-gray-700">{streamStatus || 'Generating...'}</div>
              <div className="text-xs text-gray-400 mt-1">Your page is being built</div>
            </div>
          </div>
        )}

        {previewUrl ? (
          <DeviceFrame device={device}>
            <iframe
              ref={iframeRef}
              src={previewUrl}
              title="Page Preview"
              className="w-full h-full border-none"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            />
          </DeviceFrame>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center px-6">
              <div className="w-24 h-24 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
                <svg className="w-10 h-10 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18M9 21V9" />
                </svg>
              </div>
              <h3 className="text-gray-500 font-medium text-sm">Preview will appear here</h3>
              <p className="text-gray-400 text-xs mt-1">
                Start chatting to generate your first page
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
