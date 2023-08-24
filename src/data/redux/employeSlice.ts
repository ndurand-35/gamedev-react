import { SexType, faker } from "@faker-js/faker";

import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { Candidate, Employe } from "@/data/interface";

// const generateCandidateList = createAsyncThunk("candidate/generate", (data, thunkAPI) => {
//     let state: RootState = thunkAPI.getState() as RootState;
// });

export interface EmployeState {
    employeList: Employe[];
    candidateList: Candidate[];
    lastCandidateGeneration: number;
}

const initialState: EmployeState = {
    employeList: [
        {
            id: 1,
            buildingId: 1,
            sex: "male",
            firstName: "Nicolas",
            lastName: "Durand",
            salary: 0,
        },
    ],
    candidateList: [],
    lastCandidateGeneration: -168,
};

export const employeSlice = createSlice({
    name: "employe",
    initialState,
    reducers: {
        fired(state, action: PayloadAction<number>) {
            state.employeList = state.employeList.filter((e: Employe) => e.id !== action.payload);
        },
        hire(state, action: PayloadAction<number>) {
            let candidate = state.candidateList.find((c: Candidate) => c.id === action.payload);
            if (candidate != null) {
                state.employeList = [...state.employeList, { ...candidate, id: state.employeList.length + 1 } as Employe];
                state.candidateList = state.candidateList.filter((c: Candidate) => c.id !== action.payload);
            }
        },
        generateCandidateList(state, action: PayloadAction<{ reputation: number; time: number }>) {
            if (action.payload.time - state.lastCandidateGeneration > 168) {
                state.lastCandidateGeneration = action.payload.time;
                let sex = faker.person.sex();
                state.candidateList = [
                    {
                        id: 1,
                        sex,
                        firstName: faker.person.firstName(sex as SexType),
                        lastName: faker.person.firstName(sex as SexType),
                        salary: 1200,
                    },
                ];
            }
        },
    },
    // extraReducers: (builder) => {
    //     builder.addCase(generateCandidateList.fulfilled, (state, action) => {
    //         state.candidateList = action.payload;
    //     });
    // },
});

// Action creators are generated for each case reducer function
export const { fired, hire, generateCandidateList } = employeSlice.actions;

export default employeSlice.reducer;
