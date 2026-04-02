import React, { useEffect, useState } from 'react';
import { ChatPanel } from '../chat/ChatPanel';
import { PreviewPanel } from '../preview/PreviewPanel';
import { SettingsModal } from '../settings/SettingsModal';
import { useAppStore } from '../../store/appStore';
import { listPages, createPage, getPreviewUrl } from '../../api/client';
import type { WPPage } from '../../types';

function PagesSidebar() {
  const {
    pages, setPages, currentPageId,
    setCurrentPage, setCurrentHtml, addMessage, upsertPage,
    settings, setSettingsOpen,
  } = useAppStore();

  const [creating, setCreating] = useState(false);

  const loadPages = async () => {
    try {
      const data = await listPages();
      setPages(data);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    loadPages();
  }, []);

  const handleNewPage = async () => {
    setCreating(true);
    try {
      const result = await createPage('New AI Page');
      const newPage: WPPage = {
        post_id: result.post_id,
        title: 'New AI Page',
        status: 'draft',
        modified: new Date().toISOString(),
        preview_url: result.preview_url,
        permalink: '',
      };
      upsertPage(newPage);
      setCurrentPage(result.post_id, result.preview_url);
      addMessage('system', `New page created (ID: ${result.post_id}). Start building!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create page';
      addMessage('system', `Error: ${msg}`);
    } finally {
      setCreating(false);
    }
  };

  const handleSelectPage = (page: WPPage) => {
    // Clear currentHtml when switching pages so AI starts fresh with that page's context
    setCurrentHtml('');
    setCurrentPage(page.post_id, page.preview_url, '');
    addMessage('system', `Switched to: ${page.title}`);
  };

  const hasApiKey = settings?.has_claude_key || settings?.has_gemini_key;

  return (
    <div className="w-52 flex-shrink-0 flex flex-col bg-gray-950 text-white h-full">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-500 flex items-center justify-center text-white text-xs font-bold">
            WA
          </div>
          <div>
            <div className="text-sm font-semibold text-white">AI Builder</div>
            <div className="text-xs text-gray-500">WordPress</div>
          </div>
        </div>
      </div>

      {/* API key warning */}
      {!hasApiKey && (
        <button
          onClick={() => setSettingsOpen(true)}
          className="mx-3 mt-3 text-xs bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg px-3 py-2 text-left hover:bg-amber-500/20 transition-colors"
        >
          ⚠️ Add API key to start
        </button>
      )}

      {/* New page */}
      <div className="px-3 py-3">
        <button
          onClick={handleNewPage}
          disabled={creating}
          className="w-full flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
        >
          {creating ? (
            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
          )}
          New Page
        </button>
      </div>

      {/* Pages list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {pages.length > 0 ? (
          <div className="space-y-0.5">
            <div className="text-xs text-gray-500 uppercase tracking-wide px-2 py-1 mb-1">Pages</div>
            {pages.map((page) => (
              <button
                key={page.post_id}
                onClick={() => handleSelectPage(page)}
                className={`w-full text-left px-2 py-2 rounded-lg text-xs transition-colors group ${
                  page.post_id === currentPageId
                    ? 'bg-violet-600/20 text-violet-300'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate font-medium">
                    {page.title || '(Untitled)'}
                  </span>
                  <span
                    className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] ${
                      page.status === 'publish'
                        ? 'bg-green-900/50 text-green-400'
                        : 'bg-gray-800 text-gray-500'
                    }`}
                  >
                    {page.status === 'publish' ? 'live' : 'draft'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-xs text-gray-600 px-2 py-4 text-center">
            No pages yet.<br />Create your first page above.
          </div>
        )}
      </div>

      {/* Settings button */}
      <div className="px-3 py-3 border-t border-gray-800">
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-full flex items-center gap-2 text-gray-400 hover:text-gray-200 text-xs px-2 py-2 rounded-lg hover:bg-gray-800 transition-colors"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
          Settings
        </button>
      </div>
    </div>
  );
}

export function SplitLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Left sidebar */}
      <PagesSidebar />

      {/* Chat panel */}
      <div className="w-[380px] flex-shrink-0 flex flex-col border-r border-gray-200 h-full">
        <ChatPanel />
      </div>

      {/* Preview panel */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        <PreviewPanel />
      </div>

      {/* Settings modal */}
      <SettingsModal />
    </div>
  );
}
