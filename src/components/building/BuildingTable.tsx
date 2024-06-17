import { Building } from "@/data/interface";
import { createColumnHelper } from "@tanstack/react-table";

import { MyTable } from "@/components/Table";
import { useSelector } from "react-redux";
import { RootState } from "@/data/redux/store";
import { useState } from "react";
import { getBuildingEmploye } from "@/data/utils";

export const BuildingTable = () => {
    const buildingList = useSelector((state: RootState) => state.company.buildingList);
    const employeList = useSelector((state: RootState) => state.employe.employeList);

    const [rowSelection, setRowSelection] = useState<Object>({});

    const columnHelper = createColumnHelper<Building>();
    const columns = [
        {
            header: "Name",
            // accessorFn: (row: Employe) => row.lastName + " " + row.firstName,
            enableColumnFilter: false,
            cell: (props: any) => {
                return (
                    <div className="flex items-center space-x-3">
                        <div className="avatar">
                            <div className="w-16 rounded">
                                <img src={props.row.original.image} />
                            </div>
                        </div>
                        <div>
                            <div className="font-bold">{props.row.original.name}</div>
                        </div>
                    </div>
                );
            },
        },
        columnHelper.accessor("energyPrice", {
            header: "Cout",
            cell: (info) => info.renderValue() + " / Mois",
        }),
        columnHelper.accessor("place", { header: "Place" }),
        columnHelper.display({
            header: "Employé",
            cell: (props) => {
                const nbEmploye = getBuildingEmploye(employeList, props.row.original).length;
                return <div>{nbEmploye}</div>;
            },
        }),
        columnHelper.display({
            header: "Action",
            // cell: (props) => {
            //     return (
            //         <div className="tooltip" data-tip="Embaucher">
            //             <button
            //                 className="btn btn-xs btn-info btn-square"
            //                 onClick={() => {
            //                     dispatch(hire(props.row.original.id));
            //                 }}
            //             >
            //                 <AddUser />
            //             </button>
            //         </div>
            //     );
            // },
        }),
    ];

    return (
        <div className="space-y-4">
            <MyTable
                columns={columns}
                defaultData={buildingList}
                title={buildingList.length + " Batiment" + (buildingList.length > 1 ? "s" : "")}
                isRowSelectable={false}
                rowSelection={rowSelection}
                setRowSelection={setRowSelection}
                action={<></>}
            // action={
            //     Object.keys(rowSelection).length > 0 ? (
            //         <button className="btn btn-xs btn-info" onClick={hireSelected}>
            //             <AddUser />
            //             <p>Embaucher</p>
            //         </button>
            //     ) : (
            //         <></>
            //     )
            // }
            />
        </div>
    );
};
