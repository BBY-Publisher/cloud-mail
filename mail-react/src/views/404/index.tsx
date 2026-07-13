import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '@iconify/react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';

export default function NotFoundView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <EmptyState
        icon="lucide:compass"
        title={t('notFound')}
        description={t('notFoundDesc')}
      >
        <Button variant="outline" size="sm" onClick={() => navigate('/inbox', { replace: true })}>
          <Icon icon="material-symbols-light:arrow-back-ios-new" width="14" height="14" />
          {t('backToInbox')}
        </Button>
      </EmptyState>
    </div>
  );
}