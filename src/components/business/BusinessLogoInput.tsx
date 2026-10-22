import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { uploadForPlacement } from '@/services/assets/uploadPlacement';

interface BusinessLogoInputProps {
  value?: string | null;
  scopeId?: string | null;
  onChange: (url: string | null) => void;
  compact?: boolean;
}

export function BusinessLogoInput({ value, scopeId, onChange, compact = false }: BusinessLogoInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('Choose an image smaller than 8 MB.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const placed = await uploadForPlacement(file, scopeId);
      onChange(placed.url);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Logo upload failed.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/30">
        {value ? <img src={value} alt="Business logo preview" className="max-h-full max-w-full object-contain" /> : <ImagePlus className="h-5 w-5 text-muted-foreground" />}
      </div>
      <div className="min-w-0 space-y-1.5">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          aria-label="Choose business logo image"
          className="sr-only"
          onChange={(event) => void upload(event.target.files?.[0])}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()} className={compact ? 'h-7 px-2 text-xs' : 'h-8'}>
            {uploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
            {value ? 'Replace image' : 'Insert image'}
          </Button>
          {value && <Button type="button" variant="ghost" size="icon" aria-label="Remove business logo" disabled={uploading} onClick={() => { onChange(null); setError(null); }} className={compact ? 'h-7 w-7' : 'h-8 w-8'}><X className="h-3.5 w-3.5" /></Button>}
        </div>
        {!compact && <p className="text-[11px] text-muted-foreground">PNG, JPG, or SVG; up to 8 MB.</p>}
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
