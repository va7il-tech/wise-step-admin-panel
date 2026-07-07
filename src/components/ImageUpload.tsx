import { useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { uploadToMedia } from '@/lib/storage';
import { cn } from '@/lib/utils';

/** Small image picker: uploads to the public media bucket and returns the URL. */
export function ImageUpload({
  value,
  onChange,
  folder,
  label = 'Завантажити зображення',
  className,
}: {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  folder: string;
  label?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      onChange(await uploadToMedia(file, folder));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося завантажити файл');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={className}>
      {value ? (
        <div className="relative overflow-hidden rounded-xl border border-mist-200">
          <img src={value} alt="" className="h-36 w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute right-2 top-2 rounded-lg bg-navy-900/60 p-1.5 text-white backdrop-blur-sm hover:bg-navy-900/80"
            aria-label="Прибрати зображення"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={cn(
            'flex h-24 w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-mist-300 text-sm text-mist-600 transition-colors hover:border-teal-400 hover:text-teal-600',
            uploading && 'cursor-wait opacity-60',
          )}
        >
          {uploading ? <Loader2 size={20} className="animate-spin" /> : <ImagePlus size={20} />}
          {uploading ? 'Завантаження…' : label}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = '';
        }}
      />
      {error && <p className="mt-1 text-xs font-medium text-error-500">{error}</p>}
    </div>
  );
}
