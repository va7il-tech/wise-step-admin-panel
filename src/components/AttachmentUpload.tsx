import { useRef, useState } from 'react';
import { FilePlus2, Loader2, Paperclip, X } from 'lucide-react';
import { ATTACHMENT_ACCEPT, ATTACHMENT_MAX_BYTES, uploadFormAttachment } from '@/lib/storage';
import type { FormAttachment } from '@/lib/types';
import { cn, formatBytes, randomId } from '@/lib/utils';

/**
 * Picker for documents an admin attaches to a form (rules, blank applications).
 * Uploads to the public media bucket so anonymous visitors can download them.
 */
export function AttachmentUpload({
  value,
  onChange,
  className,
}: {
  value: FormAttachment[];
  onChange: (next: FormAttachment[]) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: File[]) => {
    setError(null);
    setUploading(true);
    const added: FormAttachment[] = [];
    try {
      for (const file of files) {
        if (file.size > ATTACHMENT_MAX_BYTES) {
          setError(`Файл «${file.name}» більший за ${formatBytes(ATTACHMENT_MAX_BYTES)}`);
          continue;
        }
        const url = await uploadFormAttachment(file);
        added.push({ id: randomId().slice(0, 8), url, name: file.name, size: file.size });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося завантажити файл');
    } finally {
      if (added.length) onChange([...value, ...added]);
      setUploading(false);
    }
  };

  return (
    <div className={className}>
      {value.length > 0 && (
        <ul className="mb-2 space-y-2">
          {value.map((attachment) => (
            <li
              key={attachment.id}
              className="flex items-center gap-3 rounded-xl border border-mist-200 px-3 py-2"
            >
              <Paperclip size={16} className="shrink-0 text-teal-500" />
              <span className="min-w-0 flex-1 truncate text-sm text-navy-700">
                {attachment.name}
              </span>
              {attachment.size !== undefined && (
                <span className="shrink-0 text-xs text-mist-500">
                  {formatBytes(attachment.size)}
                </span>
              )}
              <button
                type="button"
                onClick={() => onChange(value.filter((a) => a.id !== attachment.id))}
                className="shrink-0 rounded-lg p-1.5 text-error-500 hover:bg-error-50"
                aria-label="Прибрати файл"
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={cn(
          'flex h-20 w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-mist-300 text-sm text-mist-600 transition-colors hover:border-teal-400 hover:text-teal-600',
          uploading && 'cursor-wait opacity-60',
        )}
      >
        {uploading ? <Loader2 size={20} className="animate-spin" /> : <FilePlus2 size={20} />}
        {uploading ? 'Завантаження…' : 'Додати файл'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ATTACHMENT_ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) void handleFiles(files);
          e.target.value = '';
        }}
      />
      {error && <p className="mt-1 text-xs font-medium text-error-500">{error}</p>}
    </div>
  );
}
