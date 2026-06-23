import Link from 'next/link';

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="mt-2 text-muted">
            Wallet connection and Farcaster auth arrive in the next milestone.
          </p>
        </div>
        <div className="studio-card max-w-md py-4 text-sm">
          <p className="font-semibold">Active wallet</p>
          <p className="mt-1 text-muted">Not connected</p>
        </div>
      </div>

      <div className="mb-8">
        <Link href="/collections/new" className="studio-btn">
          Create new collection
        </Link>
      </div>

      <div className="grid gap-6">
        <section className="studio-card">
          <h2 className="text-lg font-bold">Drafts</h2>
          <p className="mt-2 text-sm text-muted">
            In-progress collection deploys will appear here once draft persistence ships.
          </p>
        </section>

        <section className="studio-card">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold">Your collections</h2>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              Volume shown at listing launch
            </span>
          </div>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-neutral-50">
                <tr>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Chain</th>
                  <th className="px-4 py-3 font-semibold">Items</th>
                  <th className="px-4 py-3 font-semibold">Volume</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted">
                    No collections yet. Create your first collection to get started.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
