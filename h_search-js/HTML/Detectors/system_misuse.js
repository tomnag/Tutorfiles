// DETECTOR TEMPLATE

// Add output variable name below
let variableName = "system_misuse"

// Initializations (do not touch)
let detector_output = {
	name: variableName,
	category: "Dashboard",
	value: {
		state: "off", 
		elaboration: "", 
		image: "HTML/Detectors/Images/system_misuse.svg", 
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
let initTime;
let lastTrigger;
let intervalID;
let onboardSkills;

let firstSuspendedTimestamp;
let lastSuspendedTimestamp;
let suspendedDuration = 0;

// Declare and/or initialize any other custom global variables for this detector here...
let stepCounter = {};
let help_model_output;
let help_variables = {
	"lastAction": "null",
	"lastActionTime": "",
	"seenAllHints": {},
	"lastHintLength": "",
	"lastSenseOfWhatToDo": false
};
let elaborationString = "";
//
// [Optional] single out TUNABLE PARAMETERS below
let windowSize = 10; // arbitrary: need to tune
let threshold = 3; // arbitrary: need to tune
let BKTparams = {
	p_transit: 0.2,
	p_slip: 0.1,
	p_guess: 0.2,
	p_know: 0.25
};
let errorThreshold = 2; // currently somewhat arbitrary
let newStepThreshold = 1; // currently somewhat arbitrary
let familiarityThreshold = 0.4;
let senseOfWhatToDoThreshold = 0.6;
let hintIsHelpfulPlaceholder = true; // currently a dummy value (assumption that hint is always helpful...)
let seedTime = 25;

/*
 * ###############################
 * ###############################
 * ###############################
 */

function firstContributingAttempt(state) {
	let falseAttemptFn = (numCorrect) => numCorrect == 0;
	let trueAttemptFn = (numCorrect) => numCorrect == 1;
	if (state) {
		let trueIndex = attemptWindow.findIndex(trueAttemptFn);
		return trueIndex < 0 ? new Date() : attemptWindowTimes[trueIndex];
	} else {
		let falseIndex = attemptWindow.findIndex(falseAttemptFn);
		return falseIndex < 0 ? new Date() : attemptWindowTimes[falseIndex];
	}
}

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


// ##############

function is_gaming(e) {
	return false;
}

function is_abusing_hints(help_model_output) {
	return help_model_output == "hint abuse";
}

function is_not_deliberate(help_model_output) {
	return help_model_output == "not deliberate";
}

/*
 * ###############################
 * ###############################
 * ###############################
 */

// Non-controversial
function lastActionIsHint(e) {
	return help_variables.lastAction == "hint";
}
function lastActionIsError(e) {
	return help_variables.lastAction == "error";
}
function seenAllHintLevels(e) {
	// TODO: This would remove the need of the convoluted else statement
	// const isHintAction = e.data.tutor_data.action_evaluation.toLowerCase() == "hint"
	// const {selection} = isHintAction ? e.data.tool_data : e.data.tutor_data
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
	return e.data.tutor_data.action_evaluation.toLowerCase() == "correct";
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

// ? Why is this practically the same function as isLowSkillStep_Some
// It seems to go through each skill isn't that strange?
// More controversial...
function isFamiliar(e) {
	let rawSkills = onboardSkills;
	for (let property in rawSkills) {
	    if (rawSkills.hasOwnProperty(property)) {
	        if (parseFloat(rawSkills[property]['p_know'])<=familiarityThreshold) {
	        	return false;
	        }
	    }
	}
	return true;
}
// TODO: Only difference between Some is the >= and truth value, so merge these together
function isLowSkillStep_All(e) {
	let rawSkills = onboardSkills;
	for (let property in rawSkills) {
	    if (rawSkills.hasOwnProperty(property)) {
	        if (parseFloat(rawSkills[property]['p_know'])>=familiarityThreshold) {
	        	return false;
	        }
	    }
	}
	return true;
}

function isLowSkillStep_Some(e) {
	// return !isFamiliar(e)
	let rawSkills = onboardSkills;
	for (let property in rawSkills) {
	    if (rawSkills.hasOwnProperty(property)) {
	        if (parseFloat(rawSkills[property]['p_know'])<=familiarityThreshold) {
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
	return !help_variables.lastSenseOfWhatToDo;
}
function senseOfWhatToDo(e) {
	let sel = e.data.tutor_data.selection;
	let rawSkills = onboardSkills;
	for (let property in rawSkills) {
	    if (rawSkills.hasOwnProperty(property)) {
	        if (parseFloat(rawSkills[property]['p_know'])<=senseOfWhatToDoThreshold) {
	        	return false;
	        }
	    }
	}
	return true;
}

/*
 * ###############################
 * ###############################
 * ###############################
 */

// Evaluation of each step
function evaluateAction(e) {
	var sel = e.data.tutor_data.selection;
	var outcome = e.data.tutor_data.action_evaluation.toLowerCase();

	if (e.data.tutor_data.action_evaluation.toLowerCase() == "hint"){
		console.log("isHint")
		if (isDeliberate(e)){
			console.log("isDeliberate")
			if (isLowSkillStep_Some(e) && !lastActionIsError(e)){ //possible modifications...unless wheel-spinning? ... or even closer to Ido's would be to get rid of the "unless last step was error" qualification?
				return("not acceptable/asked hint on low skill step");
			}
			else{
				if (!seenAllHintLevels(e) &&
					(!isFamiliar(e)
					|| (lastActionIsError(e) && lastActionUnclearFix(e))
					|| (lastActionIsHint(e) && !hintIsHelpful(e))) ){
					return "preferred/ask hint";
				}
				else if ( (isFamiliar(e) && !senseOfWhatToDo(e) )
						|| (lastActionIsHint(e)) ){
					return "acceptable/ask hint";
				}
				else{
					return "hint abuse";
				}
			}
		}
		else{
			console.log("not deliberate")
			return "hint abuse";
		}

	}
	else{
		if (isLowSkillStep_Some(e) && !lastActionIsError(e)){ //possible modifications...unless wheel-spinning? ... or even closer to Ido's would be to get rid of the "unless last step was error" qualification?
				return("preferred/try step on low skill step");
			}
		else{
			if (isDeliberate(e)){
				if ( (isFamiliar(e) && (!(lastActionIsError(e) && lastActionUnclearFix(e))) )
					|| (lastActionIsHint(e) && hintIsHelpful(e))
					 ){
					return "preferred/try step";
				}
				else if (seenAllHintLevels(e) &&
					     (!(lastActionIsError(e) && lastActionUnclearFix(e))) ){
					return "preferred/try step";
				}
				else if (isCorrect(e)){
					return "acceptable/try step";
				}
				else if (seenAllHintLevels(e)){
					if (lastActionIsError(e) && lastActionUnclearFix(e)){
						return "ask teacher for help";
					}
				}
				else{
					return "hint avoidance";
				}
			}
			else{
				return "not deliberate";
			}
		}
	}
	// let sel = e.data.tutor_data.selection;
	// let outcome = e.data.tutor_data.action_evaluation.toLowerCase();

	// if (e.data.tutor_data.action_evaluation.toLowerCase() == "hint") {
	// 	console.log("isHint")
	// 	if (isDeliberate(e)) {
	// 		console.log("isDeliberate")
	// 		if (isLowSkillStep_Some(e) && !lastActionIsError(e)) { // possible modifications...unless wheel-spinning? ... or even closer to Ido's would be to get rid of the "unless last step was error" qualification?
	// 			return("not acceptable/asked hint on low skill step");
	// 		}
	// 		else {
	// 			if (!seenAllHintLevels(e) &&
	// 				(!isFamiliar(e)
	// 				 || (lastActionIsError(e) && lastActionUnclearFix(e))
	// 				 || (lastActionIsHint(e) && !hintIsHelpful(e))) ) {
	// 				return "preferred/ask hint";
	// 			}
	// 			else if ( (isFamiliar(e) && !senseOfWhatToDo(e) )
	// 					|| (lastActionIsHint(e)) ) {
	// 				return "acceptable/ask hint";
	// 			}
	// 			else {
	// 				return "hint abuse";
	// 			}
	// 		}
	// 	}
	// 	else {
	// 		console.log("not deliberate")
	// 		return "hint abuse";
	// 	}

	// } else {
	// 	if (isLowSkillStep_Some(e) && !lastActionIsError(e)) { // possible modifications...unless wheel-spinning? ... or even closer to Ido's would be to get rid of the "unless last step was error" qualification?
	// 			return("preferred/try step on low skill step");
	// 		}
	// 	else {
	// 		if (isDeliberate(e)) {
	// 			if ( (isFamiliar(e) && (!(lastActionIsError(e) && lastActionUnclearFix(e))) )
	// 				 || (lastActionIsHint(e) && hintIsHelpful(e)) ) {
	// 				return "preferred/try step";
	// 			}
	// 			else if (seenAllHintLevels(e) &&
	// 				     (!(lastActionIsError(e) && lastActionUnclearFix(e))) ) {
	// 				return "preferred/try step";
	// 			}
	// 			else if (isCorrect(e)) {
	// 				return "acceptable/try step";
	// 			}
	// 			else if (seenAllHintLevels(e)) {
	// 				if (lastActionIsError(e) && lastActionUnclearFix(e)) {
	// 					return "ask teacher for help";
	// 				}
	// 			}
	// 			else {
	// 				return "hint avoidance";
	// 			}
	// 		}
	// 		else {
	// 			return "not deliberate";
	// 		}
	// 	}
	// }
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
	else if (e.data.tutor_data.action_evaluation.toLowerCase() == "incorrect") {
		help_variables.lastAction = "error";
	}
	else {
		help_variables.lastAction = "correct";
	}

	help_variables.lastSenseOfWhatToDo = senseOfWhatToDo(e);

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
		history: JSON.stringify([attemptWindow, initTime, lastTrigger, onboardSkills]),
		// TODO: Remove updateTime from the code
		// time: updateTime 
	};

	mailer.postMessage(detector_output);
	postMessage(detector_output);
	console.log("update_detector output_data = ", detector_output);
}

function receive_transaction( e ) {
	// e is the data of the transaction from mailer from transaction assembler
	/*
	 * Set conditions under which transaction should be processed
	 * (i.e., to update internal state and history, without
	 * necessarily updating external state and history)
	 */ 
	let isGaming, isAbusingHints, isNotDeliberate, sumAskTeacherForHelp;
	if(e.data.tool_data && e.data.tool_data.action && e.data.tool_data.action == "UpdateVariable") {
		console.log("Received update variable transaction in system misuse");
		let broadcastedVar = JSON.parse(e.data.tool_data.input);
		let selection = e.data.tool_data.selection;
		if (selection == "idle" && broadcastedVar.value.state == "on" && detector_output.value.state != "suspended"
				&& detector_output.value.state == "on") {
			if (suspendedDuration == 0) firstSuspendedTimestamp = new Date(detector_output.time);
			lastSuspendedTimestamp = new Date(broadcastedVar.time);
			detector_output = {
				...detector_output,
				time: new Date(),
				history: JSON.stringify([attemptWindow, initTime, lastTrigger, onboardSkills]),
				value: {
					...detector_output.value, 
					state: "suspended", 
					elaboration: elaborationString
				}
			};
			mailer.postMessage(detector_output);
			postMessage(detector_output);
			console.log("UpdateVariable output_data = ", detector_output);
		}
	}
	if(e.data.actor == 'student' && e.data.tool_data.selection !="done" && e.data.tool_data.action != "UpdateVariable") {
		if (e.data.semantic_event == "UNTUTORED-ACTION") return
		// DO NOT TOUCH
		rawSkills = e.data.tutor_data.skills;
		let currSkills = [];
		for (let property in rawSkills) {
		    if (rawSkills.hasOwnProperty(property)) {
		        currSkills.push(rawSkills[property].name + "/" + rawSkills[property].category)
		    }
		}
		detector_output.skill_names = currSkills;
		detector_output.step_id = e.data.tutor_data.step_id;

		// Custom processing (insert code here)

		// ########  BKT  ##########
		let currStep = e.data.tutor_data.selection;
		for (let i in currSkills) {
			let skill = currSkills[i];

			if(!(currStep in stepCounter)) {
				if (!(skill in onboardSkills)) { // if this skill has not been encountered before
					onboardSkills[skill] = clone(BKTparams);
				}

				let p_know_tminus1 = onboardSkills[skill]["p_know"];
				let p_slip = onboardSkills[skill]["p_slip"];
				let p_guess = onboardSkills[skill]["p_guess"];
				let p_transit = onboardSkills[skill]["p_transit"];
				let p_know_given_obs;

				console.log(onboardSkills[skill]["p_know"]);


				if (e.data.tutor_data.action_evaluation.toLowerCase()=="correct") {
					p_know_given_obs = (p_know_tminus1*(1-p_slip))/( (p_know_tminus1*(1-p_slip)) + ((1-p_know_tminus1)*p_guess) );
				}
				else {
					p_know_given_obs = (p_know_tminus1*p_slip)/( (p_know_tminus1*p_slip) + ((1-p_know_tminus1)*(1-p_guess)) );
				}

				onboardSkills[skill]["p_know"] = p_know_given_obs + (1 - p_know_given_obs)*p_transit;

				// Following TutorShop, round down to two decimal places
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

		// ###########

		if (help_variables.lastAction!="null") {
			help_model_output = evaluateAction(e);
		}
		else {
			help_model_output = "preferred"; // first action in whole tutor is set to "preferred" by default
		}

		console.log(help_model_output);


		isGaming = is_gaming(e);
		isAbusingHints = is_abusing_hints(help_model_output);
		isNotDeliberate = is_not_deliberate(help_model_output);

		console.log(isGaming);
		console.log(isAbusingHints);
		console.log(isNotDeliberate);

		attemptWindow.shift();
		attemptWindowTimes.shift();
		attemptWindow.push( (isGaming || isAbusingHints || isNotDeliberate) ? 1 : 0 );
		attemptWindowTimes.push( new Date(e.data.tutor_data.tutor_event_time) );
		sumAskTeacherForHelp = attemptWindow.reduce(function(pv, cv) { return pv + cv; }, 0);
		console.log(attemptWindow);

		updateHistory(e);

	}
	/*
	 * Set conditions under which detector should update
	 * external state and history
	 */ 
	if(e.data.actor == 'student' && e.data.tool_data.selection !="done" && e.data.tool_data.action != "UpdateVariable") {
		detector_output.time = new Date();
		detector_output.transaction_id = e.data.transaction_id;

		// Custom processing (insert code here)

		if (isGaming) lastTrigger = "isGaming";
		else if (isAbusingHints) lastTrigger = "isAbusingHints";
		else lastTrigger = "isNotDeliberate?";

		// Elaboration string
		if (sumAskTeacherForHelp >= threshold) {
			if (isGaming) elaborationString = "frequently guessing";
			else if (isAbusingHints) elaborationString = "possibly abusing hints";
			else elaborationString = "making fast attempts in a row";
		}
		// TODO: Elaboration strings should never be empty
		// TODO: History should be separated and then I should create two functions probably
		// Detector needs to maintain as many states as elaboration strings
		else {
			elaborationString = "";
		}

		if (detector_output.value.state!="on" && (sumAskTeacherForHelp >= threshold)) {
			update_detector(true);
		}
		else if (detector_output.value.state!="off" && !(sumAskTeacherForHelp >= threshold)) {
			update_detector(false);
		}
		// TODO: Check what is happening here very thoroughly
		else if (detector_output.value.state=="on" && elaborationString != detector_output.value.elaboration) {
			detector_output = {
				...detector_output, 
				time: new Date(),
				value: {
					...detector_output.value, 
					elaboration: elaborationString
				}
			};
			if (detector_output.value.elaboration == elaborationString) {
				mailer.postMessage(detector_output);
				postMessage(detector_output);
				console.log("On output_data = ", detector_output);
			}
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
					image: "HTML/Assets/images/system_misuse.svg", 
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
			/*
			 * In the event that the detector history is empty,
			 * initialize variables to your desired 'default' values
			 */
			attemptWindow = Array.apply(null, Array(windowSize)).map(Number.prototype.valueOf,0);
			onboardSkills = {};
		}
		else {
			/* 
			 * If the detector history is not empty, you can access it via:
			 *     JSON.parse(detector_output.history);
			 * ...and initialize your variables to your desired values, based on
			 * this history
			 */
			let all_history = JSON.parse(detector_output.history);
			attemptWindow = all_history[0];
			initTime = new Date(all_history[1]);
			lastTrigger = all_history[2];
			onboardSkills = all_history[3];
		}
		suspendedDuration = 0;
		attemptWindowTimes = Array.apply(null, Array(windowSize)).map(x => new Date(Date.now()));
		console.log(attemptWindowTimes)
		detector_output = {
			...detector_output, 
			elaboration: "",
			time: new Date()
		};
		mailer.postMessage(detector_output);
		postMessage(detector_output);
		console.log("Initialize output_data = ", detector_output);


	break;
    default:
	break;

    }

}
