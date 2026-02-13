export const dynamic = "force-static";

export default function OrgCanonicalMigrationDocsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-14 text-sm text-slate-200">
      <h1 className="text-2xl font-semibold text-white">Legacy route removed</h1>
      <p className="mt-4 text-slate-300">
        Legacy routing policy is now split: <code>/organizacao/*</code> redirects to canonical web routes, and{" "}
        <code>/api/organizacao/*</code> is removed.
      </p>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-300">
        <li>
          Legacy web: <code>/organizacao/*</code> -&gt; <code>301</code> to <code>/org/:orgId/*</code>
        </li>
        <li>
          Legacy API: <code>/api/organizacao/*</code> -&gt; <code>410 LEGACY_ROUTE_REMOVED</code>
        </li>
        <li>
          Web org-scoped: <code>/org/:orgId/*</code>
        </li>
        <li>
          Web hub: <code>/org-hub/*</code>
        </li>
        <li>
          API org-scoped: <code>/api/org/:orgId/*</code>
        </li>
        <li>
          API hub: <code>/api/org-hub/*</code>
        </li>
        <li>
          API system: <code>/api/org-system/*</code>
        </li>
      </ul>
      <p className="mt-6 text-slate-400">
        For org-scoped APIs, org context must be provided only by the path segment <code>:orgId</code>.
      </p>
    </main>
  );
}
