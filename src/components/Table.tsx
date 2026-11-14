import {
  HTMLProps,
  ReactElement,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Table,
  Column,
  ColumnDef,
  FilterFn,
  Row,
  RowSelectionState,
  OnChangeFn,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFacetedMinMaxValues,
} from "@tanstack/react-table";
import {
  FilterAlt,
  NavArrowLeft,
  NavArrowRight,
  SortDown,
  SortUp,
} from "iconoir-react";
import { rankItem } from "@tanstack/match-sorter-utils";

interface TableProps<T> {
  title: string;
  columns: ColumnDef<T, any>[];
  defaultData: T[];
  /** Cases à cocher : pour toutes les lignes, ou selon un prédicat par ligne. */
  isRowSelectable: boolean | ((row: Row<T>) => boolean);
  rowSelection: RowSelectionState;
  setRowSelection: OnChangeFn<RowSelectionState>;
  action: ReactElement;
  /** Barre affichée entre l'en-tête et le tableau (ex. actions groupées). */
  toolbar?: ReactNode;
}

const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => {
  const itemRank = rankItem(row.getValue(columnId), value);
  addMeta({ itemRank });
  return itemRank.passed;
};

export function MyTable<T>({
  columns,
  defaultData,
  title,
  rowSelection,
  setRowSelection,
  isRowSelectable,
  action,
  toolbar,
}: TableProps<T>): ReactElement {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const finalColumns = useMemo<ColumnDef<T, any>[]>(() => {
    if (!isRowSelectable) return columns;
    return [
      {
        id: "select",
        header: (props: any) => (
          <IndeterminateCheckbox
            {...{
              checked: props.table.getIsAllRowsSelected(),
              indeterminate: props.table.getIsSomeRowsSelected(),
              onChange: props.table.getToggleAllRowsSelectedHandler(),
            }}
          />
        ),
        cell: (props: any) => (
          <IndeterminateCheckbox
            {...{
              checked: props.row.getIsSelected(),
              disabled: !props.row.getCanSelect(),
              indeterminate: props.row.getIsSomeSelected(),
              onChange: props.row.getToggleSelectedHandler(),
            }}
          />
        ),
      },
      ...columns,
    ];
  }, [columns, isRowSelectable]);

  const table = useReactTable({
    data: defaultData,
    columns: finalColumns,
    state: { sorting, globalFilter, rowSelection },
    enableRowSelection: isRowSelectable,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
    filterFns: { fuzzy: fuzzyFilter },
    globalFilterFn: fuzzyFilter,
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          {title && (
            <h1 className="font-display text-2xl font-bold">{title}</h1>
          )}
          {action}
        </div>
        <div className="flex items-center gap-2">
          <DebouncedInput
            value={globalFilter ?? ""}
            onChange={(value) => setGlobalFilter(String(value))}
            className="input input-sm w-52 rounded-full border-0 bg-white font-semibold [--input-color:transparent] placeholder-base-content/60"
            placeholder="Rechercher…"
            aria-label="Rechercher"
          />
          <div className="dropdown dropdown-end">
            <label
              tabIndex={0}
              className="btn btn-ghost btn-sm btn-circle bg-white"
              aria-label="Filtres"
            >
              <FilterAlt height={16} width={16} />
            </label>
            <ul
              tabIndex={0}
              className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52"
            >
              {table.getHeaderGroups().map((headerGroup) => (
                <div key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <div key={header.id}>
                        {header.column.getCanFilter() ? (
                          <div>
                            <Filter column={header.column} table={table} />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ))}
            </ul>
          </div>
        </div>
      </div>
      {toolbar}
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <th key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder ? null : (
                        <div
                          {...{
                            className: header.column.getCanSort()
                              ? "cursor-pointer select-none flex flex-row"
                              : "",
                            onClick: header.column.getToggleSortingHandler(),
                          }}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          {{
                            asc: <SortUp className="ml-2" />,
                            desc: <SortDown className="ml-2" />,
                          }[header.column.getIsSorted() as string] ?? null}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="cursor-pointer"
                data-selected={row.getIsSelected() || undefined}
                onClick={() => row.toggleSelected()}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Pagination : seulement quand il y a plus d'une page. */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between gap-2 text-sm font-bold">
          <span className="flex items-center gap-1">
            <div>Page</div>
            <strong>
              {table.getState().pagination.pageIndex + 1} sur{" "}
              {table.getPageCount()}
            </strong>
          </span>
          <div className="flex gap-1">
            <button
              className="btn btn-ghost btn-sm btn-circle bg-white"
              aria-label="Page précédente"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <NavArrowLeft />
            </button>
            <button
              className="btn btn-ghost btn-sm btn-circle bg-white"
              aria-label="Page suivante"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <NavArrowRight />
            </button>
          </div>
          <select
            className="select select-sm w-auto rounded-full border-0 bg-white [--input-color:transparent]"
            aria-label="Lignes par page"
            value={table.getState().pagination.pageSize}
            onChange={(e) => {
              table.setPageSize(Number(e.target.value));
            }}
          >
            {[10, 20, 30, 40, 50].map((pageSize) => (
              <option key={pageSize} value={pageSize}>
                {pageSize} par page
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function Filter({
  column,
  table,
}: {
  column: Column<any, unknown>;
  table: Table<any>;
}) {
  const firstValue = table
    .getPreFilteredRowModel()
    .flatRows[0]?.getValue(column.id);

  const columnFilterValue = column.getFilterValue();

  const sortedUniqueValues = useMemo(
    () =>
      typeof firstValue === "number"
        ? []
        : Array.from(column.getFacetedUniqueValues().keys()).sort(),
    [column.getFacetedUniqueValues()],
  );

  return typeof firstValue === "number" ? (
    <div className="my-2 space-y-1">
      <p>{column.columnDef.header?.toString()}</p>
      <div className="flex space-x-1">
        <DebouncedInput
          type="number"
          min={Number(column.getFacetedMinMaxValues()?.[0] ?? "")}
          max={Number(column.getFacetedMinMaxValues()?.[1] ?? "")}
          value={(columnFilterValue as [number, number])?.[0] ?? ""}
          onChange={(value) =>
            column.setFilterValue((old: [number, number]) => [value, old?.[1]])
          }
          placeholder={`Min ${column.getFacetedMinMaxValues()?.[0] ? `(${column.getFacetedMinMaxValues()?.[0]})` : ""}`}
          className="input input-sm placeholder-base-content/70"
        />
        <DebouncedInput
          type="number"
          min={Number(column.getFacetedMinMaxValues()?.[0] ?? "")}
          max={Number(column.getFacetedMinMaxValues()?.[1] ?? "")}
          value={(columnFilterValue as [number, number])?.[1] ?? ""}
          onChange={(value) =>
            column.setFilterValue((old: [number, number]) => [old?.[0], value])
          }
          placeholder={`Max ${column.getFacetedMinMaxValues()?.[1] ? `(${column.getFacetedMinMaxValues()?.[1]})` : ""}`}
          className="input input-sm placeholder-base-content/70"
        />
      </div>
      <div className="h-1" />
    </div>
  ) : (
    <div className="my-2">
      <datalist id={column.id + "list"} className="border border-blue-400">
        {sortedUniqueValues.slice(0, 5000).map((value: any) => (
          <option value={value} key={value} />
        ))}
      </datalist>
      <DebouncedInput
        type="text"
        value={(columnFilterValue ?? "") as string}
        onChange={(value) => column.setFilterValue(value)}
        placeholder={`${column.columnDef.header} (${column.getFacetedUniqueValues().size})`}
        className="input input-sm"
        list={column.id + "list"}
      />
    </div>
  );
}

// A debounced input react component
function DebouncedInput({
  value: initialValue,
  onChange,
  debounce = 500,
  ...props
}: {
  value: string | number;
  onChange: (value: string | number) => void;
  debounce?: number;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange">) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      onChange(value);
    }, debounce);

    return () => clearTimeout(timeout);
  }, [value]);

  return (
    <input
      {...props}
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
}

interface IndeterminateCheckboxProps extends HTMLProps<HTMLInputElement> {
  indeterminate: boolean;
  className?: string;
}
const IndeterminateCheckbox: React.FC<IndeterminateCheckboxProps> = ({
  indeterminate,
  className = "",
  ...rest
}): ReactElement => {
  const ref = useRef<HTMLInputElement>(null!);

  useEffect(() => {
    ref.current.indeterminate = !rest.checked && indeterminate;
  }, [ref, indeterminate]);

  return (
    <input
      type="checkbox"
      ref={ref}
      className={className + " checkbox cursor-pointer"}
      {...rest}
    />
  );
};
