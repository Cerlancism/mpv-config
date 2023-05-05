//@ts-check

mp.register_script_message('cycle-video', function ()
{
   /**
    * @type {any[]}
    */
   //@ts-ignore
   var tracklist = JSON.parse(mp.get_property("track-list"))
   print("video track " + tracklist)
   var videoTrackCount = tracklist.filter(function (x)
   {
      return x.type === "video"
   }).length
   print("video counts " + videoTrackCount)
   //@ts-ignore
   var trackNumber = mp.get_property_number("video")
   trackNumber = trackNumber + 1

   if (trackNumber > videoTrackCount)
   {
      trackNumber = 1
   }

   //@ts-ignore
   mp.set_property("video", trackNumber)

   //@ts-ignore
   trackNumber = mp.get_property_number("video")

   print("video track " + trackNumber)
});
