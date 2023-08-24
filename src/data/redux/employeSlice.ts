import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { Employe } from "@/data/interface";
import { RootState } from "@/data/redux/store";

const generateCandidateList = createAsyncThunk("candidate/generate", (data, thunkAPI) => {
    let state: RootState = thunkAPI.getState() as RootState;
    console.log(state.company.reputation);
    return [
        {
            id: 1,
            buildingId: 1,
            firstName: "Nicolas",
            lastName: "Durand",
        },
    ];
});

export interface EmployeState {
    employeList: Employe[];
    candidateList: Employe[];
}

const initialState: EmployeState = {
    employeList: [
        {
            id: 1,
            buildingId: 1,
            firstName: "Nicolas",
            lastName: "Durand",
        },
        {
            id: 1,
            buildingId: 1,
            firstName: "John",
            lastName: "Doe",
        },
    ],
    candidateList: [],
};

export const employeSlice = createSlice({
    name: "employe",
    initialState,
    reducers: {

    },
    extraReducers: (builder) => {
        builder.addCase(generateCandidateList.fulfilled, (state, action) => {
            state.candidateList = action.payload;
        });
    },
});

// Action creators are generated for each case reducer function
export const { } = employeSlice.actions;

export default employeSlice.reducer;
