import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { Person } from "@/data/interface";
import { generateNewEmploye } from "@/data/utils/employe";
import { DEFAULT_EMPLOYE_STATE } from "@/data/utils/constant";

// const generateCandidateList = createAsyncThunk("candidate/generate", (data, thunkAPI) => {
//     let state: RootState = thunkAPI.getState() as RootState;
// });

export interface EmployeState {
	employeList: Person[];
	candidateList: Person[];
	stopCandidateGeneration: boolean;
	lastCandidateGeneration: number;
}

const initialState: EmployeState = {
	employeList: [],
	candidateList: [],
	stopCandidateGeneration: false,
	lastCandidateGeneration: -168,
};

export const employeSlice = createSlice({
	name: "employe",
	initialState,
	reducers: {
		initializeEmployeState(state, action: PayloadAction<Person>) {
			state.employeList = [...DEFAULT_EMPLOYE_STATE.employeList, action.payload];
			state.candidateList = DEFAULT_EMPLOYE_STATE.candidateList
			state.stopCandidateGeneration = DEFAULT_EMPLOYE_STATE.stopCandidateGeneration;
			state.lastCandidateGeneration = DEFAULT_EMPLOYE_STATE.lastCandidateGeneration;
		},
		setStopCandidateGeneration(state, action: PayloadAction<boolean>) {
			state.stopCandidateGeneration = action.payload;
		},
		fired(state, action: PayloadAction<number>) {
			state.employeList = state.employeList.filter((e: Person) => e.id !== action.payload);
		},
		hire(state, action: PayloadAction<number>) {
			let candidate = state.candidateList.find((c: Person) => c.id === action.payload);
			if (candidate != null) {
				state.employeList = [...state.employeList, { ...candidate, id: state.employeList.length + 1 } as Person];
				state.candidateList = state.candidateList.filter((c: Person) => c.id !== action.payload);
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
export const { setStopCandidateGeneration, fired, hire, generateCandidateList, initializeEmployeState } = employeSlice.actions;

export default employeSlice.reducer;
