/**
 * BusinessCatalog — Business Center CRUD page.
 *
 * Route: `/business/:catalogKey` where `catalogKey` matches a canonical
 * `surfaceId` in the `catalogSurfaceRegistry` (services, products, menu,
 * pricing, offers, testimonials, portfolio, …).
 */
import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BusinessCatalogEditor } from '@/components/business-center/BusinessCatalogEditor';
import {
  getCatalogSurface,
  listCatalogSurfaces,
} from '@/platform/core/catalogSurfaceRegistry';

export default function BusinessCatalog() {
  const { catalogKey } = useParams<{ catalogKey: string }>();
  const navigate = useNavigate();

  const surfaces = useMemo(
    () => listCatalogSurfaces().filter((s) => s.editableFields.length > 0),
    [],
  );

  const activeSurface = useMemo(() => {
    if (!catalogKey) return null;
    return getCatalogSurface(catalogKey);
  }, [catalogKey]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <nav className="flex flex-wrap gap-1 text-xs">
            <Link to="/business/records">Records</Link>
            {surfaces.map((s) => {
              const active = s.surfaceId === activeSurface?.surfaceId;
              return (
                <Link
                  key={s.surfaceId}
                  to={`/business/${s.surfaceId}`}
                  className={`rounded-full border px-3 py-1 transition ${
                    active
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s.friendlyName}
                </Link>
              );
            })}
          </nav>
        </div>

        {activeSurface ? (
          <BusinessCatalogEditor sectionType={activeSurface.componentType} />
        ) : (
          <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            Unknown catalog <code>{catalogKey}</code>. Choose one above.
          </div>
        )}
      </div>
    </div>
  );
}
