import http, { unwrap } from './http';

export function analysisEcharts(timeZone: string): Promise<{
  sender: { name: string; value: number }[];
  totalUser: { dateList: string[]; dataList: number[] };
  totalEmail: { dateList: string[]; receivedList: number[]; sentList: number[] };
  sentToday: number;
}> {
  return unwrap(
    http.get('/analysis/echarts', { params: { timeZone } }),
  );
}