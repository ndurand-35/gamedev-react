export interface Person {
	id: number;
	sex: string;
	firstName: string;
	lastName: string;

	salary: number
}


export interface Candidate extends Person {

}



export interface Employe extends Person {
	buildingId: number;


}
