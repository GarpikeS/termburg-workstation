import { useCallback, useEffect, useState } from 'react';
import { getScheduleStreamUrl, loadSchedule, saveSchedule, subscribeToLocalSchedule } from './scheduleRepository';
import type { ScheduleSource } from './scheduleRepository';
import type { ScheduleData } from './types';

export function useSchedule(pollMs = 15000) {
  const [data, setData] = useState<ScheduleData | null>(null);
  const [source, setSource] = useState<ScheduleSource | 'loading'>('loading');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await loadSchedule();
      setData(result.data);
      setSource(result.source);
      setError(null);
      return result.data;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Ошибка загрузки расписания.');
      return null;
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void refresh(), 0);
    const unsubscribe = subscribeToLocalSchedule(next => {
      setData(next);
      setSource(current => current === 'server' || current === 'official' ? current : 'local');
    });
    const interval = window.setInterval(() => void refresh(), pollMs);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
      unsubscribe();
    };
  }, [pollMs, refresh]);

  useEffect(() => {
    if (source !== 'server' || !('EventSource' in window)) return;
    const stream = new EventSource(getScheduleStreamUrl());
    stream.addEventListener('schedule', () => void refresh());
    return () => stream.close();
  }, [refresh, source]);

  const save = useCallback(async (next: ScheduleData) => {
    const result = await saveSchedule(next);
    setData(result.data);
    setSource(result.synced ? 'server' : 'local');
    return result;
  }, []);

  return { data, source, error, refresh, save };
}
