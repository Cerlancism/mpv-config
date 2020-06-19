/**
 * @typedef {Object} CustomConfig
 * @property {string} LOG_PATH 
 * @property {string} FilterRegex
 * @property {string[]} TrimList
 */

 /**
  * @type {CustomConfig}
  */
var config = {
    LOG_PATH: undefined,
    FilterRegex: "/.*/",
    TrimList: []
}

try
{
    var raw = JSON.parse(mp.utils.read_file("~~/config.json"))
    for (var key in raw)
    {
        if (raw.hasOwnProperty(key))
        {
            var element = raw[key];
            config[key] = element
        }
    }
}
catch (error)
{
    mp.msg.warn(error.message)
}

print("Js Custom Config")
dump(config)

module.exports = config
