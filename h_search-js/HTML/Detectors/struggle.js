// DETECTOR TEMPLATE

// Add output variable name below
let variableName = "struggle"

// Initializations (DO NOT TOUCH)
let detector_output = {
	name: variableName,
	category: "Dashboard",
	value: {
		state: "off", 
		elaboration: "", 
		image: "HTML/Detectors/Images/struggle.svg", 
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
let intervalID;
let onboardSkills;
let initTime;

// Declare and/or initialize any other custom global variables for this detector here
let firstSuspendedTimestamp;
let lastSuspendedTimestamp;
let suspendedDuration = 0;

let stepCounter = {};
let help_model_output;
let help_variables = {
	"lastAction": "null",
	"lastActionTime": "",
	"seenAllHints": {},
	"lastHintLength": "",
	"lastSenseOfWhatToDo": false
};
let attemptCorrect;
let elaborationString = "";
//
// [Optional] single out TUNABLE PARAMETERS below
let windowSize = 10;
let threshold = 3;
let BKTparams = {
	p_transit: 0.2,
	p_slip: 0.1,
	p_guess: 0.2,
	p_know: 0.25
};
let errorThreshold = 2; // currently arbitrary
let newStepThreshold = 1; // currently arbitrary
let familiarityThreshold = 0.4;
let senseOfWhatToDoThreshold = 0.6;
let hintIsHelpfulPlaceholder = true; // currently a dummy value (assumption that hint is always helpful...)
let seedTime = 25;


/*
 * ###############################
 * #####     Help Model     ######
 * ###############################
 */

// Non-controversial
function lastActionIsHint(e) {
	if (help_variables.lastAction == "hint") {return true;}
	else {return false;}
}
function lastActionIsError(e) {
	if (help_variables.lastAction == "error") {return true;}
	else {return false;}
}
function seenAllHintLevels(e) {
	if (e.data.tutor_data.action_evaluation.toLowerCase() == "hint") {
		if (e.data.tutor_data.selection in help_variables.seenAllHints) {
			return help_variables.seenAllHints[e.data.tutor_data.selection];
		}
		else {return false;}
	}
	else {
		if (e.data.tool_data.selection in help_variables.seenAllHints) {
			return help_variables.seenAllHints[e.data.tool_data.selection];
		}
		else {return false;}
	}
}
function isCorrect(e) {
	if (e.data.tutor_data.action_evaluation.toLowerCase() == "correct") {return true;}
	else {return false;}
}

function secondsSinceLastAction(e) {
	let currTime = new Date();
	diff = currTime.getTime() - help_variables.lastActionTime.getTime();
	console.log("time elapsed: ", diff/1000)
	return (diff / 1000);
}

// Less controversial
function isDeliberate(e) {
	let hintThreshold = (help_variables.lastHintLength/600)*60;

	if (lastActionIsError(e)) {
		return (secondsSinceLastAction(e) > errorThreshold);
	}
	else if (lastActionIsHint(e)) {
		return (secondsSinceLastAction(e) > hintThreshold);
	}
	else {
		return (secondsSinceLastAction(e) > newStepThreshold);
	}
}

// More controversial...
function isFamiliar(e) {
	let rawSkills = onboardSkills;
	for (let property in rawSkills) {
	    if (rawSkills.hasOwnProperty(property)) {
	        if (parseFloat(rawSkills[property]["p_know"])<=familiarityThreshold) {
	        	return false;
	        }
	    }
	}
	return true;
}

function isLowSkillStep_All(e) {
	let rawSkills = onboardSkills;
	for (let property in rawSkills) {
	    if (rawSkills.hasOwnProperty(property)) {
	        if (parseFloat(rawSkills[property]["p_know"])>=familiarityThreshold) {
	        	return false;
	        }
	    }
	}
	return true;
}

function isLowSkillStep_Some(e) {
	let rawSkills = onboardSkills;
	for (let property in rawSkills) {
	    if (rawSkills.hasOwnProperty(property)) {
	        if (parseFloat(rawSkills[property]["p_know"])<=familiarityThreshold) {
	        	return true;
	        }
	    }
	}
	return false;
}

function hintIsHelpful(e) {
	return hintIsHelpfulPlaceholder;
}
function lastActionUnclearFix(e) {
	if (help_variables.lastSenseOfWhatToDo == false) {return true;}
	else {return false;}
}
function senseOfWhatToDo(e) {
	let sel = e.data.tutor_data.selection;
	let rawSkills = onboardSkills;
	for (let property in rawSkills) {
	    if (rawSkills.hasOwnProperty(property)) {
	        if (parseFloat(rawSkills[property]["p_know"])<=senseOfWhatToDoThreshold) {
	        	return false;
	        }
	    }
	}
	return true;
}

function firstContributingAttempt(state) {
	let falseAttemptFn = (numCorrect) => numCorrect > 0;
	let trueAttemptFn = (numCorrect) => numCorrect == 0;
	if (state) {
		let trueIndex = attemptWindow.findIndex(trueAttemptFn);
		return trueIndex < 0 ? new Date() : attemptWindowTimes[trueIndex];
	}
	else {
		let falseIndex = attemptWindow.findIndex(falseAttemptFn);
		return falseIndex < 0 ? new Date() : attemptWindowTimes[falseIndex];
	}
}

// Evaluation of each step
function evaluateAction(e) {
	let sel = e.data.tutor_data.selection;
	let outcome = e.data.tutor_data.action_evaluation.toLowerCase();

	if (e.data.tutor_data.action_evaluation.toLowerCase() == "hint") {
		console.log("isHint")
		if (isDeliberate(e)) {
			console.log("isDeliberate")
			if (!seenAllHintLevels(e) &&
				(!isFamiliar(e)
				|| (lastActionIsError(e) && lastActionUnclearFix(e))
				|| (lastActionIsHint(e) && !hintIsHelpful(e))) ) {
				return "preferred/ask hint";
			}
			else if ( (isFamiliar(e) && !senseOfWhatToDo(e) )
					|| (lastActionIsHint(e)) ) {
				return "acceptable/ask hint";
			}
			else {
				return "not acceptable/hint abuse";
			}

		}
		else {
			console.log("not deliberate")
			return "not acceptable/hint abuse";
		}

	}
	else {
		if (isDeliberate(e)) {
			if ( (isFamiliar(e) && (!(lastActionIsError(e) && lastActionUnclearFix(e))) )
				|| (lastActionIsHint(e) && hintIsHelpful(e))
				 ) {
				return "preferred/try step";
			}
			else if (seenAllHintLevels(e) &&
				     (!(lastActionIsError(e) && lastActionUnclearFix(e))) ) {
				return "preferred/try step";
			}
			else if (isCorrect(e)) {
				return "acceptable/try step";
			}
			else if (seenAllHintLevels(e)) {
				if (lastActionIsError(e) && lastActionUnclearFix(e)) {
					return "ask teacher for help/try step";
				}
			}
			else {
				return "not acceptable/hint avoidance";
			}
		}
		else {
			return "not acceptable/not deliberate";
		}
	}

}

function updateHistory(e) {
	help_variables.lastActionTime = new Date();
	if (e.data.tutor_data.action_evaluation.toLowerCase() == "hint") {
		help_variables.lastAction = "hint";
		help_variables.lastHintLength = e.data.tutor_data.tutor_advice.split(' ').length;
		if (help_variables.seenAllHints[e.data.tutor_data.selection] != true) {
			help_variables.seenAllHints[e.data.tutor_data.selection] = (e.data.tutor_data.current_hint_number == e.data.tutor_data.total_hints_available);
		}
	}
	if (e.data.tutor_data.action_evaluation.toLowerCase() == "incorrect") {
		help_variables.lastAction = "error";
	}
	if (e.data.tutor_data.action_evaluation.toLowerCase() == "correct") {
		help_variables.lastAction = "correct";
	}

	help_variables.lastSenseOfWhatToDo = senseOfWhatToDo(e);
}

/*
 * ###############################
 * ###############################
 * ###############################
 */

function clone(obj) {
    let copy;

    // Handle the 3 simple types, and null or undefined
    if (null == obj || "object" != typeof obj) return obj;

    // Handle Date
    if (obj instanceof Date) {
        copy = new Date();
        copy.setTime(obj.getTime());
        return copy;
    }

    // Handle Array
    if (obj instanceof Array) {
        copy = [];
        for (let i = 0, len = obj.length; i < len; i++) {
            copy[i] = clone(obj[i]);
        }
        return copy;
    }

    // Handle Object
    if (obj instanceof Object) {
        copy = {};
        for (let attr in obj) {
            if (obj.hasOwnProperty(attr)) copy[attr] = clone(obj[attr]);
        }
        return copy;
    }

    throw new Error("Unable to copy obj! Its type isn't supported.");
}

/*
 * ###############################
 * ###############################
 * ###############################
 */

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

	detector_output = {
		...detector_output,
		time: new Date(),
		value: {
			...detector_output.value,
			state: state ? "on" : "off",
			elaboration: elaborationString,
			suspended: suspendedDuration
		},
		history: JSON.stringify([attemptWindow, initTime, onboardSkills]),
		// time: updateTime
	};
	mailer.postMessage(detector_output);
	postMessage(detector_output);
	console.log("output_data = ", detector_output);
}

function receive_transaction( e ) {
	// e is the data of the transaction from mailer from transaction assembler
	/*
	 * Set conditions under which transaction should be processed
	 * (i.e., to update internal state and history, without
	 * necessarily updating external state and history)
	 */ 
	// Added these first checks because things were breaking without it
	if(e.data.tool_data && e.data.tool_data.action && e.data.tool_data.action == "UpdateVariable") {
		console.log("Received update variable transaction in struggle moving average");
		let broadcastedVar = JSON.parse(e.data.tool_data.input);
		let selection = e.data.tool_data.selection;
		if (selection == "idle" && broadcastedVar.value.state == "on" && broadcastedVar.value.state != "suspended"
				&& detector_output.value.state == "on") {
			if (suspendedDuration == 0) firstSuspendedTimestamp = new Date(detector_output.time);
			lastSuspendedTimestamp = new Date(broadcastedVar.time);
			detector_output = {
				...detector_output,
				time: new Date(),
				value: {
					...detector_output.value, 
					state: "suspended", 
					elaboration: elaborationString
				},
				history: JSON.stringify([attemptWindow, initTime, onboardSkills]),
				// time: firstContributingAttempt(false)
			};

			mailer.postMessage(detector_output);
			postMessage(detector_output);
			console.log("output_data = ", detector_output);
		}
	}
	let sumCorrect, p_know_given_obs;
	if(e.data.actor == 'student' && e.data.tool_data.selection !="done" && e.data.tool_data.action != "UpdateVariable") {
		if (e.data.semantic_event == "UNTUTORED-ACTION") return
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
		//

		// ########  BKT  ##########
		let currStep = e.data.tutor_data.selection;
		for (let i in currSkills) {
			let skill = currSkills[i];

			if(!(currStep in stepCounter)) {
				if (!(skill in onboardSkills)) {	// if this skill has not been encountered before
					onboardSkills[skill] = clone(BKTparams);
				}

				let p_know_tminus1 = onboardSkills[skill]["p_know"];
				let p_slip = onboardSkills[skill]["p_slip"];
				let p_guess = onboardSkills[skill]["p_guess"];
				let p_transit = onboardSkills[skill]["p_transit"];

				console.log(onboardSkills[skill]["p_know"]);


				if (e.data.tutor_data.action_evaluation.toLowerCase()=="correct") {
					p_know_given_obs = (p_know_tminus1*(1-p_slip))/( (p_know_tminus1*(1-p_slip)) + ((1-p_know_tminus1)*p_guess) );
				}
				else {
					p_know_given_obs = (p_know_tminus1*p_slip)/( (p_know_tminus1*p_slip) + ((1-p_know_tminus1)*(1-p_guess)) );
				}

				onboardSkills[skill]["p_know"] = p_know_given_obs + (1 - p_know_given_obs)*p_transit;

				// following TutorShop, round down to two decimal places
				onboardSkills[skill]["p_know"] = Math.floor(onboardSkills[skill]["p_know"] * 100) / 100;

				console.log("engine BKT: ", e.data.tutor_data.skills[0].pKnown);
				console.log(onboardSkills[skill]["p_know"]);
			}

		}

		// Keep track of num attempts on each step
		if(currStep in stepCounter) {
			stepCounter[currStep] += 1;
		}
		else {
			stepCounter[currStep] = 1;
		}

		// #######

		if (help_variables.lastAction!="null") {
			help_model_output = evaluateAction(e);
		}
		else {
			help_model_output = "preferred"; // first action in whole tutor is set to "preferred" by default
		}

		// attemptCorrect = (e.data.tutor_data.action_evaluation.toLowerCase() == "correct") ? 1 : 0;
		// attemptWindow.shift();
		// attemptWindow.push(attemptCorrect);

		// Ignore further hint requests if student has already seen all hint levels for this step (i.e., these do not contribute to struggle detector)
		if(seenAllHintLevels(e) && e.data.tutor_data.action_evaluation.toLowerCase() == "hint") {
			console.log("is hint request on step for which student has already seen all hints: no direct/immediate effect on struggle detector");
		}
		else {
			attemptCorrect = (e.data.tutor_data.action_evaluation.toLowerCase() == "correct") ? 1 : 0;
			attemptWindow.shift();
			attemptWindowTimes.shift();
			attemptWindow.push(attemptCorrect);
			attemptWindowTimes.push(new Date(e.data.tutor_data.tutor_event_time));
		}

		if (help_model_output == "ask teacher for help/try step") {
			for(let i=0; i<(windowSize-threshold); i++) {
				attemptWindow.shift();
				attemptWindowTimes.shift();
				attemptWindow.push(0)
			};
			attemptWindowTimes.push(new Date(e.data.tutor_data.tutor_event_time));
		}

		sumCorrect = attemptWindow.reduce(function(pv, cv) { return pv + cv; }, 0);
		console.log(attemptWindow);

		updateHistory(e);
		console.log(help_model_output);

	}
	/*
	 * set conditions under which detector should update
	 * external state and history
	 */ 
	if(e.data.actor == 'student' && e.data.tool_data.selection !="done" && e.data.tool_data.action != "UpdateVariable") {
		detector_output.time = new Date();
		detector_output.transaction_id = e.data.transaction_id;

		// Custom processing (insert code here)

		// Elaboration string
		if (sumCorrect<=threshold) {
			if(help_model_output == "ask teacher for help/try step") {
				elaborationString = "not understanding hints";
			}
			else if(help_model_output == "not acceptable/hint avoidance") {
				elaborationString = "not using hints";
			}
			else {
				elaborationString = "making errors often";
			}
		}
		else {
			elaborationString = "";
		}


		if (detector_output.value.state!="on" && (sumCorrect <= threshold)) {
			update_detector(true);
		}
		else if (detector_output.value.state!="off" && !(sumCorrect <= threshold)) {
			update_detector(false);
		}
		else if (detector_output.value.state=="on" && elaborationString != detector_output.value.elaboration) {
			detector_output = {
				...detector_output, 
				time: new Date(),
				value: {
					...detector_output.value, 
					elaboration: elaborationString
				}
			};
			mailer.postMessage(detector_output);
			postMessage(detector_output);
			console.log("output_data = ", detector_output);
		}
		else if (detector_output.value.state=="off") {
			console.log(detector_output);
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
				history: "",
				value: {
					state: "off",
					elaboration: "",
					image: "HTML/Assets/images/struggle-01.png",
					suspended: 0
				}
			};
		}
		/*
		 * Optional: If any global variables are based on remembered values across problem boundaries,
		 * these initializations should be written here
		 */
		//
		if (detector_output.history == "" || detector_output.history == null) {
			attemptWindow = Array.apply(null, Array(windowSize)).map(Number.prototype.valueOf,1);
			attemptWindowTimes = Array.apply(null, Array(windowSize)).map(x => new Date(Date.now()));
			onboardSkills = {};
		}
		else {
			let all_history = JSON.parse(detector_output.history);
			attemptWindow = all_history[0];
			attemptWindowTimes = Array.apply(null, Array(windowSize)).map(x => new Date(Date.now()));
			initTime = new Date(all_history[1]);
			onboardSkills = all_history[2];
		}
		suspendedDuration = 0;
		detector_output.time = new Date();
		mailer.postMessage(detector_output);
		postMessage(detector_output);
		console.log("output_data = ", detector_output);

	break;
    default:
	break;

    }

}
