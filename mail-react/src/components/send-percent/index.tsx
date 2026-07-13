import { Icon } from '@iconify/react';

interface SendPercentProps {
  value: number | string;
  desc?: string;
}

export default function SendPercent({ value, desc }: SendPercentProps) {
  return (
    <div className="flex gap-[10px]">
      <Icon icon="line-md:loading-loop" width="18" height="18" />
      <div>
        <span>{value}%</span>
        {desc && <span className="ml-[5px]">{desc}</span>}
      </div>
    </div>
  );
}
