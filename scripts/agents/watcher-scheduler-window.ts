export function watcherScheduleWindow(now:Date):string {
 const hour=now.getUTCHours();
 if(![11,23].includes(hour)||now.getUTCMinutes()>15)
   throw new Error('WATCHER_SCHEDULER_OUTSIDE_WINDOW');
 return now.toISOString().slice(0,13)+':00:00+00:00';
}
