import React, { useCallback, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { executePlan, createPage } from '../../api/client';
import { Button } from '../shared/Button';
import type { PlanStep } from '../../types';

const STEP_TYPE_ICONS: Record<string, string> = {
  hero:    '🦸',
  header:  '🔝',
  section: '📦',
  content: '📝',
  footer:  '🔻',
  gallery: '🖼️',
  cta:     '🎯',
};

function StepItem({ step }: { step: PlanStep }) {
  const icon = STEP_TYPE_ICONS[step.type] ?? '📄';
  const statusColor = {
    pending:   'bg-gray-100 text-gray-400',
    executing: 'bg-amber-100 text-amber-600',
    done:      'bg-green-100 text-green-600',
  }[step.status ?? 'pending'];

  return (
    <div className="flex gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
      <div className="text-xl mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-gray-800">{step.title}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${statusColor}`}>
            {step.status ?? 'pending'}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
      </div>
    </div>
  );
}

export function PlanDisplay() {
  const {
    plan, planStatus, setPlanStatus,
    currentPageId, setCurrentPage, clearPlan,
    addMessage, setStreaming, streamStatus,
    setMode,
  } = useAppStore();

  const [executing, setExecuting] = useState(false);

  const handleApprove = useCallback(async () => {
    if (!plan) return;

    setExecuting(true);
    setPlanStatus('executing');
    setStreaming(true, 'Building your page...');

    try {
      const result = await executePlan(plan, currentPageId ?? 0);
      setCurrentPage(result.post_id, result.preview_url);
      setPlanStatus('done');
      addMessage('assistant', `✅ Your page has been built! It has ${plan.steps.length} sections as planned. Check the preview and ask me to make any adjustments.`);
      setMode('build');
      clearPlan();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Execution failed';
      addMessage('system', `Error: ${msg}`);
      setPlanStatus('pending_approval');
    } finally {
      setExecuting(false);
      setStreaming(false);
    }
  }, [plan, currentPageId, setCurrentPage, setPlanStatus, addMessage, setStreaming, setMode, clearPlan]);

  const handleReject = useCallback(() => {
    clearPlan();
    setMode('build');
    addMessage('system', 'Plan cancelled. Back to build mode.');
  }, [clearPlan, setMode, addMessage]);

  if (!plan) return null;

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">📋</span>
          <h3 className="font-semibold text-gray-800">{plan.title}</h3>
        </div>
        {plan.description && (
          <p className="text-sm text-gray-500 ml-7">{plan.description}</p>
        )}
      </div>

      <div className="space-y-2 mb-5">
        {plan.steps.map((step) => (
          <StepItem key={step.id} step={step} />
        ))}
      </div>

      {planStatus === 'pending_approval' && (
        <div className="flex gap-2">
          <Button
            onClick={handleApprove}
            loading={executing}
            className="flex-1"
          >
            ✅ Build this page
          </Button>
          <Button
            variant="secondary"
            onClick={handleReject}
            disabled={executing}
          >
            ✏️ Revise
          </Button>
        </div>
      )}

      {planStatus === 'executing' && (
        <div className="text-center py-3">
          <div className="text-sm text-violet-600 font-medium">{streamStatus || 'Building...'}</div>
          <div className="text-xs text-gray-400 mt-1">This may take a moment</div>
        </div>
      )}

      {planStatus === 'done' && (
        <div className="text-center py-2 text-sm text-green-600 font-medium">
          ✅ Page built successfully!
        </div>
      )}
    </div>
  );
}
