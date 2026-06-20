/**
 * @typedef {Object} ProcessedFileStructure
 * @property {string|null} publisher - Extracted from [...]
 * @property {string|null} series - Extracted from {...}
 * @property {string|null} date - Extracted from (...)
 * @property {string|null} contentId - Unique identifier (episode number, file ID)
 * @property {string|null} title - Extracted from backtick-wrapped section
 * @property {Array<string>|null} sideCasts - Secondary cast members (not currently extracted)
 * @property {Array<string>|null} casts - Cast names extracted from \@ mentions
 * @property {Array<string>|null} tags - Tags extracted from #hashtags
 */

/**
 * Extract structured metadata from a processed filename
 *
 * Inverse of buildProcessedFilename() - extracts the structure that was built.
 * Pure ES5 compatible - designed for portability to other runtimes (MUJS, mpv, etc.)
 *
 * Format: [Publisher]{Series}(Date) ContentId `Title` SideCasts \@Cast1 \@Cast2 #tag1 #tag2 .extension
 *
 * @param {string} fileName - The processed filename to parse
 * @returns {ProcessedFileStructure} Extracted structure with all parsed fields
 */
function extractProcessedStructure(fileName) {
    var trimmed = fileName.trim()
    var result = {
        publisher: null,
        series: null,
        date: null,
        contentId: null,
        title: null,
        sideCasts: [],
        casts: [],
        tags: []
    }

    // Work with filename as-is (extension handling not needed)
    var withoutExt = trimmed

    // Extract metadata [Publisher]{Series}(Date)
    // Try to extract publisher (required if present)
    var publisherMatch = withoutExt.match(/^\s*\[([^\]]*)\]/)
    var publisherEnd = publisherMatch ? publisherMatch[0].length : 0
    var afterPublisher = publisherEnd > 0 ? withoutExt.substring(publisherEnd) : withoutExt

    // Try to extract series
    var seriesMatch = afterPublisher.match(/^\s*\{([^\}]*)\}/)
    var seriesEnd = publisherEnd + (seriesMatch ? seriesMatch[0].length : 0)
    var afterSeries = seriesMatch ? afterPublisher.substring(seriesMatch[0].length) : afterPublisher

    // Try to extract date
    var dateMatch = afterSeries.match(/^\s*\(([^\)]*)\)/)
    var contentStart = seriesEnd + (dateMatch ? dateMatch[0].length : 0)

    if (publisherMatch) {
        result.publisher = publisherMatch[1] || null
    }
    if (seriesMatch) {
        result.series = seriesMatch[1] || null
    }
    if (dateMatch) {
        result.date = dateMatch[1] || null
    }

    // Extract from contentStart onwards
    var remaining = withoutExt.substring(contentStart)

    // Find key delimiters
    var backtickIndex = remaining.indexOf('`')
    var atIndex = remaining.indexOf('@')
    var hashIndex = remaining.indexOf('#')

    // Determine where title/casts/tags section starts
    var titleStart = backtickIndex !== -1 ? backtickIndex : (atIndex !== -1 ? atIndex : (hashIndex !== -1 ? hashIndex : -1))

    // Extract contentId (everything before title/casts/tags)
    var beforeTitle
    if (titleStart !== -1) {
        beforeTitle = remaining.substring(0, titleStart).trim()
    } else {
        beforeTitle = remaining.trim()
    }

    if (beforeTitle) {
        var tokens = beforeTitle.split(/\s+/)
        var validTokens = []
        for (var i = 0; i < tokens.length; i++) {
            if (tokens[i]) {
                validTokens.push(tokens[i])
            }
        }
        if (validTokens.length > 0) {
            // Last token before title is typically the content ID
            result.contentId = validTokens[validTokens.length - 1]
        }
    }

    // If no title section found, return early
    if (titleStart === -1) {
        return result
    }

    // Extract title (between backticks)
    if (backtickIndex !== -1) {
        var titleEnd = remaining.indexOf('`', backtickIndex + 1)
        if (titleEnd !== -1) {
            result.title = remaining.substring(backtickIndex + 1, titleEnd).trim()
        }
    }

    // Extract casts (starting with @) and tags (starting with #)
    var afterTitleStart = backtickIndex !== -1 && remaining.indexOf('`', backtickIndex + 1) !== -1
        ? remaining.indexOf('`', backtickIndex + 1) + 1
        : Math.max(backtickIndex, atIndex, hashIndex)
    var afterTitle = afterTitleStart !== -1 ? remaining.substring(afterTitleStart) : ''

    // Parse mentions (@Cast) and tags (#tag)
    var mentionRegex = /@([^\s@#]+)/g
    var tagRegex = /#([^\s@#]+)/g

    var mentionMatch
    while ((mentionMatch = mentionRegex.exec(afterTitle)) !== null) {
        result.casts.push(mentionMatch[1])
    }

    var tagMatch
    while ((tagMatch = tagRegex.exec(afterTitle)) !== null) {
        result.tags.push(tagMatch[1])
    }

    return result
}

/**
 * Extract content ID from a processed filename
 *
 * Expected filename format:
 * [Publisher]{Series}(Date) ContentId `Title` SideCasts \@Cast1 \@Cast2 #tag1 #tag2 .extension
 *
 * The content ID is typically:
 * - Between the date/series segment and the title (backtick-wrapped)
 * - A unique identifier like episode number or file ID
 * - Not "HD"
 * - Not containing special formatting characters (brackets, braces, parens, \@, #)
 *
 * Pure ES5 compatible for portability to other runtimes.
 *
 * @param {string} fileName - The processed filename to extract content ID from
 * @returns {string} The extracted content ID, or fallback as string
 */
function extractContentIdOrFallback(fileName) {
    var structure = extractProcessedStructure(fileName)

    if (structure.contentId) {
        return structure.contentId
    }

    // Fallback for edge cases where there's no content ID extracted
    // Return metadata + title if available, otherwise the full filename
    var trimmed = fileName.trim()

    // If we have metadata but no contentId, return metadata + title (without extension)
    if (structure.publisher || structure.series || structure.date) {
        if (structure.title) {
            // Return metadata + title without extension
            var result = ''
            if (structure.publisher) {
                result += '[' + structure.publisher + ']'
            }
            if (structure.series) {
                result += '{' + structure.series + '}'
            }
            if (structure.date) {
                result += '(' + structure.date + ')'
            }
            result += ' `' + structure.title + '`'
            return result
        }
    }

    // Otherwise return the whole filename as-is (with extension if present)
    return trimmed
}

/**
 * Extract title from backticks and remove the backtick wrapping
 *
 * Pure ES5 compatible for portability to other runtimes.
 *
 * @param {string} fileName - The processed filename to extract title from
 * @returns {string} The extracted title without backticks, or empty string if not found
 */
function extractTitle(fileName) {
    var structure = extractProcessedStructure(fileName)
    return structure.title ? structure.title : ''
}

module.exports = {
    extractContentIdOrFallback: extractContentIdOrFallback,
    extractTitle: extractTitle
}