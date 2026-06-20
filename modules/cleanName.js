//@ts-check

require('./polyfills')

var config = require('./config');
var contentPropertyExtractor = require('./contentPropertyExtractor')

/**
 * @param {any} str
 */
function isLetter(str)
{
    return str.length === 1 && str.match(/[a-z]/i);
}

/**
 * @param {any} num
 */
function isNumeric(num)
{
    return !isNaN(Number(num))
}

/**
 * 
 * @param {string} text 
 * @param {number} length 
 */
function trimEndLength(text, length)
{
    return text.substring(0, text.length - length)
}

/**
 * 
 * @param {string} text 
 * @param {string} end 
 */
function trimeEnd(text, end)
{
    if (text.endsWith(end))
    {
        text = trimEndLength(text, end.length)
    }
    return text
}

var filterRegex = new RegExp(config.FilterRegex)

/**
 * 
 * @param {string} name 
 */
function isCleanseTarget(name)
{
    name = name.split(" ")[0]
    return filterRegex.test(name)
}

/**
 * 
 * @param {string} name 
 */
function expectDash(name)
{
    if (!name.includes("-"))
    {
        if (isLetter(name[0]) && !isLetter(name[1]))
        {
            return name
        }
        var encounteredChar = !isNumeric(name[0])
        var output = ""
        var splited = false
        for (var index = 0; index < name.length; index++)
        {
            var char = name[index];

            if (!splited)
            {
                if (encounteredChar && isNumeric(char))
                {
                    splited = true
                    output += "-" + char
                    continue
                }
                if (!encounteredChar && isLetter(char))
                {
                    encounteredChar = true
                }
            }
            else if (splited && (isLetter(char) || char === ' '))
            {
                break
            }
            output += char
        }
        return output
    }
    return name
}

/**
 * @param {string} path
 * @param {string} name 
 */
module.exports = function (path, name)
{
    try
    {
        print("path: " + path + " name: " + name)
        if (path && path.includes("Regular")) {
            print("Regular input candidate")
            var regularContentId = contentPropertyExtractor.extractContentIdOrFallback(name)
            if (!regularContentId) {
                print("Regular input empty")
                return name
            }
            print("Regular input cleaned: " + regularContentId)

            var titlePrefix = "[Regular]"
            var title = String(mp.get_property("title"))
            
            if (title && !title.includes(titlePrefix)) {
                mp.set_property("title", titlePrefix + " " + title)
            }

            return regularContentId
        }


        if (!isCleanseTarget(name))
        {
            return name
        }
        name = name.split(" ")[0].toUpperCase()

        name = expectDash(name)

        var trimList = config.TrimList.map(function (x) { return x.toUpperCase() })

        for (var index = 0; index < trimList.length; index++)
        {
            var item = trimList[index]
            name = trimeEnd(name, item)
        }

        if (isLetter(name[name.length - 1]))
        {
            name = name.substring(0, name.length - 1)
        }
    }
    catch (error)
    {
        mp.osd_message(error.message + " " + error.stack, 10)
    }

    return name
}
