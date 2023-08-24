import { Employe } from "@/data/interface";
import { RootState } from "@/data/redux/store";
import { ReactElement } from "react";
import { useSelector } from "react-redux";

interface EmployeListModalProps { }

export const EmployeListModal: React.FC<EmployeListModalProps> = (): ReactElement => {
    const employeList = useSelector((state: RootState) => state.employe.employeList);

    return (
        <dialog id="employe_list_modal" className="modal">

            <form method="dialog" className="modal-box p-0">
                <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
                <div className="flex flex-row">
                    <ul className="menu bg-base-200 rounded-box">
                        <li><a>Item 1</a></li>
                        <li><a>Item 2</a></li>
                        <li><a>Item 3</a></li>
                    </ul>
                    <div className="px-8 pt-2 pb-8">
                        <h3 className="font-bold text-lg mb-6">Employées</h3>
                        <div className="space-y-2">
                            {employeList.map((employe: Employe, index: number) => (
                                <div key={index} className="flex flex-row space-x-2 items-center">
                                    <div className="avatar placeholder">
                                        <div className="bg-neutral-focus text-neutral-content rounded-full w-8">
                                            <span className="text-xs">
                                                {employe.firstName[0]}
                                                {employe.lastName[0]}
                                            </span>
                                        </div>
                                    </div>
                                    <p>
                                        {employe.firstName} {employe.lastName}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

            </form>
        </dialog>
    );
};
