import { groupsForType, TYPE_SPEC_GROUPS } from '../specGroups';

const field = 'mt-1 w-full border border-line rounded-[10px] px-3 py-2.5 bg-white font-normal';

export default function SpecGroupFields({ type, specs = {}, onChange, groups = TYPE_SPEC_GROUPS }) {
  const list = groupsForType(type, groups);
  if (!type || !list.length) {
    return <p className="text-sm text-muted">Choose a type to enter platform specifications.</p>;
  }

  return (
    <div className="space-y-4">
      {list.map((g) => (
        <fieldset key={g.name} className="border border-line rounded-[14px] bg-white p-4">
          <legend className="font-display font-semibold text-sm px-1">{g.name}</legend>
          <div className="grid sm:grid-cols-2 gap-3">
            {(g.keys || []).map((k) => (
              <label key={k} className="block text-sm font-semibold">
                {k}
                <input
                  value={specs[k] ?? ''}
                  onChange={(e) => onChange(k, e.target.value)}
                  placeholder="Not disclosed"
                  className={field}
                />
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
