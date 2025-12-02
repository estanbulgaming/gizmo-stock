import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Download } from 'lucide-react';
import { CountingSession } from '../../hooks/useCountingSession';

interface CountingPageProps {
  session: CountingSession | null;
  isSessionActive: boolean;
  startSession: () => void;
  endSession: () => void;
  downloadSessionReport: (session: CountingSession, t: (key: string) => string) => void;
  setCountedProductIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  showToast: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  t: (key: string) => string;
}

export function CountingPage({
  session,
  isSessionActive,
  startSession,
  endSession,
  downloadSessionReport,
  setCountedProductIds,
  showToast,
  t,
}: CountingPageProps) {
  const handleStartSession = () => {
    startSession();
    showToast('success', t('counting.active'));
  };

  const handleEndSession = () => {
    if (!session) return;

    if (confirm(t('counting.confirmEnd'))) {
      if (session.changes.length > 0) {
        downloadSessionReport(session, t);
      }
      endSession();
      setCountedProductIds(new Set());
      showToast('success', t('counting.download'));
    }
  };

  const handleDownloadReport = () => {
    if (!session) return;
    downloadSessionReport(session, t);
    showToast('success', t('counting.download'));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2>{t('counting.title')}</h2>
          <p className="text-muted-foreground">
            {isSessionActive ? t('counting.active') : t('counting.noSession')}
          </p>
        </div>
        <div className="flex gap-2">
          {!isSessionActive ? (
            <Button onClick={handleStartSession} className="bg-green-600 hover:bg-green-700">
              {t('counting.start')}
            </Button>
          ) : (
            <>
              <Button onClick={handleDownloadReport} variant="outline" disabled={!session || session.changes.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                {t('counting.download')}
              </Button>
              <Button onClick={handleEndSession} variant="destructive">
                {t('counting.end')}
              </Button>
            </>
          )}
        </div>
      </div>

      {!isSessionActive ? (
        <Card className="p-8 text-center">
          <div className="text-muted-foreground">
            <p className="text-lg mb-2">{t('counting.noSession')}</p>
            <p className="text-sm">{t('counting.noSessionHint')}</p>
          </div>
        </Card>
      ) : session && (
        <Card className="p-4">
          <div className="space-y-4">
            {/* Session Info */}
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <p className="text-sm text-muted-foreground">{t('counting.startedAt')}</p>
                <p className="font-medium">{new Date(session.startedAt).toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">{t('counting.changes')}</p>
                <p className="text-2xl font-bold">{session.changes.length}</p>
              </div>
            </div>

            {/* Changes List */}
            {session.changes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>{t('counting.noChanges')}</p>
                <p className="text-sm mt-2">Stok sayfasından ürünlerde değişiklik yapın</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {session.changes.map((change, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted rounded">
                    <div>
                      <p className="font-medium">{change.productName}</p>
                      <p className="text-sm text-muted-foreground">
                        {change.barcode && `${change.barcode} • `}
                        {t('item.current')}: {change.previousCount} → {t('item.total')}: {change.finalCount}
                      </p>
                    </div>
                    <div className="text-right">
                      {change.countedValue !== undefined && (
                        <p className="text-sm">{t('item.counted')}: {change.countedValue}</p>
                      )}
                      {change.addedValue !== undefined && change.addedValue > 0 && (
                        <p className="text-sm text-green-600">+{change.addedValue}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
