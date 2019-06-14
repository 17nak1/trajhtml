/**
 *  @file      combineTables.js       This function clean, sort and combine tables in csv files.
 *                                    runs : The array of parameters that wants to combine their tables.
 *  @return                           A sorted table based on the "LogLik" column.
 *  @reference                        Aaron A. King.
 *  @author    Nazila Akhavan
 *  @date      March 2019
 */

combineTables = {}

combineTables.combine = function (runArray) {
  let allSets = [] 
  var newSet
  for ( run = 0; run < runArray.length; run++){
    var table = [], dataset = []
    var table = runArray[run]
    table.sort(sortFunction)

    newSet = {}
    table.forEach(function(arr){
      newSet[arr.join("|")] = arr
    })
    dataset = Object.keys(newSet).map(function(k){
      return newSet[k]
    })
    allSets.push(...dataset) 
  }

  allSets.sort(sortFunction)
  return allSets
}

// Helper function
function sortFunction(a, b) {
  if (Number(a[a.length - 1]) === Number(b[a.length - 1])) {
    return 0
  }
  else {
    return (Number(a[a.length - 1]) < Number(b[a.length - 1])) ? 1 : -1;
  }
}

module.exports = combineTables