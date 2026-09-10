import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useUserStore } from '@/store/user';
import { repairBrevoTime } from '@/request/all-email';

export default function BrevoTimeRepair({ onComplete }: { onComplete: () => void }) {
  const { t } = useTranslation();
  const isAdmin = useUserStore(s => s.user?.permKeys?.includes('*') === true);
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [result, setResult] = useState({ processed: 0, updated: 0, failed: 0 });
  const [errors, setErrors] = useState<{ emailId: number; message: string }[]>([]);
  const [requestFailed, setRequestFailed] = useState(false);
  const stop = useRef(false);
  const lock = useRef(false);

  useEffect(() => () => { stop.current = true; }, []);

  async function repair() {
    if (lock.current) return;
    lock.current = true;
    stop.current = false;
    setRunning(true);
    setRequestFailed(false);
    setErrors([]);
    setResult({ processed: 0, updated: 0, failed: 0 });
    let afterEmailId = 0;
    try {
      let hasMore = true;
      while (hasMore && !stop.current) {
        const batch = await repairBrevoTime({ afterEmailId, startDate, endDate });
        setResult(prev => ({ processed: prev.processed + batch.processed, updated: prev.updated + batch.updated, failed: prev.failed + batch.errors.length }));
        setErrors(prev => [...prev, ...batch.errors]);
        afterEmailId = batch.nextEmailId;
        hasMore = batch.hasMore;
      }
    } catch {
      setRequestFailed(true);
    } finally {
      lock.current = false;
      setRunning(false);
      onComplete();
    }
  }

  if (!isAdmin) return null;
  return <>
    <Button variant="outline" size="sm" onClick={() => setOpen(true)}>{t('repairBrevoTime')}</Button>
    <Dialog open={open} onOpenChange={value => { if (!running) setOpen(value); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('repairBrevoTime')}</DialogTitle>
          <DialogDescription>{t('repairBrevoTimeDesc')}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <Input type="date" aria-label={t('repairBrevoTimeStart')} disabled={running} value={startDate} onChange={e => setStartDate(e.target.value)} />
          <span>{t('to')}</span>
          <Input type="date" aria-label={t('repairBrevoTimeEnd')} disabled={running} value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        <p aria-live="polite">{t('repairBrevoTimeResult', result)}</p>
        {requestFailed && <p>{t('repairBrevoTimeRetry')}</p>}
        <div className="max-h-36 overflow-auto text-sm">{errors.map(error => <div key={error.emailId}>#{error.emailId}: {error.message}</div>)}</div>
        {running
          ? <Button variant="outline" onClick={() => { stop.current = true; }}>{t('repairBrevoTimeStop')}</Button>
          : <Button onClick={repair}>{t('repairBrevoTime')}</Button>}
      </DialogContent>
    </Dialog>
  </>;
}
