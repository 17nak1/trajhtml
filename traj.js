/*
 * Trajectory matching
 *   Estimation of parameters for deterministic models
 *
 *   In trajectory matching, one attempts to minimize the discrepancy between a model's predictions and data under the assumption that the latent state process is deterministic
 *   and all discrepancies between model and data are due to measurement error.
 *   The measurement model likelihood (dmeasure), or rather its negative, is the natural measure of the discrepancy.
 *
 *   Trajectory matching is a generalization of the traditional nonlinear least squares approach.
 *
 *   Nelder mead optimization method is used to adjust model parameters to minimize the discrepancies between the power spectrum of model simulations and that of the data.
 *
 *
 *  @return
 *   loglik constructs a stateful objective function for spectrum matching. In particular, this function takes a single numeric-vector argument that is assumed to contain
 *   the parameters named in 'estimated', in that order.
 *   When called, it will return the negative log likelihood.
 *   Each time it is called, it will remember the values of the parameters and its estimate of the log likelihood.
 *
 *  @references
 *   traj_match.R by Aaron A. King. 'https://github.com/kingaa/pomp/blob/abc552b335319bd36b21d3313305c89e97f48f68/R/traj_match.R'
 *  @file       traj.js        This function attempts to match trajectories of a model's deterministic skeleton to data.
 *                             Trajectory matching is equivalent to maximum likelihood estimatedation under the assumption
 *                             that process noise is entirely absent, i.e., that all stochasticity is measurement error.
 *                             Accordingly, this method uses only the skeleton and dmeasure components of a POMP model.
 *
 *  @author     Nazila Akhavan, Christopher Roy
 *  @date       Jan 2019
 *
 * Here are some extra variable definitions for your depth of understanding.
 * birthrateData : Linear interpolation for birth rates.
 * populationData: Linear interpoplation for population.
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


let combineTables = require('./combineTables.js')
let generateSets = require('./generateSets.js')
let snippet = require('./modelSnippet.js')
let sobolSeq = require('./sobolSeq.js')
let mathLib = require('./mathLib')
let fmin    = require('fmin')

// Indicies for params. eg. params[MU] instead of params[3]
const R0Index = 0
const AMPLITUDE = 1
const GAMMA = 2
const MU = 3
const SIGMA = 4
const RHO = 5
const PSI = 6


/** Main entry point to user interface
 */
function traj_match (interpolPopulation, interpolBirth, dataCases, params, times, index, deltaT) { 
  let tempIndex = 0,
      estimated = [],
      place = [],
      solution
  
   //*Change the initial values of estimating parameters(with index one) to the log or logit scale.
  // From those amplitude and rho are in logit scale and the rest are in log scale
  for (let i = 0; i < params.length; i++) {
    params[i] = Number(params[i])
    if (index[i] === AMPLITUDE) {
      place.push(i)
      if ((i === AMPLITUDE) || (i === RHO)) {
        estimated.push(Math.log(params[i] / (1 - params[i]))) //logit scale
      } else {
        estimated.push(Math.log(params[i])) //log scale
      }
    }
  }

  //* Optimizer function using Nelder Mead method
  solution = fmin.nelderMead(logLik, estimated)
  for (let j = 0;j < params.length; j++) {
    if (index[j] === AMPLITUDE) { // Using exp and expit to get back to the regular scale.
      if ((j === AMPLITUDE) || (j === RHO)){
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
      if ((place[i] === AMPLITUDE) || (place[i] === RHO)) { //Change to the exp scale and let optimizer to search all real numbers.
        params[place[i]] = 1 / (1 + Math.exp(-estimated[i]))
      } else {
        params[place[i]] = Math.exp(estimated[i])
      }
    }
    rho = params[5]
    psi = params[6]

    var simH = integrate(interpolPopulation, interpolBirth, params, times, deltaT)
    for (let i = 0; i < simH.length; i++) {
      likvalue = snippet.dmeasure(rho, psi, simH[i], dataCases[i][1], 1)
      loglik = loglik + likvalue
    }
    ;console.log(params, loglik)
    return [-(loglik).toFixed(6)]
  }
  return[params, -solution.fx]
}

//* ODE solver
function integrate (interpolPopulation, interpolBirth, params, times, deltaT) {
  var steps = 200 // Total number of steps in the each interval.
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
  var k = t0 , count
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
  traj_match : traj_match,
  sobolSeq : sobolSeq,
  generateSets :generateSets,
  combineTables: combineTables
}
