import { Link } from 'react-router-dom';
import { MarketplaceCatalog } from '@/marketplace/MarketplaceCatalog';

export default function Marketplace() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
          <Link to="/marketplace" className="font-semibold tracking-tight">Unison Design Market</Link>
          <Link to="/auth?next=%2Fmarketplace" className="text-sm text-muted-foreground hover:text-foreground">
            Sign in
          </Link>
        </div>
      </header>
      <MarketplaceCatalog />
    </main>
  );
}