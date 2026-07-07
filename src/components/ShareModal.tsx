import { useEffect, useRef, useState } from 'react';
import { Check, Copy, FileImage, FileCode } from 'lucide-react';
import { Button, Modal } from './ui';
import { createBrandQr, downloadQr } from '@/lib/qr';
import { copyToClipboard } from '@/lib/utils';

/**
 * Shared "copy link + branded QR" dialog used by both forms and game sessions.
 */
export function ShareModal({
  open,
  onClose,
  url,
  title,
  fileName,
}: {
  open: boolean;
  onClose: () => void;
  url: string;
  title: string;
  fileName: string;
}) {
  const qrRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !qrRef.current) return;
    qrRef.current.innerHTML = '';
    const qr = createBrandQr(url, 240);
    qr.append(qrRef.current);
  }, [open, url]);

  const handleCopy = async () => {
    if (await copyToClipboard(url)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="flex flex-col items-center gap-4">
        <div
          ref={qrRef}
          className="overflow-hidden rounded-2xl border border-mist-200 p-2 [&_svg]:h-auto [&_svg]:max-w-full"
        />
        <div className="flex w-full items-center gap-2 rounded-xl bg-mist-100 px-3 py-2.5">
          <span className="min-w-0 flex-1 truncate text-sm text-navy-600">{url}</span>
          <button
            onClick={handleCopy}
            className="shrink-0 rounded-lg p-1.5 text-navy-500 transition-colors hover:bg-white"
            aria-label="Скопіювати посилання"
          >
            {copied ? <Check size={18} className="text-success-500" /> : <Copy size={18} />}
          </button>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => void downloadQr(url, fileName, 'png')}
          >
            <FileImage size={16} /> Завантажити PNG
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => void downloadQr(url, fileName, 'svg')}
          >
            <FileCode size={16} /> Завантажити SVG
          </Button>
        </div>
      </div>
    </Modal>
  );
}
