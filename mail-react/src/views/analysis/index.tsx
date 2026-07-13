import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@iconify/react';
import { useUiStore } from '@/store/ui';
import Loading from '@/components/loading';
import echarts from '@/echarts';
import { analysisEcharts } from '@/request/analysis';
import dayjs from 'dayjs';

export default function AnalysisView() {
  const { t } = useTranslation();
  const dark = useUiStore((s) => s.dark);

  const [loading, setLoading] = useState(true);
  const [numbers, setNumbers] = useState({
    receiveTotal: 0,
    sendTotal: 0,
    accountTotal: 0,
    userTotal: 0,
    normalReceiveTotal: 0,
    normalSendTotal: 0,
    normalAccountTotal: 0,
    normalUserTotal: 0,
    delReceiveTotal: 0,
    delSendTotal: 0,
    delAccountTotal: 0,
    delUserTotal: 0,
  });

  const senderPieRef = useRef<HTMLDivElement>(null);
  const increaseLineRef = useRef<HTMLDivElement>(null);
  const emailColumnRef = useRef<HTMLDivElement>(null);
  const sendGaugeRef = useRef<HTMLDivElement>(null);
  const senderPieInst = useRef<any>(null);
  const increaseLineInst = useRef<any>(null);
  const emailColumnInst = useRef<any>(null);
  const sendGaugeInst = useRef<any>(null);

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    analysisEcharts(tz)
      .then((data: any) => {
        setNumbers({
          receiveTotal: data.numberCount?.receiveTotal || 0,
          sendTotal: data.numberCount?.sendTotal || 0,
          accountTotal: data.numberCount?.accountTotal || 0,
          userTotal: data.numberCount?.userTotal || 0,
          normalReceiveTotal: data.numberCount?.normalReceiveTotal || 0,
          normalSendTotal: data.numberCount?.normalSendTotal || 0,
          normalAccountTotal: data.numberCount?.normalAccountTotal || 0,
          normalUserTotal: data.numberCount?.normalUserTotal || 0,
          delReceiveTotal: data.numberCount?.delReceiveTotal || 0,
          delSendTotal: data.numberCount?.delSendTotal || 0,
          delAccountTotal: data.numberCount?.delAccountTotal || 0,
          delUserTotal: data.numberCount?.delUserTotal || 0,
        });
        const senderData = (data.receiveRatio?.nameRatio || []).map((it: any) => ({
          name: it.name || ' ',
          value: it.total,
        }));
        const userX = (data.userDayCount || []).map((it: any) => dayjs(it.date).format('M.D'));
        const userS = (data.userDayCount || []).map((it: any) => it.total);
        const emailDays = (data.emailDayCount?.receiveDayCount || []).map((it: any) =>
          dayjs(it.date).format('M.D'),
        );
        const emailR = (data.emailDayCount?.receiveDayCount || []).map((it: any) => it.total);
        const emailSe = (data.emailDayCount?.sendDayCount || []).map((it: any) => it.total);
        const daySend = data.daySendTotal || 0;
        setLoading(false);
        setTimeout(() => {
          createSenderPie(senderData);
          createIncreaseLine(userX, userS);
          createEmailColumn(emailDays, emailR, emailSe);
          createSendGauge(daySend);
        }, 0);
      })
      .catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading) {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      analysisEcharts(tz).then((data: any) => {
        const senderData = (data.receiveRatio?.nameRatio || []).map((it: any) => ({
          name: it.name || ' ',
          value: it.total,
        }));
        const userX = (data.userDayCount || []).map((it: any) => dayjs(it.date).format('M.D'));
        const userS = (data.userDayCount || []).map((it: any) => it.total);
        const emailDays = (data.emailDayCount?.receiveDayCount || []).map((it: any) =>
          dayjs(it.date).format('M.D'),
        );
        const emailR = (data.emailDayCount?.receiveDayCount || []).map((it: any) => it.total);
        const emailSe = (data.emailDayCount?.sendDayCount || []).map((it: any) => it.total);
        const daySend = data.daySendTotal || 0;
        createSenderPie(senderData);
        createIncreaseLine(userX, userS);
        createEmailColumn(emailDays, emailR, emailSe);
        createSendGauge(daySend);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark]);

  function topic() {
    return {
      color: dark ? 'oklch(0.96 0.003 250)' : 'oklch(0.145 0.005 250)',
      background: dark ? 'oklch(0.165 0.005 250)' : 'oklch(1 0 0)',
      borderColor: dark ? 'oklch(0.165 0.005 250)' : 'oklch(1 0 0)',
      scaleLineColor: dark ? 'oklch(0.45 0.005 250)' : 'oklch(0.85 0.003 250)',
      crossColor: dark ? 'oklch(0.55 0.005 250)' : 'oklch(0.7 0.003 250)',
      axisColor: dark ? 'oklch(0.65 0.005 250)' : 'oklch(0.5 0.003 250)',
      splitLineColor: dark ? 'oklch(0.28 0.005 250)' : 'oklch(0.88 0.003 250)',
      gaugeSplitLine: dark ? 'oklch(0.55 0.005 250)' : 'oklch(0.7 0.003 250)',
      containerBackground: dark ? 'oklch(0.28 0.005 250)' : 'oklch(0.94 0.003 250)',
    };
  }

  function createSenderPie(data: any[]) {
    if (!senderPieRef.current) return;
    if (senderPieInst.current) senderPieInst.current.dispose();
    senderPieInst.current = echarts.init(senderPieRef.current);
    const left = window.innerWidth < 500 ? `${window.innerWidth - 110}` : '65%';
    senderPieInst.current.setOption({
      tooltip: {
        trigger: 'item',
        backgroundColor: topic().background,
        textStyle: { color: topic().color },
        borderWidth: 0,
      },
      legend: {
        type: 'scroll',
        orient: 'vertical',
        left: 8,
        top: 'middle',
        textStyle: { color: topic().color, fontSize: 12 },
        itemWidth: 8,
        itemHeight: 8,
        itemGap: 12,
      },
      series: [
        {
          data,
          type: 'pie',
          radius: ['52%', '78%'],
          center: [left, '50%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 2, borderColor: topic().borderColor, borderWidth: 2 },
          label: { show: false },
          emphasis: { label: { show: false }, scale: true, scaleSize: 4 },
          color: ['oklch(0.6 0.18 250)', 'oklch(0.7 0.18 152)', 'oklch(0.78 0.16 75)', 'oklch(0.7 0.2 25)', 'oklch(0.7 0.18 320)', 'oklch(0.72 0.12 200)'],
        },
      ],
    });
  }

  function createIncreaseLine(x: string[], s: number[]) {
    if (!increaseLineRef.current) return;
    if (increaseLineInst.current) increaseLineInst.current.dispose();
    increaseLineInst.current = echarts.init(increaseLineRef.current);
    increaseLineInst.current.setOption({
      tooltip: {
        trigger: 'axis',
        backgroundColor: topic().background,
        textStyle: { color: topic().color },
        borderColor: topic().splitLineColor,
        borderWidth: 1,
      },
      grid: { top: '8%', right: 16, left: 36, bottom: 32 },
      xAxis: {
        type: 'category',
        data: x,
        axisLine: { lineStyle: { color: topic().axisColor } },
        axisTick: { show: false },
        axisLabel: { color: topic().axisColor, fontSize: 11 },
        boundaryGap: false,
      },
      yAxis: {
        type: 'value',
        max: (p: any) => (p.max < 8 ? 10 : undefined),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: topic().axisColor, fontSize: 11 },
        splitLine: { lineStyle: { type: 'dashed', color: topic().scaleLineColor } },
      },
      series: [
        {
          data: s,
          type: 'line',
          smooth: 0.1,
          symbol: 'none',
          lineStyle: { color: 'oklch(0.6 0.18 250)', width: 2 },
          areaStyle: {
            color: new (echarts as any).graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'oklch(0.6 0.18 250 / 0.2)' },
              { offset: 1, color: 'oklch(0.6 0.18 250 / 0)' },
            ]),
          },
        },
      ],
    });
  }

  function createEmailColumn(days: string[], receive: number[], send: number[]) {
    if (!emailColumnRef.current) return;
    if (emailColumnInst.current) emailColumnInst.current.dispose();
    emailColumnInst.current = echarts.init(emailColumnRef.current);
    emailColumnInst.current.setOption({
      tooltip: {
        backgroundColor: topic().background,
        textStyle: { color: topic().color },
        borderWidth: 1,
        borderColor: topic().splitLineColor,
      },
      legend: {
        data: [t('emailReceived'), t('emailSent')],
        top: 0,
        textStyle: { color: topic().color, fontSize: 12 },
        itemWidth: 10,
        itemHeight: 10,
        icon: 'roundRect',
      },
      grid: { left: 8, right: 16, bottom: 28, top: 44, containLabel: true },
      xAxis: {
        type: 'category',
        data: days,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: topic().axisColor, fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        max: (p: any) => (p.max < 8 ? 10 : undefined),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: topic().axisColor, fontSize: 11 },
        splitLine: { lineStyle: { type: 'dashed', color: topic().splitLineColor } },
      },
      series: [
        {
          name: t('emailReceived'),
          type: 'bar',
          stack: 'total',
          barMaxWidth: 18,
          data: receive,
          itemStyle: { color: 'oklch(0.6 0.18 250)', borderRadius: [0, 0, 0, 0] },
        },
        {
          name: t('emailSent'),
          type: 'bar',
          stack: 'total',
          barMaxWidth: 18,
          data: send,
          itemStyle: { color: 'oklch(0.7 0.18 152)', borderRadius: [2, 2, 0, 0] },
        },
      ],
    });
  }

  function createSendGauge(value: number) {
    if (!sendGaugeRef.current) return;
    if (sendGaugeInst.current) sendGaugeInst.current.dispose();
    sendGaugeInst.current = echarts.init(sendGaugeRef.current);
    sendGaugeInst.current.setOption({
      tooltip: { backgroundColor: topic().background, textStyle: { color: topic().color } },
      series: [
        {
          type: 'gauge',
          max: 100,
          progress: { show: true, roundCap: true, itemStyle: { color: 'oklch(0.6 0.18 250)' } },
          pointer: { show: false },
          axisLabel: { color: topic().gaugeSplitLine, fontSize: 10, distance: -28 },
          axisLine: { roundCap: true, lineStyle: { color: [[1, topic().containerBackground]], width: 8 } },
          splitLine: { show: false },
          axisTick: { show: false },
          anchor: { show: false },
          title: { show: false },
          detail: {
            valueAnimation: true,
            formatter: (val: number) => Math.round(val).toString(),
            color: topic().color,
            fontSize: 32,
            fontWeight: 600,
            fontFamily: 'Geist Mono, ui-monospace, monospace',
            offsetCenter: [0, 0],
          },
          data: [{ value }],
        },
      ],
    });
  }

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loading />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-h1 text-foreground">{t('analytics')}</h1>
          <p className="mt-1 text-[12px] text-muted-foreground">{t('analyticsSubtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <NumberCard
          label={t('totalReceived')}
          value={numbers.receiveTotal}
          normal={numbers.normalReceiveTotal}
          del={numbers.delReceiveTotal}
          icon="hugeicons:mailbox-01"
        />
        <NumberCard
          label={t('totalSent')}
          value={numbers.sendTotal}
          normal={numbers.normalSendTotal}
          del={numbers.delSendTotal}
          icon="cil:send"
        />
        <NumberCard
          label={t('totalMailboxes')}
          value={numbers.accountTotal}
          normal={numbers.normalAccountTotal}
          del={numbers.delAccountTotal}
          icon="lets-icons:e-mail"
        />
        <NumberCard
          label={t('totalUsers')}
          value={numbers.userTotal}
          normal={numbers.normalUserTotal}
          del={numbers.delUserTotal}
          icon="iconoir:user"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartPanel title={t('emailSource')}>
          <div ref={senderPieRef} className="h-[300px] w-full" />
        </ChartPanel>
        <ChartPanel title={t('userGrowth')}>
          <div ref={increaseLineRef} className="h-[300px] w-full" />
        </ChartPanel>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <ChartPanel title={t('emailGrowth')} className="lg:col-span-2">
          <div ref={emailColumnRef} className="h-[300px] w-full" />
        </ChartPanel>
        <ChartPanel title={t('sentToday')}>
          <div ref={sendGaugeRef} className="h-[300px] w-full" />
        </ChartPanel>
      </div>
    </div>
  );
}

function NumberCard({
  label,
  value,
  normal,
  del,
  icon,
}: {
  label: string;
  value: number;
  normal: number;
  del: number;
  icon: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-eyebrow">{label}</div>
          <div className="mt-2 font-mono text-[28px] font-semibold leading-none tracking-tight tabular-nums text-foreground">
            {Math.round(value).toLocaleString()}
          </div>
        </div>
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-muted-foreground">
          <Icon icon={icon} width={16} height={16} />
        </span>
      </div>
      <div className="mt-4 flex items-center gap-3 text-[11px] tabular-nums">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          <span className="text-muted-foreground">Active</span>
          <span className="font-mono font-medium text-foreground">{normal.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
          <span className="text-muted-foreground">Deleted</span>
          <span className="font-mono font-medium text-foreground">{del.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

function ChartPanel({
  title,
  children,
  className = '',
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-border bg-card p-4 ${className}`}>
      <div className="mb-3 text-[12px] font-medium text-foreground">{title}</div>
      {children}
    </div>
  );
}