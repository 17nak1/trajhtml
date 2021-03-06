/**
 *  @file       Magic.js
 */
let sobolSeq = require('traj_match').sobolSeq
let traj_match = require('traj_match').traj_match
let generateSets = require('traj_match').generateSets
let combinedTables = require('traj_match').combinedTables

function getIndicies(type) {
  if(quickRun) {
    return [0,0,0,0,0,0,0];
  } else {
    switch (type) {
      case 'SOBOL':
        return [1,1,0,1,0,1,1];
        break;
      case 'R0':
        return [0,1,0,1,0,1,1];
        break;
      case 'AMP':
        return [1,0,0,1,0,1,1];
        break;
      case 'MU':
        return [1,1,0,0,0,1,1];
        break;
      case 'Rho':
        return [1,1,0,1,0,0,1];
        break;
      case 'PSI':
        return [1,1,0,1,0,1,0];
        break;
      default:
        return [0,0,0,0,0,0,0];
    }
  }
}
let quickRun = false
/**
  * paramObject : Array of indices for 6 parameters.
  * index is an array of 6 parameters in paramObject. 0 means keep it fixed and 1 means estimate it during computation.
  */
var inputArr = [], init = [], res = [], index = Array(6).fill(0)
let dataCovar = [], dataCases = []
let initalRefinPoints = [], resR0 = [], resAmplitude = [], resMu = [], resRho = [], resPsi = []
let interpolPopulation, interpolBirth, times, modelTimestep, modelt0
const paramObject = {
  R0Index : 0,
  AMPLITUDE : 1,
  GAMMA : 2,
  MU : 3,
  SIGMA : 4,
  RHO : 5,
  PSI : 6
}

function start () {
  let req = new XMLHttpRequest()
  req.open('GET', './demo-compiled.js')
  req.onload = function () {
    code = req.responseText
  }

  var fileChooser = document.getElementById('tab2file1-upload')
  fileChooser.onclick = function () {
    this.value = ''
  }
  document.getElementById('tab2file1-upload').onchange = function () {
    document.getElementById('label-tab2file1').innerHTML = 'Uploaded'
    document.getElementById('label-tab2file1').style.backgroundColor = '#ffbf00'
    var file = this.files[0]
    dataCovar = []
    var reader = new FileReader()
    reader.onload = function () {
      var lines = this.result.split('\n')
      for (var line = 1; line < lines.length; line++) {
        if(lines[line].length) {
          dataCovar.push(lines[line].split(','))
        }
      }
    }
    reader.readAsText(file)
  }

  var fileChooser = document.getElementById('tab2file2-upload')
  fileChooser.onclick = function () {
    this.value = ''
    // Read data from tab "Model and Data"
    let modelp = document.getElementById('modelParameter')
    let modelParameter = modelp.value.split(',')
    let models= document.getElementById('modelStates')
    let modelStates = models.value.split(',')
    let modelz = document.getElementById('zeroName')
    let zeroName = modelz.value.split(',')
    let modelt = document.getElementById('modelt0')
    modelt0= Number(modelt.value)
    modelTimestep = Number(document.getElementById('modelTimestep').value)

    let paramsInitial = modelStates
    var data1 = []
    var data2 = []
    var res = [['R0', 'amplitude', 'gamma', 'mu', 'sigma', 'rho', 'psi', 'S_0', 'E_0', 'I_0', 'R_0', 'LogLik']]
    for (let i = 0; i < dataCovar.length; i++) {
      data1.push([Number(dataCovar[i][0]), Number(dataCovar[i][1])])
      data2.push([Number(dataCovar[i][0]), Number(dataCovar[i][2])])
    }
    interpolPopulation = interpolator(data1)
    interpolBirth = interpolator(data2)
  }

  document.getElementById('tab2file2-upload').onchange = function () {
    document.getElementById('label-tab2file2').innerHTML = 'Uploaded'
    document.getElementById('label-tab2file2').style.backgroundColor = '#ffbf00'
    var file = this.files[0]
    dataCases = []
    var reader = new FileReader ()
    reader.onload = function () {
      var lines = this.result.split('\n')
      for (var line = 1; line < lines.length; line++) {
        if(lines[line].length) {
          dataCases.push(lines[line].split(','))
        }
      }
    }
    reader.readAsText(file)
  }
  /** Tab "Initial Search"
   * Read the table and call traj_match
   */
  let sobolButton = document.getElementById('sobolButton')
  sobolButton.onclick = function () {
    let lowerBounds = [],
     upperBounds = [],
     resSobol = [['R0', 'amplitude', 'gamma', 'mu', 'sigma', 'rho', 'psi', 'S_0', 'E_0', 'I_0', 'R_0', 'LogLik']]
    let sobolBoundTable = document.getElementById('sobolBound')
    let rows = sobolBoundTable.querySelectorAll('tr')
    for(i = 1; i < rows.length - 1; i++){
      let row = rows[i]
      let cols = row.querySelectorAll('td')
      let lowerBound = cols[1].querySelector('input').value
      let upperBound = cols[2].querySelector('input').value
      lowerBounds.push(Number(lowerBound))
      upperBounds.push(Number(upperBound))
    }
    let SobolNumberOfPoints = Number(document.getElementById('sobolPoint').value)
    let sobolSet = sobolSeq.sobolDesign( lowerBounds,  upperBounds, SobolNumberOfPoints)
    for ( let i = 0; i < sobolSet.length; i++) {
      len = sobolSet[i].length
      sobolSet[i].push(1- (sobolSet[i][len - 1] + sobolSet[i][len - 2] + sobolSet[i][len - 3]))
    }
    if(!dataCovar.length) {
      alert('Upload data in "Model and Data", then you can generate and run!')
    } else {
      sobolButton.innerText = 'Running'
      times = [modelt0, Number(dataCases[0][0]), Number(dataCases[dataCases.length - 1][0])];
      index = getIndicies("SOBOL")
      specialLog = document.querySelector('#special-log-sobol');
      test(interpolPopulation, interpolBirth, dataCases, sobolSet, times, index, modelTimestep, 0, resSobol, sobolButton, specialLog)
    }
  }

  // Tab "Refinments"
  var fileChooser = document.getElementById('tab4-upload')
  fileChooser.onclick = function () {
    this.value = ''
    if(!dataCases.length) {
      alert('Upload data in "Model and Data", then you can generate and run!')
    } else {
      times = [modelt0, Number(dataCases[0][0]), Number(dataCases[dataCases.length - 1][0])]
    }
  }
  document.getElementById('tab4-upload').onchange = function () {
    document.getElementById('label-tab4').innerHTML = 'Uploaded'
    document.getElementById('label-tab4').style.backgroundColor = '#ffbf00'
    var file = this.files[0]
    initalRefinPoints = []
    var reader = new FileReader ()
    reader.onload = function () {
      var lines = this.result.split('\n')
      for (var line = 0; line < lines.length; line++) {
        if(lines[line].length) {
          initalRefinPoints.push(lines[line].split(','))
        }
      }
      for ( let i = 0; i <initalRefinPoints.length; i++) {
        for (let j = 0; j < initalRefinPoints[0].length; j++) {
          initalRefinPoints[i][j] = Number(initalRefinPoints[i][j])
        }
      }
    }
    reader.readAsText(file)
  }

  let logScale = 0, flagBound = 0
  let lowerLimit, upperLimit, NoPoints, flag, logScaleParam, generatedSet
  //  R0
  let runButtonR0 = document.getElementById('buttonRunR0')
  runButtonR0.onclick = function () {
    if(!dataCovar.length || ! initalRefinPoints.length) {
      if((!dataCovar.length)) {
        alert('Upload data in "Model and Data", then you can generate and run!')
      } else {
        alert('Upload initial data!')
      }
    } else {
      resR0 = [['R0', 'amplitude', 'gamma', 'mu', 'sigma', 'rho', 'psi', 'S_0', 'E_0', 'I_0', 'R_0', 'LogLik']]
      logScale = 0, flagBound = 0
      let logScaleParam = document.getElementById('logScaleR0').checked
      if(logScaleParam) {
        logScale = 1
      }
      lowerLimit = Number(document.getElementById('limit1R0').value)
      upperLimit = Number(document.getElementById('limit2R0').value)
      NoPoints = Number(document.getElementById('NoPointsR0').value)
      flag = document.getElementById('flagR0').checked
      if(flag) {
        flagBound = 1
      }
      generatedSet = generateSets.generateSet(initalRefinPoints, paramObject.R0Index, logScale, [lowerLimit,upperLimit], flagBound, NoPoints)
      index = getIndicies('R0')
      // In generatedSet the first row is the name,skip from it.
      specialLog = document.querySelector('#special-log-R0');
      test(interpolPopulation, interpolBirth, dataCases, generatedSet, times, index, modelTimestep, 1, resR0, runButtonR0, specialLog) 
    }
  }
  // Amplitude
  let runButtonAmp = document.getElementById('buttonRunAmplitude')
  runButtonAmp.onclick = function () {
    if(!dataCovar.length || ! initalRefinPoints.length) {
      if((!dataCovar.length)) {
        alert('Upload data in "Model and Data", then you can generate and run!')
      } else {
        alert('Upload initial data!')
      }
    } else {
      resAmplitude = [['R0', 'amplitude', 'gamma', 'mu', 'sigma', 'rho', 'psi', 'S_0', 'E_0', 'I_0', 'R_0', 'LogLik']]
      logScale = 0, flagBound = 0
      logScaleParam = document.getElementById('logScaleAmplitude').checked
      if(logScaleParam) {
        logScale = 1
      }
      lowerLimit = Number(document.getElementById('limit1Amplitude').value)
      upperLimit = Number(document.getElementById('limit2Amplitude').value)
      NoPoints = Number(document.getElementById('NoPointsAmplitude').value)
      flag = document.getElementById('flagAmplitude').checked
      if(flag) {
        flagBound = 1
      }
      generatedSet = generateSets.generateSet(initalRefinPoints, paramObject.AMPLITUDE, logScale, [lowerLimit,upperLimit], flagBound, NoPoints)
      index = getIndicies('AMP')
      // In generatedSet the first row is the name,skip from it.
      let specialLog = document.querySelector('#special-log-Amplitude');
      test(interpolPopulation, interpolBirth, dataCases, generatedSet, times, index, modelTimestep, 1, resAmplitude, runButtonAmp, specialLog)
    }  
  }

  // Mu
  let runButtonMu = document.getElementById('buttonRunMu')
  runButtonMu.onclick = function () {
    if(!dataCovar.length || ! initalRefinPoints.length) {
      if((!dataCovar.length)) {
        alert('Upload data in "Model and Data", then you can generate and run!')
      } else {
        alert('Upload initial data!')
      }
    } else {
      resMu = [['R0', 'amplitude', 'gamma', 'mu', 'sigma', 'rho', 'psi', 'S_0', 'E_0', 'I_0', 'R_0', 'LogLik']]
      logScale = 0, flagBound = 0
      let logScaleParam = document.getElementById('logScaleMu').checked
      if(logScaleParam) {
        logScale = 1
      }
      let lowerLimit = Number(document.getElementById('limit1Mu').value)
      let upperLimit = Number(document.getElementById('limit2Mu').value)
      let NoPoints = Number(document.getElementById('NoPointsMu').value)
      let flag = document.getElementById('flagMu').checked
      if(flag) {
        flagBound = 1
      }
      generatedSet = generateSets.generateSet(initalRefinPoints, paramObject.MU, logScale, [lowerLimit,upperLimit], flagBound, NoPoints)
      index = getIndicies('MU')
      let specialLog = document.querySelector('#special-log-Mu');
      test(interpolPopulation, interpolBirth, dataCases, generatedSet, times, index, modelTimestep, 1, resMu, runButtonMu, specialLog)
    } 
  }

    // Rho
    let runButtonRho = document.getElementById('buttonRunRho')
    runButtonRho.onclick = function () {
      if(!dataCovar.length || ! initalRefinPoints.length) {
      if((!dataCovar.length)) {
        alert('Upload data in "Model and Data", then you can generate and run!')
      } else {
        alert('Upload initial data!')
      }
    } else {
      resRho = [['R0', 'amplitude', 'gamma', 'mu', 'sigma', 'rho', 'psi', 'S_0', 'E_0', 'I_0', 'R_0', 'LogLik']]
      logScale = 0, flagBound = 0
      let logScaleParam = document.getElementById('logScaleRho').checked
      if(logScaleParam) {
        logScale = 1
      }
      let lowerLimit = Number(document.getElementById('limit1Rho').value)
      let upperLimit = Number(document.getElementById('limit2Rho').value)
      let NoPoints = Number(document.getElementById('NoPointsRho').value)
      let flag = document.getElementById('flagRho').checked
      if(flag) {
        flagBound = 1
      }
      generatedSet = generateSets.generateSet(initalRefinPoints, paramObject.RHO, logScale, [lowerLimit,upperLimit], flagBound, NoPoints)
      index = getIndicies('RHO')
      let specialLog = document.querySelector('#special-log-Rho');
      test(interpolPopulation, interpolBirth, dataCases, generatedSet, times, index, modelTimestep, 1, resRho, runButtonRho, specialLog)
    } 
  }

  // Psi
  let runButtonPsi = document.getElementById('buttonRunPsi')
  runButtonPsi.onclick = function () {
    if(!dataCovar.length || ! initalRefinPoints.length) {
      if((!dataCovar.length)) {
        alert('Upload data in "Model and Data", then you can generate and run!')
      } else {
        alert('Upload initial data!')
      }
    } else {
      resPsi = [['R0', 'amplitude', 'gamma', 'mu', 'sigma', 'rho', 'psi', 'S_0', 'E_0', 'I_0', 'R_0', 'LogLik']]
      logScale = 0, flagBound = 0
      let logScaleParam = document.getElementById('logScalePsi').checked
      if(logScaleParam) {
        logScale = 1
      }
      let lowerLimit = Number(document.getElementById('limit1Psi').value)
      let upperLimit = Number(document.getElementById('limit2Psi').value)
      let NoPoints = Number(document.getElementById('NoPointsPsi').value)
      let flag = document.getElementById('flagPsi').checked
      if(flag) {
        flagBound = 1
      }
      generatedSet = generateSets.generateSet(initalRefinPoints, paramObject.PSI, logScale, [lowerLimit,upperLimit], flagBound, NoPoints)
      index = getIndicies('PSI')
      let specialLog = document.querySelector('#special-log-Psi');
      test(interpolPopulation, interpolBirth, dataCases, generatedSet, times, index, modelTimestep, 1, resPsi, runButtonPsi, specialLog)
    }  
  }

  let combineButton = document.getElementById('combineButton')
  combineButton.onclick = function () {
    combinedRes = combineTables.combine([initalRefinPoints, resR0, resAmplitude, resMu, resRho, resPsi])
    combineButton.innerText = "Download"
    combinedRes = [['R0', 'amplitude', 'gamma', 'mu', 'sigma', 'rho', 'psi', 'S_0', 'E_0', 'I_0', 'R_0', 'LogLik']].concat(combinedRes)
    combineButton.onclick = function () {
      Csv(combinedRes)
    }
  }
  // Accordion
  var acc = document.getElementsByClassName("accordion")
  for (i = 0; i < acc.length; i++) {
    acc[i].addEventListener("click", function() {
      this.classList.toggle("active")
      var panel = this.nextElementSibling
      if (panel.style.maxHeight){
        panel.style.maxHeight = null;
      } else {
        panel.style.maxHeight = panel.scrollHeight + "px"
      }
    })
  }
}

// Helper functions
function Csv (res) {
  var csv = ''
  res.forEach(function (row) {
    csv += row.join(',')
    csv += '\n'
  })
  var hiddenElement = document.createElement('a')
  hiddenElement.href = 'data:text/csv;charset=utf-8,' + encodeURI(csv)
  hiddenElement.setAttribute('download', 'result.csv')
  hiddenElement.click()
}

function interpolator(points) {
  var first, n = points.length - 1,
    interpolated,
    leftExtrapolated,
    rightExtrapolated;
  if (points.length === 0) {
    return function () {
      return 0
    }
  }
  if (points.length === 1) {
    return function () {
      return points[0][1]
    }
  }
  points = points.sort(function (a, b) {
    return a[0] - b[0]
  })
  first = points[0]

  leftExtrapolated = function (x) {
    var a = points[0], b = points[1];
    return a[1] + (x - a[0]) * (b[1] - a[1]) / (b[0] - a[0])
  }
  interpolated = function (x, a, b) {
    return a[1] + (x - a[0]) * (b[1] - a[1]) / (b[0] - a[0])
  }
  rightExtrapolated = function (x) {
    var a = points[n - 1], b = points[n];
    return b[1] + (x - b[0]) * (b[1] - a[1]) / (b[0] - a[0])
  }
  return function (x) {
    var i
    if (x <= first[0]) {
      return leftExtrapolated(x)
    }
    for (i = 0; i < n; i += 1) {
      if (x > points[i][0] && x <= points[i + 1][0]) {
        return interpolated(x, points[i], points[i + 1])
      }
    }
    return rightExtrapolated(x);
  }
}

function specialLogFun(arg, specialLog) {
  for(let i = 0;i < arg.length;i++) {
    specialLog.value += arg[i].toString() + '\n';
  }
}

function test(a, b, c, d, e, f, g, i, res, runButton, specialLog){
  ans = traj_match(a, b, c, d[i], e, f, g)
  res.push(ans)
  if( i < d.length - 1){
    specialLogFun([ans], specialLog)
    runButton.onclick = function () {Csv(res)}
    setTimeout(function () {test(a, b, c, d, e, f, g, i + 1, res, runButton, specialLog)},0)
  } else {
    specialLogFun([ans], specialLog)
    runButton.innerText = 'Download'
    runButton.onclick = function () {Csv(res)}
  }
}

