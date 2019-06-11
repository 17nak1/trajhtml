/**
 *  @file       traj.js        This function attempts to match trajectories of a model's deterministic skeleton to data.
 *                             Trajectory matching is equivalent to maximum likelihood estimatedation under the assumption 
 *                             that process noise is entirely absent, i.e., that all stochasticity is measurement error.
 *                             Accordingly, this method uses only the skeleton and dmeasure components of a POMP model.
 *
 *  @author     Nazila Akhavan
 *  @date       Jan 2019
 */

// let linearInterpolator = require('linear-interpolator/node_main')
let snippet = require('./modelSnippet.js')
let mathLib = require('./mathLib')
let fmin    = require('fmin')
let sobolSeq = require('./sobolSeq.js')

/**
  * interpolBirth : Linear interpolation for birth rates.
  * interpolPopulation   : Linear interpoplation for population.
  * dataCovar     : Matrix created in "creadataStartTimeSet.R". 
  * dataCases     : Matrix created in "creadataStartTimeSet.R". 
  * params        : Array of parameters and initial states i.e. [R0, amplitude, gamma, mu, sigma, rho, psi, S_0, E_0, I_0, R_0]
  * times         : Array of 2 values, t0 and start time in dataCases
  * index         : Array with value 1 at the place of the parameters who are going to be estimated.
  * place         : Array include the index of parameters who are going to be estimated.
  * estimated     : Array of initial value of the parameters who are going to be estimated.
  * deltaT        : It is considered biweekly (2/52).
  * states        : Empty array for calculated states.
  * solution      : Include the result of  the optimizer function using Nelder Mead method.
  */
function traj_match (interpolPopulation, interpolBirth, dataCases, params, times, index, deltaT) { 
  var tempIndex = 0
  var estimated = []
  var place = []
  var solution
  
   //*Change the initial values of estimating parameters(with index one) to the log or logit scale.
  // From those amplitude and rho (parameters number 1 and 5) are in logit scale and the rest are in log scale
  for (let i = 0; i < params.length; i++) {
    params[i] = Number(params[i])
    if (index[i] === 1) {
      place.push(i)
      if ((i === 1) || (i === 5)) {
        estimated.push(Math.log(params[i] / (1 - params[i]))) //logit scale
      } else {
        estimated.push(Math.log(params[i])) //log scale
      }
    }
  }


  //* Optimizer function using Nelder Mead method
  solution = fmin.nelderMead(logLik, estimated)
  for (let j = 0;j < params.length; j++) {
    if (index[j] === 1) { // Using exp and expit to get back to the regular scale.
      if ((j === 1) || (j === 5)){
        params[j] = 1/ (1 + Math.exp(-solution.x[tempIndex]))
      } else {
        params[j] = Math.exp(solution.x[tempIndex])
      }
      tempIndex++
    }
  }
  

  //* calculate log likelihood
  function logLik (estimated) {
    var likvalue = 0
    var loglik = 0
    var rho 
    var psi 
    for (let i = 0; i < estimated.length; i++) {
      if ((place[i] === 1) || (place[i] === 5)) { //Change to the exp scale and let optimizer to search all real numbers.
        params[place[i]] = 1 / (1 + Math.exp(-estimated[i]))
      } else {
        params[place[i]] = Math.exp(estimated[i])
      }
    }
    rho = params[5]
    psi = params[6]

    var simH = integrate(interpolPopulation, interpolBirth, params, times, deltaT)
    for (let i = 0; i < simH.length; i++) {
      likvalue = snippet.dmeasure(rho, psi, simH[i], dataCases[i][1])
      loglik = loglik + Math.log(likvalue)
    }
    ;console.log(params, loglik)
    return [-(loglik).toFixed(6)]
  }
  // console.log(params, -solution.fx)
  return[params, -solution.fx]
}

//* ODE solver
function integrate (interpolPopulation, interpolBirth, params, times, deltaT) {
  var steps = 300 // Total number of steps in the Euler method
  var t0 = times[0]
  var dataStartTime = times[1]
  var dataEndTime = times[2]
  var rho = params[5]
  var psi = params[6]
  var arr = []
  var pop 
  var birthrate
  var timetemp
  var Npre

  var N = snippet.initz(interpolPopulation(t0), params[7], params[8], params[9], params[10])
  var  k = t0 , count
  var flag = 0
  dt = deltaT
  while ( flag === 0 ) {
    Npre = N
    for (let stp = 0; stp < steps; stp++) { 
      pop = interpolPopulation(k + stp / steps * dt)
      birthrate = interpolBirth(k + stp / steps * dt)
      N = mathLib.odeMethod('rkf45', snippet.skeleton, N, k + stp / steps * dt, 1 / steps * dt, params, pop, birthrate)
    }

    timetemp = k
    k += dt
    if (k > dataStartTime) {
      k = timetemp;
      dt = dataStartTime - timetemp ;
      N = Npre
    }
    if (k >= dataStartTime) {  
      k = timetemp + dt
      flag = 1
      arr.push(N[4])
    }
  }

  count = 0
  while (k < dataEndTime) {
    
    if (Number(dataCases[count + 1][0]) !== "undefined") {
      dt = Number(dataCases[count + 1][0]) - Number(dataCases[count][0])
    } else {
      dt = deltaT
    }
    
    N[4] = 0
    for (let stp = 0; stp < steps; stp++) { 
      pop = interpolPopulation(k + stp / steps * dt)
      birthrate = interpolBirth(k + stp / steps * dt)
      N = mathLib.odeMethod('rkf45', snippet.skeleton, N, k + stp / steps * dt, 1 / steps * dt, params, pop, birthrate)
      H = N[4]
    }
    k += dt
    count++
    arr.push(H)
  }
  return arr
}
module.exports = {
  traj_match :   traj_match,
  sobolSeq : sobolSeq
}
