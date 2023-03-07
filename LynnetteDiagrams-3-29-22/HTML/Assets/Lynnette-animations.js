var currentRow = 0

function showNextRow() {
  document.getElementById(`solve${++currentRow}Group`).parentNode.style.display = 'flex'
}

tutorInitializer.then(() => {
  updateDone()
  addFeedbackListener()
  addHintWindowListener()
  // adjustSkills()
  // addSkillListener()
})

function updateDone() {
  document.getElementById('doneButton').getElementsByClassName('CTAT-done-button--text')[0].innerHTML = 'Finish Problem'
}

function addFeedbackListener() {
  CTATCommShell.commShell.addGlobalEventListener({
    processCommShellEvent: function(event, message) {
      // console.log('EVENT', event, 'MESSAGE', message)
      if (event == 'AssociatedRules' && message) {
        let indicator = message.getIndicator(),
            sai = message.getSAI(),
            selection = (sai ? sai.getSelection() : '_noSuchComponent_'),
            selectionElement = document.getElementById(selection)
        if (selectionElement && selectionElement.classList.contains('animate'))
          window.setTimeout(delayIndicator, 700, selection, indicator)
      }
    }
  })
}

function delayIndicator(selection, indicator) {
  let indicatorBox = document.getElementById(selection + 'Feedback'),
      currentIndicatorElement = indicatorBox.firstChild,
      newIndicatorElement = document.createElement('span')
  if (indicator == 'Hint') {
    newIndicatorElement.innerHTML = '?'
    newIndicatorElement.classList.add('cross')
  } else if (indicator == 'InCorrect') {
    newIndicatorElement.innerHTML = '&#10005'
    newIndicatorElement.classList.add('cross')
  } else if (indicator == 'Correct') {
    newIndicatorElement.innerHTML = '&#10003'
    newIndicatorElement.classList.add('tick')
  }
  if (!currentIndicatorElement) indicatorBox.appendChild(newIndicatorElement)
  else indicatorBox.replaceChild(newIndicatorElement, currentIndicatorElement)
}

function addHintWindowListener() {
  CTATCommShell.commShell.addGlobalEventListener({
    processCommShellEvent: function(event, message) {
      if (event == 'AssociatedRules' && message)
        document.getElementById('HintWindow').style.display = message.getProperty('TutorAdvice') ? 'flex' : 'none'
      if (event == 'InterfaceAction' && message && typeof message == 'object') {
        let sai = message.getSAI(),
            selection = (sai ? sai.getSelection() : '_noSuchComponent_')
        if (sai.getAction() == 'SetVisible')
          document.getElementById(selection).style.display = 'flex'
      }
    }
  })
}

function addSkillListener() {
  CTATCommShell.commShell.addGlobalEventListener({
    processCommShellEvent: function(event) {
      if (event == 'ProblemRestoreEnd') {
        console.log('ProblemRestoreEnd')
        adjustSkills()
      }
    }
  })
}

function adjustSkills() {
  console.log('adjustSkills')
  Array.prototype.forEach.call(document.getElementsByClassName('CTATSkillWindow--bar'), skillBarElement => {
    let initialElement = document.createElement('div')
    initialElement.classList.add('CTATSkillWindow--initial')
    initialElement.style.width = skillBarElement.firstChild.style.width
    skillBarElement.append(initialElement)
  })
}

// function addSkillListener() {
//   let initialSkills = []
//   CTATCommShell.commShell.addGlobalEventListener({
//     processCommShellEvent: function(event, message) {
//       if (event == 'ProblemRestoreEnd') {
//         console.log('ProblemRestoreEnd')
//         window.message = message
//         initialSkills = message.getSkillsObject().getSkillSet()
//         setInitialSkills(initialSkills)
//       } else if (event == 'AssociatedRules' && message) {
//         console.log('AssociatedRules')
//         window.message = message
//         let atLeastOne = false,
//             skillElementLabels = document.getElementsByClassName('CTATSkillWindow--label')
//         message.getSkillsObject().getSkillSet().forEach(skill => {
//           let label = skill.getSkillName(),
//               labelElement = skillElementLabels.find(labelElement => labelElement.innerHTML == label)
//           if (labelElement) {
//             atLeastOne = true
//             labelElement.parentNode.classList.add('focusProgress')
//           }
//         })
//         setInitialSkills(initialSkills)
//         if (atLeastOne) {
//           skillElementLabels.forEach(labelElement => {
//             let parentElement = labelElement.parentNode
//             if (!parentElement.classList.contains('focusProgress')) parentElement.classList.add('blurProgress')
//           })
//           window.setTimeout(() => {
//             document.getElementsByClassName('CTATSkillWindow--skill').foreach(skillBar =>
//               skillBar.classList.remove('focusProgress', 'blurProgress')
//             )
//           }, 2000)
//         }
//       }
//     }
//   })
// }

// function setInitialSkills(skills) {
//   let skillElementLabels = document.getElementsByClassName('CTATSkillWindow--label')
//   skills.forEach(skill => {
//     let label = skill.getSkillName(),
//         level = skill.getLevel(),
//         labelElement = skillElementLabels.forEach(labelElement => labelElement.innerHTML == label)
//     if (labelElement) {
//       let focus = labelElement.previousSibling,
//           width = focus.offsetWidth,
//           element = document.createElement('div')
//       element.classList.add('CTATSkillWindow--initial')
//       element.style.width = level * width + 'px'
//       focus.firstChild.append(element)
//     }
//   })
// }
