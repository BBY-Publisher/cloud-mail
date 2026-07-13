import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@iconify/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import HtmlEditor, { type HtmlEditorHandle } from '@/components/tiptap-editor';
import ShadowHtml from '@/components/shadow-html';
import { signatureList, signatureSet } from '@/request/signature';
import { useSignatureStore } from '@/store/signature';

export default function SignatureView() {
  const { t } = useTranslation();
  const signatureStore = useSignatureStore();
  const [signatures, setSignatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editorShow, setEditorShow] = useState(false);
  const [previewShow, setPreviewShow] = useState(false);
  const editorRef = useRef<HtmlEditorHandle>(null);
  const [form, setForm] = useState({ domain: '', content: '', enabled: 1 });

  useEffect(() => {
    loadList();
  }, []);

  function loadList() {
    setLoading(true);
    signatureList()
      .then(setSignatures)
      .finally(() => setLoading(false));
  }

  function openEditor(row: any) {
    setForm({
      domain: row.domain,
      content: row.content || '',
      enabled: row.enabled ?? 1,
    });
    setEditorShow(true);
    setTimeout(() => editorRef.current?.clearEditor(), 0);
  }

  function openPreview() {
    setForm((f) => ({ ...f, content: editorRef.current?.getContent() ?? f.content }));
    setPreviewShow(true);
  }

  async function saveSignature() {
    const content = editorRef.current?.getContent() ?? form.content;
    setSaving(true);
    try {
      await signatureSet({ ...form, content });
      toast.success(t('saveSuccessMsg'));
      signatureStore.refreshSignature();
      setEditorShow(false);
      loadList();
    } finally {
      setSaving(false);
    }
  }

  function contentText(content: string = '') {
    return content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  return (
    <div className="signature-box">
      <div className="header-actions">
        <Icon
          className="icon"
          icon="ion:reload"
          width="18"
          height="18"
          onClick={loadList}
          style={{ cursor: 'pointer' }}
        />
      </div>
      <div className="signature-scrollbar">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead style={{ width: 10 }} />
              <TableHead className="min-w-[180px]">{t('domain')}</TableHead>
              <TableHead style={{ width: 120 }}>{t('status')}</TableHead>
              <TableHead className="min-w-[220px]">{t('preview')}</TableHead>
              <TableHead style={{ width: 120 }}>{t('action')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {signatures.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center">
                  <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                    <Icon icon="lucide:signature" width="20" height="20" />
                    <div className="text-[13px] font-medium text-foreground">
                      {t('noSignatureFound')}
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : null}
            {signatures.map((row) => (
              <TableRow key={row.domain}>
                <TableCell />
                <TableCell>@{row.domain}</TableCell>
                <TableCell>
                  <Badge variant={row.enabled ? 'default' : 'secondary'}>
                    {row.enabled ? t('enabled') : t('disabled')}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="content-preview">{contentText(row.content) || '-'}</div>
                </TableCell>
                <TableCell>
                  <Button size="sm" onClick={() => openEditor(row)}>
                    {t('change')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={editorShow} onOpenChange={setEditorShow}>
        <DialogContent className="max-w-[860px]">
          <DialogHeader>
            <DialogTitle>
              {t('signature')} - @{form.domain}
            </DialogTitle>
          </DialogHeader>
          <div className="signature-form">
            <div className="signature-switch">
              <span>{t('status')}</span>
              <Switch
                checked={form.enabled === 1}
                onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v ? 1 : 0 }))}
              />
            </div>
            <HtmlEditor
              ref={editorRef}
              defaultValue={form.content}
              onChange={(content) => setForm((f) => ({ ...f, content }))}
            />
            <div className="dialog-actions">
              <Button variant="outline" onClick={openPreview}>
                {t('preview')}
              </Button>
              <Button onClick={saveSignature} disabled={saving}>
                {t('save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={previewShow} onOpenChange={setPreviewShow}>
        <DialogContent className="max-w-[860px]">
          <DialogHeader>
            <DialogTitle>{t('preview')}</DialogTitle>
          </DialogHeader>
          <div className="preview-box">
            <ShadowHtml html={form.content || ''} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}