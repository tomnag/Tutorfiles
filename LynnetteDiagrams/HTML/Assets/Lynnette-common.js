const diagramCount = 3;
let tutorCondition, algebraParser, currentRow = 0, equationSolution;

function setupParser(solution) {
  equationSolution = parseInt(solution);
  algebraParser = new CTATAlgebraParser(new CTATVariableTable());
  algebraParser.parser.yy.variableTable.setTable({x: equationSolution});
}

function showNextRow() {
  console.log('showNextRow');
  hideIncorrectDiagrams();
  $(`#solve${++currentRow}Group`).parent().removeClass('hidden');
}

function showStepInputs() {
  console.log('showStepInputs');
  switchHeaders(true);
  hideIncorrectDiagrams();
  $(`#solve${currentRow}Group`).children().removeClass('hidden');
}

function hideIncorrectDiagrams() {
  // console.log('hideIncorrectDiagrams');
  $(`#radioExplain${currentRow}Diagram1, #radioExplain${currentRow}Diagram2, #radioExplain${currentRow}Diagram3`).
    find('>input:not(:checked)').parent().addClass('hidden');
}

function switchHeaders(diagrams) {
  $('.solveGroup .problemText').toggleClass('hidden', !diagrams);
  $('.explainGroup .problemText').toggleClass('hidden', diagrams);
}

//* Givens *//
function showGivenDiagrams(params) {
  console.log('showGivenDiagrams: ', params);
  switchHeaders(false);

  let [equation, solution, condition] = params.split(',');
  tutorCondition = condition;
  setupParser(solution);
  equation = algebraParser.algParse(equation);

  let [leftTerms, rightTerms] = algebraParser.algGetOperands(equation).map(getTerms),
      equations = [[[leftTerms, rightTerms, 'given']], shortenEquation(leftTerms, rightTerms), switchEquation(leftTerms, rightTerms)].flat();

  showDiagrams(equations);
}

function shortenEquation(leftTerms, rightTerms) {
  // console.log('shortenEquation');
  let leftSide = !hasVariable(leftTerms) ||
        evaluate(getCoefficient(getVariableTerm(leftTerms))) < evaluate(getCoefficient(getVariableTerm(rightTerms))),
      terms = leftSide ? leftTerms : rightTerms,
      newTerms = [...terms, terms.length == 1 ? terms[0] : terms[1]];

  return [[leftSide ? newTerms : leftTerms, leftSide ? rightTerms : newTerms, leftSide ? 'shortenedLeft' : 'shortenedRight']];
}

function switchEquation(leftTerms, rightTerms) {
  // console.log('switchEquation');
  if (leftTerms.length == 1 && rightTerms.length == 1) return [[rightTerms, leftTerms, 'switched']];

  let hasVars = hasVariable(leftTerms) && hasVariable(rightTerms),
      leftIndex = leftTerms.findIndex((term) => hasConstant(term) != hasVars),
      rightIndex = rightTerms.findIndex((term) => hasConstant(term) != hasVars),
      newLeftTerms = [...leftTerms],
      newRightTerms = [...rightTerms];

  newLeftTerms.splice(leftIndex, 1, rightTerms[rightIndex]);
  newRightTerms.splice(rightIndex, 1, leftTerms[leftIndex]);

  return [[newLeftTerms, newRightTerms, 'switched']];
}

//* Steps *//
function showStepDiagrams(params) {
  console.log('showStepDiagrams', params);
  switchHeaders(false);

  params = params.split('|').map((params) => params.split(','));

  let originalEquation = algebraParser.algParse(params[0][0]),
      [leftTerms, rightTerms] = algebraParser.algGetOperands(originalEquation).map(getTerms),
      solutions = params.map((param) => param.slice(1)),
      validTypes = [subtractBothSides, divideBothSides],
      validEquations = validTypes.map((fun) =>
                         solutions.map((solution) => fun.call(null, leftTerms, rightTerms, ...solution)).flat()).flat(),
      invalidTypes = [subtractOneSide, subtractDifferentBothSides, addCoefficientEachSide, multiplyCoefficientEachSide,
                      subtractAddSides, subtractTwiceOneSide, divideOneSide, divideMultiplySides],
      invalidEquations = invalidTypes.map((fun) =>
                           solutions.map((solution) => fun.call(null, leftTerms, rightTerms, ...solution)).flat()).flat(),
      nonStrategicTypes = [subtractSomethingBothSides, addBothSides, subtractOtherBothSides, multiplyBothSides,
                           divideSubtractBothSides, divideSubtractOtherBothSides],
      nonStrategicEquations = nonStrategicTypes.map((fun) =>
                                solutions.map((solution) => fun.call(null, leftTerms, rightTerms, ...solution)).flat()).flat(),
      equations = [...validEquations, ...pickRandomly(invalidEquations, 1),
                   ...pickRandomly(nonStrategicEquations, diagramCount - validEquations.length - 1)];
      // equations = [...validEquations, ...invalidEquations, ...nonStrategicEquations].slice(8, 11);

  showDiagrams(equations);
}

function subtractBothSides(leftTerms, rightTerms, operation, operand) {
  // console.log('subtractBothSides', leftTerms, rightTerms, operation, operand);
  if (operation !== 'subtraction') return [];

  let operandTree = algebraParser.algParse(operand),
      leftSide = leftTerms.some((term) => equals(term, operandTree)),
      leftEnd = equals(operandTree, leftTerms[0]) || equals(operandTree, rightTerms[0]),
      terms = leftSide ? rightTerms : leftTerms,
      index = terms.findIndex((term) => hasVariable(term) == hasVariable(operandTree)),
      newTerms = [...terms];

  newTerms[index] = algebraParser.algSimplify(newExpression('MINUS', newTerms[index], operandTree));
  newTerms = leftEnd ? [operandTree, ...newTerms] : [...newTerms, operandTree];

  return [[leftSide ? leftTerms : newTerms, leftSide ? newTerms : rightTerms, ['subtraction', operand].join(',')]];
}

function subtractOneSide(leftTerms, rightTerms, operation, operand) {
  // console.log('subtractOneSide', leftTerms, rightTerms, operation, operand);
  if (operation !== 'subtraction') return [];

  let operandTree = algebraParser.algParse(operand),
      leftSide = leftTerms.some((term) => equals(term, operandTree)),
      newOperation = leftSide ? 'subtractionLeft' : 'subtractionRight';

  return [[leftTerms, rightTerms, [newOperation, operand].join(',')]];
}

function subtractDifferentBothSides(leftTerms, rightTerms, operation, operand) {
  // console.log('subtractDifferentBothSides', leftTerms, rightTerms, operation, operand);
  if (operation !== 'subtraction') return [];

  let operandTree = algebraParser.algParse(operand),
      leftSide = leftTerms.some((term) => equals(term, operandTree)),
      terms = leftSide ? rightTerms : leftTerms,
      termTree = terms.find((term) => hasVariable(term) == hasVariable(operandTree)),
      term = algebraParser.algStringify(termTree);

  return [[leftTerms, rightTerms, ['subtractionLeftRight', leftSide ? operand : term, leftSide ? term : operand].join(',')]];
}

function addCoefficientEachSide(leftTerms, rightTerms, operation, operand) {
  // console.log('addCoefficientEachSide', leftTerms, rightTerms, operation, operand);
  if (operation !== 'subtraction') return [];

  let operandTree = algebraParser.algParse(operand),
      leftSide = leftTerms.some((term) => equals(term, operandTree)),
      newTerms = [addCoefficients(leftSide ? leftTerms : rightTerms)],
      newOperation = leftSide ? 'addCoefficientsLeft' : 'addCoefficientsRight'

  return [[leftSide ? newTerms : leftTerms, leftSide ? rightTerms : newTerms, newOperation]];
}

function multiplyCoefficientEachSide(leftTerms, rightTerms, operation, operand) {
  // console.log('multiplyCoefficientEachSide', leftTerms, rightTerms, operation, operand);
  if (operation !== 'subtraction') return [];

  let operandTree = algebraParser.algParse(operand),
      leftSide = leftTerms.some((term) => equals(term, operandTree)),
      newTerms = [multiplyCoefficients(leftSide ? leftTerms : rightTerms)],
      newOperation = leftSide ? 'multiplyCoefficientsLeft' : 'multiplyCoefficientsRight'

  return [[leftSide ? newTerms : leftTerms, leftSide ? rightTerms : newTerms, newOperation]];
}

function subtractAddSides(leftTerms, rightTerms, operation, operand) {
  // console.log('subtractAddSides', leftTerms, rightTerms, operation, operand);
  if (operation !== 'subtraction') return [];

  let operandTree = algebraParser.algParse(operand),
      leftSide = leftTerms.some((term) => equals(term, operandTree)),
      leftEnd = equals(operandTree, leftTerms[0]) || equals(operandTree, rightTerms[0]),
      newLeftTerms = leftEnd ? [operandTree, ...leftTerms] : [...leftTerms, operandTree],
      newRightTerms = leftEnd ? [operandTree, ...rightTerms] : [...rightTerms, operandTree],
      newOperation = leftSide ? 'subtractionAdditionLeft' : 'subtractionAdditionRight';

  return [[newLeftTerms, newRightTerms, [newOperation, operand].join(',')]];
}

function subtractTwiceOneSide(leftTerms, rightTerms, operation, operand) {
  // console.log('subtractTwiceOneSide', leftTerms, rightTerms, operation, operand);
  let operandTree = algebraParser.algParse(operand),
      coefficient = getCoefficient(operandTree);

  if (operation !== 'subtraction' || coefficient == 1) return [];

  let leftSide = leftTerms.some((term) => equals(term, operandTree)),
      terms = leftSide ? leftTerms : rightTerms,
      index = terms.findIndex((term) => equals(term, operandTree)),
      newCoefficient = randomInt(Math.floor((coefficient - coefficient % 2) / 2)) + 1,
      newOperandTree = algebraParser.algSimplify(replaceCoefficient(operandTree, newCoefficient)),
      newOperand = algebraParser.algStringify(newOperandTree),
      newTerms = [...terms],
      newOperation = leftSide ? 'subtractionTwiceLeft' : 'subtractionTwiceRight';

  newTerms[index] = algebraParser.algSimplify(subtractTwice(terms[index], newOperandTree));
  if (getCoefficient(newTerms[index]) == 0) newTerms.splice(index, 1);
  newTerms = index == 0 ? [newOperandTree, newOperandTree, ...newTerms] : [...newTerms, newOperandTree, newOperandTree];

  return [[leftSide ? newTerms : leftTerms, leftSide ? rightTerms : newTerms, [newOperation, newOperand].join(',')]];
}

function subtractSomethingBothSides(leftTerms, rightTerms, operation, operand) {
  // console.log('subtractSomethingBothSides', leftTerms, rightTerms, operation, operand);
  let operandTree = algebraParser.algParse(operand),
      coefficient = getCoefficient(operandTree);

  if (operation !== 'subtraction' || coefficient == 1) return [];

  let leftEnd = equals(operandTree, leftTerms[0]) || equals(operandTree, rightTerms[0]),
      indexLeft = leftTerms.findIndex((term) => hasVariable(term) == hasVariable(operandTree)),
      indexRight = rightTerms.findIndex((term) => hasVariable(term) == hasVariable(operandTree)),
      newLeftTerms = [...leftTerms],
      newRightTerms = [...rightTerms],
      newCoefficient = randomInt(coefficient - 1) + 1,
      newOperandTree = algebraParser.algSimplify(replaceCoefficient(operandTree, newCoefficient)),
      newOperand = algebraParser.algStringify(newOperandTree);

  newLeftTerms[indexLeft] = algebraParser.algSimplify(newExpression('MINUS', newLeftTerms[indexLeft], newOperandTree));
  newLeftTerms = leftEnd ? [newOperandTree, ...newLeftTerms] : [...newLeftTerms, newOperandTree];
  newRightTerms[indexRight] = algebraParser.algSimplify(newExpression('MINUS', newRightTerms[indexRight], newOperandTree));
  newRightTerms = leftEnd ? [newOperandTree, ...newRightTerms] : [...newRightTerms, newOperandTree];

  return [[newLeftTerms, newRightTerms, ['subtractionBoth', newOperand].join(',')]];
}

function addBothSides(leftTerms, rightTerms, operation, operand) {
  // console.log('addBothSides', leftTerms, rightTerms, operation, operand);
  if (operation !== 'subtraction') return [];

  let operandTree = algebraParser.algParse(operand),
      leftSide = leftTerms.some((term) => equals(term, operandTree)),
      leftEnd = equals(operandTree, leftTerms[0]) || equals(operandTree, rightTerms[0]),
      otherTree = (leftSide ? leftTerms : rightTerms).find((term) => !equals(term, operandTree)),
      otherOperand = algebraParser.algStringify(otherTree),
      newLeftTerms = leftEnd ? [operandTree, ...leftTerms] : [...leftTerms, operandTree],
      newRightTerms = leftEnd ? [operandTree, ...rightTerms] : [...rightTerms, operandTree],
      newOtherLeftTerms = leftEnd ? [...leftTerms, otherTree] : [otherTree, ...leftTerms],
      newOtherRightTerms = leftEnd ? [...rightTerms, otherTree] : [otherTree, ...rightTerms];

  return [[newLeftTerms, newRightTerms, ['additionBoth', operand].join(',')]].concat(
         leftTerms.length > 1 && rightTerms.length > 1 ? [] :
         [[newOtherLeftTerms, newOtherRightTerms, ['additionBoth', otherOperand].join(',')]]);
}

function subtractOtherBothSides(leftTerms, rightTerms, operation, operand) {
  // console.log('subtractOtherBothSides', leftTerms, rightTerms, operation, operand);
  if (operation !== 'subtraction' || leftTerms.length == 2 && rightTerms.length == 2) return [];

  let operandTree = algebraParser.algParse(operand),
      leftSide = leftTerms.some((term) => equals(term, operandTree)),
      leftEnd = equals(operandTree, leftTerms[0]) || equals(operandTree, rightTerms[0]),
      newOperandTree = (leftSide ? leftTerms : rightTerms)[leftEnd ? 1 : 0],
      newOperand = algebraParser.algStringify(newOperandTree),
      removedOperand = algebraParser.algSimplify(newExpression('MINUS', (leftSide ? rightTerms : leftTerms)[0], operandTree)),
      newTerms = leftEnd ? [operandTree, removedOperand] : [removedOperand, operandTree];

  return [[leftSide ? leftTerms : newTerms, leftSide ? newTerms : rightTerms, ['subtractionOtherBoth', newOperand].join(',')]];
}

function divideBothSides(leftTerms, rightTerms, operation, operand) {
  // console.log('divideBothSides', leftTerms, rightTerms, operation, operand);
  if (operation !== 'division') return [];

  let operandTree = algebraParser.algParse(operand),
      newLeftTermTrees = leftTerms.map((term) => algebraParser.algSimplify(newExpression('DIVIDE', term, operandTree))),
      newRightTermTrees = rightTerms.map((term) => algebraParser.algSimplify(newExpression('DIVIDE', term, operandTree))),
      newLeftTerms = Array(+operand).fill(newLeftTermTrees).flat(),
      newRightTerms = Array(+operand).fill(newRightTermTrees).flat();

  return [[newLeftTerms, newRightTerms, ['division', operand].join(',')]];
}

function divideOneSide(leftTerms, rightTerms, operation, operand) {
  // console.log('divideOneSide', leftTerms, rightTerms, operation, operand);
  if (operation !== 'division') return [];

  let operandTree = algebraParser.algParse(operand),
      newLeftTermTrees = leftTerms.map((term) => algebraParser.algSimplify(newExpression('DIVIDE', term, operandTree))),
      newRightTermTrees = rightTerms.map((term) => algebraParser.algSimplify(newExpression('DIVIDE', term, operandTree))),
      newLeftTerms = Array(+operand).fill(newLeftTermTrees).flat(),
      newRightTerms = Array(+operand).fill(newRightTermTrees).flat();

  return [[newLeftTerms, rightTerms, ['divisionLeft', operand].join(',')],
          [leftTerms, newRightTerms, ['divisionRight', operand].join(',')]];
}

function divideMultiplySides(leftTerms, rightTerms, operation, operand) {
  // console.log('divideMultiplySides', leftTerms, rightTerms, operation, operand);
  if (operation !== 'division') return [];

  let operandTree = algebraParser.algParse(operand),
      leftSide = leftTerms.some((term) => hasVariable(term)),
      divideTerms = leftSide ? leftTerms : rightTerms,
      newDivideTrees = divideTerms.map((term) => algebraParser.algSimplify(newExpression('DIVIDE', term, operandTree))),
      newDivideTerms = Array(+operand).fill(newDivideTrees).flat(),
      newMultiplyTerms = Array(+operand).fill(leftSide ? rightTerms : leftTerms).flat(),
      newOperation = leftSide ? 'divisionMultiplicationLeft' : 'divisionMultiplicationRight',
      label = [newOperation, operand].join(',')

  return [[leftSide ? newDivideTerms : newMultiplyTerms, leftSide ? newMultiplyTerms : newDivideTerms, label]];
}

function multiplyBothSides(leftTerms, rightTerms, operation, operand) {
  // console.log('multiplyBothSides', leftTerms, rightTerms, operation, operand);
  if (operation !== 'division') return [];

  let operandTree = algebraParser.algParse(operand),
      newLeftTerms = Array(+operand).fill(leftTerms).flat(),
      newRightTerms = Array(+operand).fill(rightTerms).flat();

  return [[newLeftTerms, newRightTerms, ['multiplicationBoth', operand].join(',')]];
}

function divideSubtractBothSides(leftTerms, rightTerms, operation, operand) {
  // console.log('divideSubtractBothSides', leftTerms, rightTerms, operation, operand);
  if (operation !== 'division' || leftTerms.length == 2 || rightTerms.length == 2) return [];

  let operandTree = algebraParser.algParse(operand),
      leftSide = leftTerms.some((term) => hasVariable(term)),
      newLeftTermTree = algebraParser.algSimplify(newExpression('DIVIDE', leftTerms[0], operandTree)),
      newRightTermTree = algebraParser.algSimplify(newExpression('DIVIDE', rightTerms[0], operandTree)),
      factorTree = newExpression('CONST', operand - 1),
      newOperandTree = algebraParser.algSimplify(newExpression('TIMES', factorTree, (leftSide ? newRightTermTree : newLeftTermTree))),
      newOperand = algebraParser.algStringify(newOperandTree),
      removedOperandTree = algebraParser.algSimplify(newExpression('TIMES', factorTree, (leftSide ? newLeftTermTree : newRightTermTree))),
      newLeftTerms = [newLeftTermTree, leftSide ? removedOperandTree : newOperandTree],
      newRightTerms = [newRightTermTree, leftSide ? newOperandTree : removedOperandTree];

  return [[newLeftTerms, newRightTerms, ['divisionSubtractionBoth', newOperand].join(',')]];
}

function divideSubtractOtherBothSides(leftTerms, rightTerms, operation, operand) {
  // console.log('divideSubtractOtherBothSides', leftTerms, rightTerms, operation, operand);
  return [];
}

// function divideSubtractOtherBothSides(leftTerms, rightTerms, operation, operand) {
//   // console.log('divideSubtractOtherBothSides', leftTerms, rightTerms, operation, operand);
//   if (operation !== 'division' || leftTerms.length == rightTerms.length) return [];

//   let operandTree = algebraParser.algParse(operand),
//       leftSide = leftTerms.length == 2,
//       leftEnd = hasVariable(leftTerms[0]) != hasVariable(rightTerms[0]),
//       terms = leftSide ? leftTerms : rightTerms,
//       newOperandTree = terms[leftEnd ? 0 : 1],
//       newOperand = algebraParser.algStringify(newOperandTree),
//       oldOperand = terms[leftEnd ? 1 : 0],
//       removedOperand = algebraParser.algSimplify(newExpression('MINUS', (leftSide ? rightTerms : leftTerms)[0], oldOperand)),
//       newTerms = leftEnd ? [removedOperand, oldOperand] : [oldOperand, removedOperand];

//   return [[leftSide ? leftTerms : newTerms, leftSide ? newTerms : rightTerms, ['divisionSubtractionBoth', newOperand].join(',')]];
// }

//* Diagrams *//
function showDiagrams(equations) {
  // console.log('showDiagrams');
  equations = pickRandomly(equations, equations.length)
  findDiagrams(diagramCount).map((index, diagram) => buildDiagram($(diagram), equations[index]));
}

function findDiagrams(count) {
  return $([...range(1, count)].map((index) => `#radioExplain${currentRow}Diagram${index}`).join(','));
}

function buildDiagram($diagram, type) {
  // console.log('buildDiagram', $diagram, type);
  if (!type) return;

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
                rightTerms.length > 1 && rightOperandTree && equals(rightOperandTree, rightTerms[0]);

  $diagram.find('input[type="radio"]').val(label);
  buildLine($diagram.find('.leftBoxes'), leftTerms, leftEnd,
            ['subtractionAdditionRight', 'additionBoth', 'divisionMultiplicationRight'].includes(operation) ? null : leftOperandTree,
            ['shortenedLeft', 'subtractionAdditionLeft'].includes(operation), ['subtractionAdditionRight', 'additionBoth'].includes(operation),
            operation == 'subtractionTwiceLeft', ['division', 'divisionLeft', 'divisionMultiplicationLeft'].includes(operation));
  buildLine($diagram.find('.rightBoxes'), rightTerms, leftEnd,
            ['subtractionAdditionLeft', 'additionBoth', 'divisionMultiplicationLeft'].includes(operation) ? null : rightOperandTree,
            ['shortenedRight', 'subtractionAdditionRight'].includes(operation), ['subtractionAdditionLeft', 'additionBoth'].includes(operation),
            operation == 'subtractionTwiceRight', ['division', 'divisionRight', 'divisionMultiplicationRight'].includes(operation));
  moveBars($diagram, leftTerms, rightTerms, leftEnd, leftOperandTree, rightOperandTree, operation == 'division');

  $diagram.removeClass('hidden');
}

function buildLine($line, terms, leftEnd, operandTree, hide, add, double, division) {
  // console.log('buildLine', $line, terms, leftEnd, operandTree, hide, add, double, division);
  terms.forEach((term, index) => {
    let endTerm = leftEnd ? index == 0 : index == terms.length - 1,
        nearEndTerm = leftEnd ? index == 1 : index == terms.length - 2,
        divisor = division && evaluate(operandTree),
        type = endTerm && hide ? 'hide' :
               !division && operandTree && (endTerm || (hide || double) && nearEndTerm) || division && index >= (terms.length / divisor) ? 'dashed' : 'solid',
        sign = add && endTerm;

    buildBox($line.find('.box' + (index + 1)), term, type, leftEnd, sign, terms);});

  if (!division && double && operandTree) buildBox($line.find('.box5'), operandTree, 'movedLess', leftEnd, null, terms);
  if (!division && operandTree) buildBox($line.find('.box6'), operandTree, hide ? 'movedLess' : 'moved', leftEnd, null, terms);
}

function buildBox($box, term, type, leftEnd, sign, terms) {
  // console.log('buildBox', $box, term, type, leftEnd, sign, terms);
  $box.text((sign ? '+' : '') + algebraParser.algStringify(term)).attr('style', `--flex: ${evaluate(term)}`).
    addClass(type).addClass(leftEnd ? 'leftEnd' : 'rightEnd').addClass(hasVariable(term) ? 'variable' : 'constant');
  if (type.startsWith('moved')) $box.attr('style', `--width: ${getLength([term], terms)}%;`);
  $box.removeClass('hidden');
}

function moveBars($diagram, leftTerms, rightTerms, leftEnd, leftOperandTree, rightOperandTree, division) {
  // console.log('moveBars', leftTerms, rightTerms, leftEnd, leftOperandTree, rightOperandTree, division);
  let minWidth = division ? getLength(leftTerms.slice(leftTerms.length / evaluate(leftOperandTree)), leftTerms) :
                 Math.min(leftOperandTree ? getLength([leftOperandTree], leftTerms) : 0,
                          rightOperandTree ? getLength([rightOperandTree], rightTerms) : 0);

  $diagram.find('.startLine').attr('style', `--left: ${!division && leftEnd ? `${minWidth}%` : '0%'}`);
  $diagram.find('.endLine').attr('style', `--right: ${!division && leftEnd ? '0%' : `${minWidth}%`}`);
}

//* Equation utilities *//
function getTerms(expression) {
  return ['PLUS', 'MINUS'].includes(algebraParser.algGetOperator(expression)) ? algebraParser.algGetOperands(expression) : [expression];
}

function addCoefficients(terms) {
  return newExpression('TIMES', newExpression('PLUS', getCoefficient(terms[0]), getCoefficient(terms[1])),
                                getVariable(getVariableTerm(terms)));
}

function multiplyCoefficients(terms) {
  return newExpression('TIMES', newExpression('TIMES', getCoefficient(terms[0]), getCoefficient(terms[1])),
                                getVariable(getVariableTerm(terms)));
}

function replaceCoefficient(term, coefficient) {
  return term.multiplication() ? newExpression('TIMES', new CTATConstantNode(coefficient), getVariable(term)) :
         new CTATConstantNode(coefficient);
}

function subtractTwice(leftSide, rightSide) {
  return newExpression('MINUS', newExpression('MINUS', leftSide, rightSide), rightSide);
}

function newExpression(operator, ...operands) {
  switch (operator) {
    case 'EQUAL': return new CTATRelationNode('EQUAL', ...operands);
    case 'PLUS': return new CTATAdditionNode('PLUS', operands);
    case 'MINUS': return new CTATAdditionNode('MINUS', operands);
    case 'TIMES': return new CTATMultiplicationNode('TIMES', operands);
    case 'DIVIDE': return new CTATMultiplicationNode('DIVIDE', operands);
    case 'VAR': return new CTATVariableNode(algebraParser.parser.yy.variableTable, ...operands);
    case 'CONST': return new CTATConstantNode(...operands);
  default: null;
  }
}

function hasVariable(item) {
  return Array.isArray(item) ? item.some((term) => term.countVariables() > 0) : item.countVariables() > 0;
}

function getVariableTerm(list) {
  return list.find((term) => term.countVariables() > 0);
}

function hasConstant(item) {
  return Array.isArray(item) ? item.some((term) => term.constant()) : item.constant();
}

function getCoefficient(term) {
  return !term ? new CTATConstantNode(0) : term.multiplication() ? term.factors[0] : term.constant() ? term : new CTATConstantNode(1);
}

function getVariable(term) {
  return term.multiplication() ? term.factors[1] : term.constant() ? null : term;
}

function evaluate(item) {
  return Array.isArray(item) ? item.reduce(((sum, term) => sum + term.evaluate()), 0) : item.evaluate();
}

function equals(item1, item2) {
  return item1.equals(item2);
}

function getLength(terms, list) {
  return (100 * evaluate(terms) / evaluate(list));
}

//* General utilities *//
function pickRandomly(list, count) {
  return Array.from({length: count}, () => list.splice(randomInt(list.length), 1)).flat();
}

function randomInt(limit) {
  return Math.floor(Math.random() * limit);
}

function* range(start, end) {
  for (let i = start; i <= end; i++) yield i;
}
