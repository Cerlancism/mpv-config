if (!String.prototype.includes)
{
    String.prototype.includes = function (search, start)
    {
        'use strict';

        if (search instanceof RegExp)
        {
            throw TypeError('first argument must not be a RegExp');
        }
        if (start === undefined) { start = 0; }
        return this.indexOf(search, start) !== -1;
    };
}

if (!String.prototype.endsWith)
{
    String.prototype.endsWith = function (search, this_len)
    {
        if (this_len === undefined || this_len > this.length)
        {
            this_len = this.length;
        }
        return this.substring(this_len - search.length, this_len) === search;
    };
}

module.exports = {}
