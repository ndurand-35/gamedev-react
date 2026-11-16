import { FC, Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Search } from "iconoir-react";

import { useAppSelector } from "@/data/redux/hooks";
import { CODEX_ENTRIES } from "@/data/codex";
import { isEntryVisible, parseInline, searchCodex } from "@/data/codex/codex";
import { setCodexEntry, useCodexEntryId } from "@/data/codex/codexStore";
import { CODEX_CATEGORIES, CodexBlock, CodexEntry } from "@/data/codex/types";

const Inline: FC<{ text: string }> = ({ text }) => (
  <>
    {parseInline(text).map((seg, i) =>
      seg.bold ? (
        <strong key={i}>{seg.text}</strong>
      ) : (
        <Fragment key={i}>{seg.text}</Fragment>
      ),
    )}
  </>
);

const Block: FC<{ block: CodexBlock }> = ({ block }) => {
  if (block.type === "p") {
    return (
      <p className="leading-relaxed">
        <Inline text={block.text} />
      </p>
    );
  }
  if (block.type === "list") {
    return (
      <ul className="list-disc space-y-1 pl-5 leading-relaxed">
        {block.items.map((item, i) => (
          <li key={i}>
            <Inline text={item} />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead>
          <tr>
            {block.head.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>
                  <Inline text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const categoryLabel = (entry: CodexEntry) =>
  CODEX_CATEGORIES.find((c) => c.id === entry.category)?.label ?? "";

/**
 * Le codex : sommaire par catégorie (ou résultats de recherche) à gauche,
 * entrée à droite. Les entrées liées se suivent d'un clic.
 */
export const CodexView: FC = () => {
  const acquired = useAppSelector((s) => s.research.acquired);
  const selectedId = useCodexEntryId();
  const [query, setQuery] = useState("");
  const articleRef = useRef<HTMLElement>(null);

  const visible = useMemo(
    () => CODEX_ENTRIES.filter((e) => isEntryVisible(e, acquired)),
    [acquired],
  );
  const results = useMemo(() => searchCodex(visible, query), [visible, query]);
  const entry = visible.find((e) => e.id === selectedId) ?? visible[0] ?? null;

  // Nouvelle entrée : on remonte en haut de l'article.
  useEffect(() => {
    articleRef.current?.scrollTo({ top: 0 });
  }, [entry?.id]);

  const entryButton = (e: CodexEntry) => (
    <li key={e.id}>
      <button
        type="button"
        onClick={() => setCodexEntry(e.id)}
        className={
          "w-full rounded-[0.7rem] px-3 py-1.5 text-left text-sm font-semibold transition-colors " +
          (e.id === entry?.id
            ? "bg-sun font-bold text-ink shadow-[inset_0_0_0_2px_var(--color-ink)]"
            : "hover:bg-base-200")
        }
      >
        {e.title}
      </button>
    </li>
  );

  return (
    <div className="flex h-[70dvh] min-h-0">
      <aside className="flex w-60 shrink-0 flex-col border-r-2 border-base-300">
        <label className="input input-sm m-3 w-auto">
          <Search width={14} height={14} className="opacity-50" />
          <input
            type="search"
            placeholder="Rechercher"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Rechercher dans le codex"
          />
        </label>
        <nav className="flex-1 overflow-y-auto px-2 pb-3" aria-label="Sommaire">
          {query.trim() ? (
            results.length > 0 ? (
              <ul className="space-y-0.5">{results.map(entryButton)}</ul>
            ) : (
              <p className="px-3 py-2 text-sm font-semibold text-base-content/60">
                Aucun résultat.
              </p>
            )
          ) : (
            CODEX_CATEGORIES.map((cat) => {
              const list = visible.filter((e) => e.category === cat.id);
              if (list.length === 0) return null;
              return (
                <div key={cat.id} className="mb-3">
                  <h4 className="px-3 pb-1 text-xs font-extrabold tracking-wide text-base-content/70 uppercase">
                    {cat.label}
                  </h4>
                  <ul className="space-y-0.5">{list.map(entryButton)}</ul>
                </div>
              );
            })
          )}
        </nav>
      </aside>

      <article ref={articleRef} className="flex-1 overflow-y-auto px-8 py-6">
        {entry && (
          <div className="max-w-prose space-y-4">
            <header>
              <span className="text-xs font-extrabold tracking-wide text-base-content/70 uppercase">
                {categoryLabel(entry)}
              </span>
              <h3 className="font-display text-2xl font-bold">{entry.title}</h3>
              <p className="mt-1 font-semibold text-base-content/70">
                {entry.summary}
              </p>
            </header>
            {entry.body.map((block, i) => (
              <Block key={i} block={block} />
            ))}
            {entry.related && entry.related.length > 0 && (
              <footer className="border-t-[1.5px] border-base-300 pt-4">
                <h4 className="mb-2 text-xs font-extrabold tracking-wide text-base-content/70 uppercase">
                  Voir aussi
                </h4>
                <div className="flex flex-wrap gap-2">
                  {entry.related
                    .map((id) => visible.find((e) => e.id === id))
                    .filter((e): e is CodexEntry => !!e)
                    .map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        className="btn btn-sm"
                        onClick={() => {
                          setQuery("");
                          setCodexEntry(e.id);
                        }}
                      >
                        {e.title}
                      </button>
                    ))}
                </div>
              </footer>
            )}
          </div>
        )}
      </article>
    </div>
  );
};
