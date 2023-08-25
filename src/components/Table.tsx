import { HTMLProps, ReactElement, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
    Table,
    Column,
    FilterFn,
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
import { FilterAlt, NavArrowLeft, NavArrowRight, SortDown, SortUp } from "iconoir-react";
import { rankItem } from "@tanstack/match-sorter-utils";

interface TableProps {
    title: string;
    columns: any;
    defaultData: any;
    isRowSelectable: boolean;
    rowSelection: any;
    setRowSelection: (row: any) => void;
}

const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => {
    const itemRank = rankItem(row.getValue(columnId), value);
    addMeta({ itemRank });
    return itemRank.passed;
};

export const MyTable: React.FC<TableProps> = ({
    columns,
    defaultData,
    title,
    rowSelection,
    setRowSelection,
    isRowSelectable,
}): ReactElement => {
    const [data, setData] = useState(() => [...defaultData]);
    const rerender = useReducer(() => ({}), {})[1];

    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState("");

    if (isRowSelectable)
        columns.unshift({
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
        });

    const table = useReactTable({
        data,
        columns,
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
        <div className="space-y-4">
            <div className="flex flex-row justify-between">
                <h1 className="heading-1">{title}</h1>
                <div className="flex flew-row space-x-2">
                    <DebouncedInput
                        value={globalFilter ?? ""}
                        onChange={(value) => setGlobalFilter(String(value))}
                        className="input input-sm input-bordered"
                        placeholder="Chercher"
                    />
                    <div className="dropdown dropdown-end">
                        <label tabIndex={0} className="btn btn-sm btn-square">
                            <FilterAlt height={16} width={16} />
                        </label>
                        <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
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
                                                    className: header.column.getCanSort() ? "cursor-pointer select-none flex flex-row" : "",
                                                    onClick: header.column.getToggleSortingHandler(),
                                                }}
                                            >
                                                {flexRender(header.column.columnDef.header, header.getContext())}
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
                        <tr key={row.id} className="hover cursor-pointer" onClick={() => row.toggleSelected()}>
                            {row.getVisibleCells().map((cell) => (
                                <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className="flex justify-between items-center gap-2">
                <span className="flex items-center gap-1">
                    <div>Page</div>
                    <strong>
                        {table.getState().pagination.pageIndex + 1} sur {table.getPageCount()}
                    </strong>
                </span>
                <div className="join">
                    {/* <button className="join-item btn btn-sm" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
                        <FastArrowLeft />
                    </button> */}
                    <button className="join-item btn btn-sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                        <NavArrowLeft />
                    </button>
                    <button className="join-item btn btn-sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                        <NavArrowRight />
                    </button>
                    {/* <button
                        className="join-item btn btn-sm"
                        onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                        disabled={!table.getCanNextPage()}
                    >
                        <FastArrowRight />
                    </button> */}
                </div>
                <select
                    className="select select-sm select-bordered"
                    value={table.getState().pagination.pageSize}
                    onChange={(e) => {
                        table.setPageSize(Number(e.target.value));
                    }}
                >
                    {[10, 20, 30, 40, 50].map((pageSize) => (
                        <option key={pageSize} value={pageSize}>
                            Afficher {pageSize}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
};

function Filter({ column, table }: { column: Column<any, unknown>; table: Table<any> }) {
    const firstValue = table.getPreFilteredRowModel().flatRows[0]?.getValue(column.id);

    const columnFilterValue = column.getFilterValue();

    const sortedUniqueValues = useMemo(
        () => (typeof firstValue === "number" ? [] : Array.from(column.getFacetedUniqueValues().keys()).sort()),
        [column.getFacetedUniqueValues()]
    );

    return typeof firstValue === "number" ? (
        <div className="my-2">
            <p>{column.columnDef.header?.toString()}</p>
            <div className="flex space-x-1">
                <DebouncedInput
                    type="number"
                    min={Number(column.getFacetedMinMaxValues()?.[0] ?? "")}
                    max={Number(column.getFacetedMinMaxValues()?.[1] ?? "")}
                    value={(columnFilterValue as [number, number])?.[0] ?? ""}
                    onChange={(value) => column.setFilterValue((old: [number, number]) => [value, old?.[1]])}
                    placeholder={`Min ${column.getFacetedMinMaxValues()?.[0] ? `(${column.getFacetedMinMaxValues()?.[0]})` : ""}`}
                    className="input input-sm input-bordered"
                />
                <DebouncedInput
                    type="number"
                    min={Number(column.getFacetedMinMaxValues()?.[0] ?? "")}
                    max={Number(column.getFacetedMinMaxValues()?.[1] ?? "")}
                    value={(columnFilterValue as [number, number])?.[1] ?? ""}
                    onChange={(value) => column.setFilterValue((old: [number, number]) => [old?.[0], value])}
                    placeholder={`Max ${column.getFacetedMinMaxValues()?.[1] ? `(${column.getFacetedMinMaxValues()?.[1]})` : ""}`}
                    className="input input-sm input-bordered"
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
                className="input input-sm input-bordered"
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
}: { value: string | number; onChange: (value: string | number) => void; debounce?: number } & Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "onChange"
>) {
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

    return <input {...props} value={value} onChange={(e) => setValue(e.target.value)} />;
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

    return <input type="checkbox" ref={ref} className={className + "checkbox cursor-pointer"} {...rest} />;
};
