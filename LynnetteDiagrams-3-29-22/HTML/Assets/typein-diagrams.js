const diagramCount = 3
let tutorCondition, algebraParser, steps = [], equations = [], diagrams = []

function chooseDiagram(solution) {
  console.log("chooseDiagram ",solution);

  equations[currentRow] = equations[currentRow].filter(equation => equation[2] == solution)
  console.log("equations is ",equations);
  console.log("currentRow is ",currentRow);

  setTimeout(setDiagrams("chooseDiagram"))
}

function showNextRow() {
  console.trace('showNextRow', currentRow)
  hideIncorrectDiagrams()
  let panel = document.getElementById('middlePanel'),
      template = document.getElementById('rowTemplate'),
      row = template.content.firstElementChild.cloneNode(true),
      solveGroup = row.firstElementChild,
      input = solveGroup.getElementsByClassName('CTATMathInput')[0],
      explainGroup = row.lastElementChild
  console.log(panel, row, solveGroup, explainGroup)
  solveGroup.id = `solve${++currentRow}Group`
  input.id = `solve${currentRow}`
  solveGroup.getElementsByClassName('feedback')[0].id = `solve${currentRow}Feedback`
  explainGroup.id = `explain${currentRow}Group`
  Array.from(explainGroup.children).forEach((radioButton, index) => {
    radioButton.id = `radioExplain${currentRow}Diagram${index + 1}`
    radioButton.setAttribute('name', `groupExplain${currentRow}Diagrams`)})
  panel.insertBefore(row, template)
  input.focus()
}

function showStepInputs() {
  console.log('showStepInputs', currentRow)
  switchHeaders(true)
  hideIncorrectDiagrams()
  $(`#solve${currentRow}Group`).children().removeClass('hidden')
}

function hideIncorrectDiagrams() {
  console.log('hideIncorrectDiagrams')
  $(`#radioExplain${currentRow}Diagram1, #radioExplain${currentRow}Diagram2, #radioExplain${currentRow}Diagram3`).
    find('>input:not(:checked)').parent().remove()
}

function switchHeaders(diagrams) {
  $('.solveGroup .problemText').toggleClass('hidden', !diagrams)
  $('.explainGroup .problemText').toggleClass('hidden', diagrams)
}

function setGivenDiagrams(params) {
  console.log('setGivenDiagrams', params)
  let [equation, solution, condition] = params.split(',')
  tutorCondition = condition
  solution = parseInt(solution)
  algebraParser = new CTATAlgebraParser(new CTATVariableTable())
  algebraParser.parser.yy.variableTable.setTable({x: solution})
  steps[0] = {equation: algebraParser.algParse(equation), solution}
  setEquations()
}

function setStepDiagrams(params) {
  console.log('setStepDiagrams', params)
  transformations = params.split('|').map(param => param.split(','))
  steps[currentRow] = {equation: algebraParser.algParse(transformations[0][0]), solution: transformations.map(param => param.slice(1))}
  setEquations()
}

function setEquations() {
  console.log('setEquations')
  let [leftTerms, rightTerms] = algebraParser.algGetOperands(steps[currentRow].equation).map(getTerms)
  if (currentRow) {
    let validEquations = [subtractBothSides, divideBothSides].map(fun =>
                           steps[currentRow].solution.map(solution => fun.call(null, leftTerms, rightTerms, ...solution)).flat()).flat(),
        invalidEquations =  [subtractOneSide, subtractDifferentBothSides, addCoefficientEachSide, multiplyCoefficientEachSide,
                             subtractAddSides, subtractTwiceOneSide, divideOneSide, divideMultiplySides].map(fun =>
                              steps[currentRow].solution.map(solution => fun.call(null, leftTerms, rightTerms, ...solution)).flat()).flat(),
        nonStrategicEquations = [subtractSomethingBothSides, addBothSides, subtractOtherBothSides, multiplyBothSides,
                                 divideSubtractBothSides, divideSubtractOtherBothSides].map(fun =>
                                  steps[currentRow].solution.map(solution => fun.call(null, leftTerms, rightTerms, ...solution)).flat()).flat()
    equations[currentRow] = [...validEquations, ...pickRandomly(invalidEquations, 1),
                             ...pickRandomly(nonStrategicEquations, diagramCount - validEquations.length - 1)]
    // equations[currentRow] = [...validEquations, ...invalidEquations, ...nonStrategicEquations].slice(0, 3)
  } else {
    let validEquations = [givenEquation].map(fun => fun.call(null, leftTerms, rightTerms)).flat(),
        invalidEquations = [shortenEquation, switchEquation].map(fun => fun.call(null, leftTerms, rightTerms)).flat()
    equations[currentRow] = [...validEquations, ...invalidEquations]
  }
  equations[currentRow] = pickRandomly(equations[currentRow], equations[currentRow].length)
}

//* Givens *//
function givenEquation(leftTerms, rightTerms) {
  return [[leftTerms, rightTerms, 'given']]
}

function shortenEquation(leftTerms, rightTerms) {
  console.log('shortenEquation')
  let leftSide = !hasVariable(leftTerms) ||
        evaluate(getCoefficient(getVariableTerm(leftTerms))) < evaluate(getCoefficient(getVariableTerm(rightTerms))),
      terms = leftSide ? leftTerms : rightTerms,
      newTerms = [...terms, terms.length == 1 ? terms[0] : terms[1]]

  return [[leftSide ? newTerms : leftTerms, leftSide ? rightTerms : newTerms, leftSide ? 'shortenedLeft' : 'shortenedRight']]
}

function switchEquation(leftTerms, rightTerms) {
  console.log('switchEquation')
  if (leftTerms.length == 1 && rightTerms.length == 1) return [[rightTerms, leftTerms, 'switched']]

  let hasVars = hasVariable(leftTerms) && hasVariable(rightTerms),
      leftIndex = leftTerms.findIndex(term => hasConstant(term) != hasVars),
      rightIndex = rightTerms.findIndex(term => hasConstant(term) != hasVars),
      newLeftTerms = [...leftTerms],
      newRightTerms = [...rightTerms]

  newLeftTerms.splice(leftIndex, 1, rightTerms[rightIndex])
  newRightTerms.splice(rightIndex, 1, leftTerms[leftIndex])

  return [[newLeftTerms, newRightTerms, 'switched']]
}

//* Steps *//
function subtractBothSides(leftTerms, rightTerms, operation, operand) {
  console.log('subtractBothSides', leftTerms, rightTerms, operation, operand)
  if (operation !== 'subtraction') return []

  let operandTree = algebraParser.algParse(operand),
      leftSide = leftTerms.some(term => equals(term, operandTree)),
      leftEnd = equals(operandTree, leftTerms[0]) || equals(operandTree, rightTerms[0]),
      terms = leftSide ? rightTerms : leftTerms,
      index = terms.findIndex(term => hasVariable(term) == hasVariable(operandTree)),
      newTerms = [...terms]

  newTerms[index] = algebraParser.algSimplify(newExpression('MINUS', newTerms[index], operandTree))
  newTerms = leftEnd ? [operandTree, ...newTerms] : [...newTerms, operandTree]

  return [[leftSide ? leftTerms : newTerms, leftSide ? newTerms : rightTerms, ['subtraction', operand].join(',')]]
}

function subtractOneSide(leftTerms, rightTerms, operation, operand) {
  console.log('subtractOneSide', leftTerms, rightTerms, operation, operand)
  if (operation !== 'subtraction') return []

  let operandTree = algebraParser.algParse(operand),
      leftSide = leftTerms.some(term => equals(term, operandTree)),
      newOperation = leftSide ? 'subtractionLeft' : 'subtractionRight'

  return [[leftTerms, rightTerms, [newOperation, operand].join(',')]]
}

function subtractDifferentBothSides(leftTerms, rightTerms, operation, operand) {
  console.log('subtractDifferentBothSides', leftTerms, rightTerms, operation, operand)
  if (operation !== 'subtraction') return []

  let operandTree = algebraParser.algParse(operand),
      leftSide = leftTerms.some(term => equals(term, operandTree)),
      terms = leftSide ? rightTerms : leftTerms,
      termTree = terms.find(term => hasVariable(term) == hasVariable(operandTree)),
      term = algebraParser.algStringify(termTree)

  return [[leftTerms, rightTerms, ['subtractionLeftRight', leftSide ? operand : term, leftSide ? term : operand].join(',')]]
}

function addCoefficientEachSide(leftTerms, rightTerms, operation, operand) {
  console.log('addCoefficientEachSide', leftTerms, rightTerms, operation, operand)
  if (operation !== 'subtraction') return []

  let operandTree = algebraParser.algParse(operand),
      leftSide = leftTerms.some(term => equals(term, operandTree)),
      newTerms = [addCoefficients(leftSide ? leftTerms : rightTerms)],
      newOperation = leftSide ? 'addCoefficientsLeft' : 'addCoefficientsRight'

  return [[leftSide ? newTerms : leftTerms, leftSide ? rightTerms : newTerms, newOperation]]
}

function multiplyCoefficientEachSide(leftTerms, rightTerms, operation, operand) {
  console.log('multiplyCoefficientEachSide', leftTerms, rightTerms, operation, operand)
  if (operation !== 'subtraction') return []

  let operandTree = algebraParser.algParse(operand),
      leftSide = leftTerms.some(term => equals(term, operandTree)),
      newTerms = [multiplyCoefficients(leftSide ? leftTerms : rightTerms)],
      newOperation = leftSide ? 'multiplyCoefficientsLeft' : 'multiplyCoefficientsRight'

  return [[leftSide ? newTerms : leftTerms, leftSide ? rightTerms : newTerms, newOperation]]
}

function subtractAddSides(leftTerms, rightTerms, operation, operand) {
  console.log('subtractAddSides', leftTerms, rightTerms, operation, operand)
  if (operation !== 'subtraction') return []

  let operandTree = algebraParser.algParse(operand),
      leftSide = leftTerms.some(term => equals(term, operandTree)),
      leftEnd = equals(operandTree, leftTerms[0]) || equals(operandTree, rightTerms[0]),
      newLeftTerms = leftEnd ? [operandTree, ...leftTerms] : [...leftTerms, operandTree],
      newRightTerms = leftEnd ? [operandTree, ...rightTerms] : [...rightTerms, operandTree],
      newOperation = leftSide ? 'subtractionAdditionLeft' : 'subtractionAdditionRight'

  return [[newLeftTerms, newRightTerms, [newOperation, operand].join(',')]]
}

function subtractTwiceOneSide(leftTerms, rightTerms, operation, operand) {
  console.log('subtractTwiceOneSide', leftTerms, rightTerms, operation, operand)
  let operandTree = algebraParser.algParse(operand),
      coefficient = getCoefficient(operandTree)

  if (operation !== 'subtraction' || coefficient == 1) return []

  let leftSide = leftTerms.some(term => equals(term, operandTree)),
      terms = leftSide ? leftTerms : rightTerms,
      index = terms.findIndex(term => equals(term, operandTree)),
      newCoefficient = randomInt(Math.floor((coefficient - coefficient % 2) / 2)) + 1,
      newOperandTree = algebraParser.algSimplify(replaceCoefficient(operandTree, newCoefficient)),
      newOperand = algebraParser.algStringify(newOperandTree),
      newTerms = [...terms],
      newOperation = leftSide ? 'subtractionTwiceLeft' : 'subtractionTwiceRight'

  newTerms[index] = algebraParser.algSimplify(subtractTwice(terms[index], newOperandTree))
  if (getCoefficient(newTerms[index]) == 0) newTerms.splice(index, 1)
  newTerms = index == 0 ? [newOperandTree, newOperandTree, ...newTerms] : [...newTerms, newOperandTree, newOperandTree]

  return [[leftSide ? newTerms : leftTerms, leftSide ? rightTerms : newTerms, [newOperation, newOperand].join(',')]]
}

function subtractSomethingBothSides(leftTerms, rightTerms, operation, operand) {
  console.log('subtractSomethingBothSides', leftTerms, rightTerms, operation, operand)
  let operandTree = algebraParser.algParse(operand),
      coefficient = getCoefficient(operandTree)

  if (operation !== 'subtraction' || coefficient == 1) return []

  let leftEnd = equals(operandTree, leftTerms[0]) || equals(operandTree, rightTerms[0]),
      indexLeft = leftTerms.findIndex(term => hasVariable(term) == hasVariable(operandTree)),
      indexRight = rightTerms.findIndex(term => hasVariable(term) == hasVariable(operandTree)),
      newLeftTerms = [...leftTerms],
      newRightTerms = [...rightTerms],
      newCoefficient = randomInt(coefficient - 1) + 1,
      newOperandTree = algebraParser.algSimplify(replaceCoefficient(operandTree, newCoefficient)),
      newOperand = algebraParser.algStringify(newOperandTree)

  newLeftTerms[indexLeft] = algebraParser.algSimplify(newExpression('MINUS', newLeftTerms[indexLeft], newOperandTree))
  newLeftTerms = leftEnd ? [newOperandTree, ...newLeftTerms] : [...newLeftTerms, newOperandTree]
  newRightTerms[indexRight] = algebraParser.algSimplify(newExpression('MINUS', newRightTerms[indexRight], newOperandTree))
  newRightTerms = leftEnd ? [newOperandTree, ...newRightTerms] : [...newRightTerms, newOperandTree]

  return [[newLeftTerms, newRightTerms, ['subtractionBoth', newOperand].join(',')]]
}

function addBothSides(leftTerms, rightTerms, operation, operand) {
  console.log('addBothSides', leftTerms, rightTerms, operation, operand)
  if (operation !== 'subtraction') return []

  let operandTree = algebraParser.algParse(operand),
      leftSide = leftTerms.some(term => equals(term, operandTree)),
      leftEnd = equals(operandTree, leftTerms[0]) || equals(operandTree, rightTerms[0]),
      otherTree = (leftSide ? leftTerms : rightTerms).find(term => !equals(term, operandTree)),
      otherOperand = algebraParser.algStringify(otherTree),
      newLeftTerms = leftEnd ? [operandTree, ...leftTerms] : [...leftTerms, operandTree],
      newRightTerms = leftEnd ? [operandTree, ...rightTerms] : [...rightTerms, operandTree],
      newOtherLeftTerms = leftEnd ? [...leftTerms, otherTree] : [otherTree, ...leftTerms],
      newOtherRightTerms = leftEnd ? [...rightTerms, otherTree] : [otherTree, ...rightTerms]

  return [[newLeftTerms, newRightTerms, ['additionBoth', operand].join(',')]].concat(
         leftTerms.length > 1 && rightTerms.length > 1 ? [] :
         [[newOtherLeftTerms, newOtherRightTerms, ['additionBoth', otherOperand].join(',')]])
}

function subtractOtherBothSides(leftTerms, rightTerms, operation, operand) {
  console.log('subtractOtherBothSides', leftTerms, rightTerms, operation, operand)
  if (operation !== 'subtraction' || leftTerms.length == 2 && rightTerms.length == 2) return []

  let operandTree = algebraParser.algParse(operand),
      leftSide = leftTerms.some(term => equals(term, operandTree)),
      leftEnd = equals(operandTree, leftTerms[0]) || equals(operandTree, rightTerms[0]),
      newOperandTree = (leftSide ? leftTerms : rightTerms)[leftEnd ? 1 : 0],
      newOperand = algebraParser.algStringify(newOperandTree),
      removedOperand = algebraParser.algSimplify(newExpression('MINUS', (leftSide ? rightTerms : leftTerms)[0], operandTree)),
      newTerms = leftEnd ? [operandTree, removedOperand] : [removedOperand, operandTree]

  return [[leftSide ? leftTerms : newTerms, leftSide ? newTerms : rightTerms, ['subtractionOtherBoth', newOperand].join(',')]]
}

function divideBothSides(leftTerms, rightTerms, operation, operand) {
  console.log('divideBothSides', leftTerms, rightTerms, operation, operand)
  if (operation !== 'division') return []

  let operandTree = algebraParser.algParse(operand),
      newLeftTermTrees = leftTerms.map(term => algebraParser.algSimplify(newExpression('DIVIDE', term, operandTree))),
      newRightTermTrees = rightTerms.map(term => algebraParser.algSimplify(newExpression('DIVIDE', term, operandTree))),
      newLeftTerms = Array(+operand).fill(newLeftTermTrees).flat(),
      newRightTerms = Array(+operand).fill(newRightTermTrees).flat()

  return [[newLeftTerms, newRightTerms, ['division', operand].join(',')]]
}

function divideOneSide(leftTerms, rightTerms, operation, operand) {
  console.log('divideOneSide', leftTerms, rightTerms, operation, operand)
  if (operation !== 'division') return []

  let operandTree = algebraParser.algParse(operand),
      newLeftTermTrees = leftTerms.map(term => algebraParser.algSimplify(newExpression('DIVIDE', term, operandTree))),
      newRightTermTrees = rightTerms.map(term => algebraParser.algSimplify(newExpression('DIVIDE', term, operandTree))),
      newLeftTerms = Array(+operand).fill(newLeftTermTrees).flat(),
      newRightTerms = Array(+operand).fill(newRightTermTrees).flat()

  return [[newLeftTerms, rightTerms, ['divisionLeft', operand].join(',')],
          [leftTerms, newRightTerms, ['divisionRight', operand].join(',')]]
}

function divideMultiplySides(leftTerms, rightTerms, operation, operand) {
  console.log('divideMultiplySides', leftTerms, rightTerms, operation, operand)
  if (operation !== 'division') return []

  let operandTree = algebraParser.algParse(operand),
      leftSide = leftTerms.some(term => hasVariable(term)),
      divideTerms = leftSide ? leftTerms : rightTerms,
      newDivideTrees = divideTerms.map(term => algebraParser.algSimplify(newExpression('DIVIDE', term, operandTree))),
      newDivideTerms = Array(+operand).fill(newDivideTrees).flat(),
      newMultiplyTerms = Array(+operand).fill(leftSide ? rightTerms : leftTerms).flat(),
      newOperation = leftSide ? 'divisionMultiplicationLeft' : 'divisionMultiplicationRight',
      label = [newOperation, operand].join(',')

  return [[leftSide ? newDivideTerms : newMultiplyTerms, leftSide ? newMultiplyTerms : newDivideTerms, label]]
}

function multiplyBothSides(leftTerms, rightTerms, operation, operand) {
  console.log('multiplyBothSides', leftTerms, rightTerms, operation, operand)
  if (operation !== 'division') return []

  let newLeftTerms = Array(+operand).fill(leftTerms).flat(),
      newRightTerms = Array(+operand).fill(rightTerms).flat()

  return [[newLeftTerms, newRightTerms, ['multiplicationBoth', operand].join(',')]]
}

function divideSubtractBothSides(leftTerms, rightTerms, operation, operand) {
  console.log('divideSubtractBothSides', leftTerms, rightTerms, operation, operand)
  if (operation !== 'division' || leftTerms.length == 2 || rightTerms.length == 2) return []

  let operandTree = algebraParser.algParse(operand),
      leftSide = leftTerms.some(term => hasVariable(term)),
      newLeftTermTree = algebraParser.algSimplify(newExpression('DIVIDE', leftTerms[0], operandTree)),
      newRightTermTree = algebraParser.algSimplify(newExpression('DIVIDE', rightTerms[0], operandTree)),
      factorTree = newExpression('CONST', operand - 1),
      newOperandTree = algebraParser.algSimplify(newExpression('TIMES', factorTree, (leftSide ? newRightTermTree : newLeftTermTree))),
      newOperand = algebraParser.algStringify(newOperandTree),
      removedOperandTree = algebraParser.algSimplify(newExpression('TIMES', factorTree, (leftSide ? newLeftTermTree : newRightTermTree))),
      newLeftTerms = [newLeftTermTree, leftSide ? removedOperandTree : newOperandTree],
      newRightTerms = [newRightTermTree, leftSide ? newOperandTree : removedOperandTree]

  return [[newLeftTerms, newRightTerms, ['divisionSubtractionBoth', newOperand].join(',')]]
}

function divideSubtractOtherBothSides(leftTerms, rightTerms, operation, operand) {
  console.log('divideSubtractOtherBothSides', leftTerms, rightTerms, operation, operand)
  return []
}

// function divideSubtractOtherBothSides(leftTerms, rightTerms, operation, operand) {
//   console.log('divideSubtractOtherBothSides', leftTerms, rightTerms, operation, operand)
//   if (operation !== 'division' || leftTerms.length == rightTerms.length) return []

//   let operandTree = algebraParser.algParse(operand),
//       leftSide = leftTerms.length == 2,
//       leftEnd = hasVariable(leftTerms[0]) != hasVariable(rightTerms[0]),
//       terms = leftSide ? leftTerms : rightTerms,
//       newOperandTree = terms[leftEnd ? 0 : 1],
//       newOperand = algebraParser.algStringify(newOperandTree),
//       oldOperand = terms[leftEnd ? 1 : 0],
//       removedOperand = algebraParser.algSimplify(newExpression('MINUS', (leftSide ? rightTerms : leftTerms)[0], oldOperand)),
//       newTerms = leftEnd ? [removedOperand, oldOperand] : [oldOperand, removedOperand]

//   return [[leftSide ? leftTerms : newTerms, leftSide ? newTerms : rightTerms, ['divisionSubtractionBoth', newOperand].join(',')]]
// }

//* Diagrams *//
function showDiagrams() {
  console.log('showDiagrams')
  switchHeaders(false)

  setTimeout(() => {
    setDiagrams("showDiagrams")
    diagrams.forEach(rowDiagrams => rowDiagrams.forEach($diagram => $diagram.removeClass('hidden')))
  })
}

problemRestoreEndListener = {
  problemRestoreEndSeen: false,  // set to true when see ProblemRestoreEnd msg
  restoring: function() {
    let mrps=CTAT.ToolTutor.tutor.getOutputStatus().mustRetrieveProblemState();
    console.log("problemRestoreEndListener.restoring() mustRetrieveProblemState, this.problemRestoreEndSeen", mrps, this.problemRestoreEndSeen);
    return mrps && !this.problemRestoreEndSeen;
  },
  processCommShellEvent: function (evt, m) {
    let msg=(typeof(m)=="string" ? CTATMessage.fromString(m) : m);
    console.log("***processCommShellEvent:", evt, msg && msg.getSAI() && msg.getSAI().toString() );
    if (evt=="ProblemRestoreEnd") {
      this.problemRestoreEndSeen = true;
    }
  }
};
document.addEventListener("tutorInitialized", function() {CTATCommShell.commShell.addGlobalEventListener(problemRestoreEndListener)});
let $rb0 = null, toClick = null, label = null;
function setDiagrams(caller) {
  console.log(caller,'> setDiagrams, equations are ',equations)
  equations.forEach((rowEquations, rowIndex) => {
    console.log("setDiagrams rowIndex",rowIndex,"diagrams[rowIndex]",diagrams[rowIndex]);
    if (!diagrams[rowIndex]) {
      diagrams[rowIndex] = []
      rowEquations.forEach((equation, index) => diagrams[rowIndex][index] = buildDiagram($(`#radioExplain${rowIndex}Diagram${index + 1}`), equation))
      if (rowEquations.length == 1) {
        console.log("diagrams is ",diagrams[rowIndex]);
        $rb0=diagrams[rowIndex][0];
        $rb0.find('> *').addClass('simulated');
        toClick = $rb0.find('> input');
        label = $rb0.find('> label');
        console.log("$rb0[0] toClick toClick[0] label label[0]", $rb0[0], toClick, toClick[0], label, label[0]);
        let input = toClick[0].value+": "+label[0].textContent;
        toClick[0].checked = true;  // preserve through hideIncorrectDiagrams()
        console.log("(row "+rowIndex+") processComponentAction: selection input checked", toClick[0].name, input, toClick[0].checked);
        // instead of   toClick.click();
        CTATCommShell.commShell.processComponentAction(
          new CTATSAI(toClick[0].name, "UpdateRadioButton", input),
          true,       // tutorComponent
          true,       // behaviorRecord
          null,       // unused
          "ATTEMPT",  // req type
          "DATA",     // tutor-performed
          null,       // optional txId
          true        // saveForRestore override
        );
      }
    }
  })
}

function buildDiagram($diagram, type) {
  console.log('buildDiagram', $diagram, type)
  if (!type) return

  let [leftTerms, rightTerms, label] = type,
      [operation, leftOperand, rightOperand] = label.split(','),
      leftOperandTree = leftOperand &&
        ['subtraction', 'subtractionLeft', 'subtractionLeftRight', 'subtractionAdditionLeft', 'subtractionTwiceLeft', 'subtractionBoth',
         'additionBoth', 'subtractionOtherBoth', 'divisionSubtractionBoth', 'division', 'divisionLeft', 'divisionMultiplicationLeft'].includes(operation) ?
          algebraParser.algParse(leftOperand) : null,
      rightOperandTree = (rightOperand || leftOperand) &&
          ['subtraction', 'subtractionRight', 'subtractionAdditionRight', 'subtractionTwiceRight', 'subtractionBoth', 'subtractionOtherBoth',
           'divisionSubtractionBoth', 'division', 'divisionRight', 'divisionMultiplicationRight'].includes(operation) ||
        rightOperand && ['subtractionLeftRight'].includes(operation) ?
          algebraParser.algParse(rightOperand || leftOperand) : null,
      leftEnd = leftTerms.length > 1 && leftOperandTree && equals(leftOperandTree, leftTerms[0]) ||
                rightTerms.length > 1 && rightOperandTree && equals(rightOperandTree, rightTerms[0])

  console.log('buildDiagram', $diagram, label)
  $diagram.find('input[type="radio"]').val(label)
  buildLine($diagram.find('.leftBoxes'), leftTerms, leftEnd,
            ['subtractionAdditionRight', 'additionBoth', 'divisionMultiplicationRight'].includes(operation) ? null : leftOperandTree,
            ['shortenedLeft', 'subtractionAdditionLeft'].includes(operation), ['subtractionAdditionRight', 'additionBoth'].includes(operation),
            operation == 'subtractionTwiceLeft', ['division', 'divisionLeft', 'divisionMultiplicationLeft'].includes(operation))
  buildLine($diagram.find('.rightBoxes'), rightTerms, leftEnd,
            ['subtractionAdditionLeft', 'additionBoth', 'divisionMultiplicationLeft'].includes(operation) ? null : rightOperandTree,
            ['shortenedRight', 'subtractionAdditionRight'].includes(operation), ['subtractionAdditionLeft', 'additionBoth'].includes(operation),
            operation == 'subtractionTwiceRight', ['division', 'divisionRight', 'divisionMultiplicationRight'].includes(operation))
  moveBars($diagram, leftTerms, rightTerms, leftEnd, leftOperandTree, rightOperandTree, operation == 'division')
  console.log("returning ",$diagram);
  return $diagram
}

function buildLine($line, terms, leftEnd, operandTree, hide, add, double, division) {
  console.log('buildLine', $line, terms, leftEnd, operandTree, hide, add, double, division)
  terms.forEach((term, index) => {
    let endTerm = leftEnd ? index == 0 : index == terms.length - 1,
        nearEndTerm = leftEnd ? index == 1 : index == terms.length - 2,
        divisor = division && evaluate(operandTree),
        type = endTerm && hide ? 'hide' :
               !division && operandTree && (endTerm || (hide || double) && nearEndTerm) || division && index >= (terms.length / divisor) ? 'dashed' : 'solid',
        sign = add && endTerm

    buildBox($line.find('.box' + (index + 1)), term, type, leftEnd, sign, terms);})

  if (!division && double && operandTree) buildBox($line.find('.box5'), operandTree, 'movedLess', leftEnd, null, terms)
  if (!division && operandTree) buildBox($line.find('.box6'), operandTree, hide ? 'movedLess' : 'moved', leftEnd, null, terms)
}

function buildBox($box, term, type, leftEnd, sign, terms) {
  console.log('buildBox', $box, term, type, leftEnd, sign, terms)
  $box.text((sign ? '+' : '') + algebraParser.algStringify(term)).attr('style', `--flex: ${evaluate(term)}`).
    addClass(type).addClass(leftEnd ? 'leftEnd' : 'rightEnd').addClass(hasVariable(term) ? 'variable' : 'constant')
  if (type.startsWith('moved')) $box.attr('style', `--width: ${getLength([term], terms)}%;`)
  $box.removeClass('hidden')
}

function moveBars($diagram, leftTerms, rightTerms, leftEnd, leftOperandTree, rightOperandTree, division) {
  console.log('moveBars', leftTerms, rightTerms, leftEnd, leftOperandTree, rightOperandTree, division)
  let minWidth = division ? getLength(leftTerms.slice(leftTerms.length / evaluate(leftOperandTree)), leftTerms) :
                 Math.min(leftOperandTree ? getLength([leftOperandTree], leftTerms) : 0,
                          rightOperandTree ? getLength([rightOperandTree], rightTerms) : 0)

  $diagram.find('.startLine').attr('style', `--left: ${!division && leftEnd ? `${minWidth}%` : '0%'}`)
  $diagram.find('.endLine').attr('style', `--right: ${!division && leftEnd ? '0%' : `${minWidth}%`}`)
}

//* Equation utilities *//
function getTerms(expression) {
  return ['PLUS', 'MINUS'].includes(algebraParser.algGetOperator(expression)) ? algebraParser.algGetOperands(expression) : [expression]
}

function addCoefficients(terms) {
  return newExpression('TIMES', newExpression('PLUS', getCoefficient(terms[0]), getCoefficient(terms[1])), getVariable(getVariableTerm(terms)))
}

function multiplyCoefficients(terms) {
  return newExpression('TIMES', newExpression('TIMES', getCoefficient(terms[0]), getCoefficient(terms[1])), getVariable(getVariableTerm(terms)))
}

function replaceCoefficient(term, coefficient) {
  return term.multiplication() ? newExpression('TIMES', new CTATConstantNode(coefficient), getVariable(term)) : new CTATConstantNode(coefficient)
}

function subtractTwice(leftSide, rightSide) {
  return newExpression('MINUS', newExpression('MINUS', leftSide, rightSide), rightSide)
}

function newExpression(operator, ...operands) {
  switch (operator) {
    case 'EQUAL': return new CTATRelationNode('EQUAL', ...operands)
    case 'PLUS': return new CTATAdditionNode('PLUS', operands)
    case 'MINUS': return new CTATAdditionNode('MINUS', operands)
    case 'TIMES': return new CTATMultiplicationNode('TIMES', operands)
    case 'DIVIDE': return new CTATMultiplicationNode('DIVIDE', operands)
    case 'VAR': return new CTATVariableNode(algebraParser.parser.yy.variableTable, ...operands)
    case 'CONST': return new CTATConstantNode(...operands)
  default: null
  }
}

function hasVariable(item) {
  return Array.isArray(item) ? item.some(term => term.countVariables() > 0) : item.countVariables() > 0
}

function getVariableTerm(list) {
  return list.find(term => term.countVariables() > 0)
}

function hasConstant(item) {
  return Array.isArray(item) ? item.some(term => term.constant()) : item.constant()
}

function getCoefficient(term) {
  return !term ? new CTATConstantNode(0) : term.multiplication() ? term.factors[0] : term.constant() ? term : new CTATConstantNode(1)
}

function getVariable(term) {
  return term.multiplication() ? term.factors[1] : term.constant() ? null : term
}

function evaluate(item) {
  return Array.isArray(item) ? item.reduce(((sum, term) => sum + term.evaluate()), 0) : item.evaluate()
}

function equals(item1, item2) {
  return item1.equals(item2)
}

function getLength(terms, list) {
  return (100 * evaluate(terms) / evaluate(list))
}

//* General utilities *//
function pickRandomly(list, count) {
  return Array.from({length: count}, () => list.splice(randomInt(list.length), 1)).flat()
}

function randomInt(limit) {
  return Math.floor(Math.random() * limit)
}
