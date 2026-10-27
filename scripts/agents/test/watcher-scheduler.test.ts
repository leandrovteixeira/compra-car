import {describe,it,expect} from 'vitest';
import {watcherScheduleWindow} from '../watcher-scheduler-cli';
describe('Watcher scheduler UTC schedule admission',()=>{
 it('allows the 08h Sao Paulo window',()=>{
  expect(watcherScheduleWindow(new Date('2026-10-28T11:00:00Z')))
   .toBe('2026-10-28T11:00:00+00:00');
 });
 it('allows the 20h Sao Paulo window',()=>{
  expect(watcherScheduleWindow(new Date('2026-10-28T23:00:00Z')))
   .toBe('2026-10-28T23:00:00+00:00');
 });
 it('rejects off-schedule runs',()=>{
  expect(()=>watcherScheduleWindow(new Date('2026-10-28T16:30:00Z')))
   .toThrow('WATCHER_SCHEDULER_OUTSIDE_WINDOW');
 });
});
