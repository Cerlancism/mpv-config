//@ts-check

require('./polyfills')

var config = require('./config')

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

/**
 * 
 * @param {string} name 
 */
function isCleanseTarget(name)
{
    return name.match(new RegExp(config.FilterRegex))
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
 * 
 * @param {string} name 
 */
module.exports = function (name)
{
    try
    {
        if (!isCleanseTarget(name))
        {
            return name
        }
        name = name.toUpperCase()

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
