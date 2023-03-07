// DETECTOR TEMPLATE

// Add output variable name below
let variableName = "student_doing_well"

// Initializations (DO NOT TOUCH)
let detector_output = {
	name: variableName,
	category: "Dashboard",
	value: {
		state: "off", 
		elaboration: "", 
		image: "HTML/Detectors/Images/student_doing_well.svg", 
		suspended: 0
	},
	history: "",
	skill_names: "",
	step_id: "",
	transaction_id: "",
	time: ""
};
let mailer;
/*
 * Declare any custom global variables that will be initialized
 * based on "remembered" values across problem boundaries, here
 * (initialize these at the bottom of this file, inside of self.onmessage)
 */ 
let attemptWindow;
let attemptWindowTimes;

let firstSuspendedTimestamp;
let lastSuspendedTimestamp;
let suspendedDuration = 0;

let isFirstAttempt = true;
let initTime;
let elaborationString = "";

// Declare and/or initialize any other custom global variables for this detector here
let attemptCorrect;
let windowSize = 10;
let threshold = 8;
let stepCounter = {};


function is_first_attempt(e) {
	if (e.data.semantic_event == "UNTUTORED-ACTION") return
	let currStep = e.data.tutor_data.selection;

	if(currStep in stepCounter) {
		stepCounter[currStep] += 1;
		return false;
	}
	else {
		stepCounter[currStep] = 1;
		return true;
	}

}


function firstContributingAttempt(state) {
	let falseAttemptFn = (attemptCorrect) => attemptCorrect == 0;
	let trueAttemptFn = (attemptCorrect) => attemptCorrect == 1;
	if (state) {
		let trueIndex = attemptWindow.findIndex(trueAttemptFn);
		return trueIndex < 0 ?
					 new Date() : attemptWindowTimes[trueIndex];
	}
	else {
		let falseIndex = attemptWindow.findIndex(falseAttemptFn);
		return falseIndex < 0 ?
					 new Date() : attemptWindowTimes[falseIndex];
	}
}

function update_detector( state ) {
	let updateTime = new Date(firstSuspendedTimestamp);
	if (detector_output.value.state == "suspended" && state) {
		suspendedDuration += (new Date()).getTime() - lastSuspendedTimestamp;
		updateTime = new Date(firstSuspendedTimestamp);
	}
	else {
		suspendedDuration = 0;
		updateTime = firstContributingAttempt(state);
	}

	elaborationString = state ? "recently doing well" : "";
	detector_output = {
		...detector_output,
		value: {
			...detector_output.value,
			state: state ? "on" : "off",
			elaboration: elaborationString,
			suspended: suspendedDuration
		},
		time: new Date()//updatetime
	};
	mailer.postMessage(detector_output);
	postMessage(detector_output);
	console.log("output_data = ", detector_output);
}

function receive_transaction( e ) {
	// e is the data of the transaction from mailer from transaction assembler
	if(e.data.tool_data && e.data.tool_data.action && e.data.tool_data.action == "UpdateVariable") {
		console.log("Received update variable transaction in student doing well");
		let broadcastedVar = JSON.parse(e.data.tool_data.input);
		let selection = e.data.tool_data.selection;
		if (selection == "idle" && broadcastedVar.value.state == "on" && detector_output.value.state != "suspended"
					&& detector_output.value.state == "on") {
				if (suspendedDuration == 0) firstSuspendedTimestamp = new Date(detector_output.time);
				lastSuspendedTimestamp = new Date(broadcastedVar.time);
				detector_output = {
					...detector_output,
					value: {
						...detector_output.value,
						state: "suspended",
						elaboration: "",
						suspended: 0
					},
					time: new Date()//firstContributingAttempt(false)
				};
				mailer.postMessage(detector_output);
				postMessage(detector_output);
				console.log("output_data = ", detector_output);
			}
	}

	if(e.data.actor == 'student'  && e.data.tool_data.selection !="done" && e.data.tool_data.action != "UpdateVariable") {
		isFirstAttempt = is_first_attempt(e);
		// exit suspended status
		if (detector_output.value.state == "suspended" && sumCorrect >= threshold && !isFirstAttempt) {
			update_detector(true);
		}
		else if (detector_output.value.state == "suspended" && !(sumCorrect >= threshold) && !isFirstAttempt) {
			update_detector(false);
		}
	}
	/*
	 * Set conditions under which transaction should be processed
	 * (i.e., to update internal state and history, without
	 * necessarily updating external state and history)
	 */ 
	let sumCorrect;
	if(e.data.actor == 'student'  && e.data.tool_data.selection !="done" && isFirstAttempt == true && e.data.tool_data.action != "UpdateVariable") {
		// DO NOT TOUCH
		rawSkills = e.data.tutor_data.skills
		let currSkills = []
		for (let property in rawSkills) {
		    if (rawSkills.hasOwnProperty(property)) {
		        currSkills.push(rawSkills[property].name + "/" + rawSkills[property].category)
		    }
		}
		detector_output.skill_names = currSkills;
		detector_output.step_id = e.data.tutor_data.step_id;

		// Custom processing (insert code here)
		attemptCorrect = (e.data.tutor_data.action_evaluation.toLowerCase() == "correct") ? 1 : 0;
		attemptWindow.shift();
		attemptWindowTimes.shift();
		attemptWindow.push(attemptCorrect);
		attemptWindowTimes.push(new Date(e.data.tutor_data.tutor_event_time));
		detector_output.history = JSON.stringify(attemptWindow);

		sumCorrect = attemptWindow.reduce(function(pv, cv) { return pv + cv; }, 0);
		console.log(attemptWindow);

	}
	/*
	 * Set conditions under which detector should update
	 * external state and history
	 */ 
	if(e.data.actor == 'student' && e.data.tool_data.selection !="done" && isFirstAttempt == true && e.data.tool_data.action != "UpdateVariable") {
		detector_output.time = new Date();
		detector_output.transaction_id = e.data.transaction_id;

		// Custom processing (insert code here)
		if (detector_output.value.state != "on" && sumCorrect >= threshold) {
			update_detector(true);
		}
		else if (detector_output.value.state != "off" && !(sumCorrect >= threshold)) {
			update_detector(false);
		}
		else if (detector_output.value.state=="on" && elaborationString != detector_output.value.elaboration) {
			detector_output = {
				...detector_output, 
				value: {
					...detector_output.value, 
					elaboration: elaborationString
				}
			};
			mailer.postMessage(detector_output);
			postMessage(detector_output);
			console.log("output_data = ", detector_output);
		}
	}
}


self.onmessage = function ( e ) {
    console.log(variableName, " self.onmessage:", e, e.data, (e.data?e.data.commmand:null), (e.data?e.data.transaction:null), e.ports);
    switch( e.data.command )
    {
    case "connectMailer":
		mailer = e.ports[0];
		mailer.onmessage = receive_transaction;
	break;
	case "initialize":
		for (initItem in e.data.initializer) {
			if (e.data.initializer[initItem].name == variableName) {
				detector_output.history = e.data.initializer[initItem].history;
				detector_output.value = e.data.initializer[initItem].value;
			}
		}
		/*
		 * Optional: In "detectorForget", specify conditions under which a detector
		 * should NOT remember their most recent value and history (using the variable "detectorForget").
		 * (e.g., setting the condition to "true" will mean that the detector
		 * will always be reset between problems... and setting the condition to "false"
		 * means that the detector will never be reset between problems)
		 */
		//
		//
		detectorForget = false;
		//
		//

		if (detectorForget) {
			detector_output = {
				...detector_output,
				time: new Date(),
				value: {
					state: "off",
					elaboration: "",
					image: "HTML/Assets/images/student_doing_well.svg",
					suspended: 0
				},
				history: ""
			};
		}
		/*
		 * Optional: If any global variables are based on remembered values across problem boundaries,
		 * these initializations should be written here
		 */
		//
		if (detector_output.history == "" || detector_output.history == null) {
			attemptWindow = Array.apply(null, Array(windowSize)).map(Number.prototype.valueOf,0);
		}
		else {
			attemptWindow = JSON.parse(detector_output.history);
		}
		suspendedDuration = 0;
		attemptWindowTimes = Array.apply(null, Array(windowSize)).map(x => new Date(Date.now()));
		detector_output.time = new Date();
		mailer.postMessage(detector_output);
		postMessage(detector_output);
		console.log("output_data = ", detector_output);

	break;
    default:
	break;

    }

}
