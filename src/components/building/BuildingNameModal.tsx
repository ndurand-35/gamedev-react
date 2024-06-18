import { Building } from "@/data/interface";
import { FieldApi, createFormFactory } from "@tanstack/react-form";
import { FC } from "react";

function FieldInfo({ field }: { field: FieldApi<any, any, any, any> }) {
    return (
        <>
            {field.state.meta.touchedErrors ? <em>{field.state.meta.touchedErrors}</em> : null}
            {field.state.meta.isValidating ? "Validating..." : null}
        </>
    );
}

export interface BuildingNameModalProps {
    building: Building;
    setCurrentBuilding: (building: Building | null) => void;
}

export const BuildingNameModal: FC<BuildingNameModalProps> = ({ building, setCurrentBuilding }) => {
    const formFactory = createFormFactory<Building>({ defaultValues: building });

    const form = formFactory.useForm({
        onSubmit: async ({ value }) => {
            console.log(value);
        },
    });

    return (
        <>
            <dialog id="building_name_modal" className="modal">
                <div className="modal-box">
                    <form
                        method="dialog"
                        onSubmit={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            form.handleSubmit();
                        }}
                    >
                        <h3 className="font-bold text-lg">Changer le nom</h3>
                        <p className="py-4">
                            <form.Field
                                name="name"
                                children={(field) => (
                                    <>
                                        <input
                                            className="input input-bordered w-full text-black"
                                            value={field.state.value}
                                            onBlur={field.handleBlur}
                                            onChange={(e) => field.handleChange(e.target.value)}
                                        />
                                        <FieldInfo field={field} />
                                    </>
                                )}
                            />
                        </p>
                        <div className="modal-action">
                            <form.Subscribe
                                selector={(state) => [state.canSubmit, state.isSubmitting]}
                                children={([canSubmit, isSubmitting]) => (
                                    <>
                                        <button type="submit" disabled={!canSubmit} className="btn btn-primary">
                                            {isSubmitting ? "..." : "Valider"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                (document.getElementById("building_name_modal") as HTMLFormElement)?.close();
                                                setCurrentBuilding(null);
                                            }}
                                            className="btn"
                                        >
                                            Annuler
                                        </button>
                                    </>
                                )}
                            />
                        </div>
                    </form>
                </div>
            </dialog>
        </>
    );
};
