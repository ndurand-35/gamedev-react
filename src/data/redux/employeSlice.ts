import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { Candidate, Employe } from "@/data/interface";
import { generateNewEmploye } from "@/data/utils/employe";

// const generateCandidateList = createAsyncThunk("candidate/generate", (data, thunkAPI) => {
//     let state: RootState = thunkAPI.getState() as RootState;
// });

export interface EmployeState {
    employeList: Employe[];
    candidateList: Candidate[];
    stopCandidateGeneration : boolean;
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
    stopCandidateGeneration  : false,
    lastCandidateGeneration: -168,
};

export const employeSlice = createSlice({
    name: "employe",
    initialState,
    reducers: {
        setStopCandidateGeneration(state,action :PayloadAction<boolean>){
            console.log(action.payload)
            state.stopCandidateGeneration = action.payload
        },
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
            if (!state.stopCandidateGeneration && action.payload.time - state.lastCandidateGeneration > 168) {
                state.lastCandidateGeneration = action.payload.time;
                state.candidateList = generateNewEmploye(action.payload.reputation);
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
export const { setStopCandidateGeneration, fired, hire, generateCandidateList } = employeSlice.actions;

export default employeSlice.reducer;
