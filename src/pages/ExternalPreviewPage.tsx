import { VFSPreview } from '@/components/VFSPreview';
import {
  createExternalPreviewChannel,
  isExternalPreviewFilesMessage,
  readExternalPreviewSession,
} from '@/services/externalPreviewSession';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

export default function ExternalPreviewPage() {
  const { previewKey = '' } = useParams();
  const [session] = useState(() => {
    const storedSession = readExternalPreviewSession(previewKey);
    if (storedSession) return storedSession;

    const title = new URLSearchParams(window.location.search).get('title');
    if (!title || typeof BroadcastChannel === 'undefined') return null;
    return { files: {}, title, createdAt: Date.now() };
  });
  const [files, setFiles] = useState(() => session?.files ?? {});

  useEffect(() => {
    if (!session) return;
    document.title = `${session.title} | Preview`;
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const channel = createExternalPreviewChannel(previewKey);
    if (!channel) return;

    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (isExternalPreviewFilesMessage(event.data)) setFiles(event.data.files);
    };
    channel.postMessage({ type: 'request' });

    return () => channel.close();
  }, [previewKey, session]);

  if (!session) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background p-6 text-foreground">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold">Preview unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This preview has expired or is not available in this browser. Open it again from the Web Builder.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="h-dvh w-full overflow-hidden bg-white">
      <VFSPreview
        nodes={[]}
        files={files}
        className="!h-full !w-full !rounded-none !border-0"
        showToolbar={false}
        autoStart={false}
        forceBackend="sandpack"
        showBackendIndicator={false}
      />
    </main>
  );
}