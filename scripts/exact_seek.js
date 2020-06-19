//@ts-check

mp.register_script_message('seek-interval', function (interval)
{
   interval = Number(interval)
   /** @type {number} */
   var time_pos = Math.floor(mp.get_property_number("time-pos"));
   var offset = time_pos % interval;
   var seek_time = (interval - offset) + time_pos

   // if (seek_time < time_pos && offset > 1)
   // {
   //    seek_time = seek_time - interval
   // }

   mp.commandv("seek", seek_time, "absolute+exact");
});
