const VERSION = '0.0.1'

var net = require('net')

var HOST = '127.0.0.1'
var PORT = 8180
var runningApps = {}

var client
var cmdID = 0
var cmdResult = {}
var connected

var stateTrigger = {
  'subscribe': async (appid, entityId, name, from, to, last, cb) => {
    var rst
    var d = {
      'type': 'state_changed',
      'appid': appid,
      'entity_id': entityId,
      'name': name || 'state',
      'from': from || undefined,
      'to': to || undefined,
      'last': last || 0
    }
    var id = sendCommand('subTrigger', d)
    try {
      rst = await receiveResponse(id)
    } catch (e) {
      console.log(`ERROR: receive ping command ${id} failed. ${e.message}`)
      return false
    }
    delete cmdResult[id]
    if (rst.result === 'ok') {
      var triggerId = rst.message
      runningApps[appid].subscribedTriggers[triggerId] = cb
      return true
    } else {
      return false
    }
  }
}
var state = {
  'get': async (entityId, stateName) => {
    return await stateGet(entityId, stateName)
  },
  'compare': async (entityId, stateName, opt, targetValue, cb) => {
    var stateValue = await stateGet(entityId, stateName)
    if (stateCompare(stateValue, targetValue, opt)) {
      await cb()
    }
  }
}
var service = {
  'call': async (domain, service, data) => {
    var rst
    var d = {
      'domain': domain,
      'service': service,
      'data': data
    }
    var id = sendCommand('callService', d)
    try {
      rst = await receiveResponse(id)
    } catch (e) {
      console.log(`ERROR: receive ping command ${id} failed. ${e.message}`)
      return false
    }
    delete cmdResult[id]
    if (rst.result === 'ok') {
      return true
    } else {
      return false
    }
  }
}
var utils = {
  'delay': (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

main()

// main function
function main () {
  console.log(`VERSION=${VERSION}`)
  start()
}

function formatValue(value) {
  if (typeof(value) === "string") {
    return value.toLowerCase()
  } else if (typeof(value) === "number") {
    return value.toString()
  } else {
    return value
  }
}

function stateCompare(stateValue, targetValue, opt) {
  switch(opt) {
    case 'EQ': return formatValue(stateValue) == formatValue(targetValue)
    case 'NEQ': return formatValue(stateValue) != formatValue(targetValue)
    case 'GTE': return formatValue(stateValue) >= formatValue(targetValue)
    case 'GT': return formatValue(stateValue) > formatValue(targetValue)
    case 'LSE': return formatValue(stateValue) <= formatValue(targetValue)
    case 'LS': return formatValue(stateValue) < formatValue(targetValue)
  }
}

async function stateGet(entityId, stateName) {
  var rst
  var d = {
    'entity_id': entityId,
    'name': stateName
  }
  var id = sendCommand('getState', d)
  try {
    rst = await receiveResponse(id)
  } catch (e) {
    console.log(`ERROR: receive ping command ${id} failed. ${e.message}`)
    return null
  }
  delete cmdResult[id]
  if (rst.result === 'ok') {
    return rst.message
  } else {
    return null
  }
}

var clientDataBuffer

function receiveCommandHandler (jsonString) {
  var data = JSON.parse(jsonString)
  var cmd = data.cmd
  if (cmd === 'emitTrigger') {
    emitTriggerCallback(data.data.id)
  } else if (cmd === 'unSubTrigger') {
    unSubTriggerCallback(data.data.id)
  } else if (cmd === 'suspendApp') {
    suspendAppCallback(data.data.id)
  } else if (cmd === 'startApp') {
    startAppCallback(data.data.id, data.data.path)
  } else if (cmd === 'healthCheck') {
    healthCheckCallback()
  } else {
    if (data.hasOwnProperty('result')) {
      // Receive manager result. data.id is same as cmdID
      if (cmdResult.hasOwnProperty(data.id)) {
        // Receive result callback is set before. Emit it and remove it
        cmdResult[data.id].callback(data)
      } else {
        // Save this data, wait for other command use it.
        cmdResult[data.id] = { 'data': data }
      }
    } else {
      console.log(`Unsupported command ${cmd}`)
    }
  }
}

function getJSONStringFromDataBuffer () {
  var begin = 0
  var end = 0
  var index = 0
  var count = -1
  while (clientDataBuffer[index] !== undefined) {
    if (count < 0) {
      // No valid begin find.
      if (clientDataBuffer[index] === '{') {
        count = 1
        begin = index
      }
      index++
      continue
    } else {
      // need find valid end.
      if (clientDataBuffer[index] === '{') {
        count++
      } else if (clientDataBuffer[index] === '}') {
        count--
      }
      if (count === 0) {
        // Valid JSON.
        end = index + 1
        break
      }
      index++
      continue
      // TODO: Need handle \{ \}
    }
  }
  if (count === 0) {
    var ret = clientDataBuffer.substring(begin, end)
    clientDataBuffer = clientDataBuffer.substring(end)
    return ret
  }
  return ''
}

function receiveDataHandler () {
  while (true) {
    let jsonString = getJSONStringFromDataBuffer()
    if (jsonString === '') {
      return
    }
    receiveCommandHandler(jsonString)
  }
}

// Start socket client
function start () {
  client = new net.Socket()
  client.connect(PORT, HOST, () => {
    connected = true
    // Loop here
    setTimeout(heartbeat, 5000)
  })
  // Set on data
  client.on('data', (data) => {
    clientDataBuffer = clientDataBuffer + data

    receiveDataHandler()
  })

  client.on('error', (e) => {
    console.log(`client failed ${e.message}`)
    client.end()
  })

  // Set on close
  client.on('close', () => {
    console.log(`Bridge server closed.`)
    connected = false
    setTimeout(start, 5000)
  })

  setTimeout(wait, 1000)
}

// Loop to send ping command
function heartbeat () {
  if (connected && sendPingCommand()) {
    setTimeout(heartbeat, 5000)
  } else {
    console.log(`Bridge server crashed.`)
  }
}

// Loop to send ping command
function wait () {
  if (connected) {
    setTimeout(wait, 5000)
  } else {
    console.log(`Bridge server disconnected.`)
  }
}

function emitTriggerCallback (tID) {
  for (let appID in runningApps) {
    if (runningApps[appID].subscribedTriggers) {
      for (let triggerID in runningApps[appID].subscribedTriggers) {
        if (tID == triggerID) {
          runningApps[appID].subscribedTriggers[triggerID]()
        }
      }
    }
  }
}

function unSubTriggerCallback (tID) {
  for (let appID in runningApps) {
    if (runningApps[appID].subscribedTriggers) {
      for (let triggerID in runningApps[appID].subscribedTriggers) {
        if (tID == triggerID) {
          delete runningApps[appID].subscribedTriggers[triggerID]
        }
      }
    }
  }
}

function suspendAppCallback (aID) {
  for (let appID in runningApps) {
    if (aID == appID) {
      try {
        runningApps[appID].module.suspend(stateTrigger, state, service, utils)
      } catch (e) {
        sendErrorCommand(aID, `Failed to suspend APP ${aID}. ${e.message}.`)
        return false
      }
      delete runningApps[appID]
    }
  }
}

function healthCheckCallback () {
  console.log(`---------------------------------------------`)
  console.log(`Socket: tcp://${HOST}:${PORT} ${(connected)? 'connecte': 'disconnect'}`)
  console.log(`Running Apps : ${JSON.stringify(runningApps)}`)
  console.log(`command results : ${JSON.stringify(cmdResult)}`)
}

/**
 * Removes a module from the cache
 */
function purgeCache (moduleName) {
  // Traverse the cache looking for the files
  // loaded by the specified module name
  searchCache(moduleName, function (mod) {
    delete require.cache[mod.id]
  })

  // Remove cached paths to the module.
  // Thanks to @bentael for pointing this out.
  Object.keys(module.constructor._pathCache).forEach((cacheKey) => {
    if (cacheKey.indexOf(moduleName) > 0) {
      delete module.constructor._pathCache[cacheKey]
    }
  })
}

/**
* Traverses the cache to search for all the cached
* files of the specified module name
*/
function searchCache (moduleName, callback) {
  // Resolve the module identified by the specified name
  var mod = require.resolve(moduleName)

  // Check if the module has been resolved and found within
  // the cache
  if (mod && ((mod = require.cache[mod]) !== undefined)) {
    // Recursively go over the results
    (function traverse (mod) {
      // Go over each of the module's children and
      // traverse them
      mod.children.forEach(function (child) {
        traverse(child)
      })

      // Call the specified callback providing the
      // found cached module
      callback(mod)
    }(mod))
  }
}

function startAppCallback (aID, aPath) {
  runningApps[aID] = {}
  runningApps[aID].subscribedTriggers = {}
  try {
    purgeCache(aPath)
    var appModule = require(aPath)
    appModule.start(aID, stateTrigger, state, service, utils)
  } catch (e) {
    sendErrorCommand(aID, `Failed to start ${aPath}. ${e.message}.`)
    return false
  }
  runningApps[aID].module = appModule
  return true
}

function sendErrorCommand (appid, message) {
  var d = {
    'appid': appid,
    'message': message
  }
  sendCommand('error', d)
  return true
}

async function sendPingCommand () {
  var rst
  var id = sendCommand('ping')

  try {
    rst = await receiveResponse(id)
  } catch (e) {
    console.log(`ERROR: receive ping command ${id} failed. ${e.message}`)
    return true
  }
  delete cmdResult[id]
  if (rst.result === 'ok') {
    return true
  } else {
    return false
  }
}

function receiveResponse (id, timeout) {
  return new Promise((resolve, reject) => {
    if (cmdResult.hasOwnProperty(id)) {
      // Result has receive, return it
      return resolve(cmdResult[id].data)
    } else {
      cmdResult[id] = { 'callback': (data) => { return resolve(data) } }
    }
    timeout = timeout || 1000
    setTimeout(() => { return reject(new Error(`TIMEOUT`)) }, timeout)
  })
}

function sendCommand (cmd, data) {
  var d = {}
  cmdID = cmdID + 1
  d.id = cmdID
  d.cmd = cmd
  for (let key in data) {
    d[key] = data[key]
  }
  client.write(JSON.stringify(d))
  return d.id
}
