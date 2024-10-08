//@ts-check
var cleanName = require("../modules/cleanName")

var LOG_PATH = require("../modules/config").LOG_PATH;

//@ts-ignore
var titleTemplate = mp.get_property("title")

; (function ()
{
    if (!LOG_PATH)
    {
        print("No logging")
        return
    }

    /**
     * @type {string[]}
     */
    var playingList = []

    function getLogName()
    {
        var filename = String(mp.get_property("filename/no-ext"))
        var cleanedName = cleanName(filename)
		if (filename == cleanedName) {
			var splits = cleanedName.split("#")
			cleanedName = splits[0].trim()
		}
		return cleanedName
    }

    /**
     * 
     * @param {string} file 
     */
    function getHistoryFile(file)
    {
        try
        {
            return mp.utils.read_file(file)
        }
        catch (error)
        {
            return ""
        }
    }

    /**
     * 
     * @param {string} raw 
     */
    function checkIntegrity(raw)
    {
        if (raw === undefined)
        {
            return ""
        }
        if (raw === "")
        {
            return raw
        }
        if (raw[raw.length - 1] === "\n")
        {
            return raw
        }
        else
        {
            return raw.split("\n")
                .filter(function (x)
                {
                    var splits = x.split(" ")

                    return splits.length == 2 && splits.every(function (y)
                    {
                        return !isNaN(Number(y))
                    })
                })
                .join("\n") + "\n"
        }
    }

    mp.register_event("file-loaded", function ()
    {
        var cleaned = getLogName()
        var target = LOG_PATH + cleaned + ".dat"

        if (target.length > 128)
        {
            print("history name too long")
            return
        }

        playingList.push(cleaned)

        var history = checkIntegrity(getHistoryFile(target))
        var playedTime = history.split("\n")
            .map(function (x)
            {
                if (!x)
                {
                    return 0
                }
                var parts = x.split(" ")
                return Number(parts[1]) - Number(parts[0])
            })
            .reduce(function (a, b)
            {
                return a + b
            }, 0)
        var output = history + Date.now()
        var playTimeMessage = (playedTime / 1000).toFixed(2) + " s"
        var message = cleaned + " history: " + playTimeMessage
        print(message)
        // mp.osd_message(message, 5)
        mp.utils.write_file("file://" + target, output)

        print("Title: " + titleTemplate)
        //@ts-ignore
        mp.set_property("title", titleTemplate + "    " + playTimeMessage)
    })

    mp.register_event("end-file", function ()
    {
        var time = Date.now()
        var last = playingList.shift()

        if (!last)
        {
            return
        }

        var target = LOG_PATH + last + ".dat"

        var history = getHistoryFile(target)
        var lines = history.split("\n")

        // There is least one other session playing the same file simultaniously
        // Abort the end log as it will likely corrupt the log file due to the data race
        if (lines[lines.length - 1].length === 0)
        {
            return
        }

        var output = history + " " + time + "\n"

        mp.utils.write_file("file://" + target, output)
    })
})()
