import { useState, useCallback } from 'react';

export interface CountingSessionChange {
  productId: string;
  productName: string;
  barcode?: string;
  previousCount: number;
  countedValue?: number;
  addedValue?: number;
  finalCount: number;
  previousPrice?: number;
  newPrice?: number;
  previousCost?: number;
  newCost?: number;
  timestamp: string;
}

export interface CountingSession {
  id: string;
  startedAt: string;
  endedAt?: string;
  status: 'active' | 'completed';
  changes: CountingSessionChange[];
  totalProducts: number;
  totalChanges: number;
}

export interface UseCountingSessionReturn {
  session: CountingSession | null;
  isSessionActive: boolean;
  startSession: () => void;
  endSession: () => void;
  addChange: (change: CountingSessionChange) => void;
  clearSession: () => void;
}

export function useCountingSession(): UseCountingSessionReturn {
  const [session, setSession] = useState<CountingSession | null>(null);

  const isSessionActive = session?.status === 'active';

  const startSession = useCallback(() => {
    const newSession: CountingSession = {
      id: Date.now().toString(),
      startedAt: new Date().toISOString(),
      status: 'active',
      changes: [],
      totalProducts: 0,
      totalChanges: 0,
    };
    setSession(newSession);
  }, []);

  const endSession = useCallback(() => {
    setSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        endedAt: new Date().toISOString(),
        status: 'completed',
      };
    });
  }, []);

  const addChange = useCallback((change: CountingSessionChange) => {
    setSession(prev => {
      if (!prev || prev.status !== 'active') return prev;

      // Check if product already has a change, update it
      const existingIndex = prev.changes.findIndex(c => c.productId === change.productId);
      let newChanges: CountingSessionChange[];

      if (existingIndex >= 0) {
        newChanges = [...prev.changes];
        newChanges[existingIndex] = change;
      } else {
        newChanges = [...prev.changes, change];
      }

      return {
        ...prev,
        changes: newChanges,
        totalChanges: newChanges.length,
        totalProducts: new Set(newChanges.map(c => c.productId)).size,
      };
    });
  }, []);

  const clearSession = useCallback(() => {
    setSession(null);
  }, []);

  return {
    session,
    isSessionActive,
    startSession,
    endSession,
    addChange,
    clearSession,
  };
}

// Generate CSV report from session
export function generateSessionReport(session: CountingSession, t: (key: string) => string): string {
  const headers = [
    t('csv.productName'),
    t('item.barcode'),
    t('csv.current'),
    t('csv.counted'),
    t('csv.added'),
    t('csv.total'),
    t('csv.oldPrice'),
    t('csv.newPrice'),
    t('csv.date'),
  ];

  const rows = session.changes.map(change => [
    change.productName,
    change.barcode || '',
    change.previousCount.toString(),
    change.countedValue?.toString() || '',
    change.addedValue?.toString() || '',
    change.finalCount.toString(),
    change.previousPrice?.toFixed(2) || '',
    change.newPrice?.toFixed(2) || '',
    new Date(change.timestamp).toLocaleString(),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  return csvContent;
}

// Download CSV file
export function downloadSessionReport(session: CountingSession, t: (key: string) => string): void {
  const csv = generateSessionReport(session, t);
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;

  const date = new Date(session.startedAt).toISOString().split('T')[0];
  link.download = `sayim-raporu-${date}.csv`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
